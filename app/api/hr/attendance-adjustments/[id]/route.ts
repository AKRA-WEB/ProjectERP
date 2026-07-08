import { NextRequest } from 'next/server';
import { auth } from '@/auth';
import pool from '@/lib/db/client';
import { apiSuccess, apiError, apiValidationError } from '@/lib/api-response';
import { z } from 'zod';
import { assertRole, type SessionUser } from '@/lib/authz';
import { resolveAttendanceReview } from '@/lib/hr/attendance-adjustments';
import type { AttendanceAdjReq } from '@/lib/hr/attendance-adjustments';
import { isEmployeeInScope } from '@/lib/hr/employee-profile-access';

const ReviewSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('approve'), review_note: z.string().nullable().optional() }),
  z.object({ action: z.literal('reject'), review_note: z.string().min(1) }),
]);

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;
  try { assertRole(u, ['manager', 'admin']); } catch { return apiError('Forbidden', 403); }
  const { id } = await params;

  const body = await req.json();
  const parsed = ReviewSchema.safeParse(body);
  if (!parsed.success) return apiValidationError(parsed.error);

  const d = parsed.data;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const reqRow = await client.query<AttendanceAdjReq & { attendance_record_id: string | null }>(
      `SELECT * FROM attendance_adjustment_requests WHERE id = $1 AND status = 'submitted' FOR UPDATE`,
      [id]
    );
    if (!reqRow.rows[0]) {
      await client.query('ROLLBACK');
      return apiError('Request not found or not in submitted state', 404);
    }

    const request = reqRow.rows[0];

    // Manager: verify the request's employee is in scope
    if (u.role === 'manager') {
      const inScope = await isEmployeeInScope(u, request.employee_id);
      if (!inScope) {
        await client.query('ROLLBACK');
        return apiError('Forbidden', 403);
      }
    }

    let mutation;
    try {
      const existingRecord = request.attendance_record_id
        ? { id: request.attendance_record_id }
        : null;
      mutation = resolveAttendanceReview(d.action, u.id, request, existingRecord);
    } catch (e) {
      await client.query('ROLLBACK');
      return apiError((e as Error).message, 403);
    }

    if (mutation) {
      if (mutation.action === 'update') {
        const sets: string[] = [];
        const vals: unknown[] = [];
        let idx = 1;
        if (mutation.data.clock_in !== undefined) { sets.push(`clock_in = $${idx++}`); vals.push(mutation.data.clock_in); }
        if (mutation.data.clock_out !== undefined) { sets.push(`clock_out = $${idx++}`); vals.push(mutation.data.clock_out); }
        if (mutation.data.status !== null) { sets.push(`status = $${idx++}`); vals.push(mutation.data.status); }
        if (mutation.data.ot_hours !== null) { sets.push(`ot_hours = $${idx++}`); vals.push(mutation.data.ot_hours); }
        sets.push(`note = $${idx++}`); vals.push(mutation.data.note);
        // Include employee_id + work_date to prevent cross-employee record mutation
        vals.push(request.attendance_record_id, request.employee_id, request.work_date);
        if (sets.length > 1) {
          await client.query(
            `UPDATE attendance_records SET ${sets.join(', ')}
             WHERE id = $${idx} AND employee_id = $${idx + 1} AND work_date = $${idx + 2}`,
            vals
          );
        }
      } else {
        await client.query(
          `INSERT INTO attendance_records (employee_id, work_date, clock_in, clock_out, status, ot_hours, note)
           VALUES ($1,$2,$3,$4,COALESCE($5,'present'),$6,$7)
           ON CONFLICT (employee_id, work_date) DO UPDATE
             SET clock_in = EXCLUDED.clock_in, clock_out = EXCLUDED.clock_out,
                 status = COALESCE(EXCLUDED.status, attendance_records.status),
                 ot_hours = COALESCE(EXCLUDED.ot_hours, attendance_records.ot_hours),
                 note = EXCLUDED.note`,
          [
            mutation.data.employee_id, mutation.data.work_date,
            mutation.data.clock_in, mutation.data.clock_out,
            mutation.data.status, mutation.data.ot_hours ?? 0, mutation.data.note,
          ]
        );
      }
    }

    await client.query(
      `UPDATE attendance_adjustment_requests
       SET status = $1, reviewed_by_user_id = $2, reviewed_at = NOW(), review_note = $3
       WHERE id = $4`,
      [d.action === 'approve' ? 'approved' : 'rejected', u.id,
       (d as { review_note?: string | null }).review_note ?? null, id]
    );

    await client.query(
      `INSERT INTO hr_employee_audit_events (employee_id, actor_user_id, event_type, event_payload_json)
       VALUES ($1,$2,'ATTENDANCE_ADJUSTMENT_REVIEWED',$3)`,
      [request.employee_id, u.id, JSON.stringify({
        request_id: id,
        action: d.action,
        work_date: request.work_date,
      })]
    );

    await client.query('COMMIT');
    return apiSuccess({ ok: true });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    return apiError('Failed to review adjustment', 500);
  } finally {
    client.release();
  }
}

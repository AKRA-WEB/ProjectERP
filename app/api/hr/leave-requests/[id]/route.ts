import { NextRequest } from 'next/server';
import { auth } from '@/auth';
import pool, { queryOne } from '@/lib/db/client';
import { apiSuccess, apiError } from '@/lib/api-response';
import { z } from 'zod';
import { assertRole, SessionUser } from '@/lib/authz';

const ActionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('submit') }),
  z.object({ action: z.literal('approve') }),
  z.object({ action: z.literal('reject'), reject_reason: z.string().min(1) }),
  z.object({ action: z.literal('cancel') }),
]);

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const { id } = await params;

  const row = await queryOne(`
    SELECT lr.*, 
      u.name_th AS employee_name_th, u.name_en AS employee_name_en,
      lt.name_th AS leave_type_name_th, lt.name_en AS leave_type_name_en,
      a.name_th AS approved_by_name_th, a.name_en AS approved_by_name_en
    FROM leave_requests lr
    JOIN users u ON u.id = lr.employee_id
    JOIN leave_types lt ON lt.id = lr.leave_type_id
    LEFT JOIN users a ON a.id = lr.approved_by
    WHERE lr.id = $1
  `, [id]);
  if (!row) return apiError('Not found', 404);
  return apiSuccess(row);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;
  const { id } = await params;

  const body = await req.json();
  const parsed = ActionSchema.safeParse(body);
  if (!parsed.success) return apiError(parsed.error.message, 400);

  const lr = await queryOne<{ status: string; employee_id: string; leave_type_id: string; days_requested: number; start_date: string }>(
    `SELECT status, employee_id, leave_type_id, days_requested, start_date FROM leave_requests WHERE id = $1`, [id]
  );
  if (!lr) return apiError('Not found', 404);

  const { action } = parsed.data;

  if (action === 'submit') {
    if (lr.status !== 'draft') return apiError('Can only submit draft requests', 400);
    await queryOne(`UPDATE leave_requests SET status = 'submitted' WHERE id = $1`, [id]);
  }

  if (action === 'approve') {
    try { assertRole(u, ['manager', 'admin']); } catch { return apiError('Forbidden', 403); }
    if (lr.status !== 'submitted') return apiError('Can only approve submitted requests', 400);
    if (lr.employee_id === u.id) return apiError('Cannot approve own leave request', 403);

    const year = new Date(lr.start_date).getFullYear();
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `UPDATE leave_requests SET status='approved', approved_by=$1, approved_at=NOW() WHERE id=$2`,
        [u.id, id]
      );
      // Upsert balance and increment days_used
      await client.query(`
        INSERT INTO leave_balances (employee_id, leave_type_id, year, days_entitled, days_used)
        VALUES ($1, $2, $3,
          (SELECT days_per_year FROM leave_types WHERE id = $2),
          $4
        )
        ON CONFLICT (employee_id, leave_type_id, year)
        DO UPDATE SET days_used = leave_balances.days_used + $4
      `, [lr.employee_id, lr.leave_type_id, year, lr.days_requested]);
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }

  if (action === 'reject') {
    try { assertRole(u, ['manager', 'admin']); } catch { return apiError('Forbidden', 403); }
    if (lr.status !== 'submitted') return apiError('Can only reject submitted requests', 400);
    const d = parsed.data as { action: 'reject'; reject_reason: string };
    await queryOne(
      `UPDATE leave_requests 
       SET status = 'rejected', approved_by = $1, reject_reason = $2, updated_at = NOW() 
       WHERE id = $3 AND status = 'submitted'
       RETURNING id`,
      [u.id, d.reject_reason, id]
    );
  }

  if (action === 'cancel') {
    if (lr.employee_id !== u.id && u.role !== 'admin') return apiError('Forbidden', 403);
    if (!['draft','submitted'].includes(lr.status)) return apiError('Cannot cancel this request', 400);
    await queryOne(`UPDATE leave_requests SET status='cancelled' WHERE id=$1`, [id]);
  }

  return apiSuccess({ ok: true });
}

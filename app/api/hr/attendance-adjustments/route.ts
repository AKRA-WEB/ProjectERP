import { NextRequest } from 'next/server';
import { auth } from '@/auth';
import { query, queryOne } from '@/lib/db/client';
import { apiSuccess, apiError, apiValidationError } from '@/lib/api-response';
import { z } from 'zod';
import { buildWarehouseScopeClause, type SessionUser } from '@/lib/authz';
import { isEmployeeInScope } from '@/lib/hr/employee-profile-access';

const CreateSchema = z.object({
  employee_id: z.string().uuid().optional(),
  attendance_record_id: z.string().uuid().nullable().optional(),
  work_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  requested_clock_in: z.string().nullable().optional(),
  requested_clock_out: z.string().nullable().optional(),
  requested_status: z.enum(['present', 'absent', 'late', 'half_day', 'holiday']).nullable().optional(),
  requested_ot_hours: z.number().min(0).nullable().optional(),
  reason: z.string().min(1),
});

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;

  const sp = new URL(req.url).searchParams;
  const status = sp.get('status');
  const page = Math.max(1, parseInt(sp.get('page') ?? '1'));
  const pageSize = Math.min(100, Math.max(1, parseInt(sp.get('pageSize') ?? '20')));
  const offset = (page - 1) * pageSize;

  const conditions: string[] = [];
  const vals: unknown[] = [];
  let idx = 1;

  // Staff: own requests only
  if (u.role === 'staff') {
    conditions.push(`aar.employee_id = $${idx++}`);
    vals.push(u.id);
  }

  // Manager: scope to employees sharing warehouse assignment
  if (u.role === 'manager') {
    const scope = buildWarehouseScopeClause(u, 'uwa.warehouse_id', idx);
    if (scope?.clause === 'FALSE') return apiSuccess([]);
    if (scope) {
      conditions.push(
        `EXISTS (SELECT 1 FROM user_warehouse_assignments uwa WHERE uwa.user_id = aar.employee_id AND ${scope.clause})`
      );
      vals.push(...scope.params);
      idx += scope.params.length;
    }
  }

  if (status) {
    conditions.push(`aar.status = $${idx++}`);
    vals.push(status);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  vals.push(pageSize, offset);

  const rows = await query(
    `SELECT aar.*, u.name_th AS employee_name_th
     FROM attendance_adjustment_requests aar
     LEFT JOIN users u ON u.id = aar.employee_id
     ${where}
     ORDER BY aar.created_at DESC
     LIMIT $${idx} OFFSET $${idx + 1}`,
    vals
  );
  return apiSuccess(rows);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;

  const body = await req.json();
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) return apiValidationError(parsed.error);

  const d = parsed.data;

  // Staff can only create requests for self
  const targetEmployeeId = u.role === 'staff' ? u.id : (d.employee_id ?? u.id);
  if (u.role === 'staff' && d.employee_id && d.employee_id !== u.id) {
    return apiError('Staff can only submit adjustment requests for themselves', 403);
  }

  // Manager: verify target employee is in scope
  if (u.role === 'manager') {
    const inScope = await isEmployeeInScope(u, targetEmployeeId);
    if (!inScope) return apiError('Forbidden', 403);
  }

  // If attendance_record_id provided, verify it belongs to the target employee and work_date
  if (d.attendance_record_id) {
    const rec = await queryOne(
      `SELECT id FROM attendance_records WHERE id = $1 AND employee_id = $2 AND work_date = $3`,
      [d.attendance_record_id, targetEmployeeId, d.work_date]
    );
    if (!rec) return apiError('attendance_record_id does not match employee or work_date', 400);
  }

  const row = await queryOne<{ id: string; request_number: string }>(
    `INSERT INTO attendance_adjustment_requests
       (employee_id, attendance_record_id, work_date, requested_clock_in, requested_clock_out,
        requested_status, requested_ot_hours, reason)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id, request_number`,
    [
      targetEmployeeId,
      d.attendance_record_id ?? null,
      d.work_date,
      d.requested_clock_in ?? null,
      d.requested_clock_out ?? null,
      d.requested_status ?? null,
      d.requested_ot_hours ?? null,
      d.reason,
    ]
  );
  return apiSuccess({ id: row?.id, request_number: row?.request_number });
}

import { NextRequest } from 'next/server';
import { auth } from '@/auth';
import pool, { query } from '@/lib/db/client';
import { apiSuccess, apiError, apiValidationError } from '@/lib/api-response';
import { z } from 'zod';
import { assertRole, buildWarehouseScopeClause, type SessionUser } from '@/lib/authz';
import { computeLeaveAdjustment } from '@/lib/hr/leave-balance-adjustments';
import { isEmployeeInScope } from '@/lib/hr/employee-profile-access';

const CreateSchema = z.object({
  employee_id: z.string().uuid(),
  leave_type_id: z.string().uuid(),
  year: z.number().int().min(2000).max(2100),
  adjustment_kind: z.enum(['entitlement', 'used_correction']),
  delta_days: z.number(),
  reason: z.string().min(1),
});

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;
  try { assertRole(u, ['manager', 'admin']); } catch { return apiError('Forbidden', 403); }

  const sp = new URL(req.url).searchParams;
  const employeeId = sp.get('employee_id');
  const year = sp.get('year') ? parseInt(sp.get('year')!) : new Date().getFullYear();
  const page = Math.max(1, parseInt(sp.get('page') ?? '1'));
  const pageSize = Math.min(100, Math.max(1, parseInt(sp.get('pageSize') ?? '20')));
  const offset = (page - 1) * pageSize;

  const conditions: string[] = ['1=1'];
  const vals: unknown[] = [];
  let idx = 1;
  if (employeeId) { conditions.push(`lba.employee_id = $${idx++}`); vals.push(employeeId); }
  conditions.push(`lba.year = $${idx++}`); vals.push(year);

  // Manager: scope to employees sharing warehouse assignment
  if (u.role === 'manager') {
    const scope = buildWarehouseScopeClause(u, 'uwa.warehouse_id', idx);
    if (scope?.clause === 'FALSE') return apiSuccess([]);
    if (scope) {
      conditions.push(
        `EXISTS (SELECT 1 FROM user_warehouse_assignments uwa WHERE uwa.user_id = lba.employee_id AND ${scope.clause})`
      );
      vals.push(...scope.params);
      idx += scope.params.length;
    }
  }

  const where = conditions.join(' AND ');
  vals.push(pageSize, offset);

  const rows = await query(
    `SELECT lba.*, lt.name_th AS leave_type_name_th, u.name_th AS adjusted_by_name_th
     FROM leave_balance_adjustments lba
     JOIN leave_types lt ON lt.id = lba.leave_type_id
     LEFT JOIN users u ON u.id = lba.adjusted_by_user_id
     WHERE ${where}
     ORDER BY lba.created_at DESC
     LIMIT $${idx} OFFSET $${idx + 1}`,
    vals
  );
  return apiSuccess(rows);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;
  try { assertRole(u, ['manager', 'admin']); } catch { return apiError('Forbidden', 403); }

  const body = await req.json();
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) return apiValidationError(parsed.error);

  const d = parsed.data;

  const inScope = await isEmployeeInScope(u, d.employee_id);
  if (!inScope) return apiError('Forbidden', 403);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const balanceRow = await client.query<{
      id: string;
      days_entitled: string;
      days_used: string;
    }>(
      `SELECT id, days_entitled, days_used FROM leave_balances
       WHERE employee_id = $1 AND leave_type_id = $2 AND year = $3 FOR UPDATE`,
      [d.employee_id, d.leave_type_id, d.year]
    );

    if (!balanceRow.rows[0]) {
      await client.query('ROLLBACK');
      return apiError('Leave balance record not found for this employee/type/year', 404);
    }

    const state = {
      days_entitled: Number(balanceRow.rows[0].days_entitled),
      days_used: Number(balanceRow.rows[0].days_used),
    };

    let before: number;
    let after: number;
    try {
      ({ before, after } = computeLeaveAdjustment(d.adjustment_kind, state, d.delta_days, d.reason));
    } catch (e) {
      await client.query('ROLLBACK');
      return apiError((e as Error).message, 400);
    }

    const updateField = d.adjustment_kind === 'entitlement' ? 'days_entitled' : 'days_used';
    await client.query(
      `UPDATE leave_balances SET ${updateField} = $1 WHERE id = $2`,
      [after, balanceRow.rows[0].id]
    );

    const adjRow = await client.query<{ id: string }>(
      `INSERT INTO leave_balance_adjustments
         (employee_id, leave_type_id, year, adjustment_kind, delta_days, balance_before, balance_after, reason, adjusted_by_user_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
      [d.employee_id, d.leave_type_id, d.year, d.adjustment_kind,
       d.delta_days, before, after, d.reason, u.id]
    );

    await client.query(
      `INSERT INTO hr_employee_audit_events (employee_id, actor_user_id, event_type, event_payload_json)
       VALUES ($1,$2,'LEAVE_BALANCE_ADJUSTED',$3)`,
      [d.employee_id, u.id, JSON.stringify({
        adjustment_id: adjRow.rows[0].id,
        kind: d.adjustment_kind,
        delta_days: d.delta_days,
        before,
        after,
        reason: d.reason,
      })]
    );

    await client.query('COMMIT');
    return apiSuccess({ id: adjRow.rows[0].id });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    return apiError('Failed to create adjustment', 500);
  } finally {
    client.release();
  }
}

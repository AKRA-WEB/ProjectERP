import { NextRequest } from 'next/server';
import { auth } from '@/auth';
import pool, { queryOne } from '@/lib/db/client';
import { apiSuccess, apiError } from '@/lib/api-response';
import { z } from 'zod';
import { assertRole, type SessionUser } from '@/lib/authz';
import { isEmployeeInScope, canSeeSalary } from '@/lib/hr/employee-profile-access';

const PatchSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('update'),
    employee_id: z.string().max(50).optional(),
    department_id: z.string().uuid().nullable().optional(),
    position_id: z.string().uuid().nullable().optional(),
    salary_grade_id: z.string().uuid().nullable().optional(),
    base_salary: z.number().min(0).nullable().optional(),
    employment_type: z.enum(['full_time', 'part_time', 'contract']).optional(),
    hired_date: z.string().nullable().optional(),
    phone: z.string().nullable().optional(),
  }),
  z.object({
    action: z.literal('set_status'),
    employee_status: z.enum(['active', 'inactive', 'resigned']),
    resignation_date: z.string().nullable().optional(),
    reason: z.string().min(1),
  }),
]);

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;
  const { id } = await params;

  if (u.role === 'staff' && u.id !== id) return apiError('Forbidden', 403);
  if (u.role === 'manager') {
    const inScope = await isEmployeeInScope(u, id);
    if (!inScope) return apiError('Not found', 404);
  }

  const showSalary = canSeeSalary(u);
  const row = await queryOne<Record<string, unknown>>(`
    SELECT
      u.id, u.employee_id, u.name_th, u.name_en, u.email, u.phone, u.role,
      u.department_id, d.name_th AS department_name_th, d.name_en AS department_name_en,
      u.position_id, p.name_th AS position_name_th, p.name_en AS position_name_en,
      u.employment_type, u.employee_status, u.hired_date, u.resignation_date, u.created_at
      ${showSalary
        ? ', u.salary_grade_id, sg.name_th AS salary_grade_name, sg.base_salary_min, sg.base_salary_max, u.base_salary'
        : ', NULL AS salary_grade_id, NULL AS salary_grade_name, NULL::numeric AS base_salary_min, NULL::numeric AS base_salary_max, NULL::numeric AS base_salary'}
    FROM users u
    LEFT JOIN departments d ON d.id = u.department_id
    LEFT JOIN positions p ON p.id = u.position_id
    LEFT JOIN salary_grades sg ON sg.id = u.salary_grade_id
    WHERE u.id = $1
  `, [id]);
  if (!row) return apiError('Not found', 404);
  return apiSuccess(row);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;
  try { assertRole(u, ['manager', 'admin']); } catch { return apiError('Forbidden', 403); }
  const { id } = await params;

  if (u.role === 'manager') {
    const inScope = await isEmployeeInScope(u, id);
    if (!inScope) return apiError('Forbidden', 403);
  }

  const body = await req.json();
  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) return apiError(parsed.error.message, 400);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    if (parsed.data.action === 'update') {
      const d = parsed.data;
      const sets: string[] = [];
      const vals: unknown[] = [];
      let idx = 1;

      // Salary updates restricted to admin; status changes must use set_status action
      const salaryFields = ['salary_grade_id', 'base_salary'] as const;
      const generalFields = ['employee_id', 'department_id', 'position_id',
        'employment_type', 'hired_date', 'phone'] as const;

      for (const f of generalFields) {
        if (d[f] !== undefined) { sets.push(`${f} = $${idx++}`); vals.push(d[f]); }
      }
      if (u.role === 'admin') {
        for (const f of salaryFields) {
          if (d[f] !== undefined) { sets.push(`${f} = $${idx++}`); vals.push(d[f]); }
        }
      }

      if (sets.length === 0) {
        await client.query('ROLLBACK');
        return apiError('No fields to update', 400);
      }

      const before = await client.query('SELECT * FROM users WHERE id = $1 FOR UPDATE', [id]);
      if (!before.rows[0]) {
        await client.query('ROLLBACK');
        return apiError('Employee not found', 404);
      }

      vals.push(id);
      await client.query(`UPDATE users SET ${sets.join(', ')} WHERE id = $${idx}`, vals);

      const changed: Record<string, { before: unknown; after: unknown }> = {};
      const allFields = [...generalFields, ...(u.role === 'admin' ? salaryFields : [])];
      for (const f of allFields) {
        if (d[f] !== undefined && d[f] !== before.rows[0][f]) {
          changed[f] = { before: before.rows[0][f], after: d[f] };
        }
      }

      await client.query(
        `INSERT INTO hr_employee_audit_events (employee_id, actor_user_id, event_type, event_payload_json)
         VALUES ($1, $2, 'PROFILE_UPDATED', $3)`,
        [id, u.id, JSON.stringify({ changed })]
      );
    } else if (parsed.data.action === 'set_status') {
      const d = parsed.data;

      const before = await client.query('SELECT employee_status FROM users WHERE id = $1 FOR UPDATE', [id]);
      if (!before.rows[0]) {
        await client.query('ROLLBACK');
        return apiError('Employee not found', 404);
      }

      const prevStatus = before.rows[0].employee_status;
      await client.query(
        `UPDATE users SET employee_status = $1, resignation_date = $2 WHERE id = $3`,
        [d.employee_status, d.resignation_date ?? null, id]
      );

      await client.query(
        `INSERT INTO hr_employee_audit_events (employee_id, actor_user_id, event_type, event_payload_json)
         VALUES ($1, $2, 'STATUS_CHANGED', $3)`,
        [id, u.id, JSON.stringify({
          before: prevStatus,
          after: d.employee_status,
          reason: d.reason,
        })]
      );
    }

    await client.query('COMMIT');
    return apiSuccess({ ok: true });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    return apiError('Update failed', 500);
  } finally {
    client.release();
  }
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;
  try { assertRole(u, ['admin']); } catch { return apiError('Forbidden', 403); }
  const { id } = await params;

  if (id === u.id) return apiError('Cannot delete yourself', 400);

  try {
    await queryOne('DELETE FROM users WHERE id = $1', [id]);
    return apiSuccess({ ok: true });
  } catch (err) {
    console.error(err);
    return apiError('Failed to delete employee. They may have related records (PO, GRN, etc).', 409);
  }
}

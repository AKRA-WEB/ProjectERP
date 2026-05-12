import { NextRequest } from 'next/server';
import { auth } from '@/auth';
import { query, pool } from '@/lib/db/client';
import { apiSuccess, apiError } from '@/lib/api-response';
import { z } from 'zod';
import type { SessionUser } from '@/lib/authz';

const CreateSchema = z.object({
  period_month: z.number().min(1).max(12),
  period_year: z.number().min(2024),
});

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const { searchParams } = new URL(req.url);
  const year = searchParams.get('year') ?? String(new Date().getFullYear());

  const rows = await query(`
    SELECT pr.*, u.name AS created_by_name
    FROM payroll_runs pr
    JOIN users u ON u.id = pr.created_by
    WHERE pr.period_year = $1
    ORDER BY pr.period_month DESC
  `, [year]);
  return apiSuccess(rows);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;
  if (!['admin', 'manager'].includes(u.role)) return apiError('Forbidden', 403);

  const body = await req.json();
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) return apiError(parsed.error.message, 400);
  const { period_month, period_year } = parsed.data;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    const { rows } = await client.query(
      `INSERT INTO payroll_runs (period_month, period_year, created_by)
       VALUES ($1, $2, $3) RETURNING id`,
      [period_month, period_year, u.id]
    );
    const runId = rows[0].id;

    // Generate lines for all active employees
    await client.query(`
      INSERT INTO payroll_lines (run_id, employee_id, base_salary, gross_pay, sso_employee, sso_employer, net_pay)
      SELECT
        $1, id, base_salary, base_salary,
        GREATEST(0, LEAST(750, base_salary * 0.05)),
        GREATEST(0, LEAST(750, base_salary * 0.05)),
        base_salary - GREATEST(0, LEAST(750, base_salary * 0.05))
      FROM users
      WHERE employee_status = 'active' AND base_salary > 0
    `, [runId]);

    // Update run totals
    await client.query(`
      UPDATE payroll_runs SET
        total_gross = (SELECT SUM(gross_pay) FROM payroll_lines WHERE run_id = $1),
        total_net = (SELECT SUM(net_pay) FROM payroll_lines WHERE run_id = $1),
        total_sso_emp = (SELECT SUM(sso_employee) FROM payroll_lines WHERE run_id = $1),
        total_sso_co = (SELECT SUM(sso_employer) FROM payroll_lines WHERE run_id = $1)
      WHERE id = $1
    `, [runId]);

    await client.query('COMMIT');
    return apiSuccess({ id: runId }, 201);
  } catch (e: any) {
    await client.query('ROLLBACK');
    return apiError(e.message || 'Failed to create payroll run', 500);
  } finally {
    client.release();
  }
}

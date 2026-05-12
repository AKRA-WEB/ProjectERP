import { NextRequest } from 'next/server';
import { auth } from '@/auth';
import { query, pool } from '@/lib/db/client';
import { apiSuccess, apiError } from '@/lib/api-response';
import { z } from 'zod';
import type { SessionUser } from '@/lib/authz';
import { calcPayroll, calcOTPay } from '@/lib/hr/payroll-calc';

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

    // Get all active employees
    const employees = await client.query<{
      id: string; base_salary: number | null;
    }>(`SELECT id, base_salary FROM users WHERE employee_status = 'active' AND base_salary IS NOT NULL`);

    let totalGross = 0, totalNet = 0, totalSsoEmp = 0, totalSsoCo = 0, totalTax = 0;

    for (const emp of employees.rows) {
      const baseSalary = Number(emp.base_salary ?? 0);

      // Sum OT split by weekday/weekend (DOW 0=Sun, 6=Sat → 3×; Mon-Fri → 1.5×)
      const otRes = await client.query<{ ot_hours: string; is_weekend: boolean }>(
        `SELECT ot_hours, EXTRACT(DOW FROM work_date) IN (0,6) AS is_weekend
         FROM attendance_records
         WHERE employee_id = $1
           AND EXTRACT(MONTH FROM work_date) = $2
           AND EXTRACT(YEAR FROM work_date) = $3
           AND ot_hours > 0`,
        [emp.id, period_month, period_year]
      );
      let otPay = 0;
      for (const row of otRes.rows) {
        otPay += calcOTPay(baseSalary, Number(row.ot_hours), row.is_weekend ? 'weekend' : 'weekday');
      }

      // Absence deduction: count absent days × daily rate
      const absentRes = await client.query<{ absent_count: string }>(
        `SELECT COUNT(*) AS absent_count FROM attendance_records
         WHERE employee_id = $1 AND status = 'absent'
           AND EXTRACT(MONTH FROM work_date) = $2
           AND EXTRACT(YEAR FROM work_date) = $3`,
        [emp.id, period_month, period_year]
      );
      const absentDays = Number(absentRes.rows[0].absent_count);
      const absenceDeduction = Math.round((baseSalary / 26) * absentDays * 100) / 100;

      const result = calcPayroll({
        baseSalary,
        allowancesTotal: 0, // TODO: allowances per employee when implemented
        otPay,
        absenceDeduction,
      });

      await client.query(
        `INSERT INTO payroll_lines
          (run_id, employee_id, base_salary, ot_pay, absence_deduction,
           gross_pay, sso_employee, sso_employer, taxable_income, income_tax, total_deductions, net_pay)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
        [runId, emp.id, baseSalary, otPay, absenceDeduction,
         result.grossPay, result.ssoEmployee, result.ssoEmployer,
         result.taxableIncome, result.incomeTax, result.total_deductions, result.netPay]
      );

      totalGross += result.grossPay;
      totalNet += result.netPay;
      totalSsoEmp += result.ssoEmployee;
      totalSsoCo += result.ssoEmployer;
      totalTax += result.incomeTax;
    }

    // Update run totals
    await client.query(
      `UPDATE payroll_runs SET total_gross=$1, total_net=$2, total_sso_emp=$3, total_sso_co=$4, total_tax=$5, status='processing'
       WHERE id=$6`,
      [totalGross, totalNet, totalSsoEmp, totalSsoCo, totalTax, runId]
    );

    await client.query('COMMIT');
    return apiSuccess({ id: runId }, 201);
  } catch (e: unknown) {
    await client.query('ROLLBACK');
    const msg = e instanceof Error ? e.message : 'Failed to create payroll run';
    return apiError(msg, 500);
  } finally {
    client.release();
  }
}

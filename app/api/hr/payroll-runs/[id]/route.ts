import { NextRequest } from 'next/server';
import { auth } from '@/auth';
import pool, { query, queryOne } from '@/lib/db/client';
import { apiSuccess, apiError } from '@/lib/api-response';
import type { SessionUser } from '@/lib/authz';

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const { id } = await params;

  const run = await queryOne(`
    SELECT pr.*, 
      u.name_th AS created_by_name_th, u.name_en AS created_by_name_en, 
      a.name_th AS approved_by_name_th, a.name_en AS approved_by_name_en
    FROM payroll_runs pr
    JOIN users u ON u.id = pr.created_by
    LEFT JOIN users a ON a.id = pr.approved_by
    WHERE pr.id = $1
  `, [id]);
  if (!run) return apiError('Not found', 404);

  const lines = await query(`
    SELECT pl.*, 
      u.name_th AS employee_name_th, u.name_en AS employee_name_en, 
      u.employee_id AS employee_id_code
    FROM payroll_lines pl
    JOIN users u ON u.id = pl.employee_id
    WHERE pl.run_id = $1
    ORDER BY u.name_en
  `, [id]);

  return apiSuccess({ ...run, lines });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;
  if (!['admin', 'manager'].includes(u.role)) return apiError('Forbidden', 403);
  const { id } = await params;

  const body = await req.json();
  const { action } = body;

  const run = await queryOne<{ status: string; total_net: number; period_month: number; period_year: number; total_gross: number; total_sso_emp: number; total_sso_co: number; total_tax: number }>(
    `SELECT status, total_net, period_month, period_year, total_gross, total_sso_emp, total_sso_co, total_tax FROM payroll_runs WHERE id = $1`, [id]
  );
  if (!run) return apiError('Not found', 404);

  if (action === 'approve') {
    if (run.status !== 'draft') return apiError('Not in draft', 400);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`UPDATE payroll_runs SET status = 'approved', approved_by = $1, approved_at = NOW() WHERE id = $2`, [u.id, id]);
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      const msg = e instanceof Error ? e.message : 'Failed to approve';
      return apiError(msg, 500);
    } finally {
      client.release();
    }
  }

  if (action === 'post_to_accounting') {
    if (run.status !== 'approved') return apiError('Must be approved first', 400);
    
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      const mapping = await client.query(`SELECT * FROM hr_payroll_accounts WHERE id = 1`);
      const map = mapping.rows[0];
      if (!map?.salary_expense_account_id) throw new Error('Payroll account mapping incomplete');

      // Create journal entry
      const jeRes = await client.query(
        `INSERT INTO journal_entries (entry_date, entry_type, description, status, created_by)
         VALUES ($1, 'manual', $2, 'posted', $3) RETURNING id`,
        [`${run.period_year}-${String(run.period_month).padStart(2, '0')}-28`, `Payroll Run ${run.period_month}/${run.period_year}`, u.id]
      );
      const jeId = jeRes.rows[0].id;

      // Lines: Expense (Dr), Payable (Cr)
      // Simplify: total_gross -> Salary Exp (Dr), total_sso_co -> SSO Exp (Dr)
      // net_pay -> Salary Payable (Cr), total_sso_emp + total_sso_co -> SSO Payable (Cr), total_tax -> Tax Payable (Cr)
      
      // 1. Salary Expense (Dr)
      await client.query(`INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit_amount, credit_amount, line_number) VALUES ($1, $2, $3, 0, 1)`,
        [jeId, map.salary_expense_account_id, run.total_gross]);
      
      // 2. SSO Expense (Dr)
      if (run.total_sso_co > 0) {
        await client.query(`INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit_amount, credit_amount, line_number) VALUES ($1, $2, $3, 0, 2)`,
          [jeId, map.sso_expense_account_id, run.total_sso_co]);
      }

      // 3. Salary Payable (Cr)
      await client.query(`INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit_amount, credit_amount, line_number) VALUES ($1, $2, 0, $3, 3)`,
        [jeId, map.salary_payable_account_id, run.total_net]);

      // 4. SSO Payable (Cr)
      if ((run.total_sso_emp + run.total_sso_co) > 0) {
        await client.query(`INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit_amount, credit_amount, line_number) VALUES ($1, $2, 0, $3, 4)`,
          [jeId, map.sso_payable_account_id, run.total_sso_emp + run.total_sso_co]);
      }

      // 5. Tax Payable (Cr)
      if (run.total_tax > 0) {
        await client.query(`INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit_amount, credit_amount, line_number) VALUES ($1, $2, 0, $3, 5)`,
          [jeId, map.tax_payable_account_id, run.total_tax]);
      }

      await client.query(`UPDATE payroll_runs SET status = 'paid', journal_entry_id = $1 WHERE id = $2`, [jeId, id]);
      
      await client.query('COMMIT');
    } catch (e: unknown) {
      await client.query('ROLLBACK');
      const msg = e instanceof Error ? e.message : 'Unknown error';
      return apiError(msg, 500);
    } finally {
      client.release();
    }
  }

  return apiSuccess({ ok: true });
}

import { NextRequest } from 'next/server';
import { auth } from '@/auth';
import { queryOne } from '@/lib/db/client';
import { apiSuccess, apiError } from '@/lib/api-response';
import { z } from 'zod';
import type { SessionUser } from '@/lib/authz';

const UpdateSchema = z.object({
  salary_expense_account_id: z.string().uuid().nullable(),
  sso_expense_account_id: z.string().uuid().nullable(),
  salary_payable_account_id: z.string().uuid().nullable(),
  sso_payable_account_id: z.string().uuid().nullable(),
  tax_payable_account_id: z.string().uuid().nullable(),
});

export async function GET() {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const row = await queryOne(`SELECT * FROM hr_payroll_accounts WHERE id = 1`, []);
  return apiSuccess(row ?? {});
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;
  if (u.role !== 'admin') return apiError('Forbidden', 403);

  const body = await req.json();
  const parsed = UpdateSchema.safeParse(body);
  if (!parsed.success) return apiError(parsed.error.message, 400);
  const d = parsed.data;

  await queryOne(`
    INSERT INTO hr_payroll_accounts (id, salary_expense_account_id, sso_expense_account_id, salary_payable_account_id, sso_payable_account_id, tax_payable_account_id)
    VALUES (1, $1, $2, $3, $4, $5)
    ON CONFLICT (id) DO UPDATE SET
      salary_expense_account_id = $1,
      sso_expense_account_id = $2,
      salary_payable_account_id = $3,
      sso_payable_account_id = $4,
      tax_payable_account_id = $5,
      updated_at = NOW()
  `, [d.salary_expense_account_id, d.sso_expense_account_id, d.salary_payable_account_id, d.sso_payable_account_id, d.tax_payable_account_id]);

  return apiSuccess({ ok: true });
}

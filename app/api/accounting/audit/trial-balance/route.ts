import { auth } from '@/auth';
import { apiSuccess, apiError } from '@/lib/api-response';
import { query } from '@/lib/db/client';
import type { SessionUser } from '@/types';

interface RowData {
  account_code: string;
  account_name_th: string;
  account_name_en: string;
  account_type: string;
  normal_balance: string;
  total_debit: string;
  total_credit: string;
}

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;

  // Enforce role guard
  if (!['admin', 'manager', 'auditor'].includes(u.role)) {
    return apiError('Forbidden', 403);
  }

  const { searchParams } = new URL(req.url);
  const periodId = searchParams.get('period_id');
  const asOf = searchParams.get('as_of'); // YYYY-MM-DD

  let where = "je.status = 'posted'";
  const params: string[] = [];
  if (periodId) {
    where += " AND je.fiscal_period_id = $1";
    params.push(periodId);
  } else if (asOf) {
    where += " AND je.entry_date <= $1";
    params.push(asOf);
  }

  const rows = await query<RowData>(
    `SELECT 
        a.account_code, a.name_th AS account_name_th, a.name_en AS account_name_en, a.account_type, a.normal_balance,
        COALESCE(SUM(jel.debit_amount), 0) AS total_debit,
        COALESCE(SUM(jel.credit_amount), 0) AS total_credit
     FROM accounts a
     LEFT JOIN journal_entry_lines jel ON jel.account_id = a.id
     LEFT JOIN journal_entries je ON je.id = jel.journal_entry_id AND ${where}
     WHERE a.allows_direct_posting = TRUE
     GROUP BY a.id, a.account_code, a.name_th, a.name_en, a.account_type, a.normal_balance
     HAVING SUM(jel.debit_amount) > 0 OR SUM(jel.credit_amount) > 0
     ORDER BY a.account_code ASC`,
    params
  );

  // Map to include balance calculation
  const data = rows.map((r) => {
    const dr = Number(r.total_debit);
    const cr = Number(r.total_credit);
    const balance = r.normal_balance === 'debit' ? (dr - cr) : (cr - dr);
    return { ...r, total_debit: dr, total_credit: cr, balance };
  });

  return apiSuccess(data);
}

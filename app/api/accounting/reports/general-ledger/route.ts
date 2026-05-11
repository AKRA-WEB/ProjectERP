import { auth } from '@/auth';
import { apiSuccess, apiError } from '@/lib/api-response';
import { assertPermission } from '@/lib/authz';
import { query, queryOne } from '@/lib/db/client';
import type { SessionUser } from '@/lib/authz';

interface RowData {
  entry_number: string;
  entry_date: string;
  description: string;
  debit_amount: string;
  credit_amount: string;
}

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;

  try { assertPermission(u, 'reports:accounting'); } catch { return apiError('Forbidden', 403); }

  const { searchParams } = new URL(req.url);
  const accountId = searchParams.get('account_id');
  const fromDate = searchParams.get('from_date');
  const toDate = searchParams.get('to_date');

  if (!accountId || !fromDate || !toDate) return apiError('account_id, from_date, and to_date are required', 400);

  // 1. Get account normal balance
  const account = await queryOne<{ normal_balance: string }>('SELECT normal_balance FROM accounts WHERE id = $1', [accountId]);
  if (!account) return apiError('Account not found', 404);
  const isDebitNormal = account.normal_balance === 'debit';

  // 2. Compute opening balance
  const [opening] = await query<{ balance: string }>(
    `SELECT COALESCE(SUM(debit_amount - credit_amount), 0) AS balance
     FROM journal_entry_lines jel
     JOIN journal_entries je ON je.id = jel.journal_entry_id
     WHERE jel.account_id = $1 AND je.status = 'posted' AND je.entry_date < $2`,
    [accountId, fromDate]
  );
  let currentBalance = Number(opening.balance);
  const openingBalanceValue = isDebitNormal ? currentBalance : -currentBalance;

  // 3. Get transactions
  const lines = await query<RowData>(
    `SELECT je.entry_number, je.entry_date, jel.description, jel.debit_amount, jel.credit_amount
     FROM journal_entry_lines jel
     JOIN journal_entries je ON je.id = jel.journal_entry_id
     WHERE jel.account_id = $1 AND je.status = 'posted' AND je.entry_date BETWEEN $2 AND $3
     ORDER BY je.entry_date ASC, je.entry_number ASC`,
    [accountId, fromDate, toDate]
  );

  const data = lines.map((l) => {
    const dr = Number(l.debit_amount);
    const cr = Number(l.credit_amount);
    currentBalance += (dr - cr);
    return {
      ...l,
      debit_amount: dr,
      credit_amount: cr,
      running_balance: isDebitNormal ? currentBalance : -currentBalance
    };
  });

  return apiSuccess({
    opening_balance: openingBalanceValue,
    lines: data,
    closing_balance: isDebitNormal ? currentBalance : -currentBalance
  });
}

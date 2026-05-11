import { auth } from '@/auth';
import { apiSuccess, apiError } from '@/lib/api-response';
import { assertPermission } from '@/lib/authz';
import { query } from '@/lib/db/client';
import type { SessionUser } from '@/lib/authz';

interface RowData {
  account_code: string;
  name_th: string;
  name_en: string;
  account_type: string;
  normal_balance: string;
  dr: string;
  cr: string;
}

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;

  try { assertPermission(u, 'reports:accounting'); } catch { return apiError('Forbidden', 403); }

  const { searchParams } = new URL(req.url);
  const asOf = searchParams.get('as_of') || new Date().toISOString().split('T')[0];

  const rows = await query<RowData>(
    `SELECT 
        a.account_code, a.name_th, a.name_en, a.account_type, a.normal_balance,
        SUM(jel.debit_amount) AS dr,
        SUM(jel.credit_amount) AS cr
     FROM accounts a
     JOIN journal_entry_lines jel ON jel.account_id = a.id
     JOIN journal_entries je ON je.id = jel.journal_entry_id
     WHERE je.status = 'posted' AND je.entry_date <= $1
     GROUP BY a.id, a.account_code, a.name_th, a.name_en, a.account_type, a.normal_balance
     ORDER BY a.account_code ASC`,
    [asOf]
  );

  const assetItems: { code: string; name: string; amount: number }[] = [];
  const liabilityItems: { code: string; name: string; amount: number }[] = [];
  const equityItems: { code: string; name: string; amount: number }[] = [];

  let totalAssets = 0;
  let totalLiabilities = 0;
  let totalEquity = 0;

  // We need current P&L for Retained Earnings if not already closed
  // Simplification: just sum all Revenue/Expense accounts as part of Equity for now
  rows.forEach((r) => {
    const dr = Number(r.dr);
    const cr = Number(r.cr);
    
    if (r.account_type === 'asset') {
      const balance = dr - cr;
      assetItems.push({ code: r.account_code, name: r.name_th, amount: balance });
      totalAssets += balance;
    } else if (r.account_type === 'liability') {
      const balance = cr - dr;
      liabilityItems.push({ code: r.account_code, name: r.name_th, amount: balance });
      totalLiabilities += balance;
    } else if (r.account_type === 'equity') {
      const balance = cr - dr;
      equityItems.push({ code: r.account_code, name: r.name_th, amount: balance });
      totalEquity += balance;
    } else {
      // revenue or expense -> contributes to retained earnings
      const balance = r.account_type === 'revenue' ? (cr - dr) : (dr - cr);
      totalEquity += (r.account_type === 'revenue' ? balance : -balance);
    }
  });

  // Check if we need to add a "Retained Earnings / Current Profit" line
  // For this simple version, we'll just return the sections
  return apiSuccess({
    as_of: asOf,
    assets: { items: assetItems, total: totalAssets },
    liabilities: { items: liabilityItems, total: totalLiabilities },
    equity: { items: equityItems, total: totalEquity },
    is_balanced: Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 0.01
  });
}

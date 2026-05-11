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
  dr: string;
  cr: string;
}

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;

  try { assertPermission(u, 'reports:accounting'); } catch { return apiError('Forbidden', 403); }

  const { searchParams } = new URL(req.url);
  const fromDate = searchParams.get('from_date');
  const toDate = searchParams.get('to_date');

  if (!fromDate || !toDate) return apiError('from_date and to_date are required', 400);

  const rows = await query<RowData>(
    `SELECT 
        a.account_code, a.name_th, a.name_en, a.account_type,
        SUM(jel.debit_amount) AS dr,
        SUM(jel.credit_amount) AS cr
     FROM accounts a
     JOIN journal_entry_lines jel ON jel.account_id = a.id
     JOIN journal_entries je ON je.id = jel.journal_entry_id
     WHERE je.status = 'posted' AND je.entry_date BETWEEN $1 AND $2
       AND a.account_type IN ('revenue', 'expense')
     GROUP BY a.id, a.account_code, a.name_th, a.name_en, a.account_type
     ORDER BY a.account_code ASC`,
    [fromDate, toDate]
  );

  const revenueItems: { code: string; name: string; amount: number }[] = [];
  const cogsItems: { code: string; name: string; amount: number }[] = [];
  const expenseItems: { code: string; name: string; amount: number }[] = [];
  const taxItems: { code: string; name: string; amount: number }[] = [];

  let totalRevenue = 0;
  let totalCogs = 0;
  let totalExpenses = 0;
  let totalTax = 0;

  rows.forEach((r) => {
    const dr = Number(r.dr);
    const cr = Number(r.cr);
    const balance = r.account_type === 'revenue' ? (cr - dr) : (dr - cr);
    
    const item = { code: r.account_code, name: r.name_th, amount: balance };

    if (r.account_type === 'revenue') {
      revenueItems.push(item);
      totalRevenue += balance;
    } else if (r.account_code.startsWith('5')) {
      cogsItems.push(item);
      totalCogs += balance;
    } else if (r.account_code.startsWith('7')) {
      taxItems.push(item);
      totalTax += balance;
    } else {
      expenseItems.push(item);
      totalExpenses += balance;
    }
  });

  const grossProfit = totalRevenue - totalCogs;
  const operatingIncome = grossProfit - totalExpenses;
  const netIncome = operatingIncome - totalTax;

  return apiSuccess({
    revenue: { items: revenueItems, total: totalRevenue },
    cogs: { items: cogsItems, total: totalCogs },
    gross_profit: grossProfit,
    expenses: { items: expenseItems, total: totalExpenses },
    operating_income: operatingIncome,
    tax: { items: taxItems, total: totalTax },
    net_income: netIncome
  });
}

import { auth } from '@/auth';
import { apiSuccess, apiError } from '@/lib/api-response';
import { assertPermission } from '@/lib/authz';
import { query } from '@/lib/db/client';
import type { SessionUser } from '@/lib/authz';

import type { ArAgingRow } from '@/types';

export async function GET() {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;

  try { assertPermission(u, 'reports:accounting'); } catch { return apiError('Forbidden', 403); }

  // Check if sales_invoices table exists
  const [tableExists] = await query<{ exists: boolean }>(
    "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'sales_invoices')"
  );

  if (!tableExists.exists) {
    return apiSuccess({ rows: [], total: 0 });
  }

  const rows = await query<Omit<ArAgingRow, 'bucket'>>(
    `SELECT 
        c.name_th AS customer_name_th,
        si.si_number,
        si.invoice_date,
        si.due_date,
        si.total_amount,
        (CURRENT_DATE - si.due_date) AS days_overdue
     FROM sales_invoices si
     JOIN customers c ON c.id = si.customer_id
     WHERE si.status = 'issued'
     ORDER BY days_overdue DESC`
  );

  const data = rows.map((r) => {
    const days = Number(r.days_overdue);
    let bucket: ArAgingRow['bucket'] = 'current';
    if (days > 90) bucket = '90+';
    else if (days > 60) bucket = '61-90';
    else if (days > 30) bucket = '31-60';
    else if (days > 0) bucket = '1-30';
    
    return { ...r, bucket, total_amount: Number(r.total_amount) };
  });

  const totalAmount = data.reduce((sum, r) => sum + r.total_amount, 0);

  return apiSuccess({ rows: data, total: totalAmount });
}

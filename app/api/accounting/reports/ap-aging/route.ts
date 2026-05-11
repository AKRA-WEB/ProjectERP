import { auth } from '@/auth';
import { apiSuccess, apiError } from '@/lib/api-response';
import { assertPermission } from '@/lib/authz';
import { query } from '@/lib/db/client';
import type { SessionUser } from '@/lib/authz';

import type { ApAgingRow } from '@/types';

export async function GET() {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;

  try { assertPermission(u, 'reports:accounting'); } catch { return apiError('Forbidden', 403); }

  const rows = await query<Omit<ApAgingRow, 'bucket'>>(
    `SELECT 
        v.name_th AS vendor_name_th,
        inv.invoice_number,
        inv.invoice_date,
        inv.due_date,
        inv.amount,
        (CURRENT_DATE - inv.due_date) AS days_overdue
     FROM po_invoices inv
     JOIN purchase_orders po ON po.id = inv.po_id
     JOIN vendors v ON v.id = po.vendor_id
     WHERE inv.is_paid = FALSE
     ORDER BY days_overdue DESC`
  );

  const data = rows.map((r) => {
    const days = Number(r.days_overdue);
    let bucket: ApAgingRow['bucket'] = 'current';
    if (days > 90) bucket = '90+';
    else if (days > 60) bucket = '61-90';
    else if (days > 30) bucket = '31-60';
    else if (days > 0) bucket = '1-30';
    
    return { ...r, bucket, amount: Number(r.amount) };
  });

  const totalAmount = data.reduce((sum, r) => sum + r.amount, 0);

  return apiSuccess({ rows: data, total: totalAmount });
}

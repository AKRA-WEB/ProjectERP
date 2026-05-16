import { auth } from '@/auth';
import { apiSuccess, apiError } from '@/lib/api-response';
import { query } from '@/lib/db/client';
import { DEFAULT_PAGE_SIZE } from '@/lib/constants';

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, Number(searchParams.get('page') ?? 1));
  const limit = Math.min(100, Number(searchParams.get('limit') ?? DEFAULT_PAGE_SIZE));
  const offset = (page - 1) * limit;
  const vendorId = searchParams.get('vendor_id');
  const isPaid = searchParams.get('is_paid');

  const conditions: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  if (vendorId) {
    conditions.push(`pi.vendor_id = $${idx++}`);
    params.push(vendorId);
  }
  if (isPaid !== null && isPaid !== undefined) {
    conditions.push(`pi.is_paid = $${idx++}`);
    params.push(isPaid === 'true');
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const [total] = await query<{ count: string }>(`SELECT COUNT(*) FROM po_invoices pi ${where}`, params);

  const rows = await query(
    `SELECT pi.id, pi.invoice_number, pi.invoice_date, pi.due_date,
            pi.amount, pi.paid_amount, (pi.amount - pi.paid_amount) AS outstanding_amount,
            pi.is_paid,
            CASE WHEN pi.is_paid = FALSE AND pi.due_date < CURRENT_DATE
                 THEN (CURRENT_DATE - pi.due_date)
                 ELSE 0 END AS overdue_days,
            pi.vendor_id, v.name_th AS vendor_name_th, v.name_en AS vendor_name_en, v.code AS vendor_code,
            pi.po_id, po.po_number,
            pi.grn_id, grn.grn_number,
            pi.created_at
     FROM po_invoices pi
     JOIN vendors v ON v.id = pi.vendor_id
     LEFT JOIN purchase_orders po ON po.id = pi.po_id
     LEFT JOIN goods_receipt_notes grn ON grn.id = pi.grn_id
     ${where}
     ORDER BY pi.due_date ASC, pi.created_at DESC
     LIMIT $${idx++} OFFSET $${idx++}`,
    [...params, limit, offset]
  );

  return apiSuccess({
    invoices: rows,
    total: Number(total.count),
    page,
    limit,
    total_pages: Math.ceil(Number(total.count) / limit)
  });
}

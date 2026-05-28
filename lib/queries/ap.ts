import { query } from '@/lib/db/client';
import { DEFAULT_PAGE_SIZE } from '@/lib/constants';
import type { ApInvoice } from '@/types';

export interface APPageResult {
  invoices: ApInvoice[];
  total: number;
  total_pages: number;
}

export async function getAPInvoicePage(
  params: {
    page?: number;
    limit?: number;
    is_paid?: boolean | null;
    vendor_id?: string | null;
    match_status?: string | null;
  }
): Promise<APPageResult> {
  const page = Math.max(1, params.page ?? 1);
  const limit = Math.min(100, params.limit ?? DEFAULT_PAGE_SIZE);
  const offset = (page - 1) * limit;

  const conditions: string[] = [];
  const qParams: unknown[] = [];
  let idx = 1;

  if (params.is_paid !== null && params.is_paid !== undefined) {
    conditions.push(`pi.is_paid = $${idx++}`);
    qParams.push(params.is_paid);
  }
  if (params.vendor_id) {
    conditions.push(`pi.vendor_id = $${idx++}`);
    qParams.push(params.vendor_id);
  }
  if (params.match_status) {
    conditions.push(`pi.match_status = $${idx++}`);
    qParams.push(params.match_status);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const [[totalRow], rows] = await Promise.all([
    query<{ count: string }>(`SELECT COUNT(*) FROM po_invoices pi ${where}`, qParams),
    query<ApInvoice>(
      `SELECT pi.id, pi.invoice_number, pi.invoice_date, pi.due_date,
              pi.amount, pi.paid_amount, (pi.amount - pi.paid_amount) AS outstanding_amount,
              pi.is_paid,
              CASE WHEN pi.is_paid = FALSE AND pi.due_date < CURRENT_DATE
                   THEN (CURRENT_DATE - pi.due_date)::int ELSE 0 END AS overdue_days,
              pi.vendor_id, v.name_th AS vendor_name_th, v.name_en AS vendor_name_en, v.code AS vendor_code,
              pi.po_id, po.po_number, pi.grn_id, grn.grn_number, pi.created_at
       FROM po_invoices pi
       JOIN vendors v ON v.id = pi.vendor_id
       LEFT JOIN purchase_orders po ON po.id = pi.po_id
       LEFT JOIN goods_receipt_notes grn ON grn.id = pi.grn_id
       ${where}
       ORDER BY pi.due_date ASC, pi.created_at DESC
       LIMIT $${idx++} OFFSET $${idx++}`,
      [...qParams, limit, offset]
    ),
  ]);

  return { invoices: rows, total: Number(totalRow.count), total_pages: Math.ceil(Number(totalRow.count) / limit) };
}

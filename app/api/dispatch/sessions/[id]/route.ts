import { auth } from '@/auth';
import { apiSuccess, apiError } from '@/lib/api-response';
import { queryOne, query } from '@/lib/db/client';
import type { SessionUser } from '@/lib/authz';

export async function GET(
  req: Request,
  props: { params: Promise<{ id: string }> }
) {
  const { id } = await props.params;
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;

  if (!['admin', 'manager', 'staff'].includes(u.role)) {
    return apiError('Forbidden', 403);
  }

  // 1. Get session info
  const ds = await queryOne<{ id: string; invoice_id: string; si_number: string; current_barcode: string; customer_name: string }>(
    `SELECT ds.*, si.si_number, si.current_barcode, c.name_th as customer_name
     FROM dispatch_sessions ds
     JOIN sales_invoices si ON si.id = ds.invoice_id
     JOIN customers c ON c.id = si.customer_id
     WHERE ds.id = $1`,
    [id]
  );
  if (!ds) return apiError('Session not found', 404);

  // 2. Get expected vs scanned aggregates
  const lines = await query<{ product_id: string; name_th: string; sku: string; expected_qty: number; scanned_total: number }>(
    `WITH expected AS (
       SELECT dli.product_id, p.name_th, p.sku, SUM(dli.qty_to_deliver) as expected_qty
       FROM sales_invoices si
       JOIN do_line_items dli ON dli.do_id = si.delivery_order_id
       JOIN products p ON p.id = dli.product_id
       WHERE si.id = $1
       GROUP BY dli.product_id, p.name_th, p.sku
     ),
     scanned AS (
       SELECT product_id, SUM(scanned_qty) as scanned_total
       FROM dispatch_check_log
       WHERE session_id = $2
       GROUP BY product_id
     )
     SELECT e.*, COALESCE(s.scanned_total, 0) as scanned_total
     FROM expected e
     LEFT JOIN scanned s ON s.product_id = e.product_id`,
    [ds.invoice_id, id]
  );

  return apiSuccess({ session: ds, lines });
}

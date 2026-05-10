import { auth } from '@/auth';
import { apiSuccess, apiError } from '@/lib/api-response';
import { query, queryOne } from '@/lib/db/client';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);

  const { id } = await params;

  const io = await queryOne(
    `SELECT io.*, v.name_th AS vendor_name, v.code AS vendor_code,
            w.code AS warehouse_code, w.name_th AS warehouse_name,
            u.name_en AS created_by_name,
            vb.name_en AS verified_by_name
     FROM inbound_orders io
     JOIN vendors v ON v.id = io.vendor_id
     JOIN warehouses w ON w.id = io.warehouse_id
     JOIN users u ON u.id = io.created_by
     LEFT JOIN users vb ON vb.id = io.verified_by
     WHERE io.id = $1`,
    [id]
  );

  if (!io) return apiError('Inbound Order not found', 404);

  const lines = await query(
    `SELECT iol.*, p.sku, p.name_th, p.name_en, u.code AS uom_code,
            COALESCE(sb.qty_available, 0) AS qty_available
     FROM inbound_order_lines iol
     JOIN products p ON p.id = iol.product_id
     JOIN units_of_measure u ON u.id = p.uom_id
     LEFT JOIN stock_balances sb ON sb.product_id = iol.product_id AND sb.warehouse_id = $2
     WHERE iol.io_id = $1
     ORDER BY iol.line_number`,
    [id, (io as { warehouse_id: string }).warehouse_id]
  );

  const grns = await query(
    `SELECT g.id, g.grn_number, g.status, g.received_date, u.name_en AS received_by_name
     FROM goods_receipt_notes g
     JOIN users u ON u.id = g.received_by
     WHERE g.inbound_order_id = $1
     ORDER BY g.created_at`,
    [id]
  );

  return apiSuccess({ ...io, lines, grns });
}

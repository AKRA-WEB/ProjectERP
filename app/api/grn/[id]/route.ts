import { auth } from '@/auth';
import { apiSuccess, apiError } from '@/lib/api-response';
import { query, queryOne } from '@/lib/db/client';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);

  const { id } = await params;

  const [grn, lines] = await Promise.all([
    queryOne(
      `SELECT g.*, po.po_number, io.io_number, w.code AS warehouse_code, w.name_th AS warehouse_name,
              u1.name_en AS received_by_name, u2.name_en AS qc_reviewed_by_name, u3.name_en AS stocked_by_name
       FROM goods_receipt_notes g
       LEFT JOIN purchase_orders po ON po.id = g.po_id
       LEFT JOIN inbound_orders io ON io.id = g.inbound_order_id
       JOIN warehouses w ON w.id = g.warehouse_id
       JOIN users u1 ON u1.id = g.received_by
       LEFT JOIN users u2 ON u2.id = g.qc_reviewed_by
       LEFT JOIN users u3 ON u3.id = g.stocked_by
       WHERE g.id = $1`,
      [id]
    ),
    query(
      `SELECT li.*, p.sku, p.name_th, p.name_en, p.is_lot_tracked, p.is_serial_tracked, u.code AS uom_code
       FROM grn_line_items li
       JOIN products p ON p.id = li.product_id
       JOIN units_of_measure u ON u.id = p.uom_id
       WHERE li.grn_id = $1
       ORDER BY li.line_number`,
      [id]
    )
  ]);

  if (!grn) return apiError('GRN not found', 404);

  return apiSuccess({ ...grn, lines });
}

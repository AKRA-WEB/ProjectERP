import { auth } from '@/auth';
import { apiSuccess, apiError } from '@/lib/api-response';
import { query, queryOne } from '@/lib/db/client';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);

  const { id } = await params;
  const transfer = await queryOne(
    `SELECT t.*, ws.code AS source_code, ws.name_th AS source_name,
            wd.code AS dest_code, wd.name_th AS dest_name,
            u.name_en AS initiated_by_name
     FROM warehouse_transfers t
     JOIN warehouses ws ON ws.id = t.source_warehouse_id
     JOIN warehouses wd ON wd.id = t.dest_warehouse_id
     JOIN users u ON u.id = t.initiated_by
     WHERE t.id = $1`,
    [id]
  );
  if (!transfer) return apiError('Transfer not found', 404);

  const lines = await query(
    `SELECT tl.*, p.sku, p.name_th, p.name_en, u.code AS uom_code, l.lot_number
     FROM warehouse_transfer_lines tl
     JOIN products p ON p.id = tl.product_id
     JOIN units_of_measure u ON u.id = p.uom_id
     LEFT JOIN lots l ON l.id = tl.lot_id
     WHERE tl.transfer_id = $1
     ORDER BY tl.line_number`,
    [id]
  );

  return apiSuccess({ ...transfer, lines });
}

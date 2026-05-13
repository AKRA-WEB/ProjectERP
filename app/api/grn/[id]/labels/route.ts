import { auth } from '@/auth';
import { apiSuccess, apiError } from '@/lib/api-response';
import { query } from '@/lib/db/client';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);

  const { id } = await params;
  const url = new URL(req.url);
  const lineId = url.searchParams.get('lineId');

  const whereClause = lineId
    ? 'li.grn_id = $1 AND li.id = $2'
    : 'li.grn_id = $1';
  const queryParams = lineId ? [id, lineId] : [id];

  const labels = await query(
    `SELECT
       p.sku                     AS product_sku,
       p.name_th                 AS product_name_th,
       p.name_en                 AS product_name_en,
       tu.code                   AS uom_code,
       tu.name_th                AS uom_name_th,
       pu.barcode_label,
       li.storage_location,
       COALESCE(li.base_qty, li.qty_accepted) AS base_qty,
       bu.code                   AS base_uom_code,
       li.transaction_qty,
       tu.code                   AS transaction_uom_code,
       li.lot_number,
       g.grn_number
     FROM grn_line_items li
     JOIN goods_receipt_notes g ON g.id = li.grn_id
     JOIN products p ON p.id = li.product_id
     JOIN units_of_measure bu ON bu.id = p.uom_id
     LEFT JOIN units_of_measure tu ON tu.id = COALESCE(li.transaction_uom_id, p.uom_id)
     LEFT JOIN product_uom pu ON pu.product_id = li.product_id AND pu.uom_id = COALESCE(li.transaction_uom_id, p.uom_id)
     WHERE ${whereClause}
     ORDER BY li.line_number`,
    queryParams
  );

  if (!labels.length) return apiError('GRN not found or no lines', 404);
  return apiSuccess(labels);
}

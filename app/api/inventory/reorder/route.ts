import { auth } from '@/auth';
import { apiSuccess, apiError } from '@/lib/api-response';
import { query } from '@/lib/db/client';
import { buildWarehouseScopeClause } from '@/lib/authz';
import type { SessionUser } from '@/lib/authz';

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;

  const { searchParams } = new URL(req.url);
  const warehouseId = searchParams.get('warehouse_id');

  const conditions: string[] = ['p.is_active = TRUE', 'sb.qty_available <= p.reorder_point'];
  const params: unknown[] = [];
  let idx = 1;

  const scope = buildWarehouseScopeClause(u, 'sb.warehouse_id', idx);
  if (scope) { conditions.push(scope.clause); params.push(...scope.params); idx += scope.params.length; }

  if (warehouseId) { conditions.push(`sb.warehouse_id = $${idx++}`); params.push(warehouseId); }

  const where = `WHERE ${conditions.join(' AND ')}`;

  const rows = await query(
    `SELECT
       p.id            AS product_id,
       p.sku,
       p.name_th,
       p.name_en,
       p.unit_cost,
       p.reorder_point,
       u.code          AS uom_code,
       w.id            AS warehouse_id,
       w.code          AS warehouse_code,
       w.name_th       AS warehouse_name,
       sb.qty_on_hand,
       sb.qty_available,
       (p.reorder_point - sb.qty_available) AS qty_deficit
     FROM stock_balances sb
     JOIN products p         ON p.id = sb.product_id
     JOIN units_of_measure u ON u.id = p.uom_id
     JOIN warehouses w       ON w.id = sb.warehouse_id
     ${where}
     ORDER BY qty_deficit DESC, p.sku`,
    params
  );

  return apiSuccess(rows);
}

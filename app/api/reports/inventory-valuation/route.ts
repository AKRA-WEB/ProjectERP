import { auth } from '@/auth';
import { apiSuccess, apiError } from '@/lib/api-response';
import { query } from '@/lib/db/client';
import { buildWarehouseScopeClause } from '@/lib/authz';
import type { SessionUser } from '@/lib/authz';

export interface ValuationRow {
  warehouse_id: string;
  warehouse_code: string;
  warehouse_name: string;
  category_name: string | null;
  product_id: string;
  sku: string;
  product_name_th: string;
  product_name_en: string;
  unit_cost: number;
  uom_code: string;
  qty_on_hand: number;
  qty_available: number;
  total_value: number;
}

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;

  const { searchParams } = new URL(req.url);
  const warehouseId = searchParams.get('warehouse_id');
  const categoryId = searchParams.get('category_id');

  const conditions: string[] = ['p.is_active = TRUE', 'sb.qty_on_hand > 0'];
  const params: unknown[] = [];
  let idx = 1;

  const scope = buildWarehouseScopeClause(u, 'sb.warehouse_id', idx);
  if (scope) {
    conditions.push(scope.clause);
    params.push(...scope.params);
    idx += scope.params.length;
  }

  if (warehouseId) {
    conditions.push(`sb.warehouse_id = $${idx++}`);
    params.push(warehouseId);
  }
  if (categoryId) {
    conditions.push(`p.category_id = $${idx++}`);
    params.push(categoryId);
  }

  const where = `WHERE ${conditions.join(' AND ')}`;

  const rows = await query<ValuationRow>(
    `SELECT
       w.id                                      AS warehouse_id,
       w.code                                    AS warehouse_code,
       w.name_th                                 AS warehouse_name,
       c.name_th                                 AS category_name,
       p.id                                      AS product_id,
       p.sku,
       p.name_th                                 AS product_name_th,
       p.name_en                                 AS product_name_en,
       p.unit_cost,
       u.code                                    AS uom_code,
       sb.qty_on_hand,
       sb.qty_available,
       ROUND(sb.qty_on_hand * p.unit_cost, 2)    AS total_value
     FROM stock_balances sb
     JOIN products p             ON p.id  = sb.product_id
     JOIN warehouses w           ON w.id  = sb.warehouse_id
     JOIN units_of_measure u     ON u.id  = p.uom_id
     LEFT JOIN product_categories c ON c.id = p.category_id
     ${where}
     ORDER BY w.code, c.name_th NULLS LAST, p.sku`,
    params
  );

  // Compute summary totals server-side
  const byWarehouse: Record<string, { warehouse_code: string; warehouse_name: string; total_value: number; product_count: number }> = {};
  let grandTotal = 0;

  for (const row of rows) {
    const val = Number(row.total_value);
    grandTotal += val;
    if (!byWarehouse[row.warehouse_id]) {
      byWarehouse[row.warehouse_id] = {
        warehouse_code: row.warehouse_code,
        warehouse_name: row.warehouse_name,
        total_value: 0,
        product_count: 0
      };
    }
    byWarehouse[row.warehouse_id].total_value += val;
    byWarehouse[row.warehouse_id].product_count += 1;
  }

  return apiSuccess({
    rows,
    summary: {
      grand_total: Math.round(grandTotal * 100) / 100,
      by_warehouse: Object.entries(byWarehouse).map(([id, s]) => ({
        warehouse_id: id,
        ...s,
        total_value: Math.round(s.total_value * 100) / 100
      })),
      row_count: rows.length,
    },
  });
}

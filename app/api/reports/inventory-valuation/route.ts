import { auth } from '@/auth';
import { apiSuccess, apiError } from '@/lib/api-response';
import { query } from '@/lib/db/client';
import { buildWarehouseScopeClause, assertRole } from '@/lib/authz';
import { DEFAULT_PAGE_SIZE } from '@/lib/constants';
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

  try { assertRole(u, ['manager', 'admin']); } catch { return apiError('Forbidden', 403); }

  const { searchParams } = new URL(req.url);
  const warehouseId = searchParams.get('warehouse_id');
  const categoryId = searchParams.get('category_id');
  const method = (searchParams.get('method') ?? 'wac') as 'wac' | 'fifo';
  const format = searchParams.get('format');
  const page = Math.max(1, Number(searchParams.get('page') ?? 1));
  const limit = Math.min(500, Number(searchParams.get('limit') ?? DEFAULT_PAGE_SIZE));
  const offset = (page - 1) * limit;

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

  const costExpr = method === 'fifo' 
    ? 'COALESCE(sl_fifo.unit_cost, p.unit_cost)' 
    : 'p.unit_cost';

  const joinExpr = method === 'fifo'
    ? `JOIN LATERAL (
         SELECT unit_cost
         FROM stock_ledger
         WHERE product_id = sb.product_id
           AND warehouse_id = sb.warehouse_id
           AND entry_type = 'grn_receipt'
         ORDER BY created_at DESC
         LIMIT 1
       ) sl_fifo ON TRUE`
    : '';

  const queryStr = `
    SELECT
       w.id                                      AS warehouse_id,
       w.code                                    AS warehouse_code,
       w.name_th                                 AS warehouse_name,
       c.name_th                                 AS category_name,
       p.id                                      AS product_id,
       p.sku,
       p.name_th                                 AS product_name_th,
       p.name_en                                 AS product_name_en,
       ${costExpr}                               AS unit_cost,
       u.code                                    AS uom_code,
       sb.qty_on_hand,
       sb.qty_available,
       ROUND(sb.qty_on_hand * ${costExpr}, 2)    AS total_value
     FROM stock_balances sb
     JOIN products p             ON p.id  = sb.product_id
     JOIN warehouses w           ON w.id  = sb.warehouse_id
     JOIN units_of_measure u     ON u.id  = p.uom_id
     LEFT JOIN product_categories c ON c.id = p.category_id
     ${joinExpr}
     ${where}
     ORDER BY w.code, c.name_th NULLS LAST, p.sku`;

  if (format === 'csv') {
    const allRows = await query<ValuationRow>(queryStr, params);
    const csv = [
      'Warehouse,Category,SKU,Product,Quantity,UoM,Unit Cost,Total Value',
      ...allRows.map(r =>
        `"${r.warehouse_name}","${r.category_name ?? ''}","${r.sku}","${r.product_name_th}",${r.qty_on_hand},"${r.uom_code}",${r.unit_cost},${r.total_value}`
      ),
    ].join('\n');
    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="inventory_valuation.csv"',
      },
    });
  }

  const [rows, [{ count }]] = await Promise.all([
    query<ValuationRow>(`${queryStr} LIMIT $${idx} OFFSET $${idx+1}`, [...params, limit, offset]),
    query<{ count: string }>(`SELECT COUNT(*) FROM stock_balances sb JOIN products p ON p.id = sb.product_id ${where}`, params)
  ]);

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
    total: parseInt(count),
    page,
    limit,
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

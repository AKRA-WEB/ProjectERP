import { query } from '@/lib/db/client';
import { buildWarehouseScopeClause } from '@/lib/authz';
import { DEFAULT_PAGE_SIZE } from '@/lib/constants';
import type { SessionUser } from '@/lib/authz';

export interface StockItemRow {
  product_id: string;
  warehouse_id: string;
  sku: string;
  name_th: string;
  name_en: string;
  warehouse_code: string;
  warehouse_name: string;
  qty_on_hand: number;
  qty_reserved: number;
  qty_available: number;
  unit_cost: number;
  reorder_point: number;
  uom_code: string;
}

export interface InventoryPageResult {
  data: StockItemRow[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
  warehouses: { id: string; code: string; name: string }[];
}

export async function getInventoryPage(
  user: SessionUser,
  params: { page?: number; limit?: number; search?: string; warehouse_id?: string; low_stock?: boolean }
): Promise<InventoryPageResult> {
  const page = Math.max(1, params.page ?? 1);
  const limit = Math.min(200, params.limit ?? DEFAULT_PAGE_SIZE);
  const offset = (page - 1) * limit;

  const conditions: string[] = ['p.is_active = TRUE'];
  const qParams: unknown[] = [];
  let idx = 1;

  const scope = buildWarehouseScopeClause(user, 'sb.warehouse_id', idx);
  if (scope) { conditions.push(scope.clause); qParams.push(...scope.params); idx += scope.params.length; }
  if (params.warehouse_id) { conditions.push(`sb.warehouse_id = $${idx++}`); qParams.push(params.warehouse_id); }
  if (params.search) {
    conditions.push(`(p.sku ILIKE $${idx} OR p.name_th ILIKE $${idx} OR p.name_en ILIKE $${idx})`);
    qParams.push(`%${params.search}%`); idx++;
  }
  if (params.low_stock) conditions.push('sb.qty_available <= p.reorder_point');

  const where = `WHERE ${conditions.join(' AND ')}`;

  const [[totalRow], rows, warehouses] = await Promise.all([
    query<{ count: string }>(
      `SELECT COUNT(*) FROM stock_balances sb JOIN products p ON p.id = sb.product_id ${where}`, qParams
    ),
    query<StockItemRow>(
      `SELECT sb.warehouse_id, sb.product_id, sb.qty_on_hand, sb.qty_reserved, sb.qty_available,
              p.sku, p.name_th, p.name_en, p.reorder_point, p.unit_cost,
              u.code AS uom_code, w.code AS warehouse_code, w.name_th AS warehouse_name, w.id
       FROM stock_balances sb
       JOIN products p ON p.id = sb.product_id
       JOIN warehouses w ON w.id = sb.warehouse_id
       JOIN units_of_measure u ON u.id = p.uom_id
       ${where}
       ORDER BY p.sku, w.code
       LIMIT $${idx++} OFFSET $${idx++}`,
      [...qParams, limit, offset]
    ),
    query<{ id: string; code: string; name: string }>(
      `SELECT id, code, name_th AS name FROM warehouses WHERE code NOT LIKE 'V-%' ORDER BY code`
    ),
  ]);

  return {
    data: rows,
    total: Number(totalRow.count),
    page,
    per_page: limit,
    total_pages: Math.ceil(Number(totalRow.count) / limit),
    warehouses,
  };
}

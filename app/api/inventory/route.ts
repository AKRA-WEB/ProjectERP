import { auth } from '@/auth';
import { apiSuccess, apiError } from '@/lib/api-response';
import { query } from '@/lib/db/client';
import { DEFAULT_PAGE_SIZE } from '@/lib/constants';
import type { SessionUser } from '@/lib/authz';

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, Number(searchParams.get('page') ?? 1));
  const limit = Math.min(200, Number(searchParams.get('limit') ?? DEFAULT_PAGE_SIZE));
  const offset = (page - 1) * limit;
  const warehouseId = searchParams.get('warehouse_id');
  const search = searchParams.get('search') || searchParams.get('q'); // Support both
  const lowStock = searchParams.get('low_stock') === 'true' || searchParams.get('low_stock') === '1';

  const conditions: string[] = ['p.is_active = TRUE'];
  const params: unknown[] = [];
  let idx = 1;

  if (u.role === 'staff' && u.assignedWarehouseIds && u.assignedWarehouseIds.length > 0) {
    conditions.push(`sb.warehouse_id = ANY($${idx++}::uuid[])`);
    params.push(u.assignedWarehouseIds);
  }

  if (warehouseId) {
    conditions.push(`sb.warehouse_id = $${idx++}`);
    params.push(warehouseId);
  }

  if (search) {
    conditions.push(`(p.sku ILIKE $${idx} OR p.name_th ILIKE $${idx} OR p.name_en ILIKE $${idx})`);
    params.push(`%${search}%`);
    idx++;
  }

  if (lowStock) {
    conditions.push('sb.qty_available <= p.reorder_point');
  }

  const where = `WHERE ${conditions.join(' AND ')}`;

  const [total] = await query<{ count: string }>(
    `SELECT COUNT(*) FROM stock_balances sb JOIN products p ON p.id = sb.product_id ${where}`,
    params
  );

  const rows = await query(
    `SELECT sb.warehouse_id, sb.product_id, sb.qty_on_hand, sb.qty_reserved, sb.qty_available,
            p.sku, p.name_th, p.name_en, p.reorder_point, p.is_lot_tracked,
            u.code AS uom_code, w.code AS warehouse_code, w.name_th AS warehouse_name
     FROM stock_balances sb
     JOIN products p ON p.id = sb.product_id
     JOIN warehouses w ON w.id = sb.warehouse_id
     JOIN units_of_measure u ON u.id = p.uom_id
     ${where}
     ORDER BY p.sku, w.code
     LIMIT $${idx++} OFFSET $${idx++}`,
    [...params, limit, offset]
  );

  return apiSuccess({
    data: rows,
    total: Number(total.count),
    page,
    limit,
    per_page: limit,
    total_pages: Math.ceil(Number(total.count) / limit),
  });

}

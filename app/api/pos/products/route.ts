import { auth } from '@/auth';
import { apiSuccess, apiError } from '@/lib/api-response';
import { assertPermission, assertWarehouseAccess } from '@/lib/authz';
import { query } from '@/lib/db/client';
import type { SessionUser } from '@/lib/authz';

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;

  try { assertPermission(u, 'pos:cashier'); } catch { return apiError('Forbidden', 403); }

  const { searchParams } = new URL(req.url);
  const warehouseId = searchParams.get('warehouse_id');
  const q = searchParams.get('q');
  const categoryId = searchParams.get('category_id');
  const limit = Math.min(200, Number(searchParams.get('limit') ?? 100));

  if (!warehouseId) return apiError('warehouse_id is required', 400);
  try { assertWarehouseAccess(u, warehouseId); } catch { return apiError('No access to this warehouse', 403); }

  const conditions = ['p.is_active = true', 'sb.warehouse_id = $1'];
  const params: unknown[] = [warehouseId];
  let idx = 2;

  if (q) {
    conditions.push(`(p.barcode = $${idx} OR p.sku ILIKE $${idx + 1} OR p.name_th ILIKE $${idx + 1} OR p.name_en ILIKE $${idx + 1})`);
    params.push(q, `%${q}%`);
    idx += 2;
  }

  if (categoryId) {
    conditions.push(`p.category_id = $${idx}`);
    params.push(categoryId);
    idx += 1;
  }

  const products = await query(
    `SELECT p.id, p.sku, p.barcode, p.name_th, p.name_en, p.selling_price, 
            p.image_url, p.reorder_point, p.category_id,
            sb.qty_available, uom.code AS uom_code
     FROM products p
     JOIN stock_balances sb ON sb.product_id = p.id
     LEFT JOIN units_of_measure uom ON uom.id = p.uom_id
     WHERE ${conditions.join(' AND ')}
     ORDER BY p.name_th ASC
     LIMIT $${idx}`,
    [...params, limit]
  );

  return apiSuccess(products);
}

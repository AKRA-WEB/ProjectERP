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
  const productId = searchParams.get('product_id');
  const entryType = searchParams.get('entry_type');

  const conditions: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  if (u.role === 'staff' && u.assignedWarehouseIds.length > 0) {
    conditions.push(`sl.warehouse_id = ANY($${idx++}::uuid[])`);
    params.push(u.assignedWarehouseIds);
  }

  if (warehouseId) { conditions.push(`sl.warehouse_id = $${idx++}`); params.push(warehouseId); }
  if (productId) { conditions.push(`sl.product_id = $${idx++}`); params.push(productId); }
  if (entryType) { conditions.push(`sl.entry_type = $${idx++}`); params.push(entryType); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const [total] = await query<{ count: string }>(`SELECT COUNT(*) FROM stock_ledger sl ${where}`, params);

  const rows = await query(
    `SELECT sl.id, sl.entry_type, sl.qty_change, sl.qty_after, sl.unit_cost, sl.reference_type, sl.created_at,
            p.sku, p.name_th, w.code AS warehouse_code,
            u.name_en AS created_by_name
     FROM stock_ledger sl
     JOIN products p ON p.id = sl.product_id
     JOIN warehouses w ON w.id = sl.warehouse_id
     LEFT JOIN users u ON u.id = sl.created_by
     ${where}
     ORDER BY sl.created_at DESC
     LIMIT $${idx++} OFFSET $${idx++}`,
    [...params, limit, offset]
  );

  return apiSuccess({ data: rows, total: Number(total.count), page, limit, total_pages: Math.ceil(Number(total.count) / limit) });
}

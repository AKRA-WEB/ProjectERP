import { auth } from '@/auth';
import { apiSuccess, apiError } from '@/lib/api-response';
import { queryOne } from '@/lib/db/client';
import type { SessionUser } from '@/lib/authz';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ warehouse_id: string; product_id: string }> }
) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;

  const { warehouse_id, product_id } = await params;

  // Check access
  if (u.role === 'staff' && u.assignedWarehouseIds && !u.assignedWarehouseIds.includes(warehouse_id)) {
    return apiError('No access to this warehouse', 403);
  }

  const stock = await queryOne<{
    warehouse_id: string;
    product_id: string;
    qty_on_hand: string;
    qty_reserved: string;
    qty_available: string;
  }>(
    `SELECT warehouse_id, product_id, qty_on_hand, qty_reserved, qty_available
     FROM stock_balances
     WHERE warehouse_id = $1 AND product_id = $2`,
    [warehouse_id, product_id]
  );

  if (!stock) {
    return apiSuccess({
      warehouse_id,
      product_id,
      qty_on_hand: 0,
      qty_reserved: 0,
      qty_available: 0,
    });
  }

  return apiSuccess(stock);
}

import { auth } from '@/auth';
import { apiSuccess, apiError } from '@/lib/api-response';
import { assertPermission } from '@/lib/authz';
import { query, queryOne } from '@/lib/db/client';
import type { SessionUser } from '@/lib/authz';

export async function GET(
  req: Request,
  props: { params: Promise<{ id: string }> }
) {
  const { id } = await props.params;
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;

  try { assertPermission(u, 'pos:cashier'); } catch { return apiError('Forbidden', 403); }

  const heldCart = await queryOne<Record<string, unknown>>(
    `SELECT hc.*, pps.status as picking_slip_status 
     FROM pos_held_carts hc 
     LEFT JOIN pos_picking_slips pps ON hc.wholesale_picking_slip_id = pps.id
     WHERE hc.id = $1`,
    [id]
  );
  if (!heldCart) return apiError('Held cart not found', 404);

  if (heldCart.is_hybrid && heldCart.wholesale_picking_slip_id && heldCart.picking_slip_status !== 'picked') {
    return apiError('Picking slip not yet picked', 409);
  }

  const lines = await query(
    `SELECT hcl.*, p.name_th, p.sku, p.image_url 
     FROM pos_held_cart_lines hcl
     JOIN products p ON p.id = hcl.product_id
     WHERE hcl.held_cart_id = $1`,
    [id]
  );

  return apiSuccess({ ...heldCart, lines });
}

export async function DELETE(
  req: Request,
  props: { params: Promise<{ id: string }> }
) {
  const { id } = await props.params;
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;

  try { assertPermission(u, 'pos:cashier'); } catch { return apiError('Forbidden', 403); }

  const cart = await queryOne<{ cashier_id: string }>(
    'SELECT cashier_id FROM pos_held_carts WHERE id = $1',
    [id]
  );
  if (!cart) return apiError('Held cart not found', 404);
  if (u.role === 'staff' && cart.cashier_id !== u.id) {
    return apiError('Forbidden', 403);
  }

  const result = await query(
    `DELETE FROM pos_held_carts WHERE id = $1 RETURNING id`,
    [id]
  );

  if (result.length === 0) return apiError('Held cart not found', 404);

  return apiSuccess(null, 204);
}

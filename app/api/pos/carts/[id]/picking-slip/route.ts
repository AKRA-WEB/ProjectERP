import { auth } from '@/auth';
import { apiSuccess, apiError } from '@/lib/api-response';
import { assertPermission } from '@/lib/authz';
import pool from '@/lib/db/client';
import type { SessionUser } from '@/lib/authz';
import { z } from 'zod';

const PickingSlipSchema = z.object({
  source_warehouse_id: z.string().uuid(),
});

export async function POST(
  req: Request,
  props: { params: Promise<{ id: string }> }
) {
  const { id } = await props.params;
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;

  try {
    assertPermission(u, 'pos:cashier');
  } catch {
    return apiError('Forbidden', 403);
  }

  const body = await req.json().catch(() => null);
  if (!body) return apiError('Invalid JSON', 400);
  const result = PickingSlipSchema.safeParse(body);
  if (!result.success) return apiError('Invalid request body', 400, result.error.flatten());
  const { source_warehouse_id } = result.data;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Check if cart exists and doesn't have a slip yet
    const cartRes = await client.query(
      `SELECT id, is_hybrid, wholesale_picking_slip_id FROM pos_held_carts WHERE id = $1 FOR UPDATE`,
      [id]
    );
    if (cartRes.rowCount === 0) {
      await client.query('ROLLBACK');
      return apiError('Held cart not found', 404);
    }
    const cart = cartRes.rows[0];
    if (cart.wholesale_picking_slip_id) {
      await client.query('ROLLBACK');
      return apiError('Picking slip already exists for this cart', 409);
    }

    // 2. Pull lines
    const linesRes = await client.query(
      `SELECT hcl.product_id, hcl.qty, hcl.unit_price, hcl.discount_amount, p.name_th, p.sku
       FROM pos_held_cart_lines hcl
       JOIN products p ON p.id = hcl.product_id
       WHERE hcl.held_cart_id = $1`,
      [id]
    );
    if (linesRes.rowCount === 0) {
      await client.query('ROLLBACK');
      return apiError('Cart has no lines', 400);
    }

    // 3. Create picking slip
    const slipRes = await client.query(
      `INSERT INTO pos_picking_slips (draft_cart_id, source_warehouse_id, printed_by, lines)
       VALUES ($1, $2, $3, $4::jsonb)
       RETURNING id, doc_no, lines, status, printed_at`,
      [id, source_warehouse_id, u.id, JSON.stringify(linesRes.rows)]
    );
    const slip = slipRes.rows[0];

    // 4. Update cart to hybrid
    await client.query(
      `UPDATE pos_held_carts SET is_hybrid = TRUE, wholesale_picking_slip_id = $1 WHERE id = $2`,
      [slip.id, id]
    );

    await client.query('COMMIT');
    return apiSuccess({ slip });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error creating picking slip:', err);
    return apiError('Failed to create picking slip', 500);
  } finally {
    client.release();
  }
}

import { auth } from '@/auth';
import { apiSuccess, apiError, apiValidationError } from '@/lib/api-response';
import { assertPermission } from '@/lib/authz';
import pool, { query } from '@/lib/db/client';
import type { SessionUser } from '@/lib/authz';
import { z } from 'zod';

const heldCartSchema = z.object({
  session_id: z.string().uuid(),
  warehouse_id: z.string().uuid(),
  note: z.string().optional().nullable(),
  lines: z.array(z.object({
    product_id: z.string().uuid(),
    qty: z.number().positive(),
    unit_price: z.number().nonnegative(),
    discount_amount: z.number().nonnegative().optional().default(0),
  })).min(1),
});

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;

  try { assertPermission(u, 'pos:cashier'); } catch { return apiError('Forbidden', 403); }

  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get('session_id');

  if (!sessionId) return apiError('session_id is required', 400);

  const heldCarts = await query(
    `SELECT hc.*, 
            (SELECT COUNT(*) FROM pos_held_cart_lines WHERE held_cart_id = hc.id) as line_count
     FROM pos_held_carts hc
     JOIN pos_sessions ps ON ps.id = hc.session_id
     WHERE hc.session_id = $1 AND ps.opened_by = $2
     ORDER BY hc.created_at DESC`,
    [sessionId, u.id]
  );

  return apiSuccess(heldCarts);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;

  try { assertPermission(u, 'pos:cashier'); } catch { return apiError('Forbidden', 403); }

  const client = await pool.connect();
  try {
    const body = await req.json();
    const data = heldCartSchema.parse(body);

    await client.query('BEGIN');

    const hcResult = await client.query(
      `INSERT INTO pos_held_carts (session_id, warehouse_id, note, created_by)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [data.session_id, data.warehouse_id, data.note ?? null, u.id]
    );
    const hcId = hcResult.rows[0].id;

    for (const line of data.lines) {
      await client.query(
        `INSERT INTO pos_held_cart_lines (held_cart_id, product_id, qty, unit_price, discount_amount)
         VALUES ($1, $2, $3, $4, $5)`,
        [hcId, line.product_id, line.qty, line.unit_price, line.discount_amount]
      );
    }

    await client.query('COMMIT');
    return apiSuccess({ id: hcId }, 201);
  } catch (err: unknown) {
    await client.query('ROLLBACK');
    if (err instanceof z.ZodError) return apiValidationError(err);
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return apiError(msg, 500);
  } finally {
    client.release();
  }
}

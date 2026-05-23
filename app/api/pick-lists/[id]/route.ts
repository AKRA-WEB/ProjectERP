import { auth } from '@/auth';
import { apiSuccess, apiError, apiValidationError } from '@/lib/api-response';
import { assertRole } from '@/lib/authz';
import pool, { query, queryOne } from '@/lib/db/client';
import { z } from 'zod';
import type { SessionUser } from '@/lib/authz';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);

  const { id } = await params;

  const pickList = await queryOne(
    `SELECT pl.*,
           w.name_th AS warehouse_name,
           assigned.name_th AS assigned_to_name,
           creator.name_th AS created_by_name,
           so.so_number
    FROM pick_lists pl
    JOIN warehouses w ON w.id = pl.warehouse_id
    LEFT JOIN users assigned ON assigned.id = pl.assigned_to
    JOIN users creator ON creator.id = pl.created_by
    LEFT JOIN sales_orders so ON so.id = pl.sales_order_id
    WHERE pl.id = $1`,
    [id]
  );

  if (!pickList) return apiError('Pick List not found', 404);

  const lines = await query(
    `SELECT pll.*,
           p.name_th AS product_name, p.sku AS product_sku,
           COALESCE(sb.qty_on_hand, 0) AS qty_on_hand,
           COALESCE(sb.qty_available, 0) AS qty_available,
           l.lot_number AS suggested_lot_number,
           l.expiry_date AS suggested_expiry
    FROM pick_list_lines pll
    JOIN products p ON p.id = pll.product_id
    LEFT JOIN stock_balances sb ON sb.product_id = pll.product_id
      AND sb.warehouse_id = $2
    LEFT JOIN lots l ON l.id = pll.lot_id
    WHERE pll.pick_list_id = $1
    ORDER BY pll.created_at`,
    [id, (pickList as { warehouse_id: string }).warehouse_id]
  );

  return apiSuccess({ ...pickList, lines });
}

const patchSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('open'),
  }),
  z.object({
    action: z.literal('assign'),
    assigned_to: z.string().uuid(),
  }),
  z.object({
    action: z.literal('complete'),
  }),
  z.object({
    action: z.literal('cancel'),
  }),
]);

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;

  const { id } = await params;
  const body = await req.json().catch(() => null);
  if (!body) return apiError('Invalid JSON', 400);

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return apiValidationError(parsed.error);

  const pickList = await queryOne<{ status: string; warehouse_id: string; assigned_to: string }>(
    'SELECT status, warehouse_id, assigned_to FROM pick_lists WHERE id = $1',
    [id]
  );
  if (!pickList) return apiError('Pick List not found', 404);

  const { action } = parsed.data;

  if (action === 'open') {
    try { assertRole(u, ['manager', 'admin']); } catch { return apiError('Forbidden', 403); }
    if (pickList.status !== 'draft') return apiError('Only draft pick lists can be opened', 422);

    const lines = await query<{ id: string; product_id: string; qty_requested: number; qty_available: number; product_name: string }>(
      `SELECT pll.id, pll.product_id, pll.qty_requested,
             COALESCE(sb.qty_available, 0) AS qty_available,
             p.name_th AS product_name
      FROM pick_list_lines pll
      JOIN products p ON p.id = pll.product_id
      LEFT JOIN stock_balances sb ON sb.product_id = pll.product_id
        AND sb.warehouse_id = $2
      WHERE pll.pick_list_id = $1`,
      [id, pickList.warehouse_id]
    );

    if (lines.length === 0) return apiError('Pick list has no lines', 422);

    const shortages = lines.filter(l => Number(l.qty_available) < Number(l.qty_requested));
    if (shortages.length > 0) {
      return apiError('Insufficient stock availability', 422, shortages.map(s => ({
        product_id: s.product_id,
        product_name: s.product_name,
        requested: s.qty_requested,
        available: s.qty_available
      })));
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const updateRes = await client.query(
        "UPDATE pick_lists SET status = 'open', updated_at = NOW() WHERE id = $1 AND status = 'draft' RETURNING id",
        [id]
      );

      if (updateRes.rowCount === 0) {
        await client.query('ROLLBACK');
        return apiError('Conflict: Pick list status changed by another process', 409);
      }

      for (const line of lines) {
        // UPSERT into stock_balances to reserve stock
        await client.query(
          `INSERT INTO stock_balances (warehouse_id, product_id, qty_reserved)
           VALUES ($1, $2, $3)
           ON CONFLICT (warehouse_id, product_id)
           DO UPDATE SET qty_reserved = stock_balances.qty_reserved + $3, last_updated = NOW()`,
          [pickList.warehouse_id, line.product_id, line.qty_requested]
        );
      }

      await client.query('COMMIT');
      return apiSuccess({ status: 'open' });
    } catch (err) {
      await client.query('ROLLBACK');
      console.error(err);
      return apiError('Failed to open pick list', 500);
    } finally {
      client.release();
    }
  }

  if (action === 'assign') {
    try { assertRole(u, ['manager', 'admin']); } catch { return apiError('Forbidden', 403); }
    if (pickList.status !== 'open') return apiError('Only open pick lists can be assigned', 422);

    await query(
      "UPDATE pick_lists SET assigned_to = $1, status = 'picking', updated_at = NOW() WHERE id = $2 AND status = 'open'",
      [parsed.data.assigned_to, id]
    );
    return apiSuccess({ status: 'picking' });
  }

  if (action === 'complete') {
    const isAuthorized = u.role === 'admin' || u.role === 'manager' || u.id === pickList.assigned_to;
    if (!isAuthorized) return apiError('Forbidden', 403);
    if (pickList.status !== 'picking') return apiError('Only pick lists in picking status can be completed', 422);

    const lines = await query<{ qty_picked: number; qty_requested: number; id: string }>(
      'SELECT id, qty_picked, qty_requested FROM pick_list_lines WHERE pick_list_id = $1',
      [id]
    );

    const totalPicked = lines.reduce((sum, l) => sum + Number(l.qty_picked), 0);
    if (totalPicked === 0) return apiError('No items have been picked', 422);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      for (const line of lines) {
        const status = Number(line.qty_picked) >= Number(line.qty_requested) ? 'picked' : 'short_picked';
        await client.query(
          'UPDATE pick_list_lines SET status = $1, updated_at = NOW() WHERE id = $2',
          [status, line.id]
        );
      }

      await client.query(
        "UPDATE pick_lists SET status = 'completed', updated_at = NOW() WHERE id = $1 AND status = 'picking'",
        [id]
      );

      await client.query('COMMIT');
      return apiSuccess({ status: 'completed' });
    } catch (err) {
      await client.query('ROLLBACK');
      console.error(err);
      return apiError('Failed to complete pick list', 500);
    } finally {
      client.release();
    }
  }

  if (action === 'cancel') {
    try { assertRole(u, ['manager', 'admin']); } catch { return apiError('Forbidden', 403); }
    if (!['draft', 'open'].includes(pickList.status)) return apiError('Only draft or open pick lists can be cancelled', 422);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      if (pickList.status === 'open') {
        const lines = await client.query<{ product_id: string; qty_requested: number }>(
          'SELECT product_id, qty_requested FROM pick_list_lines WHERE pick_list_id = $1',
          [id]
        );
        for (const line of lines.rows) {
          await client.query(
            `UPDATE stock_balances
             SET qty_reserved = GREATEST(qty_reserved - $3, 0), last_updated = NOW()
             WHERE product_id = $1 AND warehouse_id = $2`,
            [line.product_id, pickList.warehouse_id, line.qty_requested]
          );
        }
      }

      await client.query(
        "UPDATE pick_lists SET status = 'cancelled', updated_at = NOW() WHERE id = $1",
        [id]
      );

      await client.query('COMMIT');
      return apiSuccess({ status: 'cancelled' });
    } catch (err) {
      await client.query('ROLLBACK');
      console.error(err);
      return apiError('Failed to cancel pick list', 500);
    } finally {
      client.release();
    }
  }

  return apiError('Unknown action', 400);
}

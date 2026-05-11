import { auth } from '@/auth';
import { apiSuccess, apiError, apiValidationError } from '@/lib/api-response';
import { assertPermission } from '@/lib/authz';
import pool, { queryOne, query } from '@/lib/db/client';
import { z } from 'zod';
import type { SessionUser } from '@/lib/authz';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;

  try { assertPermission(u, 'do:view'); } catch { return apiError('Forbidden', 403); }
  const { id } = await params;

  const do_ = await queryOne(
    `SELECT do_.*, 
            so.so_number,
            c.name_th AS customer_name_th, 
            w.name_th AS warehouse_name_th,
            u_cr.name_en AS created_by_name
     FROM delivery_orders do_
     JOIN sales_orders so ON so.id = do_.so_id
     JOIN customers c ON c.id = so.customer_id
     JOIN warehouses w ON w.id = do_.warehouse_id
     JOIN users u_cr ON u_cr.id = do_.created_by
     WHERE do_.id = $1`,
    [id]
  );
  if (!do_) return apiError('Delivery order not found', 404);

  const lines = await query(
    `SELECT li.*, p.sku, p.name_th, p.name_en
     FROM do_line_items li
     JOIN products p ON p.id = li.product_id
     WHERE li.do_id = $1
     ORDER BY li.line_number ASC`,
    [id]
  );

  return apiSuccess({ ...do_, lines });
}

const actionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('ready') }),
  z.object({ action: z.literal('ship') }),
  z.object({ action: z.literal('deliver') }),
  z.object({ action: z.literal('cancel') }),
]);

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;
  const { id } = await params;

  const body = await req.json().catch(() => null);
  if (!body) return apiError('Invalid JSON', 400);
  const parsed = actionSchema.safeParse(body);
  if (!parsed.success) return apiValidationError(parsed.error);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const doRes = await client.query(
      'SELECT * FROM delivery_orders WHERE id = $1 FOR UPDATE',
      [id]
    );
    const do_ = doRes.rows[0];
    if (!do_) { await client.query('ROLLBACK'); return apiError('DO not found', 404); }

    const { action } = parsed.data;

    if (action === 'ready') {
      try { assertPermission(u, 'do:create'); } catch { await client.query('ROLLBACK'); return apiError('Forbidden', 403); }
      if (do_.status !== 'draft') { await client.query('ROLLBACK'); return apiError('Can only mark draft DO as ready', 409); }
      
      const updated = await client.query(
        `UPDATE delivery_orders SET status = 'ready', updated_at = NOW() WHERE id = $1 RETURNING *`,
        [id]
      );
      await client.query('COMMIT');
      return apiSuccess(updated.rows[0]);
    }

    if (action === 'ship') {
      try { assertPermission(u, 'do:ship'); } catch { await client.query('ROLLBACK'); return apiError('Forbidden', 403); }
      if (do_.status !== 'ready') { await client.query('ROLLBACK'); return apiError('Can only ship ready DO', 409); }
      
      // Get lines to deduct stock
      const linesRes = await client.query('SELECT product_id, qty_to_deliver, so_line_item_id FROM do_line_items WHERE do_id = $1', [id]);
      
      for (const line of linesRes.rows) {
        // Deduct stock via ledger entry
        // We need to fetch current qty_on_hand
        const balanceRes = await client.query(
          'SELECT qty_on_hand FROM stock_balances WHERE warehouse_id = $1 AND product_id = $2 FOR UPDATE',
          [do_.warehouse_id, line.product_id]
        );
        const qtyAfter = Number(balanceRes.rows[0]?.qty_on_hand ?? 0) - Number(line.qty_to_deliver);

        await client.query(
          `INSERT INTO stock_ledger (warehouse_id, product_id, entry_type, reference_type, reference_id, qty_change, qty_after, created_by)
           VALUES ($1, $2, 'so_delivery', 'delivery_order', $3, $4, $5, $6)`,
          [do_.warehouse_id, line.product_id, do_.id, -line.qty_to_deliver, qtyAfter, u.id]
        );

        // Update SO Line delivered qty
        await client.query(
          `UPDATE so_line_items SET qty_delivered = qty_delivered + $1 WHERE id = $2`,
          [line.qty_to_deliver, line.so_line_item_id]
        );
      }

      // Re-evaluate SO status
      const soLinesRes = await client.query(
        'SELECT qty_ordered, qty_delivered FROM so_line_items WHERE so_id = $1',
        [do_.so_id]
      );
      const allFullyDelivered = soLinesRes.rows.every(l => Number(l.qty_delivered) >= Number(l.qty_ordered));
      
      await client.query(
        `UPDATE sales_orders SET status = $1, updated_at = NOW() WHERE id = $2`,
        [allFullyDelivered ? 'fully_delivered' : 'partially_delivered', do_.so_id]
      );

      const updated = await client.query(
        `UPDATE delivery_orders SET status = 'shipped', shipped_at = NOW(), updated_at = NOW() WHERE id = $1 RETURNING *`,
        [id]
      );
      await client.query('COMMIT');
      return apiSuccess(updated.rows[0]);
    }

    if (action === 'deliver') {
      try { assertPermission(u, 'do:deliver'); } catch { await client.query('ROLLBACK'); return apiError('Forbidden', 403); }
      if (do_.status !== 'shipped') { await client.query('ROLLBACK'); return apiError('Can only deliver shipped DO', 409); }
      
      const updated = await client.query(
        `UPDATE delivery_orders SET status = 'delivered', delivered_at = NOW(), updated_at = NOW() WHERE id = $1 RETURNING *`,
        [id]
      );
      await client.query('COMMIT');
      return apiSuccess(updated.rows[0]);
    }

    if (action === 'cancel') {
      try { assertPermission(u, 'do:create'); } catch { await client.query('ROLLBACK'); return apiError('Forbidden', 403); }
      if (['shipped', 'delivered', 'cancelled'].includes(do_.status)) {
        await client.query('ROLLBACK'); return apiError(`Cannot cancel DO in status ${do_.status}`, 409);
      }
      
      const updated = await client.query(
        `UPDATE delivery_orders SET status = 'cancelled', cancelled_at = NOW(), updated_at = NOW() WHERE id = $1 RETURNING *`,
        [id]
      );
      await client.query('COMMIT');
      return apiSuccess(updated.rows[0]);
    }

    await client.query('ROLLBACK');
    return apiError('Invalid action', 400);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Patch DO error:', err);
    return apiError('Failed to update delivery order', 500);
  } finally {
    client.release();
  }
}

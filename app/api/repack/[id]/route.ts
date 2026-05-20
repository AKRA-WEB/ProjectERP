import { NextRequest } from 'next/server';
import { auth } from '@/auth';
import pool, { query } from '@/lib/db/client';
import { apiSuccess, apiError, apiValidationError } from '@/lib/api-response';
import { PatchRepackOrderSchema } from '@/lib/validations/repack';
import { type SessionUser, assertWarehouseAccess } from '@/lib/authz';
import type { RepackOrder, RepackOrderItem } from '@/types';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);

  const { id } = await params;

  const [order] = await query<RepackOrder>(`
    SELECT 
      ro.*,
      p.sku AS source_product_sku,
      p.name_th AS source_product_name_th,
      w.name_th AS warehouse_name_th,
      u.name_en AS created_by_name
    FROM repack_orders ro
    JOIN products p ON p.id = ro.source_product_id
    JOIN warehouses w ON w.id = ro.warehouse_id
    LEFT JOIN users u ON u.id = ro.created_by
    WHERE ro.id = $1
  `, [id]);

  if (!order) return apiError('Repack order not found', 404);

  const items = await query<RepackOrderItem>(`
    SELECT 
      roi.*,
      p.sku AS product_sku,
      p.name_th AS product_name_th
    FROM repack_order_items roi
    JOIN products p ON p.id = roi.product_id
    WHERE roi.repack_order_id = $1
    ORDER BY roi.id ASC
  `, [id]);

  return apiSuccess({ ...order, items });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const user = session.user as unknown as SessionUser;

  const { id } = await params;
  const body = await req.json();
  const result = PatchRepackOrderSchema.safeParse(body);
  if (!result.success) return apiValidationError(result.error);
  const { action } = result.data;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: [order] } = await client.query(
      'SELECT status, source_product_id, source_qty, warehouse_id FROM repack_orders WHERE id = $1 FOR UPDATE',
      [id]
    );
    if (!order) throw new Error('Repack order not found');

    try { assertWarehouseAccess(user, order.warehouse_id); } catch { throw new Error('No access to this warehouse'); }

    if (action === 'complete') {
      if (order.status !== 'draft') throw new Error('Only draft orders can be completed');

      // 1. Check source stock
      const { rows: [balance] } = await client.query(
        'SELECT qty_on_hand FROM stock_balances WHERE warehouse_id = $1 AND product_id = $2',
        [order.warehouse_id, order.source_product_id]
      );
      const currentSourceQty = Number(balance?.qty_on_hand || 0);
      if (currentSourceQty < Number(order.source_qty)) {
        throw new Error(`Insufficient stock for source product. Available: ${currentSourceQty}`);
      }

      // 2. Get items
      const { rows: items } = await client.query(
        'SELECT product_id, qty, unit_cost FROM repack_order_items WHERE repack_order_id = $1',
        [id]
      );

      // 3. Stock OUT (Source)
      const qtyAfterSource = currentSourceQty - Number(order.source_qty);
      await client.query(`
        INSERT INTO stock_ledger (
          warehouse_id, product_id, entry_type, reference_type, reference_id, qty_change, qty_after, created_by
        ) VALUES ($1, $2, 'repack_out', 'repack', $3, $4, $5, $6)
      `, [order.warehouse_id, order.source_product_id, id, -Number(order.source_qty), qtyAfterSource, user.id]);

      // 4. Stock IN (Outputs)
      for (const item of items) {
        const { rows: [targetBalance] } = await client.query(
          'SELECT qty_on_hand FROM stock_balances WHERE warehouse_id = $1 AND product_id = $2',
          [order.warehouse_id, item.product_id]
        );
        const currentTargetQty = Number(targetBalance?.qty_on_hand || 0);
        const qtyAfterTarget = currentTargetQty + Number(item.qty);

        await client.query(`
          INSERT INTO stock_ledger (
            warehouse_id, product_id, entry_type, reference_type, reference_id, qty_change, qty_after, unit_cost, created_by
          ) VALUES ($1, $2, 'repack_in', 'repack', $3, $4, $5, $6, $7)
        `, [order.warehouse_id, item.product_id, id, Number(item.qty), qtyAfterTarget, item.unit_cost, user.id]);
      }

      // 5. Update Status
      await client.query(
        'UPDATE repack_orders SET status = $1, completed_at = NOW(), updated_at = NOW() WHERE id = $2',
        ['completed', id]
      );

    } else if (action === 'void') {
      if (order.status === 'completed') throw new Error('Completed orders cannot be voided');
      await client.query(
        "UPDATE repack_orders SET status = 'void', notes = COALESCE(notes, '') || '\nVoid Reason: ' || $1, updated_at = NOW() WHERE id = $2",
        [result.data.action === 'void' ? result.data.reason : '', id]
      );
    }

    await client.query('COMMIT');
    return apiSuccess({ id, status: action === 'complete' ? 'completed' : 'void' });
  } catch (e: unknown) {
    await client.query('ROLLBACK');
    const msg = e instanceof Error ? e.message : 'Failed to update repack order';
    return apiError(msg, 500);
  } finally {
    client.release();
  }
}

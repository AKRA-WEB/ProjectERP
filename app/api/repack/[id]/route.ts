import { NextRequest } from 'next/server';
import { auth } from '@/auth';
import pool, { query } from '@/lib/db/client';
import { apiSuccess, apiError, apiValidationError } from '@/lib/api-response';
import { PatchRepackOrderSchema } from '@/lib/validations/repack';
import { type SessionUser, assertWarehouseAccess } from '@/lib/authz';
import type { RepackOrder, RepackOrderItem } from '@/types';
import { consumeOverrideToken } from '@/lib/auth/override-pin';
import { postYieldLossJE } from '@/lib/repack/postYieldLossJE';

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
      'SELECT status, source_product_id, source_qty, source_unit_cost, warehouse_id FROM repack_orders WHERE id = $1 FOR UPDATE',
      [id]
    );
    if (!order) throw new Error('Repack order not found');

    try { assertWarehouseAccess(user, order.warehouse_id); } catch { throw new Error('No access to this warehouse'); }

    if (action === 'complete') {
      if (order.status !== 'draft') throw new Error('Only draft orders can be completed');

      const { yield_loss_qty = 0, yield_loss_reason, override_token } = result.data;
      const source_qty = Number(order.source_qty);
      const loss_pct = source_qty > 0 ? (yield_loss_qty / source_qty) * 100 : 0;

      // 1. Threshold Check
      const { rows: [settings] } = await client.query('SELECT threshold_pct FROM repack_loss_settings WHERE id = 1');
      const threshold = Number(settings?.threshold_pct || 5);

      if (loss_pct > threshold && !override_token) {
        await client.query('ROLLBACK');
        return apiError('Yield loss above threshold', 412, { 
          code: 'YIELD_OVER_THRESHOLD', 
          threshold_pct: threshold, 
          loss_pct: loss_pct 
        });
      }

      // 2. Consume Override Token if needed
      if (loss_pct > threshold && override_token) {
        try {
          await consumeOverrideToken(override_token, 'repack_yield_override', {
            user_id: user.id,
            target_table: 'repack_orders',
            target_id: id,
            original_value: { threshold_pct: threshold },
            override_value: { loss_pct: loss_pct },
            reason_code: 'yield_loss_above_threshold'
          });
        } catch (err: unknown) {
          await client.query('ROLLBACK');
          const e = err as { message?: string; status?: number };
          return apiError(e.message || 'Override failed', e.status || 401);
        }
      }

      // 3. Check source stock
      const { rows: [balance] } = await client.query(
        'SELECT qty_on_hand FROM stock_balances WHERE warehouse_id = $1 AND product_id = $2',
        [order.warehouse_id, order.source_product_id]
      );
      const currentSourceQty = Number(balance?.qty_on_hand || 0);
      if (currentSourceQty < source_qty) {
        throw new Error(`Insufficient stock for source product. Available: ${currentSourceQty}`);
      }

      // 4. Get items
      const { rows: items } = await client.query(
        'SELECT product_id, qty, unit_cost FROM repack_order_items WHERE repack_order_id = $1',
        [id]
      );

      // 5. Stock OUT (Source BLK -> V-PACK)
      const qtyAfterSource = currentSourceQty - source_qty;
      await client.query(`
        INSERT INTO stock_ledger (
          warehouse_id, product_id, entry_type, reference_type, reference_id, qty_change, qty_after, created_by
        ) VALUES ($1, $2, 'repack_stage_in', 'repack', $3, $4, $5, $6)
      `, [order.warehouse_id, order.source_product_id, id, -source_qty, qtyAfterSource, user.id]);

      // Fetch all target balances
      const productIds = items.map((i: { product_id: string }) => i.product_id);
      const { rows: balances } = await client.query(
        'SELECT product_id, qty_on_hand FROM stock_balances WHERE warehouse_id = $1 AND product_id = ANY($2::uuid[])',
        [order.warehouse_id, productIds]
      );
      const balanceMap = new Map(balances.map(b => [b.product_id, Number(b.qty_on_hand || 0)]));

      // 6. Stock IN (Outputs V-PACK -> RTL)
      for (const item of items) {
        const currentTargetQty = balanceMap.get(item.product_id) || 0;
        const qtyAfterTarget = currentTargetQty + Number(item.qty);

        await client.query(`
          INSERT INTO stock_ledger (
            warehouse_id, product_id, entry_type, reference_type, reference_id, qty_change, qty_after, unit_cost, created_by
          ) VALUES ($1, $2, 'repack_stage_out', 'repack', $3, $4, $5, $6, $7)
        `, [order.warehouse_id, item.product_id, id, Number(item.qty), qtyAfterTarget, item.unit_cost, user.id]);
      }

      // 7. Stock Loss (V-PACK -> V-KILL)
      if (yield_loss_qty > 0) {
        await client.query(`
          INSERT INTO stock_ledger (
            warehouse_id, product_id, entry_type, reference_type, reference_id, qty_change, qty_after, created_by
          ) VALUES ($1, $2, 'scrap', 'repack', $3, $4, $5, $6)
        `, [order.warehouse_id, order.source_product_id, id, -yield_loss_qty, qtyAfterSource - yield_loss_qty, user.id]);
      }

      // 8. Post JE if loss > 0
      let closed_je_id = null;
      if (yield_loss_qty > 0) {
        const { rows: [period] } = await client.query(
          `SELECT id FROM fiscal_periods WHERE status = 'open' AND CURRENT_DATE BETWEEN start_date AND end_date LIMIT 1`
        );
        if (!period) throw new Error('No open fiscal period found for current date');
        
        const { je_id } = await postYieldLossJE(client, id, yield_loss_qty, Number(order.source_unit_cost || 0), period.id, user.id);
        closed_je_id = je_id;
      }

      // 9. Update Repack Order
      await client.query(
        `UPDATE repack_orders SET 
           status = 'completed', 
           completed_at = NOW(), 
           updated_at = NOW(),
           yield_loss_qty = $1,
           yield_loss_reason = $2,
           closed_je_id = $3
         WHERE id = $4`,
        [yield_loss_qty, yield_loss_reason || null, closed_je_id, id]
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

import { auth } from '@/auth';
import { apiSuccess, apiError } from '@/lib/api-response';
import pool from '@/lib/db/client';
import type { SessionUser } from '@/lib/authz';

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;

  const { id } = await params;
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const grn = await client.query<{ status: string; warehouse_id: string; po_id: string | null; inbound_order_id: string | null }>(
      'SELECT status, warehouse_id, po_id, inbound_order_id FROM goods_receipt_notes WHERE id = $1 FOR UPDATE',
      [id]
    );
    if (!grn.rows[0]) { await client.query('ROLLBACK'); return apiError('GRN not found', 404); }
    if (!['qc_passed', 'verified'].includes(grn.rows[0].status)) {
      await client.query('ROLLBACK');
      return apiError('GRN must be qc_passed or verified before stocking', 409);
    }

    const { warehouse_id, po_id, inbound_order_id } = grn.rows[0];

    const lines = await client.query<{
      id: string; product_id: string; lot_number: string | null; serial_number: string | null;
      expiry_date: string | null; qty_accepted: number; base_qty: number | null;
      is_lot_tracked: boolean; is_serial_tracked: boolean;
      po_line_item_id: string | null; inbound_order_line_id: string | null;
      unit_cost: number; transaction_uom_id: string | null; po_unit_price: number | null;
    }>(
      `SELECT li.id, li.product_id, li.lot_number, li.serial_number, li.expiry_date,
              li.qty_accepted, li.base_qty, li.transaction_uom_id,
              li.po_line_item_id, li.inbound_order_line_id,
              p.is_lot_tracked, p.is_serial_tracked, p.unit_cost,
              pol.unit_price AS po_unit_price
       FROM grn_line_items li
       JOIN products p ON p.id = li.product_id
       LEFT JOIN po_line_items pol ON pol.id = li.po_line_item_id
       WHERE li.grn_id = $1 AND li.qty_accepted > 0`,
      [id]
    );

    for (const line of lines.rows) {
      let lotId: string | null = null;

      // Compute cost per base unit from PO line price + UoM conversion
      let costPerBaseUnit = line.unit_cost; // default: use existing product cost
      if (line.transaction_uom_id && line.po_unit_price != null) {
        const convRow = await client.query<{ factor: string }>(
          'SELECT factor FROM uom_conversions WHERE uom_id = $1',
          [line.transaction_uom_id]
        );
        const factor = convRow.rows[0] ? Number(convRow.rows[0].factor) : 1;
        costPerBaseUnit = Number(line.po_unit_price) / factor;
        // Sync product's unit_cost to new cost per base unit
        await client.query(
          'UPDATE products SET unit_cost = $1, updated_at = NOW() WHERE id = $2',
          [costPerBaseUnit, line.product_id]
        );
      }

      // Use effective qty: base_qty if set (multi-UoM), else qty_accepted (legacy)
      const effectiveQty = line.base_qty != null ? Number(line.base_qty) : Number(line.qty_accepted);

      if (line.is_lot_tracked && line.lot_number) {
        const lot = await client.query<{ id: string }>(
          `INSERT INTO lots (product_id, warehouse_id, lot_number, serial_number, expiry_date, qty_on_hand)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (product_id, warehouse_id, lot_number)
           DO UPDATE SET qty_on_hand = lots.qty_on_hand + EXCLUDED.qty_on_hand, expiry_date = COALESCE(EXCLUDED.expiry_date, lots.expiry_date)
           RETURNING id`,
          [line.product_id, warehouse_id, line.lot_number, line.serial_number ?? null, line.expiry_date ?? null, effectiveQty]
        );
        lotId = lot.rows[0]?.id ?? null;
      }

      const balanceRes = await client.query<{ qty_on_hand: string }>(
        'SELECT qty_on_hand FROM stock_balances WHERE warehouse_id = $1 AND product_id = $2',
        [warehouse_id, line.product_id]
      );
      const currentQty = Number(balanceRes.rows[0]?.qty_on_hand ?? 0);
      const qtyAfter = currentQty + effectiveQty;

      await client.query(
        `INSERT INTO stock_ledger (warehouse_id, product_id, lot_id, entry_type, reference_type, reference_id, qty_change, qty_after, unit_cost, created_by)
         VALUES ($1, $2, $3, 'grn_receipt', 'grn', $4, $5, $6, $7, $8)`,
        [warehouse_id, line.product_id, lotId, id, effectiveQty, qtyAfter, costPerBaseUnit, u.id]
      );

      if (line.po_line_item_id) {
        await client.query(
          `UPDATE po_line_items SET qty_received = qty_received + $1 WHERE id = $2`,
          [effectiveQty, line.po_line_item_id]
        );
      } else if (line.inbound_order_line_id) {
        await client.query(
          `UPDATE inbound_order_lines SET qty_received = qty_received + $1 WHERE id = $2`,
          [effectiveQty, line.inbound_order_line_id]
        );
      }
    }

    await client.query(
      `UPDATE goods_receipt_notes SET status = 'stocked', stocked_by = $1, stocked_at = NOW() WHERE id = $2`,
      [u.id, id]
    );

    if (po_id) {
      const poLines = await client.query<{ qty_ordered: string; qty_received: string }>(
        'SELECT qty_ordered, qty_received FROM po_line_items WHERE po_id = $1',
        [po_id]
      );
      const fullyReceived = poLines.rows.every((l) => Number(l.qty_received) >= Number(l.qty_ordered));
      const anyReceived = poLines.rows.some((l) => Number(l.qty_received) > 0);
      const poStatus = fullyReceived ? 'fully_received' : anyReceived ? 'partially_received' : 'sent';
      await client.query('UPDATE purchase_orders SET status = $1 WHERE id = $2', [poStatus, po_id]);
    } else if (inbound_order_id) {
      // IO status stays 'verified' — user records vendor_ref separately to close it
    }

    await client.query('COMMIT');
    return apiSuccess({ id, status: 'stocked' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('GRN stock error:', err);
    return apiError('Failed to stock GRN', 500);
  } finally {
    client.release();
  }
}

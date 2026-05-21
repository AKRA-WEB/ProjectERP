import { auth } from '@/auth';
import { apiSuccess, apiError } from '@/lib/api-response';
import { assertRole } from '@/lib/authz';
import { query, queryOne } from '@/lib/db/client';
import pool from '@/lib/db/client';
import type { SessionUser } from '@/lib/authz';

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;
  try { assertRole(u, ['manager', 'admin']); } catch { return apiError('Forbidden', 403); }

  const { id } = await params;
  const grn = await queryOne<{ status: string; po_id: string; warehouse_id: string }>(
    'SELECT status, po_id, warehouse_id FROM goods_receipt_notes WHERE id = $1',
    [id]
  );
  if (!grn) return apiError('GRN not found', 404);
  if (grn.status !== 'received') return apiError('Only received GRNs can be confirmed', 409);

  // Set qty_accepted = qty_received for all lines that haven't been QC'd
  await query(
    `UPDATE grn_line_items
     SET qty_accepted = qty_received
     WHERE grn_id = $1 AND qty_accepted IS NULL`,
    [id]
  );

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const lines = await client.query<{
      id: string;
      product_id: string;
      po_line_item_id: string;
      qty_accepted: number;
      lot_number: string | null;
      serial_number: string | null;
      expiry_date: string | null;
      storage_location: string | null;
      transaction_uom_id: string | null;
      base_qty: number | null;
    }>(
      `SELECT id, product_id, po_line_item_id, qty_accepted,
              lot_number, serial_number, expiry_date, storage_location,
              transaction_uom_id, base_qty
       FROM grn_line_items
       WHERE grn_id = $1 AND qty_accepted > 0`,
      [id]
    );

    for (const line of lines.rows) {
      const effectiveQty = Number(line.base_qty ?? line.qty_accepted);

      // Fetch current qty_on_hand to compute qty_after
      const balanceRes = await client.query<{ qty_on_hand: string }>(
        'SELECT qty_on_hand FROM stock_balances WHERE warehouse_id = $1 AND product_id = $2',
        [grn.warehouse_id, line.product_id]
      );
      const currentQty = Number(balanceRes.rows[0]?.qty_on_hand ?? 0);
      const qtyAfter = currentQty + effectiveQty;

      // Stock ledger INSERT
      await client.query(
        `INSERT INTO stock_ledger
           (warehouse_id, product_id, lot_id, entry_type, qty_change, qty_after, reference_id, reference_type, notes)
         VALUES ($1, $2, $3, 'grn_receipt', $4, $5, $6, 'grn', $7)`,
        [
          grn.warehouse_id,
          line.product_id,
          null,
          effectiveQty,
          qtyAfter,
          id,
          `GRN ${id} confirmed by supervisor`,
        ]
      );

      // Update PO line qty_received
      if (line.po_line_item_id) {
        await client.query(
          `UPDATE po_line_items
           SET qty_received = COALESCE(qty_received, 0) + $1
           WHERE id = $2`,
          [effectiveQty, line.po_line_item_id]
        );
      }
    }

    // Update PO status (fully or partially received)
    if (grn.po_id) {
      const poLines = await client.query<{ qty_ordered: number; qty_received: number }>(
        `SELECT qty_ordered, COALESCE(qty_received, 0) AS qty_received
         FROM po_line_items WHERE po_id = $1`,
        [grn.po_id]
      );
      const allFull = poLines.rows.every((l) => Number(l.qty_received) >= Number(l.qty_ordered));
      const anyReceived = poLines.rows.some((l) => Number(l.qty_received) > 0);
      const poStatus = allFull ? 'fully_received' : anyReceived ? 'partially_received' : undefined;
      if (poStatus) {
        await client.query(
          `UPDATE purchase_orders SET status = $1 WHERE id = $2`,
          [poStatus, grn.po_id]
        );
      }
    }

    // Update GRN status
    await client.query(
      `UPDATE goods_receipt_notes
       SET status = 'stocked', stocked_by = $1, stocked_at = NOW(), updated_at = NOW()
       WHERE id = $2`,
      [u.id, id]
    );

    // Fetch source info
    const grnFull = await client.query<{ source_type: string; inbound_order_id: string | null }>(
      'SELECT source_type, inbound_order_id FROM goods_receipt_notes WHERE id = $1', [id]
    );
    const grnInfo = grnFull.rows[0];

    if (grnInfo?.source_type === 'inbound_order' && grnInfo.inbound_order_id) {
      const ioId = grnInfo.inbound_order_id;

      // Fetch IO metadata for partial split
      const ioData = await client.query<{
        vendor_id: string; warehouse_id: string; notes: string | null; created_by: string;
      }>('SELECT vendor_id, warehouse_id, notes, created_by FROM inbound_orders WHERE id = $1', [ioId]);
      const io = ioData.rows[0];

      // Compare received vs ordered per line
      const lineComp = await client.query<{
        io_line_id: string; product_id: string; qty_ordered: number;
        qty_received_now: number; line_number: number; notes: string | null;
      }>(
        `SELECT iol.id AS io_line_id, iol.product_id, iol.qty_ordered, iol.notes, iol.line_number,
                COALESCE(gli.qty_received, 0) AS qty_received_now
         FROM inbound_order_lines iol
         LEFT JOIN grn_line_items gli ON gli.inbound_order_line_id = iol.id AND gli.grn_id = $1
         WHERE iol.io_id = $2`,
        [id, ioId]
      );

      const remainingLines = lineComp.rows.filter(
        (r) => Number(r.qty_received_now) < Number(r.qty_ordered)
      );

      // Auto-create partial IO for remaining quantities
      if (remainingLines.length > 0 && io) {
        const newIO = await client.query<{ id: string }>(
          `INSERT INTO inbound_orders (vendor_id, warehouse_id, notes, parent_io_id, created_by)
           VALUES ($1, $2, $3, $4, $5) RETURNING id`,
          [io.vendor_id, io.warehouse_id, io.notes, ioId, u.id]
        );
        const newIoId = newIO.rows[0].id;
        for (let i = 0; i < remainingLines.length; i++) {
          const r = remainingLines[i];
          const remaining = Number(r.qty_ordered) - Number(r.qty_received_now);
          await client.query(
            `INSERT INTO inbound_order_lines (io_id, product_id, qty_ordered, notes, line_number)
             VALUES ($1, $2, $3, $4, $5)`,
            [newIoId, r.product_id, remaining, r.notes, i + 1]
          );
        }
      }

      // Mark original IO as verified
      await client.query(
        `UPDATE inbound_orders SET status = 'verified', verified_by = $1, verified_at = NOW()
         WHERE id = $2`,
        [u.id, ioId]
      );
    }

    // Auto-create AP Invoice
    if (grn.po_id) {
      // Fetch PO vendor + payment terms
      const poInfo = await client.query<{ vendor_id: string; payment_terms_days: number; po_number: string }>(
        `SELECT po.vendor_id, po.payment_terms_days, po.po_number
         FROM goods_receipt_notes g
         JOIN purchase_orders po ON po.id = g.po_id
         WHERE g.id = $1`,
        [id]
      );
      if (poInfo.rows.length > 0) {
        const { vendor_id, payment_terms_days, po_number } = poInfo.rows[0];
        // Calculate invoice amount from accepted lines
        const amtResult = await client.query<{ total: string }>(
          `SELECT COALESCE(SUM(gl.qty_accepted * pl.unit_price), 0) AS total
           FROM grn_line_items gl
           JOIN po_line_items pl ON pl.id = gl.po_line_item_id
           WHERE gl.grn_id = $1 AND gl.qty_accepted > 0`,
          [id]
        );
        const invoiceAmount = parseFloat(amtResult.rows[0].total);
        if (invoiceAmount > 0) {
          // Check if AP invoice already exists for this GRN to prevent duplicates
          const existing = await client.query(
            `SELECT id FROM po_invoices WHERE grn_id = $1`,
            [id]
          );
          if (existing.rows.length === 0) {
            await client.query(
              `INSERT INTO po_invoices
               (po_id, vendor_id, grn_id, invoice_number, invoice_date, due_date, amount, paid_amount)
               VALUES ($1, $2, $3, $4, CURRENT_DATE, CURRENT_DATE + ($5 || ' days')::INTERVAL, $6, 0)`,
              [grn.po_id, vendor_id, id, po_number, payment_terms_days, invoiceAmount]
            );
          }
        }
      }
    }

    await client.query('COMMIT');
    return apiSuccess({ id, status: 'stocked' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    return apiError('Failed to confirm GRN', 500);
  } finally {
    client.release();
  }
}

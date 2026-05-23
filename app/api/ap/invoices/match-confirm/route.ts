import { auth } from '@/auth';
import { apiSuccess, apiError } from '@/lib/api-response';
import pool from '@/lib/db/client';
import type { SessionUser } from '@/types';
import { z } from 'zod';

const MatchSchema = z.object({
  po_invoice_id: z.string().uuid(),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;

  // Supervisor or Admin
  if (!['admin', 'manager'].includes(u.role)) {
    return apiError('Forbidden', 403);
  }

  const body = await req.json().catch(() => null);
  if (!body) return apiError('Invalid JSON', 400);
  const result = MatchSchema.safeParse(body);
  if (!result.success) return apiError('Invalid request body', 400);
  const { po_invoice_id } = result.data;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Get info
    const invRes = await client.query(
      `SELECT pi.*, po.warehouse_id, po.id as po_id, grn.id as grn_id
       FROM po_invoices pi
       JOIN purchase_orders po ON po.id = pi.po_id
       LEFT JOIN goods_receipt_notes grn ON grn.id = pi.grn_id
       WHERE pi.id = $1 FOR UPDATE`,
      [po_invoice_id]
    );
    if (invRes.rowCount === 0) {
      await client.query('ROLLBACK');
      return apiError('Invoice not found', 404);
    }
    const inv = invRes.rows[0];

    // 2. Update status
    await client.query(
      `UPDATE po_invoices SET match_status = 'matched' WHERE id = $1`,
      [po_invoice_id]
    );

    // 3. Post stock ledger and update lines
    if (inv.grn_id) {
       const grnLines = await client.query(
         `SELECT * FROM grn_line_items WHERE grn_id = $1`,
         [inv.grn_id]
       );

       for (const line of grnLines.rows) {
         // Update PO line received qty
         if (line.po_line_item_id) {
           await client.query(
             `UPDATE po_line_items SET qty_received = qty_received + $1 WHERE id = $2`,
             [line.qty_received, line.po_line_item_id]
           );
         }

         // Get current balance
         const balanceRes = await client.query(
           `SELECT qty_on_hand FROM stock_balances 
            WHERE warehouse_id = $1 AND product_id = $2 FOR UPDATE`,
           [inv.warehouse_id, line.product_id]
         );
         const currentQty = Number(balanceRes.rows[0]?.qty_on_hand || 0);
         const qtyChange = Number(line.qty_received);
         const qtyAfter = currentQty + qtyChange;

         // Insert ledger (official sellable stock)
         await client.query(
           `INSERT INTO stock_ledger (warehouse_id, product_id, lot_id, entry_type, reference_type, reference_id, qty_change, qty_after, unit_cost, created_by)
            VALUES ($1, $2, $3, 'grn_receipt', 'grn', $4, $5, $6, $7, $8)`,
           [inv.warehouse_id, line.product_id, line.lot_id || null, inv.grn_id, qtyChange, qtyAfter, line.unit_cost, u.id]
         );
       }

       // Update GRN status
       await client.query(
         `UPDATE goods_receipt_notes SET status = 'stocked', stocked_by = $1, stocked_at = NOW() WHERE id = $2`,
         [u.id, inv.grn_id]
       );
    }

    // 4. Update PO status if fully received
    const poStatusRes = await client.query(
      `SELECT SUM(qty_ordered) as total_ordered, SUM(qty_received) as total_received
       FROM po_line_items WHERE po_id = $1`,
      [inv.po_id]
    );
    const { total_ordered, total_received } = poStatusRes.rows[0];
    if (Number(total_received) >= Number(total_ordered)) {
      await client.query(
        `UPDATE purchase_orders SET status = 'received' WHERE id = $1`,
        [inv.po_id]
      );
    } else {
      await client.query(
        `UPDATE purchase_orders SET status = 'partially_received' WHERE id = $1`,
        [inv.po_id]
      );
    }

    await client.query('COMMIT');
    return apiSuccess({ matched: true });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Match confirm error:', err);
    return apiError('Failed to confirm match', 500);
  } finally {
    client.release();
  }
}

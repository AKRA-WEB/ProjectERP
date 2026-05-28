import { auth } from '@/auth';
import { readOnlyMiddleware } from '@/lib/auth/readOnlyMiddleware';
import { apiSuccess, apiError } from '@/lib/api-response';
import { assertRole } from '@/lib/authz';
import type { SessionUser } from '@/lib/authz';
import pool from '@/lib/db/client';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const blocked = await readOnlyMiddleware(req);
  if (blocked) return blocked;

  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;

  try {
    assertRole(u, ['admin', 'manager']);
  } catch {
    return apiError('Forbidden', 403);
  }

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const reason = body.reason || null;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Fetch GRN header details
    const grnRes = await client.query<{ status: string; stocked_at: Date | null; po_id: string | null; warehouse_id: string }>(
      'SELECT status, stocked_at, po_id, warehouse_id FROM goods_receipt_notes WHERE id = $1 FOR UPDATE',
      [id]
    );

    if (grnRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return apiError('Goods Receipt Note not found', 404);
    }

    const grn = grnRes.rows[0];

    if (grn.status !== 'stocked') {
      await client.query('ROLLBACK');
      return apiError(`GRN status is ${grn.status}, only 'stocked' GRNs can be reversed`, 409);
    }

    if (!grn.stocked_at) {
      await client.query('ROLLBACK');
      return apiError('GRN stocked_at timestamp is missing', 500);
    }

    // 2. Check linked AP invoices
    const invoiceRes = await client.query<{ id: string; is_paid: boolean }>(
      'SELECT id, is_paid FROM po_invoices WHERE grn_id = $1 FOR SHARE',
      [id]
    );

    if (invoiceRes.rows.some(r => r.is_paid)) {
      await client.query('ROLLBACK');
      return apiError('AP invoice already paid — reverse manually via Journal Entry', 422, { code: 'INVOICE_PAID' });
    }

    // 3. Fetch reversal lines
    const linesRes = await client.query<{ product_id: string; effective_qty: string }>(
      `SELECT product_id, COALESCE(qty_accepted, qty_received) AS effective_qty 
       FROM grn_line_items 
       WHERE grn_id = $1 AND (qty_accepted > 0 OR qty_received > 0)`,
      [id]
    );

    if (linesRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return apiError('GRN has no line items with received/accepted quantities to reverse', 400);
    }

    // 4. Validate stock consumption and current on hand balances
    const blocking: Array<{ type: string; id: string }> = [];

    for (const line of linesRes.rows) {
      // Check for outbound consumption after stocked_at
      const consumptionRes = await client.query<{ reference_type: string; reference_id: string }>(
        `SELECT reference_type, reference_id FROM stock_ledger 
         WHERE warehouse_id = $1 AND product_id = $2 
           AND entry_type IN ('pos_sale', 'so_delivery', 'transfer_out') 
           AND created_at > $3 
         LIMIT 1`,
        [grn.warehouse_id, line.product_id, grn.stocked_at]
      );

      if (consumptionRes.rows.length > 0) {
        blocking.push({
          type: consumptionRes.rows[0].reference_type,
          id: consumptionRes.rows[0].reference_id,
        });
      }
    }

    if (blocking.length > 0) {
      await client.query('ROLLBACK');
      return apiError('Stock consumed after GRN stocking', 422, {
        code: 'CONSUMPTION_EXISTS',
        blocking_transactions: blocking,
      });
    }

    // Validate sufficient current stock on hand
    for (const line of linesRes.rows) {
      const qty = parseFloat(line.effective_qty);

      const balanceRes = await client.query<{ qty_on_hand: string }>(
        'SELECT qty_on_hand FROM stock_balances WHERE warehouse_id = $1 AND product_id = $2 FOR UPDATE',
        [grn.warehouse_id, line.product_id]
      );

      const currentQty = balanceRes.rows.length > 0 ? parseFloat(balanceRes.rows[0].qty_on_hand) : 0;

      if (currentQty < qty) {
        await client.query('ROLLBACK');
        return apiError(
          `Insufficient stock on hand to reverse product (Required: ${qty}, Available: ${currentQty})`,
          422,
          { code: 'INSUFFICIENT_STOCK' }
        );
      }
    }

    // 5. Execute stock ledger negative writes
    for (const line of linesRes.rows) {
      const qty = parseFloat(line.effective_qty);

      await client.query(
        `INSERT INTO stock_ledger (warehouse_id, product_id, entry_type, reference_id, qty_change, created_by)
         VALUES ($1, $2, 'grn_reversal', $3, $4, $5)`,
        [grn.warehouse_id, line.product_id, id, -qty, u.id]
      );
    }

    // 6. Void linked AP invoices
    await client.query(
      'UPDATE po_invoices SET voided = TRUE, updated_at = NOW() WHERE grn_id = $1',
      [id]
    );

    // 7. Revert PO status if sole active GRN
    if (grn.po_id) {
      const activeGrnsRes = await client.query<{ id: string }>(
        'SELECT id FROM goods_receipt_notes WHERE po_id = $1 AND status != \'cancelled\' AND id != $2 LIMIT 1',
        [grn.po_id, id]
      );

      if (activeGrnsRes.rows.length === 0) {
        await client.query(
          'UPDATE purchase_orders SET status = \'sent\', updated_at = NOW() WHERE id = $1',
          [grn.po_id]
        );
      }
    }

    // 8. Mark GRN as cancelled
    await client.query(
      'UPDATE goods_receipt_notes SET status = \'cancelled\', updated_at = NOW() WHERE id = $1',
      [id]
    );

    // 9. Log reversal run
    await client.query(
      `INSERT INTO grn_reversal_log (grn_id, reversed_by, reason, original_stocked_at)
       VALUES ($1, $2, $3, $4)`,
      [id, u.id, reason, grn.stocked_at]
    );

    await client.query('COMMIT');
    return apiSuccess({ id, status: 'cancelled' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Failed to cancel GRN:', err);
    return apiError('Failed to cancel GRN due to an internal error', 500);
  } finally {
    client.release();
  }
}

import { auth } from '@/auth';
import { apiSuccess, apiError } from '@/lib/api-response';
import { assertRole } from '@/lib/authz';
import pool from '@/lib/db/client';
import type { SessionUser } from '@/types';

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;
  try {
    assertRole(u, ['manager', 'admin']);
  } catch {
    return apiError('Forbidden', 403);
  }

  const { id } = await params;
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Fetch PO
    const poRes = await client.query(
      `SELECT id, warehouse_id, status FROM purchase_orders WHERE id = $1 FOR UPDATE`,
      [id]
    );
    if (!poRes.rows[0]) {
      await client.query('ROLLBACK');
      return apiError('PO not found', 404);
    }
    const po = poRes.rows[0];
    if (po.status !== 'draft') {
      await client.query('ROLLBACK');
      return apiError('PO cannot be approved in its current status', 409);
    }

    // 2. Fetch lines
    const linesRes = await client.query(
      `SELECT id, product_id, qty_ordered, unit_price FROM po_line_items WHERE po_id = $1 ORDER BY line_number`,
      [id]
    );
    const lines = linesRes.rows;
    if (!lines.length) {
      await client.query('ROLLBACK');
      return apiError('PO has no line items', 400);
    }

    // 3. Generate GRN number
    const grnNumRes = await client.query(`SELECT next_doc_number('GRN', 'seq_grn') AS grn_number`);
    const grnNumber: string = grnNumRes.rows[0].grn_number;

    // 4. Create GRN header — po_id satisfies chk_grn_source constraint
    const grnRes = await client.query(
      `INSERT INTO goods_receipt_notes (grn_number, po_id, warehouse_id, status, received_date, created_by)
       VALUES ($1, $2, $3, 'stocked', NOW(), $4) RETURNING id`,
      [grnNumber, id, po.warehouse_id, u.id]
    );
    const grnId: string = grnRes.rows[0].id;

    // 5. Create GRN lines + stock ledger entries
    for (const line of lines) {
      await client.query(
        `INSERT INTO grn_line_items (grn_id, po_line_item_id, product_id, qty_received, unit_cost)
         VALUES ($1, $2, $3, $4, $5)`,
        [grnId, line.id, line.product_id, line.qty_ordered, line.unit_price]
      );
      await client.query(
        `INSERT INTO stock_ledger (product_id, warehouse_id, direction, qty, unit_cost, reference_type, reference_id, created_by)
         VALUES ($1, $2, 'in', $3, $4, 'grn', $5, $6)`,
        [line.product_id, po.warehouse_id, line.qty_ordered, line.unit_price, grnId, u.id]
      );
    }

    // 6. Update PO lines: qty_received = qty_ordered
    await client.query(`UPDATE po_line_items SET qty_received = qty_ordered WHERE po_id = $1`, [id]);

    // 7. Update PO status
    await client.query(
      `UPDATE purchase_orders SET status = 'fully_received', approved_by = $2, approved_at = NOW() WHERE id = $1`,
      [id, u.id]
    );

    await client.query('COMMIT');
    return apiSuccess({ po_id: id, grn_id: grnId, grn_number: grnNumber });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[po-approve]', err);
    return apiError('Internal server error', 500);
  } finally {
    client.release();
  }
}

import { auth } from '@/auth';
import { apiSuccess, apiError } from '@/lib/api-response';
import pool from '@/lib/db/client';
import type { SessionUser } from '@/lib/authz';
import { z } from 'zod';

const MergeSchema = z.object({
  po_id: z.string().uuid(),
  br_ids: z.array(z.string().uuid()).min(1),
  received_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  notes: z.string().optional(),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;

  if (!['admin', 'manager'].includes(u.role)) {
    return apiError('Forbidden', 403);
  }

  const body = await req.json().catch(() => null);
  if (!body) return apiError('Invalid JSON', 400);
  const result = MergeSchema.safeParse(body);
  if (!result.success) return apiError('Invalid request body', 400);
  const { po_id, br_ids, received_date, notes } = result.data;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Verify BRs are for this PO and are submitted
    const brs = await client.query(
      `SELECT id, warehouse_id FROM blind_receipts 
       WHERE id = ANY($1) AND po_id = $2 AND status = 'submitted' FOR UPDATE`,
      [br_ids, po_id]
    );
    if (brs.rowCount !== br_ids.length) {
      await client.query('ROLLBACK');
      return apiError('One or more blind receipts not found or not submitted', 409);
    }
    const warehouseId = brs.rows[0].warehouse_id;

    // 2. Sum up quantities
    const summed = await client.query(
      `SELECT product_id, SUM(qty_counted) as total_qty
       FROM blind_receipt_lines
       WHERE blind_receipt_id = ANY($1)
       GROUP BY product_id`,
      [br_ids]
    );

    // 3. Get PO vendor_id
    const poRes = await client.query(`SELECT vendor_id FROM purchase_orders WHERE id = $1`, [po_id]);
    const vendorId = poRes.rows[0].vendor_id;

    // 4. Create GRN
    const grnRes = await client.query(
      `INSERT INTO goods_receipt_notes (grn_number, po_id, warehouse_id, vendor_id, received_by, received_date, source_type, status, notes)
       VALUES (next_doc_number('GRN', 'seq_grn'), $1, $2, $3, $4, $5, 'po', 'draft', $6)
       RETURNING id, grn_number`,
      [po_id, warehouseId, vendorId, u.id, received_date, notes || null]
    );
    const grnId = grnRes.rows[0].id;

    // 5. Create GRN lines
    for (let i = 0; i < summed.rows.length; i++) {
      const line = summed.rows[i];
      // Find matching PO line to get cost and expected qty
      const poLine = await client.query(
        `SELECT id, unit_price, qty_ordered FROM po_line_items 
         WHERE po_id = $1 AND product_id = $2`,
        [po_id, line.product_id]
      );
      const pl = poLine.rows[0];

      await client.query(
        `INSERT INTO grn_line_items (grn_id, product_id, qty_received, qty_expected, unit_cost, po_line_item_id, source_type, line_number)
         VALUES ($1, $2, $3, $4, $5, $6, 'po', $7)`,
        [grnId, line.product_id, line.total_qty, pl?.qty_ordered || 0, pl?.unit_price || 0, pl?.id || null, i + 1]
      );
    }

    // 6. Link BRs to GRN
    await client.query(
      `UPDATE blind_receipts SET grn_id = $1 WHERE id = ANY($2)`,
      [grnId, br_ids]
    );

    await client.query('COMMIT');
    return apiSuccess({ grn_id: grnId, grn_number: grnRes.rows[0].grn_number });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Merge BRs error:', err);
    return apiError('Failed to merge blind receipts', 500);
  } finally {
    client.release();
  }
}

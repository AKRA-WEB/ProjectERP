import { auth } from '@/auth';
import { apiSuccess, apiError, apiValidationError } from '@/lib/api-response';
import { query, queryOne } from '@/lib/db/client';
import pool from '@/lib/db/client';
import { z } from 'zod';
import type { SessionUser } from '@/lib/authz';

const lineSchema = z.object({
  id: z.string().uuid(),
  qty_received: z.number().nonnegative(),
  storage_location: z.string().max(100).optional(),
});

const extraLineSchema = z.object({
  product_id: z.string().uuid(),
  qty_received: z.number().positive(),
  storage_location: z.string().max(100).optional(),
});

const schema = z.object({
  delivery_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  receiver_name: z.string().max(255).optional(),
  warehouse_id: z.string().uuid().optional(),
  lines: z.array(lineSchema).min(1),
  extra_lines: z.array(extraLineSchema).optional(),
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;

  const { id } = await params;
  const grn = await queryOne<{
    status: string;
    po_id: string | null;
    inbound_order_id: string | null;
    warehouse_id: string;
    split_from_grn_id: string | null;
    source_type: string;
    vendor_id: string | null;
    pr_id: string | null;
  }>(
    'SELECT status, po_id, inbound_order_id, warehouse_id, split_from_grn_id, source_type, vendor_id, pr_id FROM goods_receipt_notes WHERE id = $1',
    [id]
  );
  if (!grn) return apiError('GRN not found', 404);
  if (grn.status !== 'draft') return apiError('Only draft GRNs can be received', 409);

  const body = await req.json().catch(() => null);
  if (!body) return apiError('Invalid JSON', 400);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return apiValidationError(parsed.error);

  const effectiveWarehouseId = parsed.data.warehouse_id ?? grn.warehouse_id;
  if (parsed.data.warehouse_id) {
    const wh = await queryOne<{ id: string }>(
      'SELECT id FROM warehouses WHERE id = $1 AND is_active = true',
      [parsed.data.warehouse_id]
    );
    if (!wh) return apiError('Warehouse not found', 404);
  }

  // Fetch all lines for this GRN
  const grnLines = await query<{
    id: string;
    product_id: string;
    po_line_item_id: string | null;
    inbound_order_line_id: string | null;
    pr_line_item_id: string | null;
    qty_expected: number | null;
    unit_cost: number;
    line_number: number;
  }>(
    `SELECT id, product_id, po_line_item_id, inbound_order_line_id, pr_line_item_id, qty_expected, unit_cost, line_number
     FROM grn_line_items WHERE grn_id = $1`,
    [id]
  );

  const lineMap = new Map(grnLines.map((l) => [l.id, l]));
  const receivedMap = new Map(parsed.data.lines.map((l) => [l.id, l]));

  // Validate all submitted line IDs belong to this GRN
  for (const line of parsed.data.lines) {
    if (!lineMap.has(line.id)) return apiError(`Line ${line.id} not in this GRN`, 422);
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Update received quantities + storage_location on all submitted lines
    for (const line of parsed.data.lines) {
      await client.query(
        `UPDATE grn_line_items
         SET qty_received = $1,
             qty_accepted = $1,
             storage_location = COALESCE($2, storage_location)
         WHERE id = $3 AND grn_id = $4`,
        [line.qty_received, line.storage_location ?? null, line.id, id]
      );
    }

    // Insert extra lines (G-003)
    const nextLineNumber = grnLines.length + 1;
    if (parsed.data.extra_lines?.length) {
      for (let i = 0; i < parsed.data.extra_lines.length; i++) {
        const el = parsed.data.extra_lines[i];
        const prod = await client.query<{ unit_cost: number }>('SELECT unit_cost FROM products WHERE id = $1', [el.product_id]);
        const unitCost = Number(prod.rows[0]?.unit_cost || 0);

        await client.query(
          `INSERT INTO grn_line_items
             (grn_id, product_id, qty_received, qty_accepted, qty_expected,
              unit_cost, storage_location, line_number, source_type)
           VALUES ($1, $2, $3, $3, NULL, $4, $5, $6, $7)`,
          [id, el.product_id, el.qty_received, unitCost, el.storage_location ?? null, nextLineNumber + i, grn.source_type]
        );
      }
    }

    // Update GRN header
    await client.query(
      `UPDATE goods_receipt_notes
       SET status = 'received',
           received_date = $1,
           receiver_name = $2,
           received_by = $3,
           warehouse_id = $4,
           updated_at = NOW()
       WHERE id = $5`,
      [parsed.data.delivery_date, parsed.data.receiver_name ?? null, u.id, effectiveWarehouseId, id]
    );

    if (grn.source_type === 'inbound_order' && grn.inbound_order_id) {
      await client.query(
        `UPDATE inbound_orders
         SET status = 'pending_verification',
             updated_at = NOW()
         WHERE id = $1`,
        [grn.inbound_order_id]
      );
    }

    // Auto-split: find lines where qty_received < qty_expected
    const splitLines: (typeof grnLines[number])[] = [];
    for (const grnLine of grnLines) {
      const submitted = receivedMap.get(grnLine.id);
      const qtyReceived = submitted ? submitted.qty_received : 0;
      const qtyExpected = Number(grnLine.qty_expected ?? 0);
      const remaining = qtyExpected - qtyReceived;
      if (remaining > 0) {
        splitLines.push({ ...grnLine, qty_expected: remaining });
      }
    }

    let splitGrnId: string | null = null;
    if (splitLines.length > 0) {
      // Create split GRN (same source, same warehouse, draft status)
      const splitGrn = await client.query<{ id: string; grn_number: string }>(
        `INSERT INTO goods_receipt_notes
           (po_id, inbound_order_id, warehouse_id, vendor_id, pr_id, source_type, received_by, split_from_grn_id, notes, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'draft')
         RETURNING id, grn_number`,
        [
          grn.po_id ?? null,
          grn.inbound_order_id ?? null,
          effectiveWarehouseId,
          grn.vendor_id ?? null,
          grn.pr_id ?? null,
          grn.source_type,
          u.id,
          id, // this GRN is the parent
          `รอรับสินค้าที่เหลือ (แยกจาก ${id})`,
        ]
      );
      splitGrnId = splitGrn.rows[0].id;

      for (let i = 0; i < splitLines.length; i++) {
        const sl = splitLines[i];
        await client.query(
          `INSERT INTO grn_line_items
             (grn_id, po_line_item_id, inbound_order_line_id, pr_line_item_id, product_id, qty_received, qty_expected, unit_cost, line_number, source_type)
           VALUES ($1, $2, $3, $4, $5, 0, $6, $7, $8, $9)`,
          [splitGrnId, sl.po_line_item_id ?? null, sl.inbound_order_line_id ?? null, sl.pr_line_item_id ?? null, sl.product_id, sl.qty_expected, sl.unit_cost, i + 1, grn.source_type]
        );
      }
    }

    await client.query('COMMIT');
    return apiSuccess({ id, status: 'received', split_grn_id: splitGrnId });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    return apiError('Failed to receive GRN', 500);
  } finally {
    client.release();
  }
}

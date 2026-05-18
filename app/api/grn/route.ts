import { auth } from '@/auth';
import { apiSuccess, apiError, apiValidationError } from '@/lib/api-response';
import { buildWarehouseScopeClause, assertRole } from '@/lib/authz';
import pool, { query, queryOne } from '@/lib/db/client';
import { z } from 'zod';
import { DEFAULT_PAGE_SIZE } from '@/lib/constants';
import type { SessionUser } from '@/types';

const lineSchema = z.object({
  po_line_item_id: z.string().uuid().optional(),
  inbound_order_line_id: z.string().uuid().optional(),
  product_id: z.string().uuid(),
  qty_received: z.number().positive(),
  lot_number: z.string().max(100).optional(),
  serial_number: z.string().max(100).optional(),
  expiry_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  storage_location: z.string().max(100).optional(),
  notes: z.string().optional(),
});

const createSchema = z.object({
  po_id: z.string().uuid().optional(),
  inbound_order_id: z.string().uuid().optional(),
  warehouse_id: z.string().uuid(),
  received_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  notes: z.string().optional(),
  lines: z.array(lineSchema).min(1),
}).refine(
  (d) => (d.po_id != null) !== (d.inbound_order_id != null),
  { message: 'Provide exactly one of po_id or inbound_order_id' }
);

const standaloneGRNSchema = z.object({
  vendor_id: z.string().uuid(),
  warehouse_id: z.string().uuid(),
  received_date: z.string().optional(),
  notes: z.string().optional(),
  lines: z.array(z.object({
    product_id: z.string().uuid(),
    qty_received: z.number().positive(),
    unit_cost: z.number().positive(),
  })).min(1),
});

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, Number(searchParams.get('page') ?? 1));
  const limit = Math.min(100, Number(searchParams.get('limit') ?? DEFAULT_PAGE_SIZE));
  const offset = (page - 1) * limit;
  const status = searchParams.get('status');
  const warehouseId = searchParams.get('warehouse_id');
  const poId = searchParams.get('po_id');

  const conditions: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  const scope = buildWarehouseScopeClause(u, 'g.warehouse_id', idx);
  if (scope) { conditions.push(scope.clause); params.push(...scope.params); idx += scope.params.length; }

  if (status) { conditions.push(`g.status = $${idx++}`); params.push(status); }
  if (warehouseId) { conditions.push(`g.warehouse_id = $${idx++}`); params.push(warehouseId); }
  if (poId) { conditions.push(`g.po_id = $${idx++}`); params.push(poId); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const [total] = await query<{ count: string }>(`SELECT COUNT(*) FROM goods_receipt_notes g ${where}`, params);

  const rows = await query(
    `SELECT g.id, g.grn_number, g.status, g.received_date, g.created_at,
            g.split_from_grn_id,
            po.po_number,
            io.io_number,
            g.po_id,
            g.inbound_order_id,
            w.code AS warehouse_code, w.name_th AS warehouse_name,
            u.name_en AS received_by_name, COUNT(li.id) AS line_count
     FROM goods_receipt_notes g
     LEFT JOIN purchase_orders po ON po.id = g.po_id
     LEFT JOIN inbound_orders io ON io.id = g.inbound_order_id
     JOIN warehouses w ON w.id = g.warehouse_id
     JOIN users u ON u.id = g.received_by
     LEFT JOIN grn_line_items li ON li.grn_id = g.id
     ${where}
     GROUP BY g.id, po.po_number, io.io_number, w.code, w.name_th, u.name_en
     ORDER BY g.created_at DESC
     LIMIT $${idx++} OFFSET $${idx++}`,
    [...params, limit, offset]
  );

  return apiSuccess({ data: rows, total: Number(total.count), page, limit, total_pages: Math.ceil(Number(total.count) / limit) });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;

  const body = await req.json().catch(() => null);
  if (!body) return apiError('Invalid JSON', 400);

  // Standalone GRN path
  if (!body.po_id && !body.inbound_order_id && body.vendor_id) {
    try {
      assertRole(u, ['manager', 'admin']);
    } catch (e) {
      const error = e as Error & { status?: number };
      return apiError(error.message, error.status || 403);
    }
    const parsed = standaloneGRNSchema.safeParse(body);
    if (!parsed.success) return apiValidationError(parsed.error);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const grnResult = await client.query(
        `INSERT INTO goods_receipt_notes (grn_number, warehouse_id, vendor_id, source_type, status, received_by, received_date, notes)
         VALUES (next_doc_number('GRN', 'seq_grn'), $1, $2, 'standalone', 'stocked', $3, $4, $5)
         RETURNING id, grn_number`,
        [
          parsed.data.warehouse_id,
          parsed.data.vendor_id,
          u.id,
          parsed.data.received_date ?? new Date().toISOString().split('T')[0],
          parsed.data.notes ?? null
        ]
      );
      const grn = grnResult.rows[0];

      for (let i = 0; i < parsed.data.lines.length; i++) {
        const l = parsed.data.lines[i];
        // 2a. Insert GRN line
        await client.query(
          `INSERT INTO grn_line_items (grn_id, product_id, qty_received, unit_cost, source_type, line_number)
           VALUES ($1, $2, $3, $4, 'standalone', $5)`,
          [grn.id, l.product_id, l.qty_received, l.unit_cost, i + 1]
        );

        // 2b. Get current stock balance for qty_after
        const balanceRes = await client.query(
          `SELECT qty_on_hand FROM stock_balances WHERE warehouse_id = $1 AND product_id = $2 FOR UPDATE`,
          [parsed.data.warehouse_id, l.product_id]
        );
        const currentQty = Number(balanceRes.rows[0]?.qty_on_hand || 0);
        const qtyAfter = currentQty + Number(l.qty_received);

        // 2c. Insert stock ledger
        await client.query(
          `INSERT INTO stock_ledger (warehouse_id, product_id, entry_type, reference_type, reference_id, qty_change, qty_after, unit_cost, created_by)
           VALUES ($1, $2, 'grn_receipt', 'grn', $3, $4, $5, $6, $7)`,
          [parsed.data.warehouse_id, l.product_id, grn.id, l.qty_received, qtyAfter, l.unit_cost, u.id]
        );
      }

      await client.query('COMMIT');
      return apiSuccess({ grn_id: grn.id, grn_number: grn.grn_number }, 201);
    } catch (e) {
      const error = e as Error & { status?: number };
      await client.query('ROLLBACK');
      console.error('Standalone GRN Error:', error);
      return apiError(error.message || 'Failed to create standalone GRN', error.status || 500);
    } finally {
      client.release();
    }
  }

  // PO/IO-based GRN path
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return apiValidationError(parsed.error);

  let sourceType: 'po' | 'inbound_order' = 'po';
  const unitCosts = new Map<string, number>();

  if (parsed.data.po_id) {
    sourceType = 'po';
    const po = await queryOne<{ status: string; warehouse_id: string }>(
      'SELECT status, warehouse_id FROM purchase_orders WHERE id = $1',
      [parsed.data.po_id]
    );
    if (!po) return apiError('PO not found', 404);
    if (!['sent', 'partially_received'].includes(po.status)) return apiError('PO must be in sent or partially_received status', 409);

    const poLines = await query<{
      id: string;
      qty_ordered: number;
      already_received: number;
      unit_price: number;
    }>(
      `SELECT pol.id, pol.qty_ordered, pol.unit_price,
              COALESCE(SUM(gli.qty_received), 0) AS already_received
       FROM po_line_items pol
       LEFT JOIN grn_line_items gli ON gli.po_line_item_id = pol.id
       LEFT JOIN goods_receipt_notes grn ON grn.id = gli.grn_id AND grn.status != 'cancelled'
       WHERE pol.po_id = $1
       GROUP BY pol.id`,
      [parsed.data.po_id]
    );

    const poLineMap = new Map(poLines.map((l) => [l.id, l]));

    for (const line of parsed.data.lines) {
      if (!line.po_line_item_id) return apiError('po_line_item_id is required for PO-based GRN', 422);
      const poLine = poLineMap.get(line.po_line_item_id);
      if (!poLine) return apiError(`PO line ${line.po_line_item_id} not found`, 422);
      const remaining = Number(poLine.qty_ordered) - Number(poLine.already_received);
      if (line.qty_received > remaining + 0.0001) {
        return apiError(
          `qty_received (${line.qty_received}) exceeds remaining qty (${remaining.toFixed(4)}) for line ${line.po_line_item_id}`,
          422
        );
      }
      unitCosts.set(line.po_line_item_id, Number(poLine.unit_price));
    }
  } else if (parsed.data.inbound_order_id) {
    sourceType = 'inbound_order';
    const io = await queryOne<{ status: string; warehouse_id: string }>(
      'SELECT status, warehouse_id FROM inbound_orders WHERE id = $1',
      [parsed.data.inbound_order_id]
    );
    if (!io) return apiError('Inbound Order not found', 404);
    if (!['open', 'receiving'].includes(io.status)) return apiError('Inbound Order must be open or receiving', 409);

    const ioLines = await query<{
      id: string;
      qty_ordered: number;
      already_received: number;
      unit_cost: number;
    }>(
      `SELECT iol.id, iol.qty_ordered, iol.unit_cost,
              COALESCE(SUM(gli.qty_received), 0) AS already_received
       FROM inbound_order_lines iol
       LEFT JOIN grn_line_items gli ON gli.inbound_order_line_id = iol.id
       LEFT JOIN goods_receipt_notes grn ON grn.id = gli.grn_id AND grn.status != 'cancelled'
       WHERE iol.io_id = $1
       GROUP BY iol.id`,
      [parsed.data.inbound_order_id]
    );

    const ioLineMap = new Map(ioLines.map((l) => [l.id, l]));

    for (const line of parsed.data.lines) {
      if (!line.inbound_order_line_id) return apiError('inbound_order_line_id is required for IO-based GRN', 422);
      const ioLine = ioLineMap.get(line.inbound_order_line_id);
      if (!ioLine) return apiError(`IO line ${line.inbound_order_line_id} not found`, 422);
      const remaining = Number(ioLine.qty_ordered) - Number(ioLine.already_received);
      if (line.qty_received > remaining + 0.0001) {
        return apiError(
          `qty_received (${line.qty_received}) exceeds remaining qty (${remaining.toFixed(4)}) for line ${line.inbound_order_line_id}`,
          422
        );
      }
      unitCosts.set(line.inbound_order_line_id, Number(ioLine.unit_cost));
    }
  }

  if (u.role === 'staff' && !u.assignedWarehouseIds.includes(parsed.data.warehouse_id)) {
    return apiError('No access to this warehouse', 403);
  }

  const grn = await queryOne<{ id: string; grn_number: string; status: string }>(
    `INSERT INTO goods_receipt_notes (po_id, inbound_order_id, warehouse_id, received_by, received_date, notes, source_type)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, grn_number, status`,
    [
      parsed.data.po_id ?? null,
      parsed.data.inbound_order_id ?? null,
      parsed.data.warehouse_id,
      u.id,
      parsed.data.received_date,
      parsed.data.notes ?? null,
      sourceType
    ]
  );
  if (!grn) return apiError('Failed to create GRN', 500);

  const lineValues = parsed.data.lines
    .map((_, i) => `($1, $${i * 10 + 2}, $${i * 10 + 3}, $${i * 10 + 4}, $${i * 10 + 5}, $${i * 10 + 6}, $${i * 10 + 7}, $${i * 10 + 8}, $${i * 10 + 9}, $${i * 10 + 10}, $${i * 10 + 11}, ${i + 1})`)
    .join(', ');
  const lineParams: unknown[] = [grn.id];
  for (const l of parsed.data.lines) {
    const cost = unitCosts.get(l.po_line_item_id || l.inbound_order_line_id || '') || 0;
    lineParams.push(
      l.po_line_item_id ?? null,
      l.inbound_order_line_id ?? null,
      l.product_id,
      l.qty_received,
      l.lot_number ?? null,
      l.serial_number ?? null,
      l.expiry_date ?? null,
      l.storage_location ?? null,
      sourceType,
      cost
    );
  }
  await query(
    `INSERT INTO grn_line_items (grn_id, po_line_item_id, inbound_order_line_id, product_id, qty_received, lot_number, serial_number, expiry_date, storage_location, source_type, unit_cost, line_number)
     VALUES ${lineValues}`,
    lineParams
  );

  if (parsed.data.inbound_order_id) {
    await query(
      "UPDATE inbound_orders SET status = 'receiving' WHERE id = $1 AND status = 'open'",
      [parsed.data.inbound_order_id]
    );
  }

  return apiSuccess(grn, 201);
}

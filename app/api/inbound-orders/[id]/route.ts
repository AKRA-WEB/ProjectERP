import { auth } from '@/auth';
import { apiSuccess, apiError, apiValidationError } from '@/lib/api-response';
import { assertRole } from '@/lib/authz';
import { query, queryOne } from '@/lib/db/client';
import pool from '@/lib/db/client';
import { z } from 'zod';
import type { SessionUser } from '@/lib/authz';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);

  const { id } = await params;

  const io = await queryOne(
    `SELECT io.*, v.name_th AS vendor_name, v.code AS vendor_code,
            w.code AS warehouse_code, w.name_th AS warehouse_name,
            u.name_en AS created_by_name,
            vb.name_en AS verified_by_name
     FROM inbound_orders io
     JOIN vendors v ON v.id = io.vendor_id
     JOIN warehouses w ON w.id = io.warehouse_id
     JOIN users u ON u.id = io.created_by
     LEFT JOIN users vb ON vb.id = io.verified_by
     WHERE io.id = $1`,
    [id]
  );

  if (!io) return apiError('Inbound Order not found', 404);

  const lines = await query(
    `SELECT iol.*, p.sku, p.name_th, p.name_en, u.code AS uom_code,
            COALESCE(sb.qty_available, 0) AS qty_available
     FROM inbound_order_lines iol
     JOIN products p ON p.id = iol.product_id
     JOIN units_of_measure u ON u.id = p.uom_id
     LEFT JOIN stock_balances sb ON sb.product_id = iol.product_id AND sb.warehouse_id = $2
     WHERE iol.io_id = $1
     ORDER BY iol.line_number`,
    [id, (io as { warehouse_id: string }).warehouse_id]
  );

  const grns = await query(
    `SELECT g.id, g.grn_number, g.status, g.received_date,
            g.rejection_notes, g.received_by_names,
            u.name_en AS received_by_name
     FROM goods_receipt_notes g
     JOIN users u ON u.id = g.received_by
     WHERE g.inbound_order_id = $1
     ORDER BY g.created_at`,
    [id]
  );

  return apiSuccess({ ...io, lines, grns });
}

const patchSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('change_warehouse'),
    warehouse_id: z.string().uuid(),
  }),
  z.object({
    action: z.literal('update_costs'),
    lines: z.array(z.object({
      id: z.string().uuid(),
      unit_cost: z.number().nonnegative(),
    })).min(1),
  }),
  z.object({
    action: z.literal('update_header'),
    order_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    notes: z.string().optional(),
  }),
  z.object({
    action: z.literal('update_lines'),
    lines: z.array(z.object({
      id: z.string().uuid().optional(),
      product_id: z.string().uuid(),
      qty_ordered: z.number().positive(),
      notes: z.string().optional(),
    })).min(1),
  }),
]);

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;

  const { id } = await params;
  const body = await req.json().catch(() => null);
  if (!body) return apiError('Invalid JSON', 400);

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return apiValidationError(parsed.error);

  if (parsed.data.action === 'change_warehouse') {
    try { assertRole(u, ['manager', 'admin']); } catch { return apiError('Forbidden', 403); }

    const io = await queryOne<{ status: string }>(
      'SELECT status FROM inbound_orders WHERE id = $1',
      [id]
    );
    if (!io) return apiError('Inbound Order not found', 404);
    if (io.status !== 'open') return apiError('Warehouse can only be changed when IO is open', 409);

    const wh = await queryOne<{ id: string }>(
      'SELECT id FROM warehouses WHERE id = $1 AND is_active = true',
      [parsed.data.warehouse_id]
    );
    if (!wh) return apiError('Warehouse not found', 404);

    await query(
      'UPDATE inbound_orders SET warehouse_id = $1, updated_at = NOW() WHERE id = $2',
      [parsed.data.warehouse_id, id]
    );
    return apiSuccess({ id, warehouse_id: parsed.data.warehouse_id });
  }

  if (parsed.data.action === 'update_costs') {
    try { assertRole(u, ['manager', 'admin']); } catch { return apiError('Forbidden', 403); }

    const io = await queryOne<{ status: string }>(
      'SELECT status FROM inbound_orders WHERE id = $1',
      [id]
    );
    if (!io) return apiError('Inbound Order not found', 404);
    if (io.status === 'closed') return apiError('Cannot update costs on a closed IO', 409);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      for (const line of parsed.data.lines) {
        // Validate line belongs to this IO
        const iol = await client.query<{ product_id: string }>(
          'SELECT product_id FROM inbound_order_lines WHERE id = $1 AND io_id = $2',
          [line.id, id]
        );
        if (!iol.rows[0]) continue;

        await client.query(
          'UPDATE inbound_order_lines SET unit_cost = $1 WHERE id = $2',
          [line.unit_cost, line.id]
        );

        // Update product master unit_cost to reflect actual purchase price
        await client.query(
          'UPDATE products SET unit_cost = $1, updated_at = NOW() WHERE id = $2',
          [line.unit_cost, iol.rows[0].product_id]
        );
      }

      await client.query('COMMIT');
      return apiSuccess({ id, updated: parsed.data.lines.length });
    } catch (err) {
      await client.query('ROLLBACK');
      console.error(err);
      return apiError('Failed to update costs', 500);
    } finally {
      client.release();
    }
  }

  if (parsed.data.action === 'update_header') {
    const io = await queryOne<{ status: string }>('SELECT status FROM inbound_orders WHERE id = $1', [id]);
    if (!io) return apiError('IO not found', 404);
    if (io.status !== 'open') return apiError('Only open IOs can be edited', 409);
    const fields: string[] = [];
    const params: unknown[] = [];
    let idx = 1;
    if (parsed.data.order_date !== undefined) { fields.push(`order_date = $${idx++}`); params.push(parsed.data.order_date); }
    if (parsed.data.notes !== undefined) { fields.push(`notes = $${idx++}`); params.push(parsed.data.notes); }
    if (!fields.length) return apiError('No fields to update', 400);
    params.push(id);
    await query(`UPDATE inbound_orders SET ${fields.join(', ')} WHERE id = $${idx}`, params);
    return apiSuccess({ id });
  }

  if (parsed.data.action === 'update_lines') {
    const io = await queryOne<{ status: string }>('SELECT status FROM inbound_orders WHERE id = $1', [id]);
    if (!io) return apiError('IO not found', 404);
    if (io.status !== 'open') return apiError('Only open IOs can be edited', 409);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Fetch existing lines to preserve their attributes (unit_cost, qty_received)
      const existingRes = await client.query<{ id: string; unit_cost: number; qty_received: number }>(
        'SELECT id, unit_cost, qty_received FROM inbound_order_lines WHERE io_id = $1',
        [id]
      );
      const existingMap = new Map(existingRes.rows.map((row) => [row.id, row]));

      // 2. Delete all lines for this Inbound Order
      await client.query('DELETE FROM inbound_order_lines WHERE io_id = $1', [id]);

      // 3. Re-insert/Insert lines with sequential line numbers
      let lineNumber = 1;
      for (const line of parsed.data.lines) {
        let lineId = line.id;
        let unitCost = 0;
        let qtyReceived = 0;

        const existing = lineId ? existingMap.get(lineId) : null;
        if (existing) {
          unitCost = Number(existing.unit_cost ?? 0);
          qtyReceived = Number(existing.qty_received ?? 0);
        } else {
          // If it's a new line, pull default cost from product master
          const prodRes = await client.query<{ unit_cost: number }>(
            'SELECT unit_cost FROM products WHERE id = $1',
            [line.product_id]
          );
          unitCost = Number(prodRes.rows[0]?.unit_cost ?? 0);
          // Generate a new UUID if not provided
          lineId = lineId || undefined;
        }

        if (lineId) {
          await client.query(
            `INSERT INTO inbound_order_lines (id, io_id, product_id, qty_ordered, qty_received, unit_cost, notes, line_number)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [lineId, id, line.product_id, line.qty_ordered, qtyReceived, unitCost, line.notes ?? null, lineNumber++]
          );
        } else {
          await client.query(
            `INSERT INTO inbound_order_lines (io_id, product_id, qty_ordered, qty_received, unit_cost, notes, line_number)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [id, line.product_id, line.qty_ordered, qtyReceived, unitCost, line.notes ?? null, lineNumber++]
          );
        }
      }

      await client.query('COMMIT');
      return apiSuccess({ id });
    } catch (err) {
      await client.query('ROLLBACK');
      console.error(err);
      return apiError(err instanceof Error ? err.message : 'Failed to update lines', 500);
    } finally {
      client.release();
    }
  }

  return apiError('Unknown action', 400);
}

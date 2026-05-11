import { auth } from '@/auth';
import { apiSuccess, apiError, apiValidationError } from '@/lib/api-response';
import { assertRole } from '@/lib/authz';
import { query } from '@/lib/db/client';
import pool from '@/lib/db/client';
import { z } from 'zod';
import { DEFAULT_PAGE_SIZE } from '@/lib/constants';
import type { SessionUser } from '@/lib/authz';

const lineSchema = z.object({
  product_id: z.string().uuid(),
  lot_id: z.string().uuid().optional(),
  qty: z.number().positive(),
});

const createSchema = z.object({
  source_warehouse_id: z.string().uuid(),
  dest_warehouse_id: z.string().uuid(),
  notes: z.string().optional(),
  lines: z.array(lineSchema).min(1),
}).refine((d) => d.source_warehouse_id !== d.dest_warehouse_id, {
  message: 'Source and destination warehouses must differ',
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

  const conditions: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  if (u.role !== 'admin') {
    if (!u.assignedWarehouseIds.length) {
      conditions.push('FALSE');
    } else {
      conditions.push(`(t.source_warehouse_id = ANY($${idx}::uuid[]) OR t.dest_warehouse_id = ANY($${idx}::uuid[]))`);
      params.push(u.assignedWarehouseIds);
      idx += 1;
    }
  }
  if (status) { conditions.push(`t.status = $${idx++}`); params.push(status); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const [total] = await query<{ count: string }>(`SELECT COUNT(*) FROM warehouse_transfers t ${where}`, params);

  const rows = await query(
    `SELECT t.id, t.transfer_number, t.status, t.created_at,
            ws.code AS source_code, ws.name_th AS source_name,
            wd.code AS dest_code, wd.name_th AS dest_name,
            u.name_en AS initiated_by_name,
            COUNT(tl.id) AS line_count
     FROM warehouse_transfers t
     JOIN warehouses ws ON ws.id = t.source_warehouse_id
     JOIN warehouses wd ON wd.id = t.dest_warehouse_id
     JOIN users u ON u.id = t.initiated_by
     LEFT JOIN warehouse_transfer_lines tl ON tl.transfer_id = t.id
     ${where}
     GROUP BY t.id, ws.code, ws.name_th, wd.code, wd.name_th, u.name_en
     ORDER BY t.created_at DESC
     LIMIT $${idx++} OFFSET $${idx++}`,
    [...params, limit, offset]
  );

  return apiSuccess({ data: rows, total: Number(total.count), page, limit, total_pages: Math.ceil(Number(total.count) / limit) });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;
  try { assertRole(u, ['manager', 'admin']); } catch { return apiError('Forbidden', 403); }

  const body = await req.json().catch(() => null);
  if (!body) return apiError('Invalid JSON', 400);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return apiValidationError(parsed.error);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    for (const line of parsed.data.lines) {
      const balance = await client.query<{ qty_available: string }>(
        'SELECT qty_available FROM stock_balances WHERE warehouse_id = $1 AND product_id = $2 FOR UPDATE',
        [parsed.data.source_warehouse_id, line.product_id]
      );
      if (!balance.rows[0] || Number(balance.rows[0].qty_available) < line.qty) {
        await client.query('ROLLBACK');
        return apiError(`Insufficient stock for product ${line.product_id}`, 409);
      }
    }

    const trf = await client.query<{ id: string; transfer_number: string }>(
      `INSERT INTO warehouse_transfers (source_warehouse_id, dest_warehouse_id, initiated_by, notes)
       VALUES ($1, $2, $3, $4) RETURNING id, transfer_number, status`,
      [parsed.data.source_warehouse_id, parsed.data.dest_warehouse_id, u.id, parsed.data.notes ?? null]
    );
    const transferId = trf.rows[0].id;

    const lineValues = parsed.data.lines
      .map((_, i) => `($1, $${i * 3 + 2}, $${i * 3 + 3}, $${i * 3 + 4}, ${i + 1})`)
      .join(', ');
    const lineParams: unknown[] = [transferId];
    for (const l of parsed.data.lines) {
      lineParams.push(l.product_id, l.lot_id ?? null, l.qty);
    }
    await client.query(
      `INSERT INTO warehouse_transfer_lines (transfer_id, product_id, lot_id, qty, line_number) VALUES ${lineValues}`,
      lineParams
    );

    for (const line of parsed.data.lines) {
      const srcBalance = await client.query<{ qty_on_hand: string }>(
        'SELECT qty_on_hand FROM stock_balances WHERE warehouse_id = $1 AND product_id = $2',
        [parsed.data.source_warehouse_id, line.product_id]
      );
      const srcQtyAfter = Number(srcBalance.rows[0]?.qty_on_hand ?? 0) - line.qty;

      const dstBalance = await client.query<{ qty_on_hand: string }>(
        'SELECT qty_on_hand FROM stock_balances WHERE warehouse_id = $1 AND product_id = $2',
        [parsed.data.dest_warehouse_id, line.product_id]
      );
      const dstQtyAfter = Number(dstBalance.rows[0]?.qty_on_hand ?? 0) + line.qty;

      await client.query(
        `INSERT INTO stock_ledger (warehouse_id, product_id, lot_id, entry_type, reference_type, reference_id, qty_change, qty_after, created_by)
         VALUES ($1, $2, $3, 'transfer_out', 'transfer', $4, $5, $6, $7)`,
        [parsed.data.source_warehouse_id, line.product_id, line.lot_id ?? null, transferId, -line.qty, srcQtyAfter, u.id]
      );
      await client.query(
        `INSERT INTO stock_ledger (warehouse_id, product_id, lot_id, entry_type, reference_type, reference_id, qty_change, qty_after, created_by)
         VALUES ($1, $2, $3, 'transfer_in', 'transfer', $4, $5, $6, $7)`,
        [parsed.data.dest_warehouse_id, line.product_id, line.lot_id ?? null, transferId, line.qty, dstQtyAfter, u.id]
      );
    }

    await client.query(
      `UPDATE warehouse_transfers SET status = 'completed', completed_by = $1, completed_at = NOW() WHERE id = $2`,
      [u.id, transferId]
    );

    await client.query('COMMIT');
    return apiSuccess(trf.rows[0], 201);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Transfer error:', err);
    return apiError('Transfer failed', 500);
  } finally {
    client.release();
  }
}

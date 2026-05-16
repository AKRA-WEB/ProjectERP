import { auth } from '@/auth';
import { apiSuccess, apiError, apiValidationError } from '@/lib/api-response';
import { buildWarehouseScopeClause, assertRole } from '@/lib/authz';
import pool, { query } from '@/lib/db/client';
import { z } from 'zod';
import { DEFAULT_PAGE_SIZE } from '@/lib/constants';
import type { SessionUser } from '@/lib/authz';

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

  const scope = buildWarehouseScopeClause(u, 's.warehouse_id', idx);
  if (scope) {
    conditions.push(scope.clause);
    params.push(...scope.params);
    idx += scope.params.length;
  }

  if (status) {
    conditions.push(`s.status = $${idx++}`);
    params.push(status);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const totalRes = await query<{ count: string }>(
    `SELECT COUNT(*) FROM shipments s ${whereClause}`,
    params
  );
  const total = Number(totalRes[0].count);

  const rows = await query(
    `SELECT s.*,
           pl.pick_number,
           w.name_th AS warehouse_name,
           shipper.name_th AS shipped_by_name
    FROM shipments s
    JOIN pick_lists pl ON pl.id = s.pick_list_id
    JOIN warehouses w ON w.id = s.warehouse_id
    LEFT JOIN users shipper ON shipper.id = s.shipped_by
    ${whereClause}
    ORDER BY s.created_at DESC
    LIMIT $${idx++} OFFSET $${idx++}`,
    [...params, limit, offset]
  );

  return apiSuccess({
    data: rows,
    total,
    page,
    limit,
    total_pages: Math.ceil(total / limit),
  });
}

const createSchema = z.object({
  pick_list_id: z.string().uuid(),
  ship_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  carrier: z.string().optional(),
  tracking_number: z.string().optional(),
  notes: z.string().optional(),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;

  try { assertRole(u, ['manager', 'admin']); } catch { return apiError('Forbidden', 403); }

  const body = await req.json().catch(() => null);
  if (!body) return apiError('Invalid JSON', 400);

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return apiValidationError(parsed.error);

  const pickList = await query<{ status: string; warehouse_id: string }>(
    'SELECT status, warehouse_id FROM pick_lists WHERE id = $1',
    [parsed.data.pick_list_id]
  );
  if (pickList.length === 0) return apiError('Pick List not found', 404);
  if (pickList[0].status !== 'completed') return apiError('Shipments can only be created from completed pick lists', 422);

  const existingShipment = await query(
    'SELECT id FROM shipments WHERE pick_list_id = $1',
    [parsed.data.pick_list_id]
  );
  if (existingShipment.length > 0) return apiError('A shipment already exists for this pick list', 409);

  const lines = await query<{ product_id: string; qty_picked: number; qty_requested: number }>(
    'SELECT product_id, qty_picked, qty_requested FROM pick_list_lines WHERE pick_list_id = $1 AND qty_picked > 0',
    [parsed.data.pick_list_id]
  );
  if (lines.length === 0) return apiError('Pick list has no items picked', 422);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const shipRes = await client.query(
      `INSERT INTO shipments (pick_list_id, warehouse_id, ship_date, carrier, tracking_number, notes, status, shipped_by)
       VALUES ($1, $2, $3, $4, $5, $6, 'shipped', $7) RETURNING id, shipment_number`,
      [
        parsed.data.pick_list_id,
        pickList[0].warehouse_id,
        parsed.data.ship_date ?? new Date().toISOString().split('T')[0],
        parsed.data.carrier ?? null,
        parsed.data.tracking_number ?? null,
        parsed.data.notes ?? null,
        u.id
      ]
    );

    const shipmentId = shipRes.rows[0].id;
    const shipmentNumber = shipRes.rows[0].shipment_number;

    for (const line of lines) {
      // 1. Fetch current qty_on_hand
      const stockRes = await client.query<{ qty_on_hand: string }>(
        'SELECT COALESCE(qty_on_hand, 0) AS qty_on_hand FROM stock_balances WHERE product_id = $1 AND warehouse_id = $2',
        [line.product_id, pickList[0].warehouse_id]
      );
      const currentQtyOnHand = Number(stockRes.rows[0]?.qty_on_hand ?? 0);
      const qtyChange = -line.qty_picked;
      const qtyAfter = currentQtyOnHand + qtyChange;

      // 2. INSERT into stock_ledger
      await client.query(
        `INSERT INTO stock_ledger
          (warehouse_id, product_id, entry_type, reference_type, reference_id,
           qty_change, qty_after, notes, created_by)
        VALUES
          ($1, $2, 'pick_dispatch', 'shipment', $3,
           $4, $5, $6, $7)`,
        [
          pickList[0].warehouse_id,
          line.product_id,
          shipmentId,
          qtyChange,
          qtyAfter,
          parsed.data.notes ?? null,
          u.id
        ]
      );

      // 3. Release reservation
      await client.query(
        `UPDATE stock_balances
         SET qty_reserved = GREATEST(qty_reserved - $3, 0), last_updated = NOW()
         WHERE product_id = $1 AND warehouse_id = $2`,
        [line.product_id, pickList[0].warehouse_id, line.qty_requested]
      );
    }

    await client.query('COMMIT');
    return apiSuccess({ id: shipmentId, shipment_number: shipmentNumber }, 201);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error creating shipment:', err);
    return apiError('Failed to create shipment', 500);
  } finally {
    client.release();
  }
}

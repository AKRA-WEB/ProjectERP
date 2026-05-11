import { auth } from '@/auth';
import { apiSuccess, apiError, apiValidationError } from '@/lib/api-response';
import { assertPermission, buildWarehouseScopeClause } from '@/lib/authz';
import pool, { query } from '@/lib/db/client';
import { z } from 'zod';
import { DEFAULT_PAGE_SIZE } from '@/lib/constants';
import type { SessionUser } from '@/lib/authz';

const createSchema = z.object({
  so_id: z.string().uuid(),
  shipping_address: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  lines: z.array(z.object({
    so_line_item_id: z.string().uuid(),
    qty_to_deliver: z.number().positive(),
  })).min(1),
});

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;

  try { assertPermission(u, 'do:view'); } catch { return apiError('Forbidden', 403); }

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, Number(searchParams.get('page') ?? 1));
  const limit = Math.min(100, Number(searchParams.get('limit') ?? DEFAULT_PAGE_SIZE));
  const offset = (page - 1) * limit;
  const status = searchParams.get('status');

  const conditions: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  const scope = buildWarehouseScopeClause(u, 'do_.warehouse_id', idx);
  if (scope) {
    conditions.push(scope.clause);
    params.push(...scope.params);
    idx += scope.params.length;
  }

  if (status) {
    conditions.push(`do_.status = $${idx++}`);
    params.push(status);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const [totalRes] = await query<{ count: string }>(`SELECT COUNT(*) FROM delivery_orders do_ ${where}`, params);

  const dos = await query(
    `SELECT do_.*, 
            so.so_number,
            c.name_th AS customer_name_th, 
            w.name_th AS warehouse_name_th,
            u_cr.name_en AS created_by_name
     FROM delivery_orders do_
     JOIN sales_orders so ON so.id = do_.so_id
     JOIN customers c ON c.id = so.customer_id
     JOIN warehouses w ON w.id = do_.warehouse_id
     JOIN users u_cr ON u_cr.id = do_.created_by
     ${where}
     ORDER BY do_.created_at DESC
     LIMIT $${idx++} OFFSET $${idx++}`,
    [...params, limit, offset]
  );

  return apiSuccess({
    data: dos,
    total: Number(totalRes.count),
    page,
    limit,
    total_pages: Math.ceil(Number(totalRes.count) / limit),
  });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;

  try { assertPermission(u, 'do:create'); } catch { return apiError('Forbidden', 403); }

  const body = await req.json().catch(() => null);
  if (!body) return apiError('Invalid JSON', 400);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return apiValidationError(parsed.error);

  const { so_id, shipping_address, notes, lines } = parsed.data;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Validate SO
    const soRes = await client.query(
      'SELECT status, warehouse_id FROM sales_orders WHERE id = $1 FOR SHARE',
      [so_id]
    );
    const so = soRes.rows[0];
    if (!so) { await client.query('ROLLBACK'); return apiError('SO not found', 404); }
    if (!['confirmed', 'partially_delivered'].includes(so.status)) {
      await client.query('ROLLBACK'); return apiError(`Cannot create DO for SO in status ${so.status}`, 409);
    }

    // 2. Validate Lines & Stock
    const doLinesToInsert = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const soLineRes = await client.query(
        'SELECT product_id, qty_ordered, qty_delivered, unit_price FROM so_line_items WHERE id = $1 AND so_id = $2 FOR SHARE',
        [line.so_line_item_id, so_id]
      );
      const soLine = soLineRes.rows[0];
      if (!soLine) { await client.query('ROLLBACK'); return apiError(`Invalid so_line_item_id: ${line.so_line_item_id}`, 400); }

      const qtyRemaining = soLine.qty_ordered - soLine.qty_delivered;
      if (line.qty_to_deliver > qtyRemaining) {
        await client.query('ROLLBACK'); return apiError(`qty_to_deliver exceeds remaining ordered quantity for product ${soLine.product_id}`, 422);
      }

      // Check available stock
      const stockRes = await client.query(
        'SELECT qty_available FROM stock_balances WHERE warehouse_id = $1 AND product_id = $2 FOR SHARE',
        [so.warehouse_id, soLine.product_id]
      );
      const available = stockRes.rows[0]?.qty_available || 0;
      if (available < line.qty_to_deliver) {
        await client.query('ROLLBACK'); return apiError(`Insufficient stock for product ${soLine.product_id} (Available: ${available})`, 422);
      }

      doLinesToInsert.push({
        so_line_item_id: line.so_line_item_id,
        product_id: soLine.product_id,
        qty_to_deliver: line.qty_to_deliver,
        unit_price: soLine.unit_price,
        line_number: i + 1,
      });
    }

    // 3. Create DO Header
    const doRes = await client.query(
      `INSERT INTO delivery_orders (
        so_id, warehouse_id, shipping_address, notes, created_by
       ) VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [so_id, so.warehouse_id, shipping_address || null, notes || null, u.id]
    );
    const newDo = doRes.rows[0];

    // 4. Insert Lines
    for (const line of doLinesToInsert) {
      await client.query(
        `INSERT INTO do_line_items (
          do_id, so_line_item_id, product_id, qty_to_deliver, unit_price, line_number
         ) VALUES ($1, $2, $3, $4, $5, $6)`,
        [newDo.id, line.so_line_item_id, line.product_id, line.qty_to_deliver, line.unit_price, line.line_number]
      );
    }

    await client.query('COMMIT');
    return apiSuccess(newDo, 201);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Create DO error:', err);
    return apiError('Failed to create delivery order', 500);
  } finally {
    client.release();
  }
}

import { NextRequest } from 'next/server';
import { auth } from '@/auth';
import pool, { query } from '@/lib/db/client';
import { apiSuccess, apiError, apiValidationError } from '@/lib/api-response';
import { CreateRepackOrderSchema } from '@/lib/validations/repack';
import { type SessionUser } from '@/lib/authz';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);

  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status');
  const warehouseId = searchParams.get('warehouse_id');
  const page = parseInt(searchParams.get('page') ?? '1');
  const limit = parseInt(searchParams.get('pageSize') ?? '20');
  const offset = (page - 1) * limit;

  const conditions: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  if (status) {
    conditions.push(`ro.status = $${idx++}`);
    params.push(status);
  }
  if (warehouseId) {
    conditions.push(`ro.warehouse_id = $${idx++}`);
    params.push(warehouseId);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const rows = await query(`
    SELECT 
      ro.*,
      p.sku AS source_product_sku,
      p.name_th AS source_product_name_th,
      w.name_th AS warehouse_name_th,
      u.name_en AS created_by_name,
      (SELECT COUNT(*) FROM repack_order_items roi WHERE roi.repack_order_id = ro.id) AS item_count
    FROM repack_orders ro
    JOIN products p ON p.id = ro.source_product_id
    JOIN warehouses w ON w.id = ro.warehouse_id
    LEFT JOIN users u ON u.id = ro.created_by
    ${where}
    ORDER BY ro.created_at DESC
    LIMIT $${idx} OFFSET $${idx + 1}
  `, [...params, limit, offset]);

  const [{ count }] = await query<{ count: string }>(`
    SELECT COUNT(*) FROM repack_orders ro ${where}
  `, params);

  return apiSuccess({
    data: rows,
    total: parseInt(count),
    page,
    limit
  });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const user = session.user as unknown as SessionUser;

  try {
    const body = await req.json();
    const result = CreateRepackOrderSchema.safeParse(body);
    if (!result.success) {
      return apiValidationError(result.error);
    }
    const d = result.data;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const { rows: [{ orderNumber }] } = await client.query(
        "SELECT next_doc_number('RPK', 'seq_repack_order_no') AS \"orderNumber\""
      );

      // Get current unit cost of source product
      const { rows: [sourceProduct] } = await client.query(
        'SELECT unit_cost FROM products WHERE id = $1',
        [d.source_product_id]
      );

      const { rows: [order] } = await client.query(`
        INSERT INTO repack_orders (
          order_number, source_product_id, source_qty, source_unit_cost, warehouse_id, notes, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id
      `, [
        orderNumber, 
        d.source_product_id, 
        d.source_qty, 
        sourceProduct?.unit_cost || 0,
        d.warehouse_id, 
        d.notes, 
        user.id
      ]);

      for (const item of d.items) {
        await client.query(`
          INSERT INTO repack_order_items (
            repack_order_id, product_id, qty, unit_cost, notes
          ) VALUES ($1, $2, $3, $4, $5)
        `, [order.id, item.product_id, item.qty, item.unit_cost, item.notes]);
      }

      await client.query('COMMIT');
      return apiSuccess({ id: order.id, order_number: orderNumber }, 201);
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Failed to create repack order';
    return apiError(msg, 500);
  }
}

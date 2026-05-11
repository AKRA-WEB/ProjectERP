import { auth } from '@/auth';
import { apiSuccess, apiError, apiValidationError } from '@/lib/api-response';
import { assertPermission, buildWarehouseScopeClause } from '@/lib/authz';
import pool, { query } from '@/lib/db/client';
import { z } from 'zod';
import { DEFAULT_PAGE_SIZE } from '@/lib/constants';
import type { SessionUser } from '@/lib/authz';

const createSchema = z.object({
  customer_id: z.string().uuid(),
  warehouse_id: z.string().uuid(),
  so_id: z.string().uuid().optional().nullable(),
  reason: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  lines: z.array(z.object({
    product_id: z.string().uuid(),
    qty_returned: z.number().positive(),
    unit_price: z.number().min(0).optional().default(0),
  })).min(1),
});

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;

  try { assertPermission(u, 'sr:view'); } catch { return apiError('Forbidden', 403); }

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, Number(searchParams.get('page') ?? 1));
  const limit = Math.min(100, Number(searchParams.get('limit') ?? DEFAULT_PAGE_SIZE));
  const offset = (page - 1) * limit;
  const status = searchParams.get('status');

  const conditions: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  const scope = buildWarehouseScopeClause(u, 'sr.warehouse_id', idx);
  if (scope) {
    conditions.push(scope.clause);
    params.push(...scope.params);
    idx += scope.params.length;
  }

  if (status) {
    conditions.push(`sr.status = $${idx++}`);
    params.push(status);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const [totalRes] = await query<{ count: string }>(`SELECT COUNT(*) FROM sales_returns sr ${where}`, params);

  const srs = await query(
    `SELECT sr.*, 
            so.so_number,
            c.name_th AS customer_name_th, 
            w.name_th AS warehouse_name_th,
            u_cr.name_en AS created_by_name
     FROM sales_returns sr
     LEFT JOIN sales_orders so ON so.id = sr.so_id
     JOIN customers c ON c.id = sr.customer_id
     JOIN warehouses w ON w.id = sr.warehouse_id
     JOIN users u_cr ON u_cr.id = sr.created_by
     ${where}
     ORDER BY sr.created_at DESC
     LIMIT $${idx++} OFFSET $${idx++}`,
    [...params, limit, offset]
  );

  return apiSuccess({
    data: srs,
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

  try { assertPermission(u, 'sr:create'); } catch { return apiError('Forbidden', 403); }

  const body = await req.json().catch(() => null);
  if (!body) return apiError('Invalid JSON', 400);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return apiValidationError(parsed.error);

  const { customer_id, warehouse_id, so_id, reason, notes, lines } = parsed.data;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Create SR Header
    const srRes = await client.query(
      `INSERT INTO sales_returns (
        customer_id, warehouse_id, so_id, reason, notes, created_by
       ) VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [customer_id, warehouse_id, so_id || null, reason || null, notes || null, u.id]
    );
    const sr = srRes.rows[0];

    // 2. Insert Lines
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      await client.query(
        `INSERT INTO sr_line_items (
          sr_id, product_id, qty_returned, unit_price, line_number
         ) VALUES ($1, $2, $3, $4, $5)`,
        [sr.id, line.product_id, line.qty_returned, line.unit_price, i + 1]
      );
    }

    await client.query('COMMIT');
    return apiSuccess(sr, 201);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Create SR error:', err);
    return apiError('Failed to create sales return', 500);
  } finally {
    client.release();
  }
}

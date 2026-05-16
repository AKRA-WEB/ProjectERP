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
  const assigned_to = searchParams.get('assigned_to');

  const conditions: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  const scope = buildWarehouseScopeClause(u, 'pl.warehouse_id', idx);
  if (scope) {
    conditions.push(scope.clause);
    params.push(...scope.params);
    idx += scope.params.length;
  }

  if (status) {
    conditions.push(`pl.status = $${idx++}`);
    params.push(status);
  }

  // Staff can only see their own assigned pick lists — enforce at API level
  if (u.role === 'staff') {
    conditions.push(`pl.assigned_to = $${idx++}`);
    params.push(u.id);
  } else if (assigned_to) {
    conditions.push(`pl.assigned_to = $${idx++}`);
    params.push(assigned_to);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const totalRes = await query<{ count: string }>(
    `SELECT COUNT(*) FROM pick_lists pl ${whereClause}`,
    params
  );
  const total = Number(totalRes[0].count);

  const rows = await query(
    `SELECT pl.*,
           w.name_th AS warehouse_name,
           assigned.name_th AS assigned_to_name,
           creator.name_th AS created_by_name,
           so.so_number
    FROM pick_lists pl
    JOIN warehouses w ON w.id = pl.warehouse_id
    LEFT JOIN users assigned ON assigned.id = pl.assigned_to
    JOIN users creator ON creator.id = pl.created_by
    LEFT JOIN sales_orders so ON so.id = pl.sales_order_id
    ${whereClause}
    ORDER BY pl.created_at DESC
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
  warehouse_id: z.string().uuid(),
  sales_order_id: z.string().uuid().optional(),
  notes: z.string().optional(),
  lines: z.array(z.object({
    product_id: z.string().uuid(),
    qty_requested: z.number().positive(),
    storage_location: z.string().optional(),
  })).min(1),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;

  try {
    assertRole(u, ['manager', 'admin']);
  } catch {
    return apiError('Forbidden', 403);
  }

  const body = await req.json().catch(() => null);
  if (!body) return apiError('Invalid JSON', 400);

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return apiValidationError(parsed.error);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const plRes = await client.query(
      `INSERT INTO pick_lists (warehouse_id, sales_order_id, notes, created_by)
       VALUES ($1, $2, $3, $4) RETURNING id, pick_number`,
      [
        parsed.data.warehouse_id,
        parsed.data.sales_order_id ?? null,
        parsed.data.notes ?? null,
        u.id
      ]
    );

    const pickListId = plRes.rows[0].id;
    const pickNumber = plRes.rows[0].pick_number;

    for (const line of parsed.data.lines) {
      await client.query(
        `INSERT INTO pick_list_lines (pick_list_id, product_id, qty_requested, storage_location)
         VALUES ($1, $2, $3, $4)`,
        [
          pickListId,
          line.product_id,
          line.qty_requested,
          line.storage_location ?? null
        ]
      );
    }

    await client.query('COMMIT');
    return apiSuccess({ id: pickListId, pick_number: pickNumber }, 201);
  } catch {
    await client.query('ROLLBACK');
    return apiError('Failed to create pick list', 500);
  } finally {
    client.release();
  }
}

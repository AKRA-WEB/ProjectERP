import { auth } from '@/auth';
import { apiSuccess, apiError, apiValidationError } from '@/lib/api-response';
import { buildWarehouseScopeClause } from '@/lib/authz';
import { query, queryOne } from '@/lib/db/client';
import { z } from 'zod';
import { DEFAULT_PAGE_SIZE } from '@/lib/constants';
import type { SessionUser } from '@/lib/authz';

const lineSchema = z.object({
  product_id: z.string().uuid(),
  qty_ordered: z.number().positive(),
  unit_cost: z.number().nonnegative().default(0),
  notes: z.string().optional(),
});

const createSchema = z.object({
  vendor_id: z.string().uuid(),
  warehouse_id: z.string().uuid(),
  order_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  notes: z.string().optional(),
  lines: z.array(lineSchema).min(1),
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

  const conditions: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  const scope = buildWarehouseScopeClause(u, 'io.warehouse_id', idx);
  if (scope) {
    conditions.push(scope.clause);
    params.push(...scope.params);
    idx += scope.params.length;
  }

  if (status) {
    conditions.push(`io.status = $${idx++}`);
    params.push(status);
  }

  if (warehouseId) {
    conditions.push(`io.warehouse_id = $${idx++}`);
    params.push(warehouseId);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const [total] = await query<{ count: string }>(
    `SELECT COUNT(*) FROM inbound_orders io ${where}`,
    params
  );

  const rows = await query(
    `SELECT
      io.id, io.io_number, io.status, io.notes, io.vendor_ref, io.created_at, io.order_date,
      v.name_th AS vendor_name, v.code AS vendor_code,
      w.code AS warehouse_code, w.name_th AS warehouse_name,
      u.name_en AS created_by_name,
      COUNT(iol.id) AS line_count
    FROM inbound_orders io
    JOIN vendors v ON v.id = io.vendor_id
    JOIN warehouses w ON w.id = io.warehouse_id
    JOIN users u ON u.id = io.created_by
    LEFT JOIN inbound_order_lines iol ON iol.io_id = io.id
    ${where}
    GROUP BY io.id, v.name_th, v.code, w.code, w.name_th, u.name_en
    ORDER BY io.created_at DESC
    LIMIT $${idx++} OFFSET $${idx++}`,
    [...params, limit, offset]
  );

  return apiSuccess({
    data: rows,
    total: Number(total.count),
    page,
    limit,
    total_pages: Math.ceil(Number(total.count) / limit),
  });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;

  const body = await req.json().catch(() => null);
  if (!body) return apiError('Invalid JSON', 400);

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return apiValidationError(parsed.error);

  // Staff can only create for their warehouses
  if (u.role === 'staff' && !u.assignedWarehouseIds.includes(parsed.data.warehouse_id)) {
    return apiError('No access to this warehouse', 403);
  }

  const io = await queryOne<{ id: string; io_number: string }>(
    `INSERT INTO inbound_orders (vendor_id, warehouse_id, order_date, notes, created_by)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, io_number`,
    [
      parsed.data.vendor_id,
      parsed.data.warehouse_id,
      parsed.data.order_date ?? new Date().toISOString().slice(0, 10),
      parsed.data.notes ?? null,
      u.id
    ]
  );

  if (!io) return apiError('Failed to create Inbound Order', 500);

  const lineValues = parsed.data.lines
    .map((_, i) => `($1, $${i * 4 + 2}, $${i * 4 + 3}, $${i * 4 + 4}, $${i * 4 + 5}, ${i + 1})`)
    .join(', ');

  const lineParams: unknown[] = [io.id];
  for (const l of parsed.data.lines) {
    lineParams.push(l.product_id, l.qty_ordered, l.unit_cost, l.notes ?? null);
  }

  await query(
    `INSERT INTO inbound_order_lines (io_id, product_id, qty_ordered, unit_cost, notes, line_number)
     VALUES ${lineValues}`,
    lineParams
  );

  return apiSuccess(io, 201);
}

import { auth } from '@/auth';
import { apiSuccess, apiError, apiValidationError } from '@/lib/api-response';
import { buildWarehouseScopeClause } from '@/lib/authz';
import { query, queryOne } from '@/lib/db/client';
import { z } from 'zod';
import { DEFAULT_PAGE_SIZE } from '@/lib/constants';
import type { SessionUser } from '@/lib/authz';

const lineSchema = z.object({
  product_id: z.string().uuid(),
  qty_requested: z.number().positive(),
  unit_cost: z.number().nonnegative().default(0),
  notes: z.string().optional(),
});

const createSchema = z.object({
  warehouse_id: z.string().uuid(),
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
  const search = searchParams.get('search');

  const conditions: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  const scope = buildWarehouseScopeClause(u, 'pr.warehouse_id', idx);
  if (scope) { conditions.push(scope.clause); params.push(...scope.params); idx += scope.params.length; }

  if (status) { conditions.push(`pr.status = $${idx++}`); params.push(status); }
  if (warehouseId) { conditions.push(`pr.warehouse_id = $${idx++}`); params.push(warehouseId); }
  if (search) { conditions.push(`pr.pr_number ILIKE $${idx++}`); params.push(`%${search}%`); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const [total] = await query<{ count: string }>(
    `SELECT COUNT(*) FROM purchase_requisitions pr ${where}`,
    params
  );

  const rows = await query(
    `SELECT pr.id, pr.pr_number, pr.status, pr.notes, pr.created_at, pr.updated_at,
            w.code AS warehouse_code, w.name_th AS warehouse_name,
            u.name_en AS requested_by_name,
            COUNT(li.id) AS line_count
     FROM purchase_requisitions pr
     JOIN warehouses w ON w.id = pr.warehouse_id
     JOIN users u ON u.id = pr.requested_by
     LEFT JOIN pr_line_items li ON li.pr_id = pr.id
     ${where}
     GROUP BY pr.id, w.code, w.name_th, u.name_en
     ORDER BY pr.created_at DESC
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

  if (u.role === 'staff' && !u.assignedWarehouseIds.includes(parsed.data.warehouse_id)) {
    return apiError('No access to this warehouse', 403);
  }

  const pr = await queryOne<{ id: string }>(
    `INSERT INTO purchase_requisitions (warehouse_id, requested_by, notes)
     VALUES ($1, $2, $3) RETURNING id, pr_number, status`,
    [parsed.data.warehouse_id, u.id, parsed.data.notes ?? null]
  );
  if (!pr) return apiError('Failed to create PR', 500);

  const lineValues = parsed.data.lines
    .map((_, i) => `($1, $${i * 4 + 2}, $${i * 4 + 3}, $${i * 4 + 4}, $${i * 4 + 5}, ${i + 1})`)
    .join(', ');
  const lineParams: unknown[] = [pr.id];
  for (const l of parsed.data.lines) {
    lineParams.push(l.product_id, l.qty_requested, l.unit_cost, l.notes ?? null);
  }
  await query(
    `INSERT INTO pr_line_items (pr_id, product_id, qty_requested, unit_cost, notes, line_number) VALUES ${lineValues}`,
    lineParams
  );

  return apiSuccess(pr, 201);
}

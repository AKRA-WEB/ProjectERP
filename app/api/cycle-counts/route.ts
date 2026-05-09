import { auth } from '@/auth';
import { apiSuccess, apiError, apiValidationError } from '@/lib/api-response';
import { assertRole, buildWarehouseScopeClause } from '@/lib/authz';
import { query, queryOne } from '@/lib/db/client';
import { z } from 'zod';
import { DEFAULT_PAGE_SIZE } from '@/lib/constants';
import type { SessionUser } from '@/lib/authz';

const lineSchema = z.object({
  product_id: z.string().uuid(),
  lot_id: z.string().uuid().optional(),
  qty_system: z.number().nonnegative(),
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

  const conditions: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  const scope = buildWarehouseScopeClause(u, 'cc.warehouse_id', idx);
  if (scope) { conditions.push(scope.clause); params.push(...scope.params); idx += scope.params.length; }
  if (status) { conditions.push(`cc.status = $${idx++}`); params.push(status); }
  if (warehouseId) { conditions.push(`cc.warehouse_id = $${idx++}`); params.push(warehouseId); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const [total] = await query<{ count: string }>(`SELECT COUNT(*) FROM cycle_counts cc ${where}`, params);

  const rows = await query(
    `SELECT cc.id, cc.count_number, cc.status, cc.created_at,
            w.code AS warehouse_code, w.name_th AS warehouse_name,
            u.name_en AS initiated_by_name,
            COUNT(ccl.id) AS line_count,
            COUNT(ccl.id) FILTER (WHERE ccl.qty_counted IS NOT NULL) AS counted_lines
     FROM cycle_counts cc
     JOIN warehouses w ON w.id = cc.warehouse_id
     JOIN users u ON u.id = cc.initiated_by
     LEFT JOIN cycle_count_lines ccl ON ccl.cycle_count_id = cc.id
     ${where}
     GROUP BY cc.id, w.code, w.name_th, u.name_en
     ORDER BY cc.created_at DESC
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

  const cc = await queryOne<{ id: string }>(
    `INSERT INTO cycle_counts (warehouse_id, initiated_by, notes)
     VALUES ($1, $2, $3) RETURNING id, count_number, status`,
    [parsed.data.warehouse_id, u.id, parsed.data.notes ?? null]
  );
  if (!cc) return apiError('Failed to create cycle count', 500);

  const lineValues = parsed.data.lines
    .map((_, i) => `($1, $${i * 3 + 2}, $${i * 3 + 3}, $${i * 3 + 4}, ${i + 1})`)
    .join(', ');
  const lineParams: unknown[] = [cc.id];
  for (const l of parsed.data.lines) {
    lineParams.push(l.product_id, l.lot_id ?? null, l.qty_system);
  }
  await query(
    `INSERT INTO cycle_count_lines (cycle_count_id, product_id, lot_id, qty_system, line_number) VALUES ${lineValues}`,
    lineParams
  );

  return apiSuccess(cc, 201);
}

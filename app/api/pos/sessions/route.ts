import { auth } from '@/auth';
import { apiSuccess, apiError, apiValidationError } from '@/lib/api-response';
import { assertPermission, assertWarehouseAccess, buildWarehouseScopeClause } from '@/lib/authz';
import { query, queryOne } from '@/lib/db/client';
import { z } from 'zod';
import { DEFAULT_PAGE_SIZE } from '@/lib/constants';
import type { SessionUser } from '@/lib/authz';

const createSchema = z.object({
  warehouse_id: z.string().uuid(),
  opening_float: z.number().min(0),
  notes: z.string().optional(),
});

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;

  try { assertPermission(u, 'pos:view'); } catch { return apiError('Forbidden', 403); }

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, Number(searchParams.get('page') ?? 1));
  const limit = Math.min(100, Number(searchParams.get('limit') ?? DEFAULT_PAGE_SIZE));
  const offset = (page - 1) * limit;
  const status = searchParams.get('status');
  const warehouseId = searchParams.get('warehouse_id');

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
  if (warehouseId) {
    conditions.push(`s.warehouse_id = $${idx++}`);
    params.push(warehouseId);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const [total] = await query<{ count: string }>(`SELECT COUNT(*) FROM pos_sessions s ${where}`, params);

  const sessions = await query(
    `SELECT s.*, 
            w.name_th AS warehouse_name_th, w.name_en AS warehouse_name_en,
            u_open.name_en AS opened_by_name,
            (SELECT COUNT(*) FROM pos_transactions t WHERE t.session_id = s.id) AS transaction_count,
            (SELECT COALESCE(SUM(total), 0) FROM pos_transactions t WHERE t.session_id = s.id AND t.status = 'completed') AS total_sales
     FROM pos_sessions s
     JOIN warehouses w ON w.id = s.warehouse_id
     JOIN users u_open ON u_open.id = s.opened_by
     ${where}
     ORDER BY s.opened_at DESC
     LIMIT $${idx++} OFFSET $${idx++}`,
    [...params, limit, offset]
  );

  return apiSuccess({
    data: sessions,
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

  try { assertPermission(u, 'pos:session_open'); } catch { return apiError('Forbidden', 403); }

  const body = await req.json().catch(() => null);
  if (!body) return apiError('Invalid JSON', 400);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return apiValidationError(parsed.error);

  try { assertWarehouseAccess(u, parsed.data.warehouse_id); } catch { return apiError('No access to this warehouse', 403); }

  // Check for existing open session for this user and warehouse
  const existing = await queryOne(
    "SELECT id FROM pos_sessions WHERE opened_by = $1 AND warehouse_id = $2 AND status = 'open'",
    [u.id, parsed.data.warehouse_id]
  );
  if (existing) return apiError('You already have an open session for this warehouse', 409);

  const newSession = await queryOne(
    `INSERT INTO pos_sessions (warehouse_id, opened_by, opening_float, notes)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [parsed.data.warehouse_id, u.id, parsed.data.opening_float, parsed.data.notes ?? null]
  );

  return apiSuccess(newSession, 201);
}

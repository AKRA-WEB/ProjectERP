import { auth } from '@/auth';
import { apiSuccess, apiError, apiValidationError } from '@/lib/api-response';
import { buildWarehouseScopeClause } from '@/lib/authz';
import { query, queryOne } from '@/lib/db/client';
import { z } from 'zod';
import { DEFAULT_PAGE_SIZE } from '@/lib/constants';
import type { SessionUser } from '@/lib/authz';

const createSchema = z.object({
  vendor_id: z.string().uuid(),
  warehouse_id: z.string().uuid(),
  grn_id: z.string().uuid().optional(),
  po_id: z.string().uuid().optional(),
  rma_id: z.string().uuid().optional(),
  claim_amount: z.number().nonnegative(),
  description: z.string().min(1),
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

  const scope = buildWarehouseScopeClause(u, 'c.warehouse_id', idx);
  if (scope) { conditions.push(scope.clause); params.push(...scope.params); idx += scope.params.length; }
  if (status) { conditions.push(`c.status = $${idx++}`); params.push(status); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const [total] = await query<{ count: string }>(`SELECT COUNT(*) FROM vendor_claims c ${where}`, params);

  const rows = await query(
    `SELECT c.id, c.claim_number, c.status, c.claim_amount, c.resolution_type, c.created_at,
            v.code AS vendor_code, v.name_th AS vendor_name,
            w.code AS warehouse_code, w.name_th AS warehouse_name,
            u.name_en AS created_by_name
     FROM vendor_claims c
     JOIN vendors v ON v.id = c.vendor_id
     JOIN warehouses w ON w.id = c.warehouse_id
     JOIN users u ON u.id = c.created_by
     ${where}
     ORDER BY c.created_at DESC
     LIMIT $${idx++} OFFSET $${idx++}`,
    [...params, limit, offset]
  );

  return apiSuccess({ data: rows, total: Number(total.count), page, limit, total_pages: Math.ceil(Number(total.count) / limit) });
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

  const claim = await queryOne(
    `INSERT INTO vendor_claims (vendor_id, warehouse_id, grn_id, po_id, rma_id, claim_amount, description, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id, claim_number, status`,
    [
      parsed.data.vendor_id, parsed.data.warehouse_id,
      parsed.data.grn_id ?? null, parsed.data.po_id ?? null, parsed.data.rma_id ?? null,
      parsed.data.claim_amount, parsed.data.description, u.id,
    ]
  );
  return apiSuccess(claim, 201);
}

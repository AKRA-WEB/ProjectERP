import { auth } from '@/auth';
import { apiSuccess, apiError, apiValidationError } from '@/lib/api-response';
import { buildWarehouseScopeClause } from '@/lib/authz';
import { query, queryOne } from '@/lib/db/client';
import { z } from 'zod';
import { DEFAULT_PAGE_SIZE } from '@/lib/constants';
import type { SessionUser } from '@/lib/authz';

const lineSchema = z.object({
  product_id: z.string().uuid(),
  lot_id: z.string().uuid().optional(),
  qty_returned: z.number().positive(),
  condition: z.enum(['resaleable', 'repack_resell', 'damaged_return_vendor']),
  notes: z.string().optional(),
});

const createSchema = z.object({
  warehouse_id: z.string().uuid(),
  vendor_id: z.string().uuid(),
  grn_id: z.string().uuid().optional(),
  po_id: z.string().uuid().optional(),
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

  const conditions: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  const scope = buildWarehouseScopeClause(u, 'r.warehouse_id', idx);
  if (scope) { conditions.push(scope.clause); params.push(...scope.params); idx += scope.params.length; }
  if (status) { conditions.push(`r.status = $${idx++}`); params.push(status); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const [total] = await query<{ count: string }>(`SELECT COUNT(*) FROM rma_requests r ${where}`, params);

  const rows = await query(
    `SELECT r.id, r.rma_number, r.status, r.created_at,
            v.code AS vendor_code, v.name_th AS vendor_name,
            w.code AS warehouse_code, w.name_th AS warehouse_name,
            u.name_en AS initiated_by_name, COUNT(li.id) AS line_count
     FROM rma_requests r
     JOIN vendors v ON v.id = r.vendor_id
     JOIN warehouses w ON w.id = r.warehouse_id
     JOIN users u ON u.id = r.initiated_by
     LEFT JOIN rma_line_items li ON li.rma_id = r.id
     ${where}
     GROUP BY r.id, v.code, v.name_th, w.code, w.name_th, u.name_en
     ORDER BY r.created_at DESC
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

  const rma = await queryOne<{ id: string }>(
    `INSERT INTO rma_requests (warehouse_id, vendor_id, grn_id, po_id, initiated_by, notes)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, rma_number, status`,
    [parsed.data.warehouse_id, parsed.data.vendor_id, parsed.data.grn_id ?? null, parsed.data.po_id ?? null, u.id, parsed.data.notes ?? null]
  );
  if (!rma) return apiError('Failed to create RMA', 500);

  const lineValues = parsed.data.lines
    .map((_, i) => `($1, $${i * 4 + 2}, $${i * 4 + 3}, $${i * 4 + 4}, $${i * 4 + 5}, ${i + 1})`)
    .join(', ');
  const lineParams: unknown[] = [rma.id];
  for (const l of parsed.data.lines) {
    lineParams.push(l.product_id, l.lot_id ?? null, l.qty_returned, l.condition);
  }
  await query(
    `INSERT INTO rma_line_items (rma_id, product_id, lot_id, qty_returned, condition, line_number) VALUES ${lineValues}`,
    lineParams
  );

  return apiSuccess(rma, 201);
}

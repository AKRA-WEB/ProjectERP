import { auth } from '@/auth';
import { apiSuccess, apiError, apiValidationError } from '@/lib/api-response';
import { assertRole, buildWarehouseScopeClause } from '@/lib/authz';
import { query, queryOne } from '@/lib/db/client';
import { z } from 'zod';
import { DEFAULT_PAGE_SIZE, VAT_RATE } from '@/lib/constants';
import type { SessionUser } from '@/lib/authz';

const lineSchema = z.object({
  product_id: z.string().uuid(),
  pr_line_item_id: z.string().uuid().optional(),
  qty_ordered: z.number().positive(),
  unit_price: z.number().nonnegative(),
  transaction_uom_id: z.string().uuid().optional(),
  transaction_qty: z.number().positive().optional(),
});

const createSchema = z.object({
  vendor_id: z.string().uuid(),
  warehouse_id: z.string().uuid(),
  expected_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  payment_terms_days: z.number().int().nonnegative().default(30),
  notes: z.string().optional(),
  pr_ids: z.array(z.string().uuid()).optional(),
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
  const vendorId = searchParams.get('vendor_id');
  const search = searchParams.get('search');

  const conditions: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  const scope = buildWarehouseScopeClause(u, 'po.warehouse_id', idx);
  if (scope) { conditions.push(scope.clause); params.push(...scope.params); idx += scope.params.length; }

  if (status) { conditions.push(`po.status = $${idx++}`); params.push(status); }
  if (warehouseId) { conditions.push(`po.warehouse_id = $${idx++}`); params.push(warehouseId); }
  if (vendorId) { conditions.push(`po.vendor_id = $${idx++}`); params.push(vendorId); }
  if (search) { conditions.push(`po.po_number ILIKE $${idx++}`); params.push(`%${search}%`); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const [total] = await query<{ count: string }>(`SELECT COUNT(*) FROM purchase_orders po ${where}`, params);

  const rows = await query(
    `SELECT po.id, po.po_number, po.status, po.expected_date, po.total_amount, po.created_at,
            v.code AS vendor_code, v.name_th AS vendor_name,
            w.code AS warehouse_code, w.name_th AS warehouse_name,
            u2.name_en AS created_by_name
     FROM purchase_orders po
     JOIN vendors v ON v.id = po.vendor_id
     JOIN warehouses w ON w.id = po.warehouse_id
     JOIN users u2 ON u2.id = po.created_by
     ${where}
     ORDER BY po.created_at DESC
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
  try { assertRole(u, ['manager', 'admin']); } catch { return apiError('Forbidden', 403); }

  const body = await req.json().catch(() => null);
  if (!body) return apiError('Invalid JSON', 400);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return apiValidationError(parsed.error);

  // MF-1: Verify all linked PRs are admin_approved
  if (parsed.data.pr_ids?.length) {
    const prs = await query<{ id: string, status: string }>(
      'SELECT id, status FROM purchase_requisitions WHERE id = ANY($1::uuid[])',
      [parsed.data.pr_ids]
    );
    if (prs.length !== parsed.data.pr_ids.length) {
      return apiError('One or more purchase requests not found', 404);
    }
    const invalidPrs = prs.filter(pr => pr.status !== 'admin_approved');
    if (invalidPrs.length > 0) {
      return apiError('All purchase requests must be in admin_approved status to convert to PO', 422);
    }
  }

  const subtotal = parsed.data.lines.reduce((sum, l) => sum + l.qty_ordered * l.unit_price, 0);
  const vat = Math.round(subtotal * VAT_RATE * 100) / 100;
  const total = Math.round((subtotal + vat) * 100) / 100;

  const po = await queryOne<{ id: string; po_number: string }>(
    `INSERT INTO purchase_orders (vendor_id, warehouse_id, expected_date, payment_terms_days, notes, subtotal, vat_amount, total_amount, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING id, po_number, status`,
    [
      parsed.data.vendor_id, parsed.data.warehouse_id,
      parsed.data.expected_date ?? null, parsed.data.payment_terms_days,
      parsed.data.notes ?? null, subtotal, vat, total, u.id,
    ]
  );
  if (!po) return apiError('Failed to create PO', 500);

  const lineValues = parsed.data.lines
    .map((_, i) => `($1, $${i * 6 + 2}, $${i * 6 + 3}, $${i * 6 + 4}, $${i * 6 + 5}, $${i * 6 + 6}, $${i * 6 + 7}, ${i + 1})`)
    .join(', ');
  const lineParams: unknown[] = [po.id];
  for (const l of parsed.data.lines) {
    lineParams.push(
      l.product_id,
      l.pr_line_item_id ?? null,
      l.qty_ordered,
      l.unit_price,
      l.transaction_uom_id ?? null,
      l.transaction_qty ?? null,
    );
  }
  await query(
    `INSERT INTO po_line_items (po_id, product_id, pr_line_item_id, qty_ordered, unit_price, transaction_uom_id, transaction_qty, line_number)
     VALUES ${lineValues}`,
    lineParams
  );

  if (parsed.data.pr_ids?.length) {
    const linkValues = parsed.data.pr_ids.map((_, i) => `($${i * 2 + 1}, $${i * 2 + 2})`).join(', ');
    const linkParams: unknown[] = [];
    for (const prId of parsed.data.pr_ids) { linkParams.push(prId, po.id); }
    await query(`INSERT INTO pr_po_links (pr_id, po_id) VALUES ${linkValues} ON CONFLICT DO NOTHING`, linkParams);
    await query(
      `UPDATE purchase_requisitions SET status = 'converted_to_po' WHERE id = ANY($1::uuid[])`,
      [parsed.data.pr_ids]
    );
  }

  return apiSuccess(po, 201);
}

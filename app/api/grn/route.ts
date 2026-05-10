import { auth } from '@/auth';
import { apiSuccess, apiError, apiValidationError } from '@/lib/api-response';
import { buildWarehouseScopeClause } from '@/lib/authz';
import { query, queryOne } from '@/lib/db/client';
import { z } from 'zod';
import { DEFAULT_PAGE_SIZE } from '@/lib/constants';
import type { SessionUser } from '@/lib/authz';

const lineSchema = z.object({
  po_line_item_id: z.string().uuid(),
  product_id: z.string().uuid(),
  qty_received: z.number().positive(),
  lot_number: z.string().max(100).optional(),
  serial_number: z.string().max(100).optional(),
  expiry_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  notes: z.string().optional(),
});

const createSchema = z.object({
  po_id: z.string().uuid(),
  warehouse_id: z.string().uuid(),
  received_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
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
  const poId = searchParams.get('po_id');

  const conditions: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  const scope = buildWarehouseScopeClause(u, 'g.warehouse_id', idx);
  if (scope) { conditions.push(scope.clause); params.push(...scope.params); idx += scope.params.length; }

  if (status) { conditions.push(`g.status = $${idx++}`); params.push(status); }
  if (warehouseId) { conditions.push(`g.warehouse_id = $${idx++}`); params.push(warehouseId); }
  if (poId) { conditions.push(`g.po_id = $${idx++}`); params.push(poId); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const [total] = await query<{ count: string }>(`SELECT COUNT(*) FROM goods_receipt_notes g ${where}`, params);

  const rows = await query(
    `SELECT g.id, g.grn_number, g.status, g.received_date, g.created_at,
            po.po_number, w.code AS warehouse_code, w.name_th AS warehouse_name,
            u.name_en AS received_by_name, COUNT(li.id) AS line_count
     FROM goods_receipt_notes g
     JOIN purchase_orders po ON po.id = g.po_id
     JOIN warehouses w ON w.id = g.warehouse_id
     JOIN users u ON u.id = g.received_by
     LEFT JOIN grn_line_items li ON li.grn_id = g.id
     ${where}
     GROUP BY g.id, po.po_number, w.code, w.name_th, u.name_en
     ORDER BY g.created_at DESC
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

  const po = await queryOne<{ status: string; warehouse_id: string }>(
    'SELECT status, warehouse_id FROM purchase_orders WHERE id = $1',
    [parsed.data.po_id]
  );
  if (!po) return apiError('PO not found', 404);
  if (!['sent', 'partially_received'].includes(po.status)) return apiError('PO must be in sent or partially_received status', 409);

  // Fetch remaining qty per line for this PO
  const poLines = await query<{
    id: string;
    qty_ordered: number;
    qty_received: number;
  }>(
    'SELECT id, qty_ordered, qty_received FROM po_line_items WHERE po_id = $1',
    [parsed.data.po_id]
  );

  const poLineMap = new Map(poLines.map((l) => [l.id, l]));

  for (const line of parsed.data.lines) {
    const poLine = poLineMap.get(line.po_line_item_id);
    if (!poLine) return apiError(`PO line ${line.po_line_item_id} not found`, 422);
    const remaining = Number(poLine.qty_ordered) - Number(poLine.qty_received);
    if (line.qty_received > remaining) {
      return apiError(
        `qty_received (${line.qty_received}) exceeds remaining qty (${remaining}) for line ${line.po_line_item_id}`,
        422
      );
    }
  }

  if (u.role === 'staff' && !u.assignedWarehouseIds.includes(parsed.data.warehouse_id)) {
    return apiError('No access to this warehouse', 403);
  }

  const grn = await queryOne<{ id: string }>(
    `INSERT INTO goods_receipt_notes (po_id, warehouse_id, received_by, received_date, notes)
     VALUES ($1, $2, $3, $4, $5) RETURNING id, grn_number, status`,
    [parsed.data.po_id, parsed.data.warehouse_id, u.id, parsed.data.received_date, parsed.data.notes ?? null]
  );
  if (!grn) return apiError('Failed to create GRN', 500);

  const lineValues = parsed.data.lines
    .map((_, i) => `($1, $${i * 6 + 2}, $${i * 6 + 3}, $${i * 6 + 4}, $${i * 6 + 5}, $${i * 6 + 6}, $${i * 6 + 7}, ${i + 1})`)
    .join(', ');
  const lineParams: unknown[] = [grn.id];
  for (const l of parsed.data.lines) {
    lineParams.push(l.po_line_item_id, l.product_id, l.qty_received, l.lot_number ?? null, l.serial_number ?? null, l.expiry_date ?? null);
  }
  await query(
    `INSERT INTO grn_line_items (grn_id, po_line_item_id, product_id, qty_received, lot_number, serial_number, expiry_date, line_number)
     VALUES ${lineValues}`,
    lineParams
  );

  return apiSuccess(grn, 201);
}

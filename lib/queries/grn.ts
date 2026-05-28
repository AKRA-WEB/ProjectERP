import { query } from '@/lib/db/client';
import { buildWarehouseScopeClause } from '@/lib/authz';
import { DEFAULT_PAGE_SIZE } from '@/lib/constants';
import type { SessionUser } from '@/lib/authz';

export interface GRNRow {
  id: string;
  grn_number: string;
  status: string;
  po_number: string | null;
  io_number: string | null;
  po_id: string | null;
  inbound_order_id: string | null;
  split_from_grn_id: string | null;
  warehouse_code: string;
  warehouse_name: string;
  received_by_name: string;
  received_date: string;
  line_count: number;
  created_at: string;
}

export interface GRNPageResult {
  data: GRNRow[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

export async function getGRNPage(
  user: SessionUser,
  params: { page?: number; limit?: number; status?: string; warehouse_id?: string; po_id?: string }
): Promise<GRNPageResult> {
  const page = Math.max(1, params.page ?? 1);
  const limit = Math.min(100, params.limit ?? DEFAULT_PAGE_SIZE);
  const offset = (page - 1) * limit;

  const conditions: string[] = [];
  const qParams: unknown[] = [];
  let idx = 1;

  const scope = buildWarehouseScopeClause(user, 'g.warehouse_id', idx);
  if (scope) { conditions.push(scope.clause); qParams.push(...scope.params); idx += scope.params.length; }
  if (params.status) { conditions.push(`g.status = $${idx++}`); qParams.push(params.status); }
  if (params.warehouse_id) { conditions.push(`g.warehouse_id = $${idx++}`); qParams.push(params.warehouse_id); }
  if (params.po_id) { conditions.push(`g.po_id = $${idx++}`); qParams.push(params.po_id); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const [totalRow] = await query<{ count: string }>(
    `SELECT COUNT(*) FROM goods_receipt_notes g ${where}`, qParams
  );

  const rows = await query<GRNRow>(
    `SELECT g.id, g.grn_number, g.status, g.received_date, g.created_at,
            g.split_from_grn_id,
            po.po_number, io.io_number, g.po_id, g.inbound_order_id,
            w.code AS warehouse_code, w.name_th AS warehouse_name,
            u.name_en AS received_by_name, COUNT(li.id)::int AS line_count
     FROM goods_receipt_notes g
     LEFT JOIN purchase_orders po ON po.id = g.po_id
     LEFT JOIN inbound_orders io ON io.id = g.inbound_order_id
     JOIN warehouses w ON w.id = g.warehouse_id
     JOIN users u ON u.id = g.received_by
     LEFT JOIN grn_line_items li ON li.grn_id = g.id
     ${where}
     GROUP BY g.id, po.po_number, io.io_number, w.code, w.name_th, u.name_en
     ORDER BY g.created_at DESC
     LIMIT $${idx++} OFFSET $${idx++}`,
    [...qParams, limit, offset]
  );

  return { data: rows, total: Number(totalRow.count), page, limit, total_pages: Math.ceil(Number(totalRow.count) / limit) };
}

export async function getGRNStatusCounts(user: SessionUser): Promise<Record<string, number>> {
  const qParams: unknown[] = [];
  let idx = 1;
  const scope = buildWarehouseScopeClause(user, 'g.warehouse_id', idx);
  const where = scope ? `WHERE ${scope.clause}` : '';
  if (scope) { qParams.push(...scope.params); }

  const rows = await query<{ status: string; count: string }>(
    `SELECT status, COUNT(*) AS count FROM goods_receipt_notes g ${where} GROUP BY status`,
    qParams
  );
  const counts: Record<string, number> = {};
  for (const r of rows) counts[r.status] = Number(r.count);
  return counts;
}

export async function getGRNQueueCounts(user: SessionUser): Promise<{ io: number; po: number }> {
  const ioConditions: string[] = ["io.status IN ('open', 'receiving')"];
  const ioParams: unknown[] = [];
  let ioIdx = 1;
  const ioScope = buildWarehouseScopeClause(user, 'io.warehouse_id', ioIdx);
  if (ioScope) { ioConditions.push(ioScope.clause); ioParams.push(...ioScope.params); }

  const poConditions: string[] = ["po.status IN ('sent', 'partially_received')", 'li.qty_ordered > li.qty_received'];
  const poParams: unknown[] = [];
  let poIdx = 1;
  const poScope = buildWarehouseScopeClause(user, 'po.warehouse_id', poIdx);
  if (poScope) { poConditions.push(poScope.clause); poParams.push(...poScope.params); }

  const [[ioRow], [poRow]] = await Promise.all([
    query<{ count: string }>(
      `SELECT COUNT(*) FROM inbound_orders io WHERE ${ioConditions.join(' AND ')}`, ioParams
    ),
    query<{ count: string }>(
      `SELECT COUNT(DISTINCT po.id) FROM purchase_orders po JOIN po_line_items li ON li.po_id = po.id WHERE ${poConditions.join(' AND ')}`, poParams
    ),
  ]);

  return { io: Number(ioRow?.count ?? 0), po: Number(poRow?.count ?? 0) };
}

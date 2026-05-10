import { auth } from '@/auth';
import { apiSuccess, apiError } from '@/lib/api-response';
import { buildWarehouseScopeClause } from '@/lib/authz';
import { query } from '@/lib/db/client';
import type { SessionUser } from '@/lib/authz';

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;

  const { searchParams } = new URL(req.url);
  const warehouseId = searchParams.get('warehouse_id');

  // 1. Pending POs
  const poConditions: string[] = [
    "po.status IN ('sent', 'partially_received')",
    "li.qty_ordered > li.qty_received"
  ];
  const poParams: unknown[] = [];
  let poIdx = 1;

  const poScope = buildWarehouseScopeClause(u, 'po.warehouse_id', poIdx);
  if (poScope) {
    poConditions.push(poScope.clause);
    poParams.push(...poScope.params);
    poIdx += poScope.params.length;
  }

  if (warehouseId) {
    poConditions.push(`po.warehouse_id = $${poIdx++}`);
    poParams.push(warehouseId);
  }

  const pendingPos = await query(
    `SELECT
      po.id, po.po_number, po.status, po.expected_date,
      v.name_th AS vendor_name,
      w.id AS warehouse_id, w.code AS warehouse_code, w.name_th AS warehouse_name,
      COUNT(DISTINCT li.id) AS total_lines,
      SUM(li.qty_ordered - li.qty_received) AS total_qty_remaining
    FROM purchase_orders po
    JOIN vendors v ON v.id = po.vendor_id
    JOIN warehouses w ON w.id = po.warehouse_id
    JOIN po_line_items li ON li.po_id = po.id
    WHERE ${poConditions.join(' AND ')}
    GROUP BY po.id, v.name_th, w.id, w.code, w.name_th
    ORDER BY po.created_at DESC
    LIMIT 50`,
    poParams
  );

  // 2. Pending Inbound Orders
  const ioConditions: string[] = [
    "io.status IN ('open', 'receiving')",
    "iol.qty_ordered > iol.qty_received"
  ];
  const ioParams: unknown[] = [];
  let ioIdx = 1;

  const ioScope = buildWarehouseScopeClause(u, 'io.warehouse_id', ioIdx);
  if (ioScope) {
    ioConditions.push(ioScope.clause);
    ioParams.push(...ioScope.params);
    ioIdx += ioScope.params.length;
  }

  if (warehouseId) {
    ioConditions.push(`io.warehouse_id = $${ioIdx++}`);
    ioParams.push(warehouseId);
  }

  const pendingIos = await query(
    `SELECT
      io.id, io.io_number, io.status, io.created_at,
      v.name_th AS vendor_name, v.code AS vendor_code,
      w.id AS warehouse_id, w.code AS warehouse_code, w.name_th AS warehouse_name,
      COUNT(DISTINCT iol.id) AS total_lines,
      SUM(iol.qty_ordered - iol.qty_received) AS total_qty_remaining
    FROM inbound_orders io
    JOIN vendors v ON v.id = io.vendor_id
    JOIN warehouses w ON w.id = io.warehouse_id
    JOIN inbound_order_lines iol ON iol.io_id = io.id
    WHERE ${ioConditions.join(' AND ')}
    GROUP BY io.id, v.name_th, v.code, w.id, w.code, w.name_th
    ORDER BY io.created_at DESC
    LIMIT 50`,
    ioParams
  );

  return apiSuccess({
    pending_pos: pendingPos,
    inbound_orders: pendingIos
  });
}

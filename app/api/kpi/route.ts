import { auth } from '@/auth';
import { apiSuccess, apiError } from '@/lib/api-response';
import { query } from '@/lib/db/client';

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);

  const { searchParams } = new URL(req.url);
  const warehouseId = searchParams.get('warehouse_id');

  const whParam = warehouseId ? [warehouseId] : [];
  const whWhere = warehouseId ? 'AND warehouse_id = $1' : '';
  const whWhereAlias = (alias: string) => warehouseId ? `AND ${alias}.warehouse_id = $1` : '';

  const [prStats] = await query<any>(
    `SELECT
       COUNT(*) FILTER (WHERE status = 'draft') AS draft,
       COUNT(*) FILTER (WHERE status = 'submitted') AS pending_approval,
       COUNT(*) FILTER (WHERE status IN ('manager_approved','admin_approved')) AS approved,
       COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days') AS last_30_days
     FROM purchase_requisitions WHERE 1=1 ${whWhere}`,
    whParam
  );

  const [poStats] = await query<any>(
    `SELECT
       COUNT(*) FILTER (WHERE status = 'draft') AS draft,
       COUNT(*) FILTER (WHERE status = 'sent') AS sent,
       COUNT(*) FILTER (WHERE status IN ('partially_received','fully_received')) AS in_progress,
       COALESCE(SUM(total_amount) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days'), 0) AS value_30_days
     FROM purchase_orders WHERE 1=1 ${whWhere}`,
    whParam
  );

  const [grnStats] = await query<any>(
    `SELECT
       COUNT(*) FILTER (WHERE g.status = 'stocked') AS stocked_this_month,
       COUNT(*) FILTER (WHERE g.status IN ('draft','received','qc_pending')) AS pending,
       COUNT(*) FILTER (WHERE g.status = 'qc_failed') AS qc_failed
     FROM goods_receipt_notes g
     WHERE g.created_at >= DATE_TRUNC('month', NOW()) ${whWhereAlias('g')}`,
    whParam
  );

  const [rmaStats] = await query<any>(
    `SELECT
       COUNT(*) FILTER (WHERE status = 'open') AS open_rmas,
       COUNT(*) FILTER (WHERE status = 'in_review') AS in_review
     FROM rma_requests WHERE 1=1 ${whWhere}`,
    whParam
  );

  const [claimStats] = await query<any>(
    `SELECT
       COUNT(*) FILTER (WHERE status IN ('open','in_review')) AS open_claims,
       COALESCE(SUM(claim_amount) FILTER (WHERE status IN ('open','in_review')), 0) AS open_claim_value
     FROM vendor_claims WHERE 1=1 ${whWhere}`,
    whParam
  );

  const lowStock = await query<any>(
    `SELECT p.sku, p.name_th, sb.qty_available, p.reorder_point, w.code AS warehouse_code
     FROM stock_balances sb
     JOIN products p ON p.id = sb.product_id
     JOIN warehouses w ON w.id = sb.warehouse_id
     WHERE sb.qty_available <= p.reorder_point AND p.is_active = TRUE
     ${warehouseId ? 'AND sb.warehouse_id = $1' : ''}
     ORDER BY (sb.qty_available - p.reorder_point) ASC LIMIT 10`,
    whParam
  );

  const recentLedger = await query<any>(
    `SELECT sl.created_at, sl.entry_type, sl.qty_change, p.sku, p.name_th, w.code AS warehouse_code
     FROM stock_ledger sl
     JOIN products p ON p.id = sl.product_id
     JOIN warehouses w ON w.id = sl.warehouse_id
     WHERE 1=1 ${warehouseId ? 'AND sl.warehouse_id = $1' : ''}
     ORDER BY sl.created_at DESC LIMIT 10`,
    whParam
  );

  return apiSuccess({
    pr: prStats,
    po: poStats,
    grn: grnStats,
    rma: rmaStats,
    claims: claimStats,
    low_stock: lowStock,
    recent_ledger: recentLedger,
  });
}

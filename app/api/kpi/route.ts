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

  const [prStats] = await query<{ draft: string; pending_approval: string; approved: string; last_30_days: string }>(
    `SELECT
       COUNT(*) FILTER (WHERE status = 'draft') AS draft,
       COUNT(*) FILTER (WHERE status = 'submitted') AS pending_approval,
       COUNT(*) FILTER (WHERE status IN ('manager_approved','admin_approved')) AS approved,
       COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days') AS last_30_days
     FROM purchase_requisitions WHERE 1=1 ${whWhere}`,
    whParam
  );

  const [poStats] = await query<{ draft: string; sent: string; in_progress: string; value_30_days: string }>(
    `SELECT
       COUNT(*) FILTER (WHERE status = 'draft') AS draft,
       COUNT(*) FILTER (WHERE status = 'sent') AS sent,
       COUNT(*) FILTER (WHERE status IN ('partially_received','fully_received')) AS in_progress,
       COALESCE(SUM(total_amount) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days'), 0) AS value_30_days
     FROM purchase_orders WHERE 1=1 ${whWhere}`,
    whParam
  );

  const [grnStats] = await query<{ stocked_this_month: string; pending: string; qc_failed: string }>(
    `SELECT
       COUNT(*) FILTER (WHERE g.status = 'stocked') AS stocked_this_month,
       COUNT(*) FILTER (WHERE g.status IN ('draft','received','qc_pending')) AS pending,
       COUNT(*) FILTER (WHERE g.status = 'qc_failed') AS qc_failed
     FROM goods_receipt_notes g
     WHERE g.created_at >= DATE_TRUNC('month', NOW()) ${whWhereAlias('g')}`,
    whParam
  );

  const [rmaStats] = await query<{ open_rmas: string; in_review: string }>(
    `SELECT
       COUNT(*) FILTER (WHERE status = 'open') AS open_rmas,
       COUNT(*) FILTER (WHERE status = 'in_review') AS in_review
     FROM rma_requests WHERE 1=1 ${whWhere}`,
    whParam
  );

  const [claimStats] = await query<{ open_claims: string; open_claim_value: string }>(
    `SELECT
       COUNT(*) FILTER (WHERE status IN ('open','in_review')) AS open_claims,
       COALESCE(SUM(claim_amount) FILTER (WHERE status IN ('open','in_review')), 0) AS open_claim_value
     FROM vendor_claims WHERE 1=1 ${whWhere}`,
    whParam
  );

  const lowStock = await query<{ sku: string; name_th: string; qty_available: string; reorder_point: number; warehouse_code: string }>(
    `SELECT p.sku, p.name_th, sb.qty_available, p.reorder_point, w.code AS warehouse_code
     FROM stock_balances sb
     JOIN products p ON p.id = sb.product_id
     JOIN warehouses w ON w.id = sb.warehouse_id
     WHERE sb.qty_available <= p.reorder_point AND p.is_active = TRUE
     ${warehouseId ? 'AND sb.warehouse_id = $1' : ''}
     ORDER BY (sb.qty_available - p.reorder_point) ASC LIMIT 10`,
    whParam
  );

  const recentLedger = await query<{
    created_at: string; entry_type: string; qty_change: string;
    sku: string; name_th: string; warehouse_code: string;
    user_name: string | null;
  }>(
    `SELECT sl.created_at, sl.entry_type, sl.qty_change,
            p.sku, p.name_th, w.code AS warehouse_code,
            COALESCE(u.name_th, u.name_en) AS user_name
     FROM stock_ledger sl
     JOIN products p ON p.id = sl.product_id
     JOIN warehouses w ON w.id = sl.warehouse_id
     LEFT JOIN users u ON u.id = sl.created_by
     WHERE 1=1 ${warehouseId ? 'AND sl.warehouse_id = $1' : ''}
     ORDER BY sl.created_at DESC LIMIT 10`,
    whParam
  );

  const topReceived = await query<{ sku: string; name_th: string; qty_received: string; tx_count: string }>(
    `SELECT p.sku, p.name_th,
            SUM(sl.qty_change) AS qty_received,
            COUNT(*) AS tx_count
     FROM stock_ledger sl
     JOIN products p ON p.id = sl.product_id
     WHERE sl.entry_type = 'grn_receipt'
       AND sl.created_at >= DATE_TRUNC('month', NOW())
       ${warehouseId ? 'AND sl.warehouse_id = $1' : ''}
     GROUP BY p.sku, p.name_th
     ORDER BY qty_received DESC LIMIT 5`,
    whParam
  );

  const warehousePerf = await query<{ warehouse_name: string; warehouse_code: string; grn_count: string; qty_stocked: string }>(
    `SELECT w.name_th AS warehouse_name, w.code AS warehouse_code,
            COUNT(DISTINCT g.id) AS grn_count,
            COALESCE(SUM(sl.qty_change), 0) AS qty_stocked
     FROM warehouses w
     LEFT JOIN goods_receipt_notes g
       ON g.warehouse_id = w.id AND g.status = 'stocked'
       AND g.created_at >= DATE_TRUNC('month', NOW())
     LEFT JOIN stock_ledger sl
       ON sl.warehouse_id = w.id AND sl.entry_type = 'grn_receipt'
       AND sl.created_at >= DATE_TRUNC('month', NOW())
     WHERE w.is_active = TRUE
       ${warehouseId ? 'AND w.id = $1' : ''}
     GROUP BY w.id, w.name_th, w.code
     ORDER BY qty_stocked DESC`,
    whParam
  );

  const [salesStats] = await query<{ pending_so: string; revenue_30d: string; revenue_today: string }>(
    `SELECT
       COUNT(*) FILTER (WHERE status IN ('confirmed','partially_delivered')) AS pending_so,
       COALESCE(SUM(total_amount) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days'), 0) AS revenue_30d,
       COALESCE(SUM(total_amount) FILTER (WHERE created_at >= DATE_TRUNC('day', NOW())), 0) AS revenue_today
     FROM sales_orders WHERE status != 'cancelled' ${whWhere}`,
    whParam
  );

  const [posStats] = await query<{ tx_count: string; revenue_today: string }>(
    `SELECT
       COUNT(*) AS tx_count,
       COALESCE(SUM(total), 0) AS revenue_today
     FROM pos_transactions
     WHERE status = 'completed' AND created_at >= DATE_TRUNC('day', NOW()) ${whWhere}`,
    whParam
  );

  const topProducts = await query<{ sku: string; name_th: string; qty_sold: string; tx_count: string }>(
    `SELECT p.sku, p.name_th, SUM(tl.qty) AS qty_sold, COUNT(DISTINCT t.id) AS tx_count
     FROM pos_transaction_lines tl
     JOIN products p ON p.id = tl.product_id
     JOIN pos_transactions t ON t.id = tl.transaction_id
     WHERE t.status = 'completed' AND t.created_at >= NOW() - INTERVAL '30 days'
       ${warehouseId ? 'AND t.warehouse_id = $1' : ''}
     GROUP BY p.id, p.sku, p.name_th ORDER BY qty_sold DESC LIMIT 5`,
    whParam
  );

  const recentActivity = await query<{ type: string; ref: string; action: string; created_at: string }>(
    `SELECT * FROM (
      (SELECT 'grn' AS type, grn_number AS ref, status::text AS action, created_at FROM goods_receipt_notes WHERE status != 'draft' ${whWhere} ORDER BY created_at DESC LIMIT 4)
      UNION ALL
      (SELECT 'so' AS type, so_number AS ref, status::text AS action, updated_at AS created_at FROM sales_orders WHERE status != 'draft' ${whWhere} ORDER BY updated_at DESC LIMIT 4)
      UNION ALL
      (SELECT 'pos' AS type, receipt_number AS ref, 'sale' AS action, created_at FROM pos_transactions WHERE status = 'completed' ${whWhere} ORDER BY created_at DESC LIMIT 4)
    ) AS activities ORDER BY created_at DESC LIMIT 8`,
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
    top_received: topReceived,
    warehouse_perf: warehousePerf,
    sales: salesStats,
    pos_today: posStats,
    top_products: topProducts,
    recent_activity: recentActivity,
  });
}

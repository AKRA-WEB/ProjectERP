import { query } from '@/lib/db/client';

export interface KPIData {
  pr: { pending_approval: number; last_30_days: number };
  po: { sent: number; value_30_days: string | number };
  grn: { pending: number; stocked_this_month: number; qc_failed: number };
  rma: { open_rmas: number; in_review: number };
  claims: { open_claims: number; open_claim_value: string | number };
  low_stock: Array<{ sku: string; name_th: string; warehouse_code: string; qty_available: string | number; reorder_point: number }>;
  recent_ledger: Array<{ sku: string; name_th: string; warehouse_code: string; entry_type: string; qty_change: string | number; user_name: string | null }>;
  top_received: Array<{ sku: string; name_th: string; qty_received: string | number; tx_count: string | number }>;
  warehouse_perf: Array<{ warehouse_name: string; warehouse_code: string; grn_count: string | number; qty_stocked: string | number }>;
  sales: { pending_so: number; revenue_30d: string | number; revenue_today: string | number };
  pos_today: { revenue: string | number; tx_count: number };
  top_products: Array<{ sku: string; name_th: string; qty_sold: string | number; tx_count: string | number }>;
  recent_activity: Array<{ type: string; ref: string; action: string; created_at: string }>;
}

export async function getKPI(warehouseId?: string): Promise<KPIData> {
  const whParam = warehouseId ? [warehouseId] : [];
  const whWhere = warehouseId ? 'AND warehouse_id = $1' : '';
  const whWhereAlias = (alias: string) => warehouseId ? `AND ${alias}.warehouse_id = $1` : '';

  const [
    prResult, poResult, grnResult, rmaResult, claimResult,
    lowStock, recentLedger, topReceived, warehousePerf,
    salesResult, posResult, topProducts, recentActivity,
  ] = await Promise.all([
    query<{ pending_approval: string; last_30_days: string }>(
      `SELECT COUNT(*) FILTER (WHERE status = 'submitted') AS pending_approval,
              COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days') AS last_30_days
       FROM purchase_requisitions WHERE 1=1 ${whWhere}`, whParam
    ),
    query<{ sent: string; value_30_days: string }>(
      `SELECT COUNT(*) FILTER (WHERE status = 'sent') AS sent,
              COALESCE(SUM(total_amount) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days'), 0) AS value_30_days
       FROM purchase_orders WHERE 1=1 ${whWhere}`, whParam
    ),
    query<{ stocked_this_month: string; pending: string; qc_failed: string }>(
      `SELECT COUNT(*) FILTER (WHERE g.status = 'stocked') AS stocked_this_month,
              COUNT(*) FILTER (WHERE g.status IN ('draft','received','qc_pending')) AS pending,
              COUNT(*) FILTER (WHERE g.status = 'qc_failed') AS qc_failed
       FROM goods_receipt_notes g WHERE g.created_at >= DATE_TRUNC('month', NOW()) ${whWhereAlias('g')}`, whParam
    ),
    query<{ open_rmas: string; in_review: string }>(
      `SELECT COUNT(*) FILTER (WHERE status = 'open') AS open_rmas,
              COUNT(*) FILTER (WHERE status = 'in_review') AS in_review
       FROM rma_requests WHERE 1=1 ${whWhere}`, whParam
    ),
    query<{ open_claims: string; open_claim_value: string }>(
      `SELECT COUNT(*) FILTER (WHERE status IN ('open','in_review')) AS open_claims,
              COALESCE(SUM(claim_amount) FILTER (WHERE status IN ('open','in_review')), 0) AS open_claim_value
       FROM vendor_claims WHERE 1=1 ${whWhere}`, whParam
    ),
    query<{ sku: string; name_th: string; qty_available: string; reorder_point: number; warehouse_code: string }>(
      `SELECT p.sku, p.name_th, sb.qty_available, p.reorder_point, w.code AS warehouse_code
       FROM stock_balances sb
       JOIN products p ON p.id = sb.product_id
       JOIN warehouses w ON w.id = sb.warehouse_id
       WHERE sb.qty_available <= p.reorder_point AND p.is_active = TRUE
       ${warehouseId ? 'AND sb.warehouse_id = $1' : ''}
       ORDER BY (sb.qty_available - p.reorder_point) ASC LIMIT 10`, whParam
    ),
    query<{ created_at: string; entry_type: string; qty_change: string; sku: string; name_th: string; warehouse_code: string; user_name: string | null }>(
      `SELECT sl.created_at, sl.entry_type, sl.qty_change,
              p.sku, p.name_th, w.code AS warehouse_code, COALESCE(u.name_th, u.name_en) AS user_name
       FROM stock_ledger sl
       JOIN products p ON p.id = sl.product_id
       JOIN warehouses w ON w.id = sl.warehouse_id
       LEFT JOIN users u ON u.id = sl.created_by
       WHERE 1=1 ${warehouseId ? 'AND sl.warehouse_id = $1' : ''}
       ORDER BY sl.created_at DESC LIMIT 10`, whParam
    ),
    query<{ sku: string; name_th: string; qty_received: string; tx_count: string }>(
      `SELECT p.sku, p.name_th, SUM(sl.qty_change) AS qty_received, COUNT(*) AS tx_count
       FROM stock_ledger sl
       JOIN products p ON p.id = sl.product_id
       WHERE sl.entry_type = 'grn_receipt'
         AND sl.created_at >= DATE_TRUNC('month', NOW())
         ${warehouseId ? 'AND sl.warehouse_id = $1' : ''}
       GROUP BY p.sku, p.name_th ORDER BY qty_received DESC LIMIT 5`, whParam
    ),
    query<{ warehouse_name: string; warehouse_code: string; grn_count: string; qty_stocked: string }>(
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
       WHERE w.is_active = TRUE ${warehouseId ? 'AND w.id = $1' : ''}
       GROUP BY w.id, w.name_th, w.code ORDER BY qty_stocked DESC`, whParam
    ),
    query<{ pending_so: string; revenue_30d: string; revenue_today: string }>(
      `SELECT COUNT(*) FILTER (WHERE status IN ('confirmed','partially_delivered')) AS pending_so,
              COALESCE(SUM(total_amount) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days'), 0) AS revenue_30d,
              COALESCE(SUM(total_amount) FILTER (WHERE created_at >= DATE_TRUNC('day', NOW())), 0) AS revenue_today
       FROM sales_orders WHERE status != 'cancelled' ${whWhere}`, whParam
    ),
    query<{ tx_count: string; revenue_today: string }>(
      `SELECT COUNT(*) AS tx_count, COALESCE(SUM(total), 0) AS revenue_today
       FROM pos_transactions
       WHERE status = 'completed' AND created_at >= DATE_TRUNC('day', NOW()) ${whWhere}`, whParam
    ),
    query<{ sku: string; name_th: string; qty_sold: string; tx_count: string }>(
      `SELECT p.sku, p.name_th, SUM(tl.qty) AS qty_sold, COUNT(DISTINCT t.id) AS tx_count
       FROM pos_transaction_lines tl
       JOIN products p ON p.id = tl.product_id
       JOIN pos_transactions t ON t.id = tl.transaction_id
       WHERE t.status = 'completed' AND t.created_at >= NOW() - INTERVAL '30 days'
         ${warehouseId ? 'AND t.warehouse_id = $1' : ''}
       GROUP BY p.id, p.sku, p.name_th ORDER BY qty_sold DESC LIMIT 5`, whParam
    ),
    query<{ type: string; ref: string; action: string; created_at: string }>(
      `SELECT * FROM (
         (SELECT 'grn' AS type, grn_number AS ref, status::text AS action, created_at FROM goods_receipt_notes WHERE status != 'draft' ${whWhere} ORDER BY created_at DESC LIMIT 4)
         UNION ALL
         (SELECT 'so' AS type, so_number AS ref, status::text AS action, updated_at AS created_at FROM sales_orders WHERE status != 'draft' ${whWhere} ORDER BY updated_at DESC LIMIT 4)
         UNION ALL
         (SELECT 'pos' AS type, receipt_number AS ref, 'sale' AS action, created_at FROM pos_transactions WHERE status = 'completed' ${whWhere} ORDER BY created_at DESC LIMIT 4)
       ) AS activities ORDER BY created_at DESC LIMIT 8`, whParam
    ),
  ]);

  return {
    pr: { pending_approval: Number(prResult[0]?.pending_approval ?? 0), last_30_days: Number(prResult[0]?.last_30_days ?? 0) },
    po: { sent: Number(poResult[0]?.sent ?? 0), value_30_days: poResult[0]?.value_30_days ?? 0 },
    grn: { stocked_this_month: Number(grnResult[0]?.stocked_this_month ?? 0), pending: Number(grnResult[0]?.pending ?? 0), qc_failed: Number(grnResult[0]?.qc_failed ?? 0) },
    rma: { open_rmas: Number(rmaResult[0]?.open_rmas ?? 0), in_review: Number(rmaResult[0]?.in_review ?? 0) },
    claims: { open_claims: Number(claimResult[0]?.open_claims ?? 0), open_claim_value: claimResult[0]?.open_claim_value ?? 0 },
    low_stock: lowStock,
    recent_ledger: recentLedger,
    top_received: topReceived,
    warehouse_perf: warehousePerf,
    sales: { pending_so: Number(salesResult[0]?.pending_so ?? 0), revenue_30d: salesResult[0]?.revenue_30d ?? 0, revenue_today: salesResult[0]?.revenue_today ?? 0 },
    pos_today: { revenue: posResult[0]?.revenue_today ?? 0, tx_count: Number(posResult[0]?.tx_count ?? 0) },
    top_products: topProducts,
    recent_activity: recentActivity,
  };
}

export interface AuditorDashboardData {
  periodsCount: number;
  unpostedJeCount: number;
  postedJeCount: number;
  outstandingAp: number;
  whtCertificatesCount: number;
  recentJe: Array<{ id: string; entry_number: string; entry_date: string; description: string; entry_type: string; total_debit: number; status: string }>;
}

export async function getAuditorDashboardData(): Promise<AuditorDashboardData> {
  const [periods, jeList, [whtRow], apRows] = await Promise.all([
    query<{ status: string }>(`SELECT status FROM accounting_fiscal_periods ORDER BY start_date DESC LIMIT 50`),
    query<{ id: string; entry_number: string; entry_date: string; description: string; entry_type: string; total_debit: number; status: string }>(
      `SELECT id, entry_number, entry_date, description, entry_type, total_debit, status
       FROM journal_entries ORDER BY created_at DESC LIMIT 5`
    ),
    query<{ count: string }>(`SELECT COUNT(*) FROM wht_certificates`),
    query<{ outstanding_amount: string }>(`SELECT (amount - paid_amount) AS outstanding_amount FROM po_invoices WHERE is_paid = FALSE`),
  ]);

  return {
    periodsCount: periods.filter(p => p.status === 'open').length,
    unpostedJeCount: jeList.filter(j => j.status === 'draft').length,
    postedJeCount: jeList.filter(j => j.status === 'posted').length,
    outstandingAp: apRows.reduce((sum, inv) => sum + Number(inv.outstanding_amount), 0),
    whtCertificatesCount: Number(whtRow?.count ?? 0),
    recentJe: jeList,
  };
}

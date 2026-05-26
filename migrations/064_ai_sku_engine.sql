-- migrations/064_ai_sku_engine.sql

-- 1. Create materialized view for SKU performance metrics
DROP MATERIALIZED VIEW IF EXISTS sku_performance_snapshot CASCADE;

CREATE MATERIALIZED VIEW sku_performance_snapshot AS
WITH pos_sales_30d AS (
  SELECT ptl.product_id,
         COALESCE(SUM(ptl.qty), 0) AS qty,
         COALESCE(SUM(ptl.line_total), 0) AS revenue
  FROM pos_transaction_lines ptl
  JOIN pos_transactions pt ON pt.id = ptl.transaction_id
  WHERE pt.status = 'completed' AND pt.created_at >= NOW() - INTERVAL '30 days'
  GROUP BY ptl.product_id
),
pos_sales_365d AS (
  SELECT ptl.product_id,
         COALESCE(SUM(ptl.qty), 0) AS qty
  FROM pos_transaction_lines ptl
  JOIN pos_transactions pt ON pt.id = ptl.transaction_id
  WHERE pt.status = 'completed' AND pt.created_at >= NOW() - INTERVAL '365 days'
  GROUP BY ptl.product_id
),
b2b_sales_30d AS (
  SELECT dli.product_id,
         COALESCE(SUM(dli.qty_to_deliver), 0) AS qty,
         COALESCE(SUM(dli.line_total), 0) AS revenue
  FROM do_line_items dli
  JOIN delivery_orders d ON d.id = dli.do_id
  WHERE d.status IN ('shipped', 'delivered') AND d.shipped_at >= NOW() - INTERVAL '30 days'
  GROUP BY dli.product_id
),
b2b_sales_365d AS (
  SELECT dli.product_id,
         COALESCE(SUM(dli.qty_to_deliver), 0) AS qty
  FROM do_line_items dli
  JOIN delivery_orders d ON d.id = dli.do_id
  WHERE d.status IN ('shipped', 'delivered') AND d.shipped_at >= NOW() - INTERVAL '365 days'
  GROUP BY dli.product_id
),
product_stock AS (
  SELECT product_id, COALESCE(SUM(qty_on_hand), 0) AS qty_on_hand
  FROM stock_balances
  GROUP BY product_id
)
SELECT
  p.id AS product_id,
  p.sku,
  p.name_th,
  p.name_en,
  COALESCE(ps.qty_on_hand, 0) AS qty_on_hand,
  (COALESCE(pos30.qty, 0) + COALESCE(b2b30.qty, 0))::NUMERIC(15,4) AS qty_sold_30d,
  (COALESCE(pos365.qty, 0) + COALESCE(b2b365.qty, 0))::NUMERIC(15,4) AS qty_sold_365d,
  (COALESCE(pos30.revenue, 0) + COALESCE(b2b30.revenue, 0))::NUMERIC(15,2) AS revenue_30d,
  ((COALESCE(pos30.qty, 0) + COALESCE(b2b30.qty, 0)) * p.moving_avg_cost)::NUMERIC(15,2) AS cogs_30d,
  ((COALESCE(pos30.revenue, 0) + COALESCE(b2b30.revenue, 0)) - ((COALESCE(pos30.qty, 0) + COALESCE(b2b30.qty, 0)) * p.moving_avg_cost))::NUMERIC(15,2) AS gross_margin_30d,
  COALESCE(
    (((COALESCE(pos30.revenue, 0) + COALESCE(b2b30.revenue, 0)) - ((COALESCE(pos30.qty, 0) + COALESCE(b2b30.qty, 0)) * p.moving_avg_cost)) / NULLIF(COALESCE(pos30.revenue, 0) + COALESCE(b2b30.revenue, 0), 0) * 100),
    0
  )::NUMERIC(15,2) AS gross_margin_pct,
  COALESCE(
    (COALESCE(pos30.qty, 0) + COALESCE(b2b30.qty, 0)) / NULLIF(COALESCE(ps.qty_on_hand, 0) + (COALESCE(pos30.qty, 0) + COALESCE(b2b30.qty, 0)), 0) * 100,
    0
  )::NUMERIC(15,2) AS sell_through_30d,
  CASE
    WHEN (COALESCE(pos30.qty, 0) + COALESCE(b2b30.qty, 0)) > 0
    THEN (COALESCE(ps.qty_on_hand, 0) / ((COALESCE(pos30.qty, 0) + COALESCE(b2b30.qty, 0)) / 30.0))::NUMERIC(15,2)
    ELSE 999.00
  END AS days_on_hand,
  p.moving_avg_cost,
  CASE
    WHEN (COALESCE(pos30.qty, 0) + COALESCE(b2b30.qty, 0)) >= 100 THEN 'FAST'
    WHEN (COALESCE(pos30.qty, 0) + COALESCE(b2b30.qty, 0)) >= 10 THEN 'MEDIUM'
    WHEN (COALESCE(pos30.qty, 0) + COALESCE(b2b30.qty, 0)) > 0 THEN 'SLOW'
    ELSE 'STAGNANT'
  END::VARCHAR(20) AS velocity_bucket,
  NOW() AS last_updated
FROM products p
LEFT JOIN product_stock ps ON ps.product_id = p.id
LEFT JOIN pos_sales_30d pos30 ON pos30.product_id = p.id
LEFT JOIN pos_sales_365d pos365 ON pos365.product_id = p.id
LEFT JOIN b2b_sales_30d b2b30 ON b2b30.product_id = p.id
LEFT JOIN b2b_sales_365d b2b365 ON b2b365.product_id = p.id
WHERE p.is_active = TRUE;

-- 2. Create unique index on the materialized view
CREATE UNIQUE INDEX IF NOT EXISTS idx_sku_perf_product ON sku_performance_snapshot(product_id);

-- 3. Create view to identify SKU-Cut Candidates (bottom decile)
CREATE OR REPLACE VIEW sku_cut_candidates AS
WITH scored AS (
  SELECT
    product_id,
    sku,
    name_th,
    name_en,
    qty_on_hand,
    qty_sold_30d,
    qty_sold_365d,
    revenue_30d,
    cogs_30d,
    gross_margin_30d,
    gross_margin_pct,
    sell_through_30d,
    days_on_hand,
    velocity_bucket,
    (
      (sell_through_30d * 0.3) +
      (LEAST(GREATEST(gross_margin_pct, 0), 100) * 0.3) +
      (LEAST(qty_sold_30d, 100.0) / 100.0 * 40.0)
    )::NUMERIC(15,2) AS score
  FROM sku_performance_snapshot
),
ranked AS (
  SELECT *,
         PERCENT_RANK() OVER (ORDER BY score ASC) AS pct_rank
  FROM scored
)
SELECT
  product_id,
  sku,
  name_th,
  name_en,
  qty_on_hand,
  qty_sold_30d,
  qty_sold_365d,
  revenue_30d,
  gross_margin_30d,
  gross_margin_pct,
  sell_through_30d,
  days_on_hand,
  velocity_bucket,
  score,
  ARRAY_REMOVE(ARRAY[
    CASE WHEN sell_through_30d < 10.0 THEN 'LOW_SELL_THROUGH' END,
    CASE WHEN qty_sold_30d = 0.0 AND qty_on_hand > 0.0 THEN 'STAGNANT_STOCK' END,
    CASE WHEN revenue_30d > 0.0 AND gross_margin_pct < 15.0 THEN 'WEAK_MARGIN' END,
    CASE WHEN days_on_hand > 180.0 AND qty_on_hand > 0.0 THEN 'HIGH_DAYS_ON_HAND' END
  ], NULL) AS reasons
FROM ranked
WHERE pct_rank <= 0.10;

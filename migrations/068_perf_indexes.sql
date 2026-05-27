BEGIN;

-- Supports CTE: DISTINCT ON (product_id, warehouse_id) ORDER BY created_at DESC
-- Used by inventory-valuation FIFO mode to find latest grn_receipt cost per SKU/warehouse
CREATE INDEX IF NOT EXISTS idx_ledger_cost_lookup
  ON stock_ledger(product_id, warehouse_id, created_at DESC)
  WHERE entry_type = 'grn_receipt';

COMMIT;

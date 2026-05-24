-- migrations/057_price_history_index.sql
BEGIN;

CREATE INDEX IF NOT EXISTS idx_si_customer_created ON sales_invoices(customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_do_line_items_product ON do_line_items(product_id);

COMMIT;

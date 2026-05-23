-- migrations/046_channel_on_order_header.sql
BEGIN;

-- 1. Add nullable columns first to allow backfill
ALTER TABLE sales_orders ADD COLUMN IF NOT EXISTS channel price_channel;
ALTER TABLE sales_invoices ADD COLUMN IF NOT EXISTS channel price_channel;
ALTER TABLE sales_quotations ADD COLUMN IF NOT EXISTS channel price_channel;

-- 2. Backfill existing records
-- For sales_orders
UPDATE sales_orders so
  SET channel = 'TRD'::price_channel
  FROM warehouses w
  WHERE w.id = so.warehouse_id AND w.code = 'W1' AND so.channel IS NULL;

UPDATE sales_orders so
  SET channel = 'AKRA'::price_channel
  FROM warehouses w
  WHERE w.id = so.warehouse_id AND w.code <> 'W1' AND so.channel IS NULL;

-- For sales_quotations
UPDATE sales_quotations sq
  SET channel = 'TRD'::price_channel
  FROM warehouses w
  WHERE w.id = sq.warehouse_id AND w.code = 'W1' AND sq.channel IS NULL;

UPDATE sales_quotations sq
  SET channel = 'AKRA'::price_channel
  FROM warehouses w
  WHERE w.id = sq.warehouse_id AND w.code <> 'W1' AND sq.channel IS NULL;

-- For sales_invoices (derive channel from parent sales_order)
UPDATE sales_invoices si
  SET channel = so.channel
  FROM sales_orders so
  WHERE so.id = si.so_id AND si.channel IS NULL;

-- 3. Any leftover rows should be defaulted to 'AKRA' to prevent NOT NULL violation
UPDATE sales_orders SET channel = 'AKRA'::price_channel WHERE channel IS NULL;
UPDATE sales_quotations SET channel = 'AKRA'::price_channel WHERE channel IS NULL;
UPDATE sales_invoices SET channel = 'AKRA'::price_channel WHERE channel IS NULL;

-- 4. Apply NOT NULL constraints
ALTER TABLE sales_orders ALTER COLUMN channel SET NOT NULL;
ALTER TABLE sales_invoices ALTER COLUMN channel SET NOT NULL;
ALTER TABLE sales_quotations ALTER COLUMN channel SET NOT NULL;

-- 5. Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_sales_orders_channel ON sales_orders(channel, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sales_invoices_channel ON sales_invoices(channel, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sales_quotations_channel ON sales_quotations(channel, created_at DESC);

COMMIT;

-- migrations/058_moving_average_cost.sql
BEGIN;

-- 1. Add moving_avg_cost column to products table
ALTER TABLE products ADD COLUMN IF NOT EXISTS moving_avg_cost NUMERIC(14,4) NOT NULL DEFAULT 0;

-- 2. Create index on stock_ledger for entry_type = 'grn_receipt'
CREATE INDEX IF NOT EXISTS idx_stock_ledger_grn_receipt ON stock_ledger(product_id, entry_type) WHERE entry_type = 'grn_receipt';

-- 3. Create Trigger Function to recalculate MAC on every grn_receipt
CREATE OR REPLACE FUNCTION recalculate_mac()
RETURNS TRIGGER AS $$
DECLARE
  old_mac NUMERIC(14,4);
  new_mac NUMERIC(14,4);
  qty_after NUMERIC(15,4);
  qty_before NUMERIC(15,4);
BEGIN
  -- Perform a strict lock on the target product row to prevent concurrency race conditions
  SELECT moving_avg_cost INTO old_mac
  FROM products
  WHERE id = NEW.product_id
  FOR UPDATE;

  -- Fetch the global post-balance quantity for this product (aggregated across all physical warehouses)
  -- Since the trigger runs AFTER INSERT on stock_ledger (and after sync_stock_balances has run),
  -- the quantity in stock_balances already includes NEW.qty_change.
  SELECT COALESCE(SUM(qty_on_hand), 0) INTO qty_after
  FROM stock_balances
  WHERE product_id = NEW.product_id;

  qty_before := qty_after - NEW.qty_change;

  IF qty_after <= 0 THEN
    new_mac := NEW.unit_cost;
  ELSIF qty_before <= 0 THEN
    new_mac := NEW.unit_cost;
  ELSE
    new_mac := ((qty_before * old_mac) + (NEW.qty_change * NEW.unit_cost)) / qty_after;
  END IF;

  -- Safe guard checks
  new_mac := COALESCE(new_mac, 0);
  IF new_mac < 0 THEN
    new_mac := 0;
  END IF;

  -- Update the product record
  UPDATE products
  SET moving_avg_cost = new_mac,
      updated_at = NOW()
  WHERE id = NEW.product_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Install the trigger AFTER trg_stock_ledger_sync
DROP TRIGGER IF EXISTS trg_stock_ledger_mac ON stock_ledger;
CREATE TRIGGER trg_stock_ledger_mac
  AFTER INSERT ON stock_ledger
  FOR EACH ROW
  WHEN (NEW.entry_type = 'grn_receipt')
  EXECUTE FUNCTION recalculate_mac();

-- 5. Create the Backfill MAC function
CREATE OR REPLACE FUNCTION backfill_mac()
RETURNS VOID AS $$
DECLARE
  r RECORD;
  old_mac NUMERIC(14,4);
  new_mac NUMERIC(14,4);
  qty_before NUMERIC(15,4);
  qty_after NUMERIC(15,4);
BEGIN
  -- Reset all moving_avg_cost values to 0
  UPDATE products SET moving_avg_cost = 0;

  -- Create a temporary table to track accumulated global quantities sequentially
  CREATE TEMP TABLE temp_product_qtys (
    product_id UUID PRIMARY KEY,
    qty_accumulated NUMERIC(15,4) DEFAULT 0
  ) ON COMMIT DROP;

  -- Loop through all grn_receipt entries in historical order
  FOR r IN 
    SELECT id, product_id, qty_change, unit_cost 
    FROM stock_ledger 
    WHERE entry_type = 'grn_receipt' 
    ORDER BY created_at ASC, id ASC
  LOOP
    -- Get current MAC in products
    SELECT moving_avg_cost INTO old_mac FROM products WHERE id = r.product_id;
    
    -- Ensure product exists in temp tracker
    INSERT INTO temp_product_qtys (product_id, qty_accumulated)
    VALUES (r.product_id, 0)
    ON CONFLICT (product_id) DO NOTHING;
    
    SELECT qty_accumulated INTO qty_before FROM temp_product_qtys WHERE product_id = r.product_id;
    
    qty_after := qty_before + r.qty_change;
    
    IF qty_after <= 0 THEN
      new_mac := r.unit_cost;
    ELSIF qty_before <= 0 THEN
      new_mac := r.unit_cost;
    ELSE
      new_mac := ((qty_before * old_mac) + (r.qty_change * r.unit_cost)) / qty_after;
    END IF;
    
    new_mac := COALESCE(new_mac, 0);
    IF new_mac < 0 THEN
      new_mac := 0;
    END IF;
    
    -- Update products table
    UPDATE products SET moving_avg_cost = new_mac WHERE id = r.product_id;
    
    -- Update temporary quantity accumulator
    UPDATE temp_product_qtys SET qty_accumulated = qty_after WHERE product_id = r.product_id;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- 6. Execute the initial backfill once
SELECT backfill_mac();

COMMIT;

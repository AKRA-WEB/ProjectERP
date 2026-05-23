BEGIN;

-- 1. Create FEFO index on lots
CREATE INDEX IF NOT EXISTS idx_lots_fefo ON lots(product_id, warehouse_id, expiry_date NULLS LAST);

-- 2. Add lot_id to pick_list_lines
ALTER TABLE pick_list_lines ADD COLUMN IF NOT EXISTS lot_id UUID REFERENCES lots(id);

-- 3. Add override JTI to pick_list_lines
ALTER TABLE pick_list_lines ADD COLUMN IF NOT EXISTS fefo_override_jti VARCHAR(100) REFERENCES override_audit(jti);

COMMIT;

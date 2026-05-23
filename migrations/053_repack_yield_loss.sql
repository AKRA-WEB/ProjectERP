BEGIN;

-- 1. Extend repack_orders
ALTER TABLE repack_orders 
  ADD COLUMN IF NOT EXISTS yield_loss_qty NUMERIC(15,4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS yield_loss_reason TEXT,
  ADD COLUMN IF NOT EXISTS closed_je_id UUID REFERENCES journal_entries(id);

-- 2. Seed COGS-Operational-Waste account
INSERT INTO accounts (account_code, name_th, name_en, account_type, normal_balance, allows_direct_posting, parent_id)
VALUES ('5910', 'ขาดทุนจากการแปรรูป (Repack Yield Loss)', 'COGS — Operational Waste', 'expense', 'debit', TRUE, (SELECT id FROM accounts WHERE account_code='5000'))
ON CONFLICT (account_code) DO NOTHING;

-- 3. Create repack_loss_settings table
CREATE TABLE IF NOT EXISTS repack_loss_settings (
  id             INT           PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  threshold_pct  NUMERIC(5,2)  NOT NULL DEFAULT 5.00,
  updated_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- 4. Initial seed for settings
INSERT INTO repack_loss_settings (id, threshold_pct) 
VALUES (1, 5.00) 
ON CONFLICT (id) DO NOTHING;

COMMIT;

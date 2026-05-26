-- migrations/063_auto_replenishment.sql

-- 1. Add new columns to products
ALTER TABLE products ADD COLUMN IF NOT EXISTS w1_reorder_point NUMERIC(14,3);
ALTER TABLE products ADD COLUMN IF NOT EXISTS w1_reorder_qty NUMERIC(14,3);

-- 2. Create status enum type
DO $$ BEGIN
  CREATE TYPE transfer_suggestion_status AS ENUM ('pending', 'approved', 'rejected', 'executed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3. Create transfer_suggestions table
CREATE TABLE IF NOT EXISTS transfer_suggestions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id    UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  suggested_qty NUMERIC(14,3) NOT NULL,
  source_wh     UUID NOT NULL REFERENCES warehouses(id),
  target_wh     UUID NOT NULL REFERENCES warehouses(id),
  source_bu     VARCHAR(50) NOT NULL,
  target_bu     VARCHAR(50) NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  approved_at   TIMESTAMPTZ,
  approved_by   UUID REFERENCES users(id),
  transfer_id   UUID REFERENCES warehouse_transfers(id),
  je_id         UUID REFERENCES journal_entries(id),
  status        transfer_suggestion_status NOT NULL DEFAULT 'pending'
);

-- 4. Seed inter-company clearing and BU inventory accounts
INSERT INTO accounts (account_code, name_th, name_en, account_type, normal_balance, parent_id)
VALUES
  ('1300-TRD', 'สินค้าคงเหลือ — TRD', 'Inventory — TRD', 'asset', 'debit', (SELECT id FROM accounts WHERE account_code = '1000')),
  ('1300-AKRA', 'สินค้าคงเหลือ — AKRA', 'Inventory — AKRA', 'asset', 'debit', (SELECT id FROM accounts WHERE account_code = '1000')),
  ('2190-AKRA', 'เจ้าหนี้ระหว่างกัน — AKRA', 'Inter-company Payable — AKRA', 'liability', 'credit', (SELECT id FROM accounts WHERE account_code = '2000')),
  ('1190-TRD', 'ลูกหนี้ระหว่างกัน — TRD', 'Inter-company Receivable — TRD', 'asset', 'debit', (SELECT id FROM accounts WHERE account_code = '1000'))
ON CONFLICT (account_code) DO NOTHING;

-- 5. Create indexes
CREATE INDEX IF NOT EXISTS idx_transfer_suggestions_product ON transfer_suggestions(product_id);
CREATE INDEX IF NOT EXISTS idx_transfer_suggestions_status ON transfer_suggestions(status);
CREATE INDEX IF NOT EXISTS idx_transfer_suggestions_created ON transfer_suggestions(created_at DESC);

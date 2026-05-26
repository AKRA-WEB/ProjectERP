-- migrations/066_rebate_management.sql
BEGIN;

-- 1. Create rebate contract period enum
DO $$ BEGIN
  CREATE TYPE rebate_period_type AS ENUM ('monthly', 'quarterly', 'annual');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. Create rebate accrual status enum
DO $$ BEGIN
  CREATE TYPE rebate_accrual_status AS ENUM ('pending', 'accrued', 'realised', 'expired');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3. Create vendor_rebate_contracts table
CREATE TABLE IF NOT EXISTS vendor_rebate_contracts (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id         UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  threshold_amount  NUMERIC(14,2) NOT NULL,
  rebate_rate       NUMERIC(5,2) NOT NULL, -- percentage e.g., 2.00 for 2%
  period            rebate_period_type NOT NULL,
  valid_from        DATE NOT NULL,
  valid_to          DATE NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_rebate_valid_dates CHECK (valid_to >= valid_from)
);

-- 4. Create vendor_rebate_accruals table
CREATE TABLE IF NOT EXISTS vendor_rebate_accruals (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id          UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  contract_id        UUID NOT NULL REFERENCES vendor_rebate_contracts(id) ON DELETE CASCADE,
  period_label       VARCHAR(50) NOT NULL, -- e.g. "2026-Q1" or "2026-M05" or "2026"
  eligible_purchases NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  accrued_rebate     NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  status             rebate_accrual_status NOT NULL DEFAULT 'pending',
  posted_je_id       UUID REFERENCES journal_entries(id) ON DELETE SET NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Seed accounting entities if not exists
INSERT INTO accounts (account_code, name_th, name_en, account_type, normal_balance, parent_id)
VALUES
  ('1220', 'ลูกหนี้ค่าส่วนลดรับ (Rebate)', 'Rebate Receivable', 'asset', 'debit', (SELECT id FROM accounts WHERE account_code = '1000')),
  ('4300', 'รายได้ส่วนลดการค้า (Rebate)', 'Rebate Income', 'revenue', 'credit', (SELECT id FROM accounts WHERE account_code = '4000'))
ON CONFLICT (account_code) DO NOTHING;

-- 6. Create indexes
CREATE UNIQUE INDEX IF NOT EXISTS idx_vendor_rebate_accruals_unique ON vendor_rebate_accruals(vendor_id, contract_id, period_label);
CREATE INDEX IF NOT EXISTS idx_vendor_rebate_contracts_dates ON vendor_rebate_contracts(valid_from, valid_to);
CREATE INDEX IF NOT EXISTS idx_vendor_rebate_accruals_status ON vendor_rebate_accruals(status);

COMMIT;

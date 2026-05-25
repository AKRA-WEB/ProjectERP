-- migrations/059_vendor_wht.sql
BEGIN;

-- 1. Add default_wht_rate to vendors
ALTER TABLE vendors
  ADD COLUMN IF NOT EXISTS default_wht_rate NUMERIC(5,2);

-- 2. Create sequence for WHT doc numbers
CREATE SEQUENCE IF NOT EXISTS wht_certificates_seq START 1;

-- 3. Create wht_certificates table
CREATE TABLE IF NOT EXISTS wht_certificates (
  id         UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id  UUID          NOT NULL REFERENCES vendors(id),
  payment_id UUID          NOT NULL REFERENCES ap_payments(id) ON DELETE CASCADE,
  wht_rate   NUMERIC(5,2)  NOT NULL,
  wht_amount NUMERIC(15,2) NOT NULL CHECK (wht_amount >= 0),
  doc_no     VARCHAR(50)   NOT NULL UNIQUE,
  issued_at  DATE          NOT NULL DEFAULT CURRENT_DATE,
  issued_by  UUID          NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- 4. Create index on wht_certificates
CREATE INDEX IF NOT EXISTS idx_wht_certs_vendor ON wht_certificates(vendor_id);
CREATE INDEX IF NOT EXISTS idx_wht_certs_payment ON wht_certificates(payment_id);
CREATE INDEX IF NOT EXISTS idx_wht_certs_date ON wht_certificates(issued_at DESC);

-- 5. Seed Withholding Tax Payable account if not exists
INSERT INTO accounts (account_code, name_th, name_en, account_type, normal_balance, parent_id)
VALUES (
  '2310',
  'ภาษีหัก ณ ที่จ่ายค้างส่ง',
  'Withholding Tax Payable',
  'liability',
  'credit',
  (SELECT id FROM accounts WHERE account_code='2000')
)
ON CONFLICT (account_code) DO NOTHING;

COMMIT;

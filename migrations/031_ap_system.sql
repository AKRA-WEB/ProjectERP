-- migrations/031_ap_system.sql
BEGIN;

-- 1. Extend vendors with bank info
ALTER TABLE vendors
  ADD COLUMN IF NOT EXISTS bank_name           VARCHAR(255),
  ADD COLUMN IF NOT EXISTS bank_account_number VARCHAR(100),
  ADD COLUMN IF NOT EXISTS bank_account_name   VARCHAR(255);

-- 2. Extend po_invoices for AP tracking
ALTER TABLE po_invoices
  ADD COLUMN IF NOT EXISTS vendor_id    UUID REFERENCES vendors(id),
  ADD COLUMN IF NOT EXISTS grn_id       UUID REFERENCES goods_receipt_notes(id),
  ADD COLUMN IF NOT EXISTS paid_amount  NUMERIC(15,2) NOT NULL DEFAULT 0;

-- Backfill vendor_id from PO for existing rows
UPDATE po_invoices pi
   SET vendor_id = po.vendor_id
  FROM purchase_orders po
 WHERE po.id = pi.po_id
   AND pi.vendor_id IS NULL;

-- 3. AP Payments table
CREATE SEQUENCE IF NOT EXISTS seq_ap_pmt START 1;

CREATE TABLE IF NOT EXISTS ap_payments (
  id             UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_number VARCHAR(50)   NOT NULL UNIQUE DEFAULT next_doc_number('PMT', 'seq_ap_pmt'),
  vendor_id      UUID          NOT NULL REFERENCES vendors(id),
  payment_date   DATE          NOT NULL DEFAULT CURRENT_DATE,
  total_amount   NUMERIC(15,2) NOT NULL CHECK (total_amount > 0),
  bank_ref       VARCHAR(255),
  notes          TEXT,
  paid_by        UUID          NOT NULL REFERENCES users(id),
  created_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- 4. Payment allocations (maps payment → invoice)
CREATE TABLE IF NOT EXISTS ap_payment_allocations (
  id               UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id       UUID          NOT NULL REFERENCES ap_payments(id) ON DELETE CASCADE,
  invoice_id       UUID          NOT NULL REFERENCES po_invoices(id),
  allocated_amount NUMERIC(15,2) NOT NULL CHECK (allocated_amount > 0),
  created_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  UNIQUE(payment_id, invoice_id)
);

-- 5. Indexes
CREATE INDEX IF NOT EXISTS idx_po_invoices_vendor  ON po_invoices(vendor_id);
CREATE INDEX IF NOT EXISTS idx_po_invoices_grn     ON po_invoices(grn_id);
CREATE INDEX IF NOT EXISTS idx_po_invoices_is_paid ON po_invoices(is_paid) WHERE is_paid = FALSE;
CREATE INDEX IF NOT EXISTS idx_ap_payments_vendor  ON ap_payments(vendor_id);
CREATE INDEX IF NOT EXISTS idx_ap_payments_date    ON ap_payments(payment_date DESC);

-- 6. Trigger: auto-update is_paid when paid_amount >= amount
CREATE OR REPLACE FUNCTION sync_invoice_paid_status()
RETURNS TRIGGER AS $$
BEGIN
  NEW.is_paid := (NEW.paid_amount >= NEW.amount);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_po_invoices_paid_status
  BEFORE INSERT OR UPDATE OF paid_amount, amount ON po_invoices
  FOR EACH ROW EXECUTE FUNCTION sync_invoice_paid_status();

-- 7. updated_at trigger for ap_payments
CREATE OR REPLACE TRIGGER trg_ap_payments_updated_at
  BEFORE UPDATE ON ap_payments
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMIT;

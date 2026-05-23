-- Step 1: Add new values to po_status enum (if not exists)
DO $$ BEGIN
  ALTER TYPE po_status ADD VALUE 'opened';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TYPE po_status ADD VALUE 'pending_delivery';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Step 2: Begin transaction
BEGIN;

-- Create BR sequence
CREATE SEQUENCE IF NOT EXISTS seq_br START 1;

-- Create blind_receipts table
CREATE TABLE IF NOT EXISTS blind_receipts (
  id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  br_number      VARCHAR(50)  NOT NULL UNIQUE DEFAULT next_doc_number('BR', 'seq_br'),
  po_id          UUID         NOT NULL REFERENCES purchase_orders(id),
  warehouse_id   UUID         NOT NULL REFERENCES warehouses(id),
  counted_by     UUID         NOT NULL REFERENCES users(id),
  status         VARCHAR(20)  NOT NULL DEFAULT 'draft', -- 'draft', 'submitted'
  notes          TEXT,
  grn_id         UUID, -- Set when merged into a GRN
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Create blind_receipt_lines table
CREATE TABLE IF NOT EXISTS blind_receipt_lines (
  id               UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  blind_receipt_id UUID           NOT NULL REFERENCES blind_receipts(id) ON DELETE CASCADE,
  product_id       UUID           NOT NULL REFERENCES products(id),
  qty_counted      NUMERIC(15,4)  NOT NULL CHECK (qty_counted >= 0),
  notes            TEXT,
  line_number      INTEGER        NOT NULL,
  created_at       TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  UNIQUE(blind_receipt_id, line_number)
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_br_po ON blind_receipts(po_id);
CREATE INDEX IF NOT EXISTS idx_br_status ON blind_receipts(status);

-- Create match_status enum
DO $$ BEGIN
  CREATE TYPE match_status AS ENUM ('pending', 'matched', 'mismatched');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Extend po_invoices for 3-Way Matching
ALTER TABLE po_invoices ADD COLUMN IF NOT EXISTS match_status match_status NOT NULL DEFAULT 'pending';

-- Create po_invoice_match_variances table
CREATE TABLE IF NOT EXISTS po_invoice_match_variances (
  id            BIGSERIAL      PRIMARY KEY,
  po_invoice_id UUID           NOT NULL REFERENCES po_invoices(id) ON DELETE CASCADE,
  variance_type VARCHAR(50)    NOT NULL,
  po_value      NUMERIC(15,2),
  gr_value      NUMERIC(15,2),
  invoice_value NUMERIC(15,2),
  detail        JSONB,
  created_at    TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

-- Add updated_at trigger for blind_receipts
CREATE OR REPLACE TRIGGER trg_br_updated_at
  BEFORE UPDATE ON blind_receipts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMIT;

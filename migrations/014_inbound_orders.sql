-- 1. New enum for IO status
DO $$ BEGIN
  CREATE TYPE inbound_order_status AS ENUM (
    'open',                  -- task card created, awaiting delivery
    'receiving',             -- at least one GRN created
    'pending_verification',  -- GRN marked received, awaiting supervisor sign-off
    'verified',              -- supervisor confirmed receipt matches delivery bill
    'closed'                 -- vendor reference recorded; complete
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. Sequence for IO document numbers (IO-YYYYMMDD-0001)
CREATE SEQUENCE IF NOT EXISTS seq_io START 1;

-- 3. Inbound orders table (the "task card")
CREATE TABLE IF NOT EXISTS inbound_orders (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  io_number           VARCHAR(50) NOT NULL UNIQUE DEFAULT next_doc_number('IO', 'seq_io'),
  vendor_id           UUID NOT NULL REFERENCES vendors(id),
  warehouse_id        UUID NOT NULL REFERENCES warehouses(id),
  status              inbound_order_status NOT NULL DEFAULT 'open',
  notes               TEXT,         -- e.g. screenshots/context from LINE
  vendor_ref          VARCHAR(100), -- vendor's delivery bill / PO ref (recorded last)
  verified_by         UUID REFERENCES users(id),
  verified_at         TIMESTAMPTZ,
  verification_notes  TEXT,
  created_by          UUID NOT NULL REFERENCES users(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_io_vendor    ON inbound_orders(vendor_id);
CREATE INDEX IF NOT EXISTS idx_io_warehouse ON inbound_orders(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_io_status    ON inbound_orders(status);

-- 4. Inbound order line items
CREATE TABLE IF NOT EXISTS inbound_order_lines (
  id           UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  io_id        UUID          NOT NULL REFERENCES inbound_orders(id) ON DELETE CASCADE,
  product_id   UUID          NOT NULL REFERENCES products(id),
  qty_ordered  NUMERIC(15,4) NOT NULL CHECK (qty_ordered > 0),
  qty_received NUMERIC(15,4) NOT NULL DEFAULT 0,
  unit_cost    NUMERIC(15,2) NOT NULL DEFAULT 0,
  notes        TEXT,
  line_number  INTEGER       NOT NULL,
  UNIQUE(io_id, line_number)
);

CREATE INDEX IF NOT EXISTS idx_io_lines_io      ON inbound_order_lines(io_id);
CREATE INDEX IF NOT EXISTS idx_io_lines_product ON inbound_order_lines(product_id);

-- 5. updated_at trigger for inbound_orders
CREATE OR REPLACE TRIGGER trg_io_updated_at
  BEFORE UPDATE ON inbound_orders
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 6. Alter GRN: make po_id nullable; add inbound_order_id; add verification fields
ALTER TABLE goods_receipt_notes
  ALTER COLUMN po_id DROP NOT NULL;

ALTER TABLE goods_receipt_notes
  ADD COLUMN IF NOT EXISTS inbound_order_id  UUID REFERENCES inbound_orders(id),
  ADD COLUMN IF NOT EXISTS verified_by       UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS verified_at       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS verification_notes TEXT;

-- Exactly one of po_id or inbound_order_id must be set
-- First drop if exists to avoid error on retry
ALTER TABLE goods_receipt_notes DROP CONSTRAINT IF EXISTS chk_grn_source;
ALTER TABLE goods_receipt_notes
  ADD CONSTRAINT chk_grn_source CHECK (
    (po_id IS NOT NULL AND inbound_order_id IS NULL) OR
    (po_id IS NULL AND inbound_order_id IS NOT NULL)
  );

-- 7. Alter GRN lines: make po_line_item_id nullable; add IO line FK
ALTER TABLE grn_line_items
  ALTER COLUMN po_line_item_id DROP NOT NULL;

ALTER TABLE grn_line_items
  ADD COLUMN IF NOT EXISTS inbound_order_line_id UUID REFERENCES inbound_order_lines(id);

-- Exactly one source per GRN line
ALTER TABLE grn_line_items DROP CONSTRAINT IF EXISTS chk_grn_line_source;
ALTER TABLE grn_line_items
  ADD CONSTRAINT chk_grn_line_source CHECK (
    (po_line_item_id IS NOT NULL AND inbound_order_line_id IS NULL) OR
    (po_line_item_id IS NULL AND inbound_order_line_id IS NOT NULL)
  );

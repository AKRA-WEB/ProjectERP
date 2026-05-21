-- migrations/038_io_gr_po_workflow.sql

-- 1. New IO status values
ALTER TYPE inbound_order_status ADD VALUE IF NOT EXISTS 'rejected';
ALTER TYPE inbound_order_status ADD VALUE IF NOT EXISTS 'converted_to_po';

-- 2. New GRN status value
ALTER TYPE grn_status ADD VALUE IF NOT EXISTS 'rejected';

-- 3. IO: order_date + parent_io_id
ALTER TABLE inbound_orders
  ADD COLUMN IF NOT EXISTS order_date    DATE NOT NULL DEFAULT CURRENT_DATE,
  ADD COLUMN IF NOT EXISTS parent_io_id UUID REFERENCES inbound_orders(id);

-- 4. GRN: received_by_names + lift fee
ALTER TABLE goods_receipt_notes
  ADD COLUMN IF NOT EXISTS received_by_names TEXT,
  ADD COLUMN IF NOT EXISTS lift_fee_rounds   INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS lift_fee_amount   NUMERIC(10,2)
    GENERATED ALWAYS AS (lift_fee_rounds * 50.00) STORED;

-- 5. GRN lines: date_type + mfg_date
ALTER TABLE grn_line_items
  ADD COLUMN IF NOT EXISTS date_type VARCHAR(10) NOT NULL DEFAULT 'expiry'
    CHECK (date_type IN ('expiry', 'mfg')),
  ADD COLUMN IF NOT EXISTS mfg_date DATE;

-- 6. IO-PO link table
CREATE TABLE IF NOT EXISTS io_po_links (
  io_id      UUID NOT NULL REFERENCES inbound_orders(id),
  po_id      UUID NOT NULL REFERENCES purchase_orders(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (io_id, po_id)
);
CREATE INDEX IF NOT EXISTS idx_io_po_links_po ON io_po_links(po_id);

-- 7. GRN: rejection tracking
ALTER TABLE goods_receipt_notes
  ADD COLUMN IF NOT EXISTS rejected_by     UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS rejected_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rejection_notes TEXT;

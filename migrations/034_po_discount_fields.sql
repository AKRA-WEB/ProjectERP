-- po_line_items: per-line discount
ALTER TABLE po_line_items
  ADD COLUMN IF NOT EXISTS line_discount NUMERIC(15,2) NOT NULL DEFAULT 0;

-- purchase_orders: financial fields
ALTER TABLE purchase_orders
  ADD COLUMN IF NOT EXISTS bill_discount    NUMERIC(15,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS non_vat_amount   NUMERIC(15,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pre_vat_amount   NUMERIC(15,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS include_vat      BOOLEAN       NOT NULL DEFAULT FALSE,
  -- detail tab fields
  ADD COLUMN IF NOT EXISTS doc_date         DATE,
  ADD COLUMN IF NOT EXISTS expiry_date      DATE,
  ADD COLUMN IF NOT EXISTS delivery_date    DATE,
  ADD COLUMN IF NOT EXISTS from_address     TEXT,
  ADD COLUMN IF NOT EXISTS to_address       TEXT,
  ADD COLUMN IF NOT EXISTS reference        TEXT,
  -- approval tracking
  ADD COLUMN IF NOT EXISTS approved_by      UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS approved_at      TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS goods_receipt_notes (
  id             UUID       PRIMARY KEY DEFAULT gen_random_uuid(),
  grn_number     VARCHAR(50) NOT NULL UNIQUE DEFAULT next_doc_number('GRN', 'seq_grn'),
  po_id          UUID       NOT NULL REFERENCES purchase_orders(id),
  warehouse_id   UUID       NOT NULL REFERENCES warehouses(id),
  status         grn_status NOT NULL DEFAULT 'draft',
  received_by    UUID       NOT NULL REFERENCES users(id),
  received_date  DATE       NOT NULL,
  qc_reviewed_by UUID       REFERENCES users(id),
  qc_reviewed_at TIMESTAMPTZ,
  qc_notes       TEXT,
  stocked_by     UUID       REFERENCES users(id),
  stocked_at     TIMESTAMPTZ,
  notes          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_grn_po ON goods_receipt_notes(po_id);
CREATE INDEX IF NOT EXISTS idx_grn_warehouse ON goods_receipt_notes(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_grn_status ON goods_receipt_notes(status);

CREATE TABLE IF NOT EXISTS grn_line_items (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  grn_id          UUID          NOT NULL REFERENCES goods_receipt_notes(id) ON DELETE CASCADE,
  po_line_item_id UUID          NOT NULL REFERENCES po_line_items(id),
  product_id      UUID          NOT NULL REFERENCES products(id),
  lot_id          UUID          REFERENCES lots(id),
  qty_received    NUMERIC(15,4) NOT NULL CHECK (qty_received > 0),
  qty_accepted    NUMERIC(15,4),
  qty_rejected    NUMERIC(15,4),
  lot_number      VARCHAR(100),
  serial_number   VARCHAR(100),
  expiry_date     DATE,
  qc_status       VARCHAR(20),
  qc_notes        TEXT,
  line_number     INTEGER       NOT NULL,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  UNIQUE(grn_id, line_number),
  CHECK (qty_accepted IS NULL OR qty_accepted >= 0),
  CHECK (qty_rejected IS NULL OR qty_rejected >= 0)
);

CREATE INDEX IF NOT EXISTS idx_grn_lines_grn ON grn_line_items(grn_id);
CREATE INDEX IF NOT EXISTS idx_grn_lines_product ON grn_line_items(product_id);

CREATE OR REPLACE TRIGGER trg_grn_updated_at
  BEFORE UPDATE ON goods_receipt_notes
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

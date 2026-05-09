CREATE TABLE IF NOT EXISTS rma_requests (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  rma_number       VARCHAR(50) NOT NULL UNIQUE DEFAULT next_doc_number('RMA', 'seq_rma'),
  warehouse_id     UUID        NOT NULL REFERENCES warehouses(id),
  vendor_id        UUID        NOT NULL REFERENCES vendors(id),
  initiated_by     UUID        NOT NULL REFERENCES users(id),
  status           rma_status  NOT NULL DEFAULT 'open',
  grn_id           UUID        REFERENCES goods_receipt_notes(id),
  po_id            UUID        REFERENCES purchase_orders(id),
  resolved_by      UUID        REFERENCES users(id),
  resolved_at      TIMESTAMPTZ,
  resolution_notes TEXT,
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rma_warehouse ON rma_requests(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_rma_vendor ON rma_requests(vendor_id);
CREATE INDEX IF NOT EXISTS idx_rma_status ON rma_requests(status);

CREATE TABLE IF NOT EXISTS rma_line_items (
  id           UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  rma_id       UUID          NOT NULL REFERENCES rma_requests(id) ON DELETE CASCADE,
  product_id   UUID          NOT NULL REFERENCES products(id),
  lot_id       UUID          REFERENCES lots(id),
  qty_returned NUMERIC(15,4) NOT NULL CHECK (qty_returned > 0),
  condition    rma_condition NOT NULL,
  notes        TEXT,
  line_number  INTEGER       NOT NULL,
  UNIQUE(rma_id, line_number)
);

CREATE OR REPLACE TRIGGER trg_rma_updated_at
  BEFORE UPDATE ON rma_requests
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

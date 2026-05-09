CREATE TABLE IF NOT EXISTS warehouse_transfers (
  id                  UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_number     VARCHAR(50)     NOT NULL UNIQUE DEFAULT next_doc_number('TRF', 'seq_trf'),
  source_warehouse_id UUID            NOT NULL REFERENCES warehouses(id),
  dest_warehouse_id   UUID            NOT NULL REFERENCES warehouses(id),
  initiated_by        UUID            NOT NULL REFERENCES users(id),
  status              transfer_status NOT NULL DEFAULT 'pending',
  completed_by        UUID            REFERENCES users(id),
  completed_at        TIMESTAMPTZ,
  cancelled_by        UUID            REFERENCES users(id),
  cancelled_at        TIMESTAMPTZ,
  cancellation_reason TEXT,
  notes               TEXT,
  created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  CHECK (source_warehouse_id <> dest_warehouse_id)
);

CREATE INDEX IF NOT EXISTS idx_transfer_source ON warehouse_transfers(source_warehouse_id);
CREATE INDEX IF NOT EXISTS idx_transfer_dest ON warehouse_transfers(dest_warehouse_id);
CREATE INDEX IF NOT EXISTS idx_transfer_status ON warehouse_transfers(status);

CREATE TABLE IF NOT EXISTS warehouse_transfer_lines (
  id          UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_id UUID          NOT NULL REFERENCES warehouse_transfers(id) ON DELETE CASCADE,
  product_id  UUID          NOT NULL REFERENCES products(id),
  lot_id      UUID          REFERENCES lots(id),
  qty         NUMERIC(15,4) NOT NULL CHECK (qty > 0),
  line_number INTEGER       NOT NULL,
  UNIQUE(transfer_id, line_number)
);

CREATE OR REPLACE TRIGGER trg_transfers_updated_at
  BEFORE UPDATE ON warehouse_transfers
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

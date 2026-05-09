CREATE TABLE IF NOT EXISTS stock_balances (
  warehouse_id  UUID          NOT NULL REFERENCES warehouses(id),
  product_id    UUID          NOT NULL REFERENCES products(id),
  qty_on_hand   NUMERIC(15,4) NOT NULL DEFAULT 0,
  qty_reserved  NUMERIC(15,4) NOT NULL DEFAULT 0,
  qty_available NUMERIC(15,4) GENERATED ALWAYS AS (qty_on_hand - qty_reserved) STORED,
  last_updated  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  PRIMARY KEY (warehouse_id, product_id)
);

CREATE TABLE IF NOT EXISTS lots (
  id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id    UUID         NOT NULL REFERENCES products(id),
  warehouse_id  UUID         NOT NULL REFERENCES warehouses(id),
  lot_number    VARCHAR(100) NOT NULL,
  serial_number VARCHAR(100),
  expiry_date   DATE,
  qty_on_hand   NUMERIC(15,4) NOT NULL DEFAULT 0,
  received_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE(product_id, warehouse_id, lot_number)
);

CREATE INDEX IF NOT EXISTS idx_lots_product_wh ON lots(product_id, warehouse_id);
CREATE INDEX IF NOT EXISTS idx_lots_lot_number ON lots(lot_number);
CREATE INDEX IF NOT EXISTS idx_lots_expiry ON lots(expiry_date) WHERE expiry_date IS NOT NULL;

CREATE TABLE IF NOT EXISTS stock_ledger (
  id             BIGSERIAL         PRIMARY KEY,
  warehouse_id   UUID              NOT NULL REFERENCES warehouses(id),
  product_id     UUID              NOT NULL REFERENCES products(id),
  lot_id         UUID              REFERENCES lots(id),
  entry_type     ledger_entry_type NOT NULL,
  reference_type VARCHAR(50),
  reference_id   UUID,
  qty_change     NUMERIC(15,4)     NOT NULL,
  qty_after      NUMERIC(15,4)     NOT NULL,
  unit_cost      NUMERIC(15,2),
  notes          TEXT,
  created_by     UUID              REFERENCES users(id),
  created_at     TIMESTAMPTZ       NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ledger_warehouse_product ON stock_ledger(warehouse_id, product_id);
CREATE INDEX IF NOT EXISTS idx_ledger_created ON stock_ledger(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ledger_reference ON stock_ledger(reference_type, reference_id);
CREATE INDEX IF NOT EXISTS idx_ledger_lot ON stock_ledger(lot_id) WHERE lot_id IS NOT NULL;

CREATE OR REPLACE FUNCTION sync_stock_balances()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO stock_balances (warehouse_id, product_id, qty_on_hand, last_updated)
  VALUES (NEW.warehouse_id, NEW.product_id, NEW.qty_change, NOW())
  ON CONFLICT (warehouse_id, product_id)
  DO UPDATE SET
    qty_on_hand  = stock_balances.qty_on_hand + NEW.qty_change,
    last_updated = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_stock_ledger_sync
  AFTER INSERT ON stock_ledger
  FOR EACH ROW EXECUTE FUNCTION sync_stock_balances();

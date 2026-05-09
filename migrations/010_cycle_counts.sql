CREATE TABLE IF NOT EXISTS cycle_counts (
  id            UUID               PRIMARY KEY DEFAULT gen_random_uuid(),
  count_number  VARCHAR(50)        NOT NULL UNIQUE DEFAULT next_doc_number('CC', 'seq_cc'),
  warehouse_id  UUID               NOT NULL REFERENCES warehouses(id),
  status        cycle_count_status NOT NULL DEFAULT 'open',
  initiated_by  UUID               NOT NULL REFERENCES users(id),
  approved_by   UUID               REFERENCES users(id),
  approved_at   TIMESTAMPTZ,
  rejection_reason TEXT,
  notes         TEXT,
  created_at    TIMESTAMPTZ        NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ        NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cc_warehouse ON cycle_counts(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_cc_status ON cycle_counts(status);

CREATE TABLE IF NOT EXISTS cycle_count_lines (
  id             UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_count_id UUID          NOT NULL REFERENCES cycle_counts(id) ON DELETE CASCADE,
  product_id     UUID          NOT NULL REFERENCES products(id),
  lot_id         UUID          REFERENCES lots(id),
  qty_system     NUMERIC(15,4) NOT NULL,
  qty_counted    NUMERIC(15,4),
  qty_variance   NUMERIC(15,4) GENERATED ALWAYS AS (qty_counted - qty_system) STORED,
  notes          TEXT,
  counted_by     UUID          REFERENCES users(id),
  counted_at     TIMESTAMPTZ,
  line_number    INTEGER       NOT NULL,
  UNIQUE(cycle_count_id, line_number)
);

CREATE INDEX IF NOT EXISTS idx_cc_lines_count ON cycle_count_lines(cycle_count_id);
CREATE INDEX IF NOT EXISTS idx_cc_lines_product ON cycle_count_lines(product_id);

CREATE OR REPLACE FUNCTION apply_cycle_count(p_cycle_count_id UUID, p_approved_by UUID)
RETURNS VOID AS $$
DECLARE
  rec RECORD;
  v_qty_after NUMERIC(15,4);
BEGIN
  FOR rec IN
    SELECT ccl.*, sb.qty_on_hand
    FROM cycle_count_lines ccl
    JOIN stock_balances sb ON sb.warehouse_id = (
      SELECT warehouse_id FROM cycle_counts WHERE id = p_cycle_count_id
    ) AND sb.product_id = ccl.product_id
    WHERE ccl.cycle_count_id = p_cycle_count_id
      AND ccl.qty_variance IS NOT NULL
      AND ccl.qty_variance <> 0
  LOOP
    v_qty_after := rec.qty_on_hand + rec.qty_variance;
    INSERT INTO stock_ledger (
      warehouse_id, product_id, lot_id, entry_type,
      reference_type, reference_id, qty_change, qty_after, created_by
    )
    SELECT
      cc.warehouse_id, rec.product_id, rec.lot_id,
      'cycle_count_adjustment',
      'cycle_count', p_cycle_count_id,
      rec.qty_variance, v_qty_after, p_approved_by
    FROM cycle_counts cc WHERE cc.id = p_cycle_count_id;
  END LOOP;

  UPDATE cycle_counts
  SET status = 'approved', approved_by = p_approved_by, approved_at = NOW()
  WHERE id = p_cycle_count_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_cycle_counts_updated_at
  BEFORE UPDATE ON cycle_counts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

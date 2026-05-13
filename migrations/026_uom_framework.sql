-- migrations/026_uom_framework.sql

-- ── 1. Extend units_of_measure ──────────────────────────────────────────────
ALTER TABLE units_of_measure
  ADD COLUMN IF NOT EXISTS is_base_unit    BOOLEAN      NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_integer_unit BOOLEAN      NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS barcode_label   VARCHAR(100),
  ADD COLUMN IF NOT EXISTS sort_order      INTEGER      NOT NULL DEFAULT 0;

ALTER TABLE units_of_measure
  DROP CONSTRAINT IF EXISTS chk_uom_code_format;
ALTER TABLE units_of_measure
  ADD CONSTRAINT chk_uom_code_format CHECK (code ~ '^[A-Z0-9\u0E00-\u0E7F.]{1,15}$');

-- ── 2. Seed flags for codes that already exist in dev data ──────────────────
UPDATE units_of_measure SET is_base_unit = TRUE,  is_integer_unit = FALSE, sort_order = 10 WHERE code = 'KG';
UPDATE units_of_measure SET is_base_unit = TRUE,  is_integer_unit = FALSE, sort_order = 20 WHERE code = 'L';
UPDATE units_of_measure SET is_base_unit = TRUE,  is_integer_unit = TRUE,  sort_order = 30 WHERE code = 'PCS';
UPDATE units_of_measure SET is_base_unit = FALSE, is_integer_unit = TRUE,  sort_order = 40 WHERE code = 'BOX';
UPDATE units_of_measure SET is_base_unit = FALSE, is_integer_unit = TRUE,  sort_order = 50 WHERE code = 'CTN';
UPDATE units_of_measure SET is_base_unit = FALSE, is_integer_unit = TRUE,  sort_order = 60 WHERE code = 'SET';

-- ── 3. Global conversions table ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS uom_conversions (
  id           UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  uom_id       UUID          NOT NULL REFERENCES units_of_measure(id) ON DELETE RESTRICT,
  base_uom_id  UUID          NOT NULL REFERENCES units_of_measure(id) ON DELETE RESTRICT,
  factor       NUMERIC(15,6) NOT NULL CHECK (factor > 0),
  -- Semantic: 1 [uom] = factor × [base_uom].  e.g. 1 CTN = 48 PCS → factor=48
  notes        TEXT,
  created_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  UNIQUE (uom_id),
  CHECK (uom_id != base_uom_id)
);
CREATE INDEX IF NOT EXISTS idx_uom_conversions_uom ON uom_conversions(uom_id);

CREATE OR REPLACE FUNCTION fn_validate_uom_conversion()
RETURNS TRIGGER AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM units_of_measure WHERE id = NEW.base_uom_id AND is_base_unit = TRUE
  ) THEN
    RAISE EXCEPTION 'base_uom_id % must reference an is_base_unit=TRUE row', NEW.base_uom_id;
  END IF;
  IF EXISTS (
    SELECT 1 FROM units_of_measure WHERE id = NEW.uom_id AND is_base_unit = TRUE
  ) THEN
    RAISE EXCEPTION 'Cannot create a conversion row for base unit %', NEW.uom_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_validate_uom_conversion ON uom_conversions;
CREATE TRIGGER trg_validate_uom_conversion
  BEFORE INSERT OR UPDATE ON uom_conversions
  FOR EACH ROW EXECUTE FUNCTION fn_validate_uom_conversion();

-- ── 4. Repurpose product_uom: drop per-product factor, add barcode ───────────
ALTER TABLE product_uom
  DROP COLUMN IF EXISTS conversion_factor;
ALTER TABLE product_uom
  ADD COLUMN IF NOT EXISTS barcode_label VARCHAR(100) UNIQUE;

-- ── 5. Multi-UoM columns on 7 line tables ───────────────────────────────────
ALTER TABLE pr_line_items
  ADD COLUMN IF NOT EXISTS transaction_uom_id UUID          REFERENCES units_of_measure(id),
  ADD COLUMN IF NOT EXISTS transaction_qty    NUMERIC(15,4),
  ADD COLUMN IF NOT EXISTS base_qty           NUMERIC(15,4);

ALTER TABLE po_line_items
  ADD COLUMN IF NOT EXISTS transaction_uom_id UUID          REFERENCES units_of_measure(id),
  ADD COLUMN IF NOT EXISTS transaction_qty    NUMERIC(15,4),
  ADD COLUMN IF NOT EXISTS base_qty           NUMERIC(15,4);

ALTER TABLE grn_line_items
  ADD COLUMN IF NOT EXISTS transaction_uom_id UUID          REFERENCES units_of_measure(id),
  ADD COLUMN IF NOT EXISTS transaction_qty    NUMERIC(15,4),
  ADD COLUMN IF NOT EXISTS base_qty           NUMERIC(15,4);

ALTER TABLE so_line_items
  ADD COLUMN IF NOT EXISTS transaction_uom_id UUID          REFERENCES units_of_measure(id),
  ADD COLUMN IF NOT EXISTS transaction_qty    NUMERIC(15,4),
  ADD COLUMN IF NOT EXISTS base_qty           NUMERIC(15,4);

ALTER TABLE do_line_items
  ADD COLUMN IF NOT EXISTS transaction_uom_id UUID          REFERENCES units_of_measure(id),
  ADD COLUMN IF NOT EXISTS transaction_qty    NUMERIC(15,4),
  ADD COLUMN IF NOT EXISTS base_qty           NUMERIC(15,4);

ALTER TABLE pos_transaction_lines
  ADD COLUMN IF NOT EXISTS transaction_uom_id UUID          REFERENCES units_of_measure(id),
  ADD COLUMN IF NOT EXISTS transaction_qty    NUMERIC(15,4),
  ADD COLUMN IF NOT EXISTS base_qty           NUMERIC(15,4);

ALTER TABLE warehouse_transfer_lines
  ADD COLUMN IF NOT EXISTS transaction_uom_id UUID          REFERENCES units_of_measure(id),
  ADD COLUMN IF NOT EXISTS transaction_qty    NUMERIC(15,4),
  ADD COLUMN IF NOT EXISTS base_qty           NUMERIC(15,4);

-- ── 6. Cycle count counting-UoM columns ─────────────────────────────────────
-- qty_counted STAYS in base UoM (qty_variance GENERATED depends on it)
ALTER TABLE cycle_count_lines
  ADD COLUMN IF NOT EXISTS counting_uom_id    UUID          REFERENCES units_of_measure(id),
  ADD COLUMN IF NOT EXISTS counting_qty_input NUMERIC(15,4);

-- ── 7. Conversion engine function ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_resolve_base_qty(
  p_qty    NUMERIC,
  p_uom_id UUID
) RETURNS NUMERIC AS $$
DECLARE
  v_factor     NUMERIC(15,6);
  v_is_integer BOOLEAN;
BEGIN
  SELECT COALESCE(uc.factor, 1.0), u.is_integer_unit
  INTO   v_factor, v_is_integer
  FROM   units_of_measure u
  LEFT JOIN uom_conversions uc ON uc.uom_id = u.id
  WHERE  u.id = p_uom_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'UoM % not found', p_uom_id;
  END IF;

  RETURN CASE
    WHEN v_is_integer THEN FLOOR(p_qty * v_factor)
    ELSE ROUND(p_qty * v_factor, 6)
  END;
END;
$$ LANGUAGE plpgsql STABLE;

-- ── 8. Shared trigger for all 7 line tables ──────────────────────────────────
CREATE OR REPLACE FUNCTION fn_fill_line_base_qty()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.transaction_uom_id IS NOT NULL AND NEW.transaction_qty IS NOT NULL THEN
    NEW.base_qty := fn_resolve_base_qty(NEW.transaction_qty, NEW.transaction_uom_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_pr_lines_base_qty  ON pr_line_items;
DROP TRIGGER IF EXISTS trg_po_lines_base_qty  ON po_line_items;
DROP TRIGGER IF EXISTS trg_grn_lines_base_qty ON grn_line_items;
DROP TRIGGER IF EXISTS trg_so_lines_base_qty  ON so_line_items;
DROP TRIGGER IF EXISTS trg_do_lines_base_qty  ON do_line_items;
DROP TRIGGER IF EXISTS trg_pos_lines_base_qty ON pos_transaction_lines;
DROP TRIGGER IF EXISTS trg_trf_lines_base_qty ON warehouse_transfer_lines;

CREATE TRIGGER trg_pr_lines_base_qty  BEFORE INSERT OR UPDATE ON pr_line_items         FOR EACH ROW EXECUTE FUNCTION fn_fill_line_base_qty();
CREATE TRIGGER trg_po_lines_base_qty  BEFORE INSERT OR UPDATE ON po_line_items         FOR EACH ROW EXECUTE FUNCTION fn_fill_line_base_qty();
CREATE TRIGGER trg_grn_lines_base_qty BEFORE INSERT OR UPDATE ON grn_line_items        FOR EACH ROW EXECUTE FUNCTION fn_fill_line_base_qty();
CREATE TRIGGER trg_so_lines_base_qty  BEFORE INSERT OR UPDATE ON so_line_items         FOR EACH ROW EXECUTE FUNCTION fn_fill_line_base_qty();
CREATE TRIGGER trg_do_lines_base_qty  BEFORE INSERT OR UPDATE ON do_line_items         FOR EACH ROW EXECUTE FUNCTION fn_fill_line_base_qty();
CREATE TRIGGER trg_pos_lines_base_qty BEFORE INSERT OR UPDATE ON pos_transaction_lines FOR EACH ROW EXECUTE FUNCTION fn_fill_line_base_qty();
CREATE TRIGGER trg_trf_lines_base_qty BEFORE INSERT OR UPDATE ON warehouse_transfer_lines FOR EACH ROW EXECUTE FUNCTION fn_fill_line_base_qty();

-- ── 9. Cycle count trigger ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_cc_lines_fill_counted()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.counting_uom_id IS NOT NULL AND NEW.counting_qty_input IS NOT NULL THEN
    NEW.qty_counted := fn_resolve_base_qty(NEW.counting_qty_input, NEW.counting_uom_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_cc_lines_fill_counted ON cycle_count_lines;
CREATE TRIGGER trg_cc_lines_fill_counted
  BEFORE INSERT OR UPDATE ON cycle_count_lines
  FOR EACH ROW EXECUTE FUNCTION fn_cc_lines_fill_counted();

-- ─────────────────────────────────────────────
-- Phase 1: Bill of Materials (BOM) & Multi-UOM
-- ─────────────────────────────────────────────

-- 1.1 Add enums
DO $$ BEGIN
  CREATE TYPE product_uom_type AS ENUM ('purchase', 'sales', 'other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE bom_type AS ENUM ('manufacturing', 'kit');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 1.2 Create product_uom table
CREATE TABLE IF NOT EXISTS product_uom (
  id                UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id        UUID          NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  uom_id            UUID          NOT NULL REFERENCES units_of_measure(id),
  conversion_factor NUMERIC(15,6) NOT NULL CHECK (conversion_factor > 0),
  -- 1 [this UOM] = conversion_factor [base UOM]
  -- e.g. base=bottle, this=crate, factor=12 → 1 crate = 12 bottles
  uom_type          product_uom_type NOT NULL DEFAULT 'other',
  is_active         BOOLEAN       NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  UNIQUE (product_id, uom_id)
);
CREATE INDEX IF NOT EXISTS idx_product_uom_product ON product_uom(product_id);

-- 1.3 Create bom_headers table
CREATE SEQUENCE IF NOT EXISTS seq_bom START 1;

CREATE TABLE IF NOT EXISTS bom_headers (
  id          UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  bom_number  VARCHAR(50)   NOT NULL UNIQUE DEFAULT next_doc_number('BOM','seq_bom'),
  product_id  UUID          NOT NULL REFERENCES products(id),
  uom_id      UUID          NOT NULL REFERENCES units_of_measure(id),
  output_qty  NUMERIC(15,4) NOT NULL DEFAULT 1 CHECK (output_qty > 0),
  bom_type    bom_type      NOT NULL DEFAULT 'manufacturing',
  version     INTEGER       NOT NULL DEFAULT 1,
  is_active   BOOLEAN       NOT NULL DEFAULT TRUE,
  notes       TEXT,
  created_by  UUID          REFERENCES users(id),
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  UNIQUE (product_id, version)
);
CREATE INDEX IF NOT EXISTS idx_bom_product ON bom_headers(product_id);
CREATE INDEX IF NOT EXISTS idx_bom_active ON bom_headers(product_id) WHERE is_active = TRUE;

-- 1.4 Create bom_lines table
CREATE TABLE IF NOT EXISTS bom_lines (
  id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  bom_id        UUID          NOT NULL REFERENCES bom_headers(id) ON DELETE CASCADE,
  line_number   INTEGER       NOT NULL,
  component_id  UUID          NOT NULL REFERENCES products(id),
  uom_id        UUID          NOT NULL REFERENCES units_of_measure(id),
  qty_required  NUMERIC(15,6) NOT NULL CHECK (qty_required > 0),
  scrap_pct     NUMERIC(5,2)  NOT NULL DEFAULT 0 CHECK (scrap_pct >= 0 AND scrap_pct < 100),
  notes         TEXT,
  UNIQUE (bom_id, line_number)
);
CREATE INDEX IF NOT EXISTS idx_bom_lines_bom ON bom_lines(bom_id);
CREATE INDEX IF NOT EXISTS idx_bom_lines_component ON bom_lines(component_id);

-- Validation: Component cannot be the same as output product
CREATE OR REPLACE FUNCTION fn_validate_bom_line()
RETURNS TRIGGER AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM bom_headers 
    WHERE id = NEW.bom_id AND product_id = NEW.component_id
  ) THEN
    RAISE EXCEPTION 'Component cannot be the same as the output product';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_validate_bom_line
  BEFORE INSERT OR UPDATE ON bom_lines
  FOR EACH ROW EXECUTE FUNCTION fn_validate_bom_line();

-- 1.5 Add trigger trg_bom_updated_at on bom_headers
CREATE OR REPLACE TRIGGER trg_bom_updated_at
  BEFORE UPDATE ON bom_headers
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

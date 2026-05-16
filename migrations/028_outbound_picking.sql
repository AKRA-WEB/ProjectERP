-- Migration: 028_outbound_picking.sql
-- Description: Add outbound picking and shipment workflow

-- 1. Add pick_dispatch to ledger_entry_type enum
ALTER TYPE ledger_entry_type ADD VALUE IF NOT EXISTS 'pick_dispatch';

-- 2. Create sequences
CREATE SEQUENCE IF NOT EXISTS seq_pick START 1;
CREATE SEQUENCE IF NOT EXISTS seq_ship START 1;

-- 3. Create enums
DO $$ BEGIN
  CREATE TYPE pick_list_status AS ENUM ('draft', 'open', 'picking', 'completed', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE pick_line_status AS ENUM ('pending', 'picked', 'short_picked');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE shipment_status AS ENUM ('pending', 'shipped', 'delivered');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 4. Create pick_lists table
CREATE TABLE IF NOT EXISTS pick_lists (
  id              UUID              PRIMARY KEY DEFAULT gen_random_uuid(),
  pick_number     TEXT              NOT NULL UNIQUE DEFAULT next_doc_number('PL', 'seq_pick'),
  sales_order_id  UUID              REFERENCES sales_orders(id) ON DELETE SET NULL,
  warehouse_id    UUID              NOT NULL REFERENCES warehouses(id),
  status          pick_list_status  NOT NULL DEFAULT 'draft',
  assigned_to     UUID              REFERENCES users(id),
  created_by      UUID              NOT NULL REFERENCES users(id),
  notes           TEXT,
  created_at      TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ       NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE TRIGGER trg_pick_lists_updated_at
  BEFORE UPDATE ON pick_lists
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 5. Create pick_list_lines table
CREATE TABLE IF NOT EXISTS pick_list_lines (
  id               UUID             PRIMARY KEY DEFAULT gen_random_uuid(),
  pick_list_id     UUID             NOT NULL REFERENCES pick_lists(id) ON DELETE CASCADE,
  product_id       UUID             NOT NULL REFERENCES products(id),
  qty_requested    NUMERIC(12,4)    NOT NULL CHECK (qty_requested > 0),
  qty_picked       NUMERIC(12,4)    NOT NULL DEFAULT 0 CHECK (qty_picked >= 0),
  storage_location TEXT,
  status           pick_line_status NOT NULL DEFAULT 'pending',
  created_at       TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ      NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE TRIGGER trg_pick_list_lines_updated_at
  BEFORE UPDATE ON pick_list_lines
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 6. Create shipments table
CREATE TABLE IF NOT EXISTS shipments (
  id               UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_number  TEXT            NOT NULL UNIQUE DEFAULT next_doc_number('SH', 'seq_ship'),
  pick_list_id     UUID            NOT NULL REFERENCES pick_lists(id),
  warehouse_id     UUID            NOT NULL REFERENCES warehouses(id),
  shipped_by       UUID            REFERENCES users(id),
  ship_date        DATE,
  carrier          TEXT,
  tracking_number  TEXT,
  notes            TEXT,
  status           shipment_status NOT NULL DEFAULT 'pending',
  created_at       TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE TRIGGER trg_shipments_updated_at
  BEFORE UPDATE ON shipments
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 7. Create indexes
CREATE INDEX IF NOT EXISTS idx_pick_lists_warehouse   ON pick_lists(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_pick_lists_status      ON pick_lists(status);
CREATE INDEX IF NOT EXISTS idx_pick_lists_assigned    ON pick_lists(assigned_to) WHERE assigned_to IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pick_list_lines_list   ON pick_list_lines(pick_list_id);
CREATE INDEX IF NOT EXISTS idx_pick_list_lines_product ON pick_list_lines(product_id);
CREATE INDEX IF NOT EXISTS idx_shipments_warehouse    ON shipments(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_shipments_pick_list    ON shipments(pick_list_id);

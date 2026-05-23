-- migrations/042_wms_virtual_warehouses.sql

COMMIT;
ALTER TYPE ledger_entry_type ADD VALUE IF NOT EXISTS 'quarantine_in';
ALTER TYPE ledger_entry_type ADD VALUE IF NOT EXISTS 'quarantine_out';
ALTER TYPE ledger_entry_type ADD VALUE IF NOT EXISTS 'scrap';
ALTER TYPE ledger_entry_type ADD VALUE IF NOT EXISTS 'clearance_move';
ALTER TYPE ledger_entry_type ADD VALUE IF NOT EXISTS 'repack_stage_in';
ALTER TYPE ledger_entry_type ADD VALUE IF NOT EXISTS 'repack_stage_out';
BEGIN;

DO $$ BEGIN
  CREATE TYPE warehouse_zone_thermal_type AS ENUM ('ambient', 'sensitive', 'chilled', 'frozen');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE virtual_location_purpose AS ENUM ('buffer', 'damage', 'clearance', 'scrap', 'repack');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS warehouse_zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
  code VARCHAR(20) NOT NULL,
  thermal_type warehouse_zone_thermal_type NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(warehouse_id, code)
);

CREATE TABLE IF NOT EXISTS virtual_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(20) NOT NULL UNIQUE,
  purpose virtual_location_purpose NOT NULL,
  is_sellable BOOLEAN NOT NULL DEFAULT TRUE,
  visible_channels TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed zones (S1 on W3, C1 on W4, C2 on W5)
INSERT INTO warehouse_zones (warehouse_id, code, thermal_type)
SELECT id, 'S1', 'sensitive' FROM warehouses WHERE code IN ('WH-03', 'W3')
ON CONFLICT (warehouse_id, code) DO NOTHING;

INSERT INTO warehouse_zones (warehouse_id, code, thermal_type)
SELECT id, 'C1', 'chilled' FROM warehouses WHERE code IN ('WH-04', 'W4')
ON CONFLICT (warehouse_id, code) DO NOTHING;

INSERT INTO warehouse_zones (warehouse_id, code, thermal_type)
SELECT id, 'C2', 'frozen' FROM warehouses WHERE code IN ('WH-05', 'W5')
ON CONFLICT (warehouse_id, code) DO NOTHING;

-- Seed virtual locations
INSERT INTO virtual_locations (code, purpose, is_sellable, visible_channels) VALUES
  ('V-BUF', 'buffer', TRUE, ARRAY[]::TEXT[]),
  ('V-DMG', 'damage', FALSE, ARRAY[]::TEXT[]),
  ('V-CLR', 'clearance', TRUE, ARRAY['TRD']::TEXT[]),
  ('V-KILL', 'scrap', FALSE, ARRAY[]::TEXT[]),
  ('V-PACK', 'repack', FALSE, ARRAY[]::TEXT[])
ON CONFLICT (code) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_warehouse_zones_warehouse ON warehouse_zones(warehouse_id);

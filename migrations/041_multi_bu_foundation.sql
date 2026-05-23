-- migrations/041_multi_bu_foundation.sql

COMMIT;
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'auditor';
BEGIN;

CREATE TABLE IF NOT EXISTS business_units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(20) NOT NULL UNIQUE,
  name_th VARCHAR(255) NOT NULL,
  name_en VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO business_units (code, name_th, name_en) VALUES
  ('TRD', 'TRD Bakermart', 'TRD Bakermart'),
  ('AKRA', 'Akra Wholesale', 'Akra Wholesale')
ON CONFLICT (code) DO NOTHING;

ALTER TABLE warehouses ADD COLUMN IF NOT EXISTS business_unit_id UUID REFERENCES business_units(id);

-- Backfill: WH-01 is TRD, others (WH-02..WH-07) are AKRA
UPDATE warehouses
SET business_unit_id = (SELECT id FROM business_units WHERE code = 'TRD')
WHERE (code = 'WH-01' OR code = 'W1') AND business_unit_id IS NULL;

UPDATE warehouses
SET business_unit_id = (SELECT id FROM business_units WHERE code = 'AKRA')
WHERE (code IN ('WH-02', 'WH-03', 'WH-04', 'WH-05', 'WH-06', 'WH-07', 'W2', 'W3', 'W4', 'W5')) AND business_unit_id IS NULL;

ALTER TABLE users ADD COLUMN IF NOT EXISTS business_unit_id UUID REFERENCES business_units(id);

CREATE INDEX IF NOT EXISTS idx_warehouses_bu ON warehouses(business_unit_id);
CREATE INDEX IF NOT EXISTS idx_users_bu ON users(business_unit_id) WHERE business_unit_id IS NOT NULL;

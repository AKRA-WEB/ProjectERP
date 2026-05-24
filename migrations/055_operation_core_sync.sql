-- migrations/055_operation_core_sync.sql

BEGIN;

-- 1. Register new virtual warehouses in physical warehouses table
INSERT INTO warehouses (code, name_th, name_en, business_unit_id, is_active) VALUES
  ('V-BUF-AKRA', 'คลังพักสินค้า AKRA (Virtual Buffer)', 'AKRA Buffer (Virtual)', (SELECT id FROM business_units WHERE code = 'AKRA'), true),
  ('W1-DSP-STG', 'คลังพักเตรียมจัดส่ง TRD W1 (Virtual Staging)', 'W1 Dispatch Staging (Virtual)', (SELECT id FROM business_units WHERE code = 'TRD'), true)
ON CONFLICT (code) DO NOTHING;

-- 2. Register virtual locations metadata
INSERT INTO virtual_locations (code, purpose, is_sellable, visible_channels) VALUES
  ('V-BUF-AKRA', 'buffer', false, ARRAY[]::TEXT[]),
  ('W1-DSP-STG', 'buffer', false, ARRAY['TRD']::TEXT[])
ON CONFLICT (code) DO NOTHING;

-- 3. Introduce Transfer Qty Modes Enum
DO $$ BEGIN
  CREATE TYPE transfer_qty_mode AS ENUM ('SHORTAGE_ONLY', 'FULL_ORDER_LINE', 'MANUAL_QTY');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 4. Introduce Dispatch Exception Event Logs
CREATE TABLE IF NOT EXISTS dispatch_exception_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dispatch_id UUID NOT NULL,
  event_name VARCHAR(50) NOT NULL,
  sku VARCHAR(100) NOT NULL,
  original_qty NUMERIC(15,4) NOT NULL,
  picked_qty NUMERIC(15,4) NOT NULL,
  resolved_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMIT;

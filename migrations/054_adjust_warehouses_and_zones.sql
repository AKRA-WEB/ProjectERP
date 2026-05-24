-- migrations/054_adjust_warehouses_and_zones.sql

-- 1. Enum adjustments (if any are needed, otherwise transaction block begins)
BEGIN;

-- 2. Delete Standalone Cold Warehouses
-- These are now represented as thermal zones inside W4 and W5
DELETE FROM warehouses WHERE code IN ('WH-06', 'WH-07', 'C1', 'C2');

-- 3. Rename and Re-code Physical Warehouses (W1 to W5)
UPDATE warehouses SET code = 'W1', name_th = 'คลังสินค้า W1 หน้าร้าน TRD', name_en = 'W1 TRD Front Store' WHERE code = 'WH-01';
UPDATE warehouses SET code = 'W2', name_th = 'คลังสินค้า W2 ตึกส้ม Akra', name_en = 'W2 Akra Main Wholesale Hub' WHERE code = 'WH-02';
UPDATE warehouses SET code = 'W3', name_th = 'คลังสินค้า W3 ตึกเหลือง Akra', name_en = 'W3 Yellow Building Warehouse' WHERE code = 'WH-03';
UPDATE warehouses SET code = 'W4', name_th = 'คลังสินค้า W4 ตึกเขียว Akra', name_en = 'W4 Green Building Warehouse' WHERE code = 'WH-04';
UPDATE warehouses SET code = 'W5', name_th = 'คลังสินค้า W5 ตึกเทา Akra', name_en = 'W5 Grey Building / Off-Market Hub' WHERE code = 'WH-05';

-- 4. Register Virtual Warehouses in physical warehouses table
-- This enables full ledger transactions and foreign key validity
INSERT INTO warehouses (code, name_th, name_en, business_unit_id, is_active) VALUES
  ('V-BUF-TRD', 'คลังพักหน้าร้าน TRD (Virtual Buffer)', 'TRD Front Store Buffer (Virtual)', (SELECT id FROM business_units WHERE code = 'TRD'), true),
  ('V-DMG', 'คลังสินค้าเสียหาย (Virtual Damage)', 'Virtual Damage Warehouse', null, true),
  ('V-CLR', 'คลังสินค้า Clearance (Virtual Clearance)', 'Virtual Clearance Warehouse', null, true),
  ('V-KILL', 'คลังตัดขยะ/ทำลาย (Virtual Scrap)', 'Virtual Scrap Warehouse', null, true),
  ('V-PACK', 'คลังแพ็คสินค้า TRD (Virtual Repacking)', 'Virtual Repacking Warehouse', (SELECT id FROM business_units WHERE code = 'TRD'), true)
ON CONFLICT (code) DO NOTHING;

-- 5. Synchronize virtual_locations metadata
-- Update V-BUF to V-BUF-TRD and make it non-sellable
UPDATE virtual_locations 
SET code = 'V-BUF-TRD', purpose = 'buffer', is_sellable = false, visible_channels = ARRAY['TRD']::TEXT[] 
WHERE code = 'V-BUF';

-- 6. Configure Sub-Zero Freezer Zone (W4-FRZ-STG) under W4
INSERT INTO warehouse_zones (warehouse_id, code, thermal_type)
VALUES (
  (SELECT id FROM warehouses WHERE code = 'W4'), 
  'W4-FRZ-STG', 
  'frozen'
)
ON CONFLICT (warehouse_id, code) DO NOTHING;

COMMIT;

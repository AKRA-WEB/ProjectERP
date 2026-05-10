-- 1a. Employee identity fields on users
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS employee_id  VARCHAR(50) UNIQUE,
  ADD COLUMN IF NOT EXISTS position     VARCHAR(100),
  ADD COLUMN IF NOT EXISTS department   VARCHAR(100),
  ADD COLUMN IF NOT EXISTS phone        VARCHAR(50),
  ADD COLUMN IF NOT EXISTS hired_date   DATE;

CREATE INDEX IF NOT EXISTS idx_users_employee_id ON users(employee_id) WHERE employee_id IS NOT NULL;

-- 1b. Permission catalog (seeded below, admin cannot add/remove)
CREATE TABLE IF NOT EXISTS permissions (
  id         VARCHAR(100) PRIMARY KEY,
  name_th    VARCHAR(255) NOT NULL,
  name_en    VARCHAR(255) NOT NULL,
  module     VARCHAR(50)  NOT NULL,
  sort_order INTEGER      NOT NULL DEFAULT 0
);

-- 1c. Custom roles (admin-managed)
CREATE TABLE IF NOT EXISTS employee_roles (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code        VARCHAR(50)  NOT NULL UNIQUE,
  name_th     VARCHAR(255) NOT NULL,
  name_en     VARCHAR(255) NOT NULL,
  description TEXT,
  is_system   BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE TRIGGER trg_employee_roles_updated_at
  BEFORE UPDATE ON employee_roles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 1d. Role → Permission junction
CREATE TABLE IF NOT EXISTS employee_role_permissions (
  role_id       UUID        NOT NULL REFERENCES employee_roles(id) ON DELETE CASCADE,
  permission_id VARCHAR(100) NOT NULL REFERENCES permissions(id)   ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

-- 1e. User → Role junction
CREATE TABLE IF NOT EXISTS user_role_assignments (
  user_id     UUID NOT NULL REFERENCES users(id)           ON DELETE CASCADE,
  role_id     UUID NOT NULL REFERENCES employee_roles(id)  ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  assigned_by UUID REFERENCES users(id),
  PRIMARY KEY (user_id, role_id)
);

CREATE INDEX IF NOT EXISTS idx_user_role_user ON user_role_assignments(user_id);

-- ─────────────────────────────────────────────
-- SEED: Permission catalog
-- ─────────────────────────────────────────────
INSERT INTO permissions (id, name_th, name_en, module, sort_order) VALUES
  ('dashboard:view',         'ดูภาพรวม',             'View Dashboard',           'dashboard',        10),
  ('products:view',          'ดูสินค้า',              'View Products',            'products',         20),
  ('products:create',        'เพิ่มสินค้า',           'Create Products',          'products',         21),
  ('products:edit',          'แก้ไขสินค้า',           'Edit Products',            'products',         22),
  ('vendors:view',           'ดูผู้จำหน่าย',          'View Vendors',             'vendors',          30),
  ('vendors:create',         'เพิ่มผู้จำหน่าย',       'Create Vendors',           'vendors',          31),
  ('vendors:edit',           'แก้ไขผู้จำหน่าย',       'Edit Vendors',             'vendors',          32),
  ('pr:view',                'ดูคำขอซื้อ',            'View Purchase Requests',   'purchase_requests',40),
  ('pr:create',              'สร้างคำขอซื้อ',         'Create Purchase Requests', 'purchase_requests',41),
  ('pr:submit',              'ส่งคำขอซื้อ',           'Submit Purchase Requests', 'purchase_requests',42),
  ('pr:approve',             'อนุมัติคำขอซื้อ',       'Approve Purchase Requests','purchase_requests',43),
  ('pr:reject',              'ปฏิเสธคำขอซื้อ',        'Reject Purchase Requests', 'purchase_requests',44),
  ('po:view',                'ดูใบสั่งซื้อ',          'View Purchase Orders',     'purchase_orders',  50),
  ('po:create',              'สร้างใบสั่งซื้อ',       'Create Purchase Orders',   'purchase_orders',  51),
  ('po:edit',                'แก้ไขใบสั่งซื้อ',       'Edit Purchase Orders',     'purchase_orders',  52),
  ('po:send',                'ส่งใบสั่งซื้อ',         'Send Purchase Orders',     'purchase_orders',  53),
  ('po:cancel',              'ยกเลิกใบสั่งซื้อ',      'Cancel Purchase Orders',   'purchase_orders',  54),
  ('inbound_orders:view',    'ดู Inbound Orders',     'View Inbound Orders',      'inbound_orders',   60),
  ('inbound_orders:create',  'สร้าง Inbound Order',   'Create Inbound Orders',    'inbound_orders',   61),
  ('inbound_orders:close',   'ปิด Inbound Order',     'Close Inbound Orders',     'inbound_orders',   62),
  ('grn:view',               'ดูใบรับสินค้า',         'View GRN',                 'grn',              70),
  ('grn:create',             'สร้างใบรับสินค้า',      'Create GRN',               'grn',              71),
  ('grn:verify',             'ตรวจสอบการรับสินค้า',   'Verify GRN',               'grn',              72),
  ('grn:stock',              'นำเข้าคลัง',             'Stock GRN',                'grn',              73),
  ('inventory:view',         'ดูสินค้าคงคลัง',        'View Inventory',           'inventory',        80),
  ('inventory:adjust',       'ปรับสต็อก',              'Adjust Inventory',         'inventory',        81),
  ('transfers:view',         'ดูการโอนย้าย',          'View Transfers',           'transfers',        90),
  ('transfers:create',       'สร้างการโอนย้าย',        'Create Transfers',         'transfers',        91),
  ('rma:view',               'ดู RMA',                'View RMA',                 'rma',             100),
  ('rma:create',             'สร้าง RMA',             'Create RMA',               'rma',             101),
  ('rma:resolve',            'แก้ไข RMA',             'Resolve RMA',              'rma',             102),
  ('claims:view',            'ดูการเรียกร้อง',        'View Claims',              'claims',          110),
  ('claims:create',          'สร้างการเรียกร้อง',     'Create Claims',            'claims',          111),
  ('claims:resolve',         'แก้ไขการเรียกร้อง',     'Resolve Claims',           'claims',          112),
  ('cycle_counts:view',      'ดีการนับสต็อก',         'View Cycle Counts',        'cycle_counts',    120),
  ('cycle_counts:create',    'สร้างการนับสต็อก',       'Create Cycle Counts',      'cycle_counts',    121),
  ('cycle_counts:approve',   'อนุมัติการนับสต็อก',    'Approve Cycle Counts',     'cycle_counts',    122),
  ('employees:view',         'ดูพนักงาน',              'View Employees',           'admin',           130),
  ('employees:create',       'เพิ่มพนักงาน',           'Create Employees',         'admin',           131),
  ('employees:edit',         'แก้ไขพนักงาน',           'Edit Employees',           'admin',           132),
  ('roles:view',             'ดูบทบาท',                'View Roles',               'admin',           140),
  ('roles:create',           'สร้างบทบาท',             'Create Roles',             'admin',           141),
  ('roles:edit',             'แก้ไขบทบาท',             'Edit Roles',               'admin',           142),
  ('roles:delete',           'ลบบทบาท',                'Delete Roles',             'admin',           143),
  ('warehouses:view',        'ดูคลังสินค้า',           'View Warehouses',          'admin',           150)
ON CONFLICT (id) DO NOTHING;

-- ─────────────────────────────────────────────
-- SEED: Three system roles mirroring the enum
-- ─────────────────────────────────────────────
INSERT INTO employee_roles (id, code, name_th, name_en, description, is_system) VALUES
  ('00000000-0000-0000-0000-000000000001', 'system_admin',    'ผู้ดูแลระบบ',  'System Administrator', 'All permissions',      TRUE),
  ('00000000-0000-0000-0000-000000000002', 'system_manager',  'ผู้จัดการ',    'System Manager',       'Operational approvals', TRUE),
  ('00000000-0000-0000-0000-000000000003', 'system_staff',    'พนักงานทั่วไป','General Staff',        'View + basic operations', TRUE)
ON CONFLICT (id) DO NOTHING;

-- system_admin: all permissions
INSERT INTO employee_role_permissions (role_id, permission_id)
  SELECT '00000000-0000-0000-0000-000000000001', id FROM permissions
ON CONFLICT DO NOTHING;

-- system_manager: operational permissions (no admin module except view)
INSERT INTO employee_role_permissions (role_id, permission_id)
  SELECT '00000000-0000-0000-0000-000000000002', id FROM permissions
  WHERE id NOT IN ('roles:create','roles:edit','roles:delete','employees:create','employees:edit')
ON CONFLICT DO NOTHING;

-- system_staff: view + basic create operations
INSERT INTO employee_role_permissions (role_id, permission_id)
  SELECT '00000000-0000-0000-0000-000000000003', id FROM permissions
  WHERE id IN (
    'dashboard:view',
    'products:view', 'vendors:view',
    'pr:view', 'pr:create', 'pr:submit',
    'po:view',
    'inbound_orders:view', 'inbound_orders:create',
    'grn:view', 'grn:create',
    'inventory:view',
    'transfers:view', 'transfers:create',
    'rma:view', 'rma:create',
    'claims:view', 'claims:create',
    'cycle_counts:view', 'cycle_counts:create'
  )
ON CONFLICT DO NOTHING;

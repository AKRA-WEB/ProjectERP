-- 1. Enums
DO $$ BEGIN
  CREATE TYPE sq_status AS ENUM ('draft','sent','accepted','converted_to_so','rejected','expired');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE so_status AS ENUM ('draft','confirmed','partially_delivered','fully_delivered','invoiced','paid','closed','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE do_status AS ENUM ('draft','ready','shipped','delivered','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE si_status AS ENUM ('draft','issued','paid','void');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE sr_status AS ENUM ('open','received','restocked','disposed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. Alter ledger_entry_type
DO $$ BEGIN
  ALTER TYPE ledger_entry_type ADD VALUE 'so_delivery';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TYPE ledger_entry_type ADD VALUE 'so_return';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3. Sequences
CREATE SEQUENCE IF NOT EXISTS seq_sq START 1;
CREATE SEQUENCE IF NOT EXISTS seq_so START 1;
CREATE SEQUENCE IF NOT EXISTS seq_do START 1;
CREATE SEQUENCE IF NOT EXISTS seq_si START 1;
CREATE SEQUENCE IF NOT EXISTS seq_sr START 1;

-- 4. Tables

-- customers
CREATE TABLE IF NOT EXISTS customers (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code                 VARCHAR(50)  NOT NULL UNIQUE,
  name_th              VARCHAR(500) NOT NULL,
  name_en              VARCHAR(500),
  contact_name         VARCHAR(255),
  email                VARCHAR(255),
  phone                VARCHAR(50),
  address_th           TEXT,
  address_en           TEXT,
  tax_id               VARCHAR(50),
  payment_terms_days   INTEGER NOT NULL DEFAULT 30,
  credit_limit         NUMERIC(15,2) NOT NULL DEFAULT 0,
  is_active            BOOLEAN NOT NULL DEFAULT TRUE,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- sales_quotations
CREATE TABLE IF NOT EXISTS sales_quotations (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sq_number        VARCHAR(50) NOT NULL UNIQUE DEFAULT next_doc_number('SQ','seq_sq'),
  customer_id      UUID NOT NULL REFERENCES customers(id),
  warehouse_id     UUID NOT NULL REFERENCES warehouses(id),
  status           sq_status NOT NULL DEFAULT 'draft',
  valid_until      DATE,
  subtotal         NUMERIC(15,2) NOT NULL DEFAULT 0,
  vat_amount       NUMERIC(15,2) NOT NULL DEFAULT 0,
  total_amount     NUMERIC(15,2) NOT NULL DEFAULT 0,
  notes            TEXT,
  sent_at          TIMESTAMPTZ,
  accepted_at      TIMESTAMPTZ,
  rejected_at      TIMESTAMPTZ,
  expired_at       TIMESTAMPTZ,
  created_by       UUID NOT NULL REFERENCES users(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- sq_line_items
CREATE TABLE IF NOT EXISTS sq_line_items (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sq_id        UUID NOT NULL REFERENCES sales_quotations(id) ON DELETE CASCADE,
  product_id   UUID NOT NULL REFERENCES products(id),
  qty          NUMERIC(15,4) NOT NULL CHECK (qty > 0),
  unit_price   NUMERIC(15,2) NOT NULL,
  discount_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  line_total   NUMERIC(15,2) GENERATED ALWAYS AS (qty * unit_price - discount_amount) STORED,
  line_number  INTEGER NOT NULL,
  UNIQUE(sq_id, line_number)
);

-- sales_orders
CREATE TABLE IF NOT EXISTS sales_orders (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  so_number           VARCHAR(50) NOT NULL UNIQUE DEFAULT next_doc_number('SO','seq_so'),
  customer_id         UUID NOT NULL REFERENCES customers(id),
  warehouse_id        UUID NOT NULL REFERENCES warehouses(id),
  status              so_status NOT NULL DEFAULT 'draft',
  expected_delivery   DATE,
  payment_terms_days  INTEGER NOT NULL DEFAULT 30,
  subtotal            NUMERIC(15,2) NOT NULL DEFAULT 0,
  vat_amount          NUMERIC(15,2) NOT NULL DEFAULT 0,
  total_amount        NUMERIC(15,2) NOT NULL DEFAULT 0,
  notes               TEXT,
  confirmed_by        UUID REFERENCES users(id),
  confirmed_at        TIMESTAMPTZ,
  cancelled_by        UUID REFERENCES users(id),
  cancelled_at        TIMESTAMPTZ,
  cancellation_reason TEXT,
  created_by          UUID NOT NULL REFERENCES users(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- so_line_items
CREATE TABLE IF NOT EXISTS so_line_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  so_id           UUID NOT NULL REFERENCES sales_orders(id) ON DELETE CASCADE,
  product_id      UUID NOT NULL REFERENCES products(id),
  sq_line_item_id UUID REFERENCES sq_line_items(id),
  qty_ordered     NUMERIC(15,4) NOT NULL CHECK (qty_ordered > 0),
  qty_delivered   NUMERIC(15,4) NOT NULL DEFAULT 0,
  unit_price      NUMERIC(15,2) NOT NULL,
  discount_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  line_total      NUMERIC(15,2) GENERATED ALWAYS AS (qty_ordered * unit_price - discount_amount) STORED,
  line_number     INTEGER NOT NULL,
  UNIQUE(so_id, line_number)
);

-- so_sq_links
CREATE TABLE IF NOT EXISTS so_sq_links (
  so_id UUID NOT NULL REFERENCES sales_orders(id),
  sq_id UUID NOT NULL REFERENCES sales_quotations(id),
  PRIMARY KEY (so_id, sq_id)
);

-- delivery_orders
CREATE TABLE IF NOT EXISTS delivery_orders (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  do_number       VARCHAR(50) NOT NULL UNIQUE DEFAULT next_doc_number('DO','seq_do'),
  so_id           UUID NOT NULL REFERENCES sales_orders(id),
  warehouse_id    UUID NOT NULL REFERENCES warehouses(id),
  status          do_status NOT NULL DEFAULT 'draft',
  shipping_address TEXT,
  shipped_at      TIMESTAMPTZ,
  delivered_at    TIMESTAMPTZ,
  cancelled_at    TIMESTAMPTZ,
  notes           TEXT,
  created_by      UUID NOT NULL REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- do_line_items
CREATE TABLE IF NOT EXISTS do_line_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  do_id           UUID NOT NULL REFERENCES delivery_orders(id) ON DELETE CASCADE,
  so_line_item_id UUID NOT NULL REFERENCES so_line_items(id),
  product_id      UUID NOT NULL REFERENCES products(id),
  qty_to_deliver  NUMERIC(15,4) NOT NULL CHECK (qty_to_deliver > 0),
  unit_price      NUMERIC(15,2) NOT NULL,
  line_total      NUMERIC(15,2) GENERATED ALWAYS AS (qty_to_deliver * unit_price) STORED,
  line_number     INTEGER NOT NULL,
  UNIQUE(do_id, line_number)
);

-- sales_invoices
CREATE TABLE IF NOT EXISTS sales_invoices (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  si_number         VARCHAR(50) NOT NULL UNIQUE DEFAULT next_doc_number('SI','seq_si'),
  so_id             UUID NOT NULL REFERENCES sales_orders(id),
  delivery_order_id UUID REFERENCES delivery_orders(id),
  customer_id       UUID NOT NULL REFERENCES customers(id),
  status            si_status NOT NULL DEFAULT 'draft',
  invoice_date      DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date          DATE NOT NULL,
  subtotal          NUMERIC(15,2) NOT NULL,
  vat_amount        NUMERIC(15,2) NOT NULL,
  total_amount      NUMERIC(15,2) NOT NULL,
  paid_at           TIMESTAMPTZ,
  paid_by           UUID REFERENCES users(id),
  voided_at         TIMESTAMPTZ,
  voided_by         UUID REFERENCES users(id),
  void_reason       TEXT,
  notes             TEXT,
  created_by        UUID NOT NULL REFERENCES users(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- sales_returns
CREATE TABLE IF NOT EXISTS sales_returns (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sr_number       VARCHAR(50) NOT NULL UNIQUE DEFAULT next_doc_number('SR','seq_sr'),
  so_id           UUID REFERENCES sales_orders(id),
  customer_id     UUID NOT NULL REFERENCES customers(id),
  warehouse_id    UUID NOT NULL REFERENCES warehouses(id),
  status          sr_status NOT NULL DEFAULT 'open',
  reason          TEXT,
  received_at     TIMESTAMPTZ,
  restocked_at    TIMESTAMPTZ,
  disposed_at     TIMESTAMPTZ,
  notes           TEXT,
  created_by      UUID NOT NULL REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- sr_line_items
CREATE TABLE IF NOT EXISTS sr_line_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sr_id           UUID NOT NULL REFERENCES sales_returns(id) ON DELETE CASCADE,
  product_id      UUID NOT NULL REFERENCES products(id),
  qty_returned    NUMERIC(15,4) NOT NULL CHECK (qty_returned > 0),
  unit_price      NUMERIC(15,2) NOT NULL DEFAULT 0,
  line_number     INTEGER NOT NULL,
  UNIQUE(sr_id, line_number)
);

-- 5. Indexes
CREATE INDEX IF NOT EXISTS idx_customers_code ON customers(code);
CREATE INDEX IF NOT EXISTS idx_customers_active ON customers(is_active) WHERE is_active=TRUE;
CREATE INDEX IF NOT EXISTS idx_sq_customer ON sales_quotations(customer_id);
CREATE INDEX IF NOT EXISTS idx_sq_warehouse ON sales_quotations(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_sq_status ON sales_quotations(status);
CREATE INDEX IF NOT EXISTS idx_so_customer ON sales_orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_so_warehouse ON sales_orders(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_so_status ON sales_orders(status);
CREATE INDEX IF NOT EXISTS idx_do_so ON delivery_orders(so_id);
CREATE INDEX IF NOT EXISTS idx_do_warehouse ON delivery_orders(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_do_status ON delivery_orders(status);
CREATE INDEX IF NOT EXISTS idx_si_so ON sales_invoices(so_id);
CREATE INDEX IF NOT EXISTS idx_si_customer ON sales_invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_si_status ON sales_invoices(status);
CREATE INDEX IF NOT EXISTS idx_sr_customer ON sales_returns(customer_id);
CREATE INDEX IF NOT EXISTS idx_sr_warehouse ON sales_returns(warehouse_id);

-- 6. Triggers
CREATE OR REPLACE TRIGGER trg_customers_updated_at BEFORE UPDATE ON customers FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE OR REPLACE TRIGGER trg_sales_quotations_updated_at BEFORE UPDATE ON sales_quotations FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE OR REPLACE TRIGGER trg_sales_orders_updated_at BEFORE UPDATE ON sales_orders FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE OR REPLACE TRIGGER trg_delivery_orders_updated_at BEFORE UPDATE ON delivery_orders FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE OR REPLACE TRIGGER trg_sales_invoices_updated_at BEFORE UPDATE ON sales_invoices FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE OR REPLACE TRIGGER trg_sales_returns_updated_at BEFORE UPDATE ON sales_returns FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 7. Permissions
INSERT INTO permissions (id, name_th, name_en, module, sort_order) VALUES
  ('customers:view',   'ดูลูกค้า',          'View Customers',        'sales', 170),
  ('customers:create', 'เพิ่มลูกค้า',        'Create Customers',      'sales', 171),
  ('customers:edit',   'แก้ไขลูกค้า',        'Edit Customers',        'sales', 172),
  ('sq:view',          'ดูใบเสนอราคา',       'View Quotations',       'sales', 180),
  ('sq:create',        'สร้างใบเสนอราคา',    'Create Quotations',     'sales', 181),
  ('sq:send',          'ส่งใบเสนอราคา',      'Send Quotations',       'sales', 182),
  ('sq:accept',        'ยืนยันใบเสนอราคา',   'Accept Quotations',     'sales', 183),
  ('sq:reject',        'ปฏิเสธใบเสนอราคา',   'Reject Quotations',     'sales', 184),
  ('so:view',          'ดูใบสั่งขาย',        'View Sales Orders',     'sales', 190),
  ('so:create',        'สร้างใบสั่งขาย',     'Create Sales Orders',   'sales', 191),
  ('so:confirm',       'ยืนยันใบสั่งขาย',    'Confirm Sales Orders',  'sales', 192),
  ('so:cancel',        'ยกเลิกใบสั่งขาย',    'Cancel Sales Orders',   'sales', 193),
  ('do:view',          'ดูใบส่งสินค้า',      'View Delivery Orders',  'sales', 200),
  ('do:create',        'สร้างใบส่งสินค้า',   'Create Delivery Orders','sales', 201),
  ('do:ship',          'ส่งสินค้า',          'Ship Delivery',         'sales', 202),
  ('do:deliver',       'ยืนยันการส่ง',       'Confirm Delivery',      'sales', 203),
  ('si:view',          'ดูใบแจ้งหนี้',       'View Sales Invoices',   'sales', 210),
  ('si:create',        'สร้างใบแจ้งหนี้',    'Create Sales Invoices', 'sales', 211),
  ('si:mark_paid',     'บันทึกชำระ',          'Mark Invoice Paid',     'sales', 212),
  ('sr:view',          'ดูการรับคืน',        'View Sales Returns',    'sales', 220),
  ('sr:create',        'สร้างการรับคืน',     'Create Sales Returns',  'sales', 221),
  ('sr:restock',       'คืนสต็อก',           'Restock Return',        'sales', 222)
ON CONFLICT (id) DO NOTHING;

-- 8. Grant to system roles
-- system_admin: all sales permissions
INSERT INTO employee_role_permissions (role_id, permission_id)
  SELECT '00000000-0000-0000-0000-000000000001', id FROM permissions WHERE module = 'sales'
ON CONFLICT DO NOTHING;

-- system_manager: all sales permissions
INSERT INTO employee_role_permissions (role_id, permission_id)
  SELECT '00000000-0000-0000-0000-000000000002', id FROM permissions WHERE module = 'sales'
ON CONFLICT DO NOTHING;

-- system_staff: view permissions + create for basic flows
INSERT INTO employee_role_permissions (role_id, permission_id)
  SELECT '00000000-0000-0000-0000-000000000003', id FROM permissions 
  WHERE id IN (
    'customers:view', 'sq:view', 'so:view', 'do:view', 'si:view', 'sr:view',
    'customers:create', 'sq:create', 'so:create', 'do:create', 'sr:create'
  )
ON CONFLICT DO NOTHING;

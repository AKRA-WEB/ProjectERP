-- 1. Schema Updates
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS selling_price NUMERIC(15,2) NOT NULL DEFAULT 0;

DO $$ BEGIN
  CREATE TYPE pos_session_status AS ENUM ('open', 'closed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE pos_transaction_status AS ENUM ('completed', 'voided');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE pos_payment_method AS ENUM ('cash', 'card', 'mixed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Add new values to ledger_entry_type
-- Note: ALTER TYPE ADD VALUE cannot run in a transaction block in older Postgres, 
-- but we try it here. If it fails, we may need to run it manually or use a workaround.
DO $$ BEGIN
  ALTER TYPE ledger_entry_type ADD VALUE 'pos_sale';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TYPE ledger_entry_type ADD VALUE 'pos_void';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. Sequence & Tables
CREATE SEQUENCE IF NOT EXISTS seq_pos;

CREATE TABLE IF NOT EXISTS pos_sessions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_number   VARCHAR(50) NOT NULL UNIQUE DEFAULT next_doc_number('SES', 'seq_pos'),
  warehouse_id     UUID NOT NULL REFERENCES warehouses(id),
  opened_by        UUID NOT NULL REFERENCES users(id),
  closed_by        UUID REFERENCES users(id),
  status           pos_session_status NOT NULL DEFAULT 'open',
  opening_float    NUMERIC(15,2) NOT NULL DEFAULT 0,
  closing_float    NUMERIC(15,2),
  opened_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at        TIMESTAMPTZ,
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pos_transactions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_number   VARCHAR(50) NOT NULL UNIQUE DEFAULT next_doc_number('RCP', 'seq_pos'),
  session_id       UUID NOT NULL REFERENCES pos_sessions(id),
  warehouse_id     UUID NOT NULL REFERENCES warehouses(id),
  subtotal         NUMERIC(15,2) NOT NULL,
  discount_amount  NUMERIC(15,2) NOT NULL DEFAULT 0,
  vat_amount       NUMERIC(15,2) NOT NULL,
  total            NUMERIC(15,2) NOT NULL,
  payment_method   pos_payment_method NOT NULL,
  cash_tendered    NUMERIC(15,2),
  card_amount      NUMERIC(15,2),
  change_given     NUMERIC(15,2) NOT NULL DEFAULT 0,
  status           pos_transaction_status NOT NULL DEFAULT 'completed',
  voided_by        UUID REFERENCES users(id),
  voided_at        TIMESTAMPTZ,
  void_reason      TEXT,
  created_by       UUID NOT NULL REFERENCES users(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pos_transaction_lines (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id   UUID NOT NULL REFERENCES pos_transactions(id) ON DELETE CASCADE,
  product_id       UUID NOT NULL REFERENCES products(id),
  qty              NUMERIC(15,4) NOT NULL,
  unit_price       NUMERIC(15,2) NOT NULL,
  discount_amount  NUMERIC(15,2) NOT NULL DEFAULT 0,
  line_total       NUMERIC(15,2) NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Indexes
CREATE INDEX IF NOT EXISTS idx_pos_sessions_warehouse ON pos_sessions(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_pos_sessions_opened_by ON pos_sessions(opened_by);
CREATE INDEX IF NOT EXISTS idx_pos_sessions_status ON pos_sessions(status) WHERE status = 'open';
CREATE INDEX IF NOT EXISTS idx_pos_transactions_session ON pos_transactions(session_id);
CREATE INDEX IF NOT EXISTS idx_pos_transactions_receipt ON pos_transactions(receipt_number);
CREATE INDEX IF NOT EXISTS idx_pos_txn_lines_transaction ON pos_transaction_lines(transaction_id);

-- 4. Triggers
CREATE OR REPLACE TRIGGER trg_pos_sessions_updated_at
  BEFORE UPDATE ON pos_sessions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE TRIGGER trg_pos_transactions_updated_at
  BEFORE UPDATE ON pos_transactions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 5. Permissions
INSERT INTO permissions (id, name_th, name_en, module, sort_order) VALUES
  ('pos:view',          'ดู POS',           'View POS',             'pos', 160),
  ('pos:cashier',       'ดำเนินการ POS',    'Operate POS Terminal', 'pos', 161),
  ('pos:void',          'ยกเลิกรายการ POS', 'Void POS Transaction', 'pos', 162),
  ('pos:session_open',  'เปิดรอบ POS',      'Open POS Session',     'pos', 163),
  ('pos:session_close', 'ปิดรอบ POS',       'Close POS Session',    'pos', 164)
ON CONFLICT (id) DO NOTHING;

-- system_admin: all POS permissions
INSERT INTO employee_role_permissions (role_id, permission_id)
  SELECT '00000000-0000-0000-0000-000000000001', id FROM permissions WHERE module = 'pos'
ON CONFLICT DO NOTHING;

-- system_manager: all POS permissions
INSERT INTO employee_role_permissions (role_id, permission_id)
  SELECT '00000000-0000-0000-0000-000000000002', id FROM permissions WHERE module = 'pos'
ON CONFLICT DO NOTHING;

-- system_staff: view, cashier, session open/close
INSERT INTO employee_role_permissions (role_id, permission_id)
  SELECT '00000000-0000-0000-0000-000000000003', id FROM permissions 
  WHERE id IN ('pos:view', 'pos:cashier', 'pos:session_open', 'pos:session_close')
ON CONFLICT DO NOTHING;

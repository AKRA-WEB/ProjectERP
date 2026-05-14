-- migrations/029_pos_improvements.sql

BEGIN;

-- 1. Product image support
ALTER TABLE products ADD COLUMN IF NOT EXISTS image_url VARCHAR(500);

-- 2. Sequences for new doc number series
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_sequences WHERE schemaname='public' AND sequencename='seq_pos_members') THEN
    CREATE SEQUENCE seq_pos_members START 1;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_sequences WHERE schemaname='public' AND sequencename='seq_pos_held') THEN
    CREATE SEQUENCE seq_pos_held START 1;
  END IF;
END $$;

-- 3. Membership table
CREATE TABLE IF NOT EXISTS pos_members (
  id             UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  member_number  VARCHAR(50)   NOT NULL UNIQUE DEFAULT next_doc_number('MBR', 'seq_pos_members'),
  name_th        VARCHAR(255)  NOT NULL,
  phone          VARCHAR(20)   NOT NULL UNIQUE,
  email          VARCHAR(255),
  tier           VARCHAR(20)   NOT NULL DEFAULT 'standard',
  discount_rate  NUMERIC(5,4)  NOT NULL DEFAULT 0,
  point_balance  INTEGER       NOT NULL DEFAULT 0,
  is_active      BOOLEAN       NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pos_members_phone ON pos_members(phone);
CREATE INDEX IF NOT EXISTS idx_pos_members_number ON pos_members(member_number);

CREATE OR REPLACE TRIGGER trg_pos_members_updated_at
  BEFORE UPDATE ON pos_members
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 4. Shift table
CREATE TABLE IF NOT EXISTS pos_shifts (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  name_th     VARCHAR(100) NOT NULL,
  name_en     VARCHAR(100) NOT NULL,
  start_time  TIME         NOT NULL,
  end_time    TIME         NOT NULL,
  is_active   BOOLEAN      NOT NULL DEFAULT TRUE
);

INSERT INTO pos_shifts (name_th, name_en, start_time, end_time) VALUES
  ('กะเช้า',  'Morning',   '06:00', '14:00'),
  ('กะบ่าย', 'Afternoon', '14:00', '22:00'),
  ('กะดึก',  'Night',     '22:00', '06:00')
ON CONFLICT DO NOTHING;

-- 5. Held carts
CREATE TABLE IF NOT EXISTS pos_held_carts (
  id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  hold_number  VARCHAR(50)  NOT NULL UNIQUE DEFAULT next_doc_number('HLD', 'seq_pos_held'),
  session_id   UUID         NOT NULL REFERENCES pos_sessions(id),
  warehouse_id UUID         NOT NULL REFERENCES warehouses(id),
  note         VARCHAR(255),
  created_by   UUID         NOT NULL REFERENCES users(id),
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pos_held_carts_session ON pos_held_carts(session_id);

CREATE TABLE IF NOT EXISTS pos_held_cart_lines (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  held_cart_id    UUID          NOT NULL REFERENCES pos_held_carts(id) ON DELETE CASCADE,
  product_id      UUID          NOT NULL REFERENCES products(id),
  qty             NUMERIC(15,4) NOT NULL,
  unit_price      NUMERIC(15,2) NOT NULL,
  discount_amount NUMERIC(15,2) NOT NULL DEFAULT 0
);

-- 6. Extend pos_transactions
ALTER TABLE pos_transactions
  ADD COLUMN IF NOT EXISTS member_id       UUID          REFERENCES pos_members(id),
  ADD COLUMN IF NOT EXISTS member_discount NUMERIC(15,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS points_earned   INTEGER       NOT NULL DEFAULT 0;

-- 7. Extend pos_sessions
ALTER TABLE pos_sessions
  ADD COLUMN IF NOT EXISTS shift_id UUID REFERENCES pos_shifts(id);

-- 8. New permissions
INSERT INTO permissions (id, name_th, name_en, module, sort_order) VALUES
  ('pos:members',       'จัดการสมาชิก POS',   'Manage POS Members', 'pos', 165),
  ('pos:shift_manage',  'จัดการกะ POS',        'Manage POS Shifts',  'pos', 166)
ON CONFLICT (id) DO NOTHING;

-- Grant to admin and manager
INSERT INTO employee_role_permissions (role_id, permission_id)
  SELECT '00000000-0000-0000-0000-000000000001', id FROM permissions
  WHERE id IN ('pos:members', 'pos:shift_manage')
ON CONFLICT DO NOTHING;

INSERT INTO employee_role_permissions (role_id, permission_id)
  SELECT '00000000-0000-0000-0000-000000000002', id FROM permissions
  WHERE id IN ('pos:members', 'pos:shift_manage')
ON CONFLICT DO NOTHING;

COMMIT;

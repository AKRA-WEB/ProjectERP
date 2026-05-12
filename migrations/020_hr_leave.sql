-- ─────────────────────────────────────────────
-- HR Phase 2: Leave Management
-- ─────────────────────────────────────────────

CREATE SEQUENCE IF NOT EXISTS seq_lr START 1;

CREATE TABLE IF NOT EXISTS leave_types (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code          VARCHAR(50)  NOT NULL UNIQUE,
  name_th       VARCHAR(255) NOT NULL,
  name_en       VARCHAR(255) NOT NULL,
  days_per_year INT          NOT NULL DEFAULT 0,
  is_paid       BOOLEAN      NOT NULL DEFAULT TRUE,
  carry_over    BOOLEAN      NOT NULL DEFAULT FALSE,
  is_active     BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE TRIGGER trg_leave_types_updated_at
  BEFORE UPDATE ON leave_types
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS leave_balances (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  leave_type_id   UUID NOT NULL REFERENCES leave_types(id) ON DELETE CASCADE,
  year            INT  NOT NULL,
  days_entitled   INT  NOT NULL DEFAULT 0,
  days_used       NUMERIC(4,1) NOT NULL DEFAULT 0,
  UNIQUE(employee_id, leave_type_id, year)
);

CREATE INDEX IF NOT EXISTS idx_leave_bal_emp ON leave_balances(employee_id);

CREATE TABLE IF NOT EXISTS leave_requests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_number  VARCHAR(50) NOT NULL UNIQUE DEFAULT next_doc_number('LR','seq_lr'),
  employee_id     UUID NOT NULL REFERENCES users(id),
  leave_type_id   UUID NOT NULL REFERENCES leave_types(id),
  start_date      DATE NOT NULL,
  end_date        DATE NOT NULL,
  days_requested  NUMERIC(4,1) NOT NULL,
  status          VARCHAR(20) NOT NULL DEFAULT 'draft',
  approved_by     UUID REFERENCES users(id),
  approved_at     TIMESTAMPTZ,
  notes           TEXT,
  reject_reason   TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_leave_status CHECK (status IN ('draft','submitted','approved','rejected','cancelled'))
);

CREATE OR REPLACE TRIGGER trg_leave_requests_updated_at
  BEFORE UPDATE ON leave_requests
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS idx_leave_req_emp ON leave_requests(employee_id);
CREATE INDEX IF NOT EXISTS idx_leave_req_status ON leave_requests(status);

-- Seed standard Thai leave types
INSERT INTO leave_types (code, name_th, name_en, days_per_year, is_paid, carry_over) VALUES
  ('SICK',     'ลาป่วย',    'Sick Leave',     30, TRUE,  FALSE),
  ('VACATION', 'ลาพักร้อน', 'Annual Leave',   10, TRUE,  TRUE),
  ('PERSONAL', 'ลากิจ',     'Personal Leave',  3, FALSE, FALSE),
  ('MATERNITY','ลาคลอด',    'Maternity Leave', 98, TRUE, FALSE),
  ('ORDAIN',   'ลาบวช',     'Ordination Leave',15, TRUE, FALSE)
ON CONFLICT (code) DO NOTHING;

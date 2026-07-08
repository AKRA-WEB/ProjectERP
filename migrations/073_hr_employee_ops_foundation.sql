BEGIN;

-- 1. Extend employee_documents with review metadata
ALTER TABLE employee_documents
  ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'pending_review'
    CHECK (status IN ('pending_review','verified','rejected','expired')),
  ADD COLUMN IF NOT EXISTS uploaded_by_user_id UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS verified_by_user_id UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rejected_reason TEXT,
  ADD COLUMN IF NOT EXISTS notes TEXT;

CREATE INDEX IF NOT EXISTS idx_employee_documents_status
  ON employee_documents (status, expiry_date);
CREATE INDEX IF NOT EXISTS idx_employee_documents_employee_status
  ON employee_documents (employee_id, status);

-- 2. Emergency contacts
CREATE TABLE IF NOT EXISTS employee_emergency_contacts (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  contact_name VARCHAR(255) NOT NULL,
  relationship VARCHAR(100) NOT NULL,
  phone        VARCHAR(50) NOT NULL,
  alt_phone    VARCHAR(50),
  address      TEXT,
  is_primary   BOOLEAN NOT NULL DEFAULT FALSE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_emp_emergency_contacts_primary
  ON employee_emergency_contacts (employee_id)
  WHERE is_primary = TRUE;

DROP TRIGGER IF EXISTS set_employee_emergency_contacts_updated_at ON employee_emergency_contacts;
CREATE TRIGGER set_employee_emergency_contacts_updated_at
  BEFORE UPDATE ON employee_emergency_contacts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 3. HR audit events (append-only)
CREATE TABLE IF NOT EXISTS hr_employee_audit_events (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id        UUID NOT NULL REFERENCES users(id),
  actor_user_id      UUID NOT NULL REFERENCES users(id),
  event_type         VARCHAR(80) NOT NULL,
  event_payload_json JSONB NOT NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hr_employee_audit_employee_created
  ON hr_employee_audit_events (employee_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_hr_employee_audit_event_type
  ON hr_employee_audit_events (event_type);

-- 4. Leave balance adjustments
CREATE TABLE IF NOT EXISTS leave_balance_adjustments (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id         UUID NOT NULL REFERENCES users(id),
  leave_type_id       UUID NOT NULL REFERENCES leave_types(id),
  year                INT NOT NULL,
  adjustment_kind     VARCHAR(30) NOT NULL CHECK (adjustment_kind IN ('entitlement','used_correction')),
  delta_days          NUMERIC(4,1) NOT NULL,
  balance_before      NUMERIC(4,1) NOT NULL,
  balance_after       NUMERIC(4,1) NOT NULL,
  reason              TEXT NOT NULL,
  adjusted_by_user_id UUID NOT NULL REFERENCES users(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Attendance adjustment requests
CREATE SEQUENCE IF NOT EXISTS seq_hra START 1;

CREATE TABLE IF NOT EXISTS attendance_adjustment_requests (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_number       VARCHAR(50) NOT NULL UNIQUE DEFAULT next_doc_number('HRA','seq_hra'),
  employee_id          UUID NOT NULL REFERENCES users(id),
  attendance_record_id UUID REFERENCES attendance_records(id),
  work_date            DATE NOT NULL,
  requested_clock_in   TIMESTAMPTZ,
  requested_clock_out  TIMESTAMPTZ,
  requested_status     VARCHAR(20),
  requested_ot_hours   NUMERIC(5,2),
  reason               TEXT NOT NULL,
  status               VARCHAR(20) NOT NULL DEFAULT 'submitted'
    CHECK (status IN ('submitted','approved','rejected','cancelled')),
  reviewed_by_user_id  UUID REFERENCES users(id),
  reviewed_at          TIMESTAMPTZ,
  review_note          TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS set_attendance_adjustment_requests_updated_at ON attendance_adjustment_requests;
CREATE TRIGGER set_attendance_adjustment_requests_updated_at
  BEFORE UPDATE ON attendance_adjustment_requests
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS idx_att_adj_employee_status
  ON attendance_adjustment_requests (employee_id, status, work_date DESC);
CREATE INDEX IF NOT EXISTS idx_att_adj_status_created
  ON attendance_adjustment_requests (status, created_at ASC);

COMMIT;

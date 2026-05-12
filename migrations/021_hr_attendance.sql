-- ─────────────────────────────────────────────
-- HR Phase 3: Attendance
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS work_schedules (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name_th      VARCHAR(255) NOT NULL,
  name_en      VARCHAR(255) NOT NULL,
  shift_start  TIME NOT NULL DEFAULT '08:00',
  shift_end    TIME NOT NULL DEFAULT '17:00',
  days_of_week INT[] NOT NULL DEFAULT ARRAY[1,2,3,4,5],
  is_default   BOOLEAN NOT NULL DEFAULT FALSE,
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE TRIGGER trg_work_schedules_updated_at
  BEFORE UPDATE ON work_schedules
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS attendance_records (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id  UUID NOT NULL REFERENCES users(id),
  work_date    DATE NOT NULL,
  clock_in     TIMESTAMPTZ,
  clock_out    TIMESTAMPTZ,
  status       VARCHAR(20) NOT NULL DEFAULT 'present',
  ot_hours     NUMERIC(5,2) NOT NULL DEFAULT 0,
  note         TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(employee_id, work_date),
  CONSTRAINT chk_attendance_status CHECK (status IN ('present','absent','late','half_day','holiday'))
);

CREATE OR REPLACE TRIGGER trg_attendance_records_updated_at
  BEFORE UPDATE ON attendance_records
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS idx_attendance_emp_date ON attendance_records(employee_id, work_date);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance_records(work_date);

-- Add work_schedule_id to users
ALTER TABLE users ADD COLUMN IF NOT EXISTS work_schedule_id UUID REFERENCES work_schedules(id);

-- Seed default schedule
INSERT INTO work_schedules (name_th, name_en, shift_start, shift_end, days_of_week, is_default)
VALUES ('มาตรฐาน จ-ศ', 'Standard Mon-Fri', '08:00', '17:00', ARRAY[1,2,3,4,5], TRUE)
ON CONFLICT DO NOTHING;

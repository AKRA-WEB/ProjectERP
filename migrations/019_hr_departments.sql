-- ─────────────────────────────────────────────
-- HR Phase 1: Departments, Positions, Salary Grades, Employee Documents
-- ─────────────────────────────────────────────

-- 1. Departments
CREATE TABLE IF NOT EXISTS departments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code        VARCHAR(50)  NOT NULL UNIQUE,
  name_th     VARCHAR(255) NOT NULL,
  name_en     VARCHAR(255) NOT NULL,
  parent_id   UUID REFERENCES departments(id),
  manager_id  UUID REFERENCES users(id),
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE TRIGGER trg_departments_updated_at
  BEFORE UPDATE ON departments
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS idx_departments_parent ON departments(parent_id) WHERE parent_id IS NOT NULL;

-- 2. Salary grades
CREATE TABLE IF NOT EXISTS salary_grades (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code             VARCHAR(50)  NOT NULL UNIQUE,
  name_th          VARCHAR(255) NOT NULL,
  name_en          VARCHAR(255) NOT NULL,
  base_salary_min  NUMERIC(12,2) NOT NULL DEFAULT 0,
  base_salary_max  NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE TRIGGER trg_salary_grades_updated_at
  BEFORE UPDATE ON salary_grades
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 3. Positions
CREATE TABLE IF NOT EXISTS positions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code             VARCHAR(50)  NOT NULL UNIQUE,
  name_th          VARCHAR(255) NOT NULL,
  name_en          VARCHAR(255) NOT NULL,
  department_id    UUID REFERENCES departments(id),
  salary_grade_id  UUID REFERENCES salary_grades(id),
  is_active        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE TRIGGER trg_positions_updated_at
  BEFORE UPDATE ON positions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS idx_positions_dept ON positions(department_id);

-- 4. Extend users with HR FK columns
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS department_id     UUID REFERENCES departments(id),
  ADD COLUMN IF NOT EXISTS position_id       UUID REFERENCES positions(id),
  ADD COLUMN IF NOT EXISTS salary_grade_id   UUID REFERENCES salary_grades(id),
  ADD COLUMN IF NOT EXISTS base_salary       NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS employment_type   VARCHAR(20) NOT NULL DEFAULT 'full_time',
  ADD COLUMN IF NOT EXISTS employee_status   VARCHAR(20) NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS resignation_date  DATE;

-- 5. Employee documents
CREATE TABLE IF NOT EXISTS employee_documents (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  doc_type     VARCHAR(50) NOT NULL,  -- id_card | passport | degree | contract | other
  filename     VARCHAR(500) NOT NULL,
  storage_url  VARCHAR(1000) NOT NULL,
  issued_date  DATE,
  expiry_date  DATE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_emp_docs_employee ON employee_documents(employee_id);

-- 6. Seed sample departments
INSERT INTO departments (code, name_th, name_en) VALUES
  ('MGMT', 'ผู้บริหาร', 'Management'),
  ('WH',   'คลังสินค้า', 'Warehouse'),
  ('SALES','ขาย', 'Sales'),
  ('ACCT', 'บัญชี', 'Accounting'),
  ('IT',   'ไอที', 'IT')
ON CONFLICT (code) DO NOTHING;

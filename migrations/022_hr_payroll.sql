-- ─────────────────────────────────────────────
-- HR Phase 4: Payroll
-- ─────────────────────────────────────────────

CREATE SEQUENCE IF NOT EXISTS seq_pyr START 1;

-- Thai income tax brackets (2024)
CREATE TABLE IF NOT EXISTS tax_brackets (
  id          SERIAL PRIMARY KEY,
  income_from NUMERIC(15,2) NOT NULL,
  income_to   NUMERIC(15,2),             -- NULL = no upper bound
  rate        NUMERIC(5,4) NOT NULL
);

INSERT INTO tax_brackets (income_from, income_to, rate) VALUES
  (0,           150000,  0.00),
  (150000.01,   300000,  0.05),
  (300000.01,   500000,  0.10),
  (500000.01,   750000,  0.15),
  (750000.01,  1000000,  0.20),
  (1000000.01, 2000000,  0.25),
  (2000000.01, 5000000,  0.30),
  (5000000.01,  NULL,    0.35)
ON CONFLICT DO NOTHING;

-- Payroll account mapping (singleton)
CREATE TABLE IF NOT EXISTS hr_payroll_accounts (
  id                        INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  salary_expense_account_id UUID REFERENCES accounts(id),
  sso_expense_account_id    UUID REFERENCES accounts(id),
  salary_payable_account_id UUID REFERENCES accounts(id),
  sso_payable_account_id    UUID REFERENCES accounts(id),
  tax_payable_account_id    UUID REFERENCES accounts(id),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Payroll runs
CREATE TABLE IF NOT EXISTS payroll_runs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_number      VARCHAR(50) NOT NULL UNIQUE DEFAULT next_doc_number('PYR','seq_pyr'),
  period_month    INT  NOT NULL CHECK (period_month BETWEEN 1 AND 12),
  period_year     INT  NOT NULL,
  status          VARCHAR(20) NOT NULL DEFAULT 'draft',
  total_gross     NUMERIC(15,2) NOT NULL DEFAULT 0,
  total_net       NUMERIC(15,2) NOT NULL DEFAULT 0,
  total_sso_emp   NUMERIC(15,2) NOT NULL DEFAULT 0,
  total_sso_co    NUMERIC(15,2) NOT NULL DEFAULT 0,
  total_tax       NUMERIC(15,2) NOT NULL DEFAULT 0,
  approved_by     UUID REFERENCES users(id),
  approved_at     TIMESTAMPTZ,
  journal_entry_id UUID REFERENCES journal_entries(id),
  created_by      UUID NOT NULL REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(period_month, period_year),
  CONSTRAINT chk_payroll_status CHECK (status IN ('draft','processing','approved','paid','void'))
);

CREATE OR REPLACE TRIGGER trg_payroll_runs_updated_at
  BEFORE UPDATE ON payroll_runs
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Payroll lines (one per employee per run)
CREATE TABLE IF NOT EXISTS payroll_lines (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id            UUID NOT NULL REFERENCES payroll_runs(id) ON DELETE CASCADE,
  employee_id       UUID NOT NULL REFERENCES users(id),
  base_salary       NUMERIC(12,2) NOT NULL DEFAULT 0,
  allowances        JSONB NOT NULL DEFAULT '[]',
  ot_pay            NUMERIC(12,2) NOT NULL DEFAULT 0,
  absence_deduction NUMERIC(12,2) NOT NULL DEFAULT 0,
  gross_pay         NUMERIC(12,2) NOT NULL DEFAULT 0,
  sso_employee      NUMERIC(10,2) NOT NULL DEFAULT 0,
  sso_employer      NUMERIC(10,2) NOT NULL DEFAULT 0,
  taxable_income    NUMERIC(12,2) NOT NULL DEFAULT 0,
  income_tax        NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_deductions  NUMERIC(12,2) NOT NULL DEFAULT 0,
  net_pay           NUMERIC(12,2) NOT NULL DEFAULT 0,
  slip_url          TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(run_id, employee_id)
);

CREATE INDEX IF NOT EXISTS idx_payroll_lines_run ON payroll_lines(run_id);
CREATE INDEX IF NOT EXISTS idx_payroll_lines_emp ON payroll_lines(employee_id);

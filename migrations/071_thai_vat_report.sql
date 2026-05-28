-- migrations/071_thai_vat_report.sql
DO $$ BEGIN
  CREATE TYPE vat_report_type AS ENUM ('purchase', 'sales');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

BEGIN;

CREATE TABLE IF NOT EXISTS vat_report_runs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_year  INTEGER NOT NULL,
  period_month INTEGER NOT NULL CHECK (period_month BETWEEN 1 AND 12),
  report_type  vat_report_type NOT NULL,
  generated_by UUID NOT NULL REFERENCES users(id),
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  total_base   NUMERIC(15,2) NOT NULL DEFAULT 0,
  total_vat    NUMERIC(15,2) NOT NULL DEFAULT 0,
  snapshot     JSONB,
  UNIQUE (period_year, period_month, report_type)
);

CREATE INDEX IF NOT EXISTS idx_vat_runs_period ON vat_report_runs(period_year, period_month);

COMMIT;

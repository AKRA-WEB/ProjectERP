CREATE TABLE IF NOT EXISTS accounting_export_jobs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  format       VARCHAR(50) NOT NULL, -- 'express', 'flowaccount', 'peak'
  range_from   DATE NOT NULL,
  range_to     DATE NOT NULL,
  requested_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  status       VARCHAR(50) NOT NULL DEFAULT 'pending', -- 'pending', 'completed', 'failed'
  output_meta  JSONB -- row counts, file info, etc.
);

CREATE INDEX IF NOT EXISTS idx_accounting_export_jobs_requested_by ON accounting_export_jobs(requested_by);
CREATE INDEX IF NOT EXISTS idx_accounting_export_jobs_requested_at ON accounting_export_jobs(requested_at DESC);

-- Seed permission for exporting accounting data
INSERT INTO permissions (id, name_th, name_en, module, sort_order) VALUES
  ('accounting:export', 'ส่งออกข้อมูลบัญชี / Export Accounting', 'Export Accounting Data', 'accounting', 322)
ON CONFLICT (id) DO NOTHING;

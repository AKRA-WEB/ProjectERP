CREATE TABLE IF NOT EXISTS hrzoft_sync_runs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at    TIMESTAMPTZ,
  status          VARCHAR(50) NOT NULL DEFAULT 'running', -- 'running', 'completed', 'failed'
  total_count     INTEGER NOT NULL DEFAULT 0,
  created_count   INTEGER NOT NULL DEFAULT 0,
  updated_count   INTEGER NOT NULL DEFAULT 0,
  disabled_count  INTEGER NOT NULL DEFAULT 0,
  orphan_count    INTEGER NOT NULL DEFAULT 0,
  error_message   TEXT
);

CREATE INDEX IF NOT EXISTS idx_hrzoft_sync_runs_started ON hrzoft_sync_runs(started_at DESC);

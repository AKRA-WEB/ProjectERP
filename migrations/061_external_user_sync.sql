CREATE TYPE hrzoft_sync_status AS ENUM ('active', 'disabled', 'orphan');

CREATE TABLE IF NOT EXISTS external_user_sync (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  local_user_id       UUID REFERENCES users(id) ON DELETE SET NULL,
  hrzoft_employee_id  VARCHAR(100) UNIQUE NOT NULL,
  last_synced_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status              hrzoft_sync_status NOT NULL DEFAULT 'active',
  conflict_notes      TEXT
);

CREATE INDEX IF NOT EXISTS idx_external_user_sync_local ON external_user_sync(local_user_id);
CREATE INDEX IF NOT EXISTS idx_external_user_sync_hrzoft ON external_user_sync(hrzoft_employee_id);

-- Seed permission for Hrzoft sync management
INSERT INTO permissions (id, name_th, name_en, module, sort_order) VALUES
  ('admin:hrzoft_sync', 'จัดการการเชื่อมต่อ Hrzoft / Manage Hrzoft Sync', 'Manage Hrzoft Sync Integration', 'admin', 150)
ON CONFLICT (id) DO NOTHING;

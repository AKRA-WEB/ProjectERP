-- migrations/044_manager_override_pin.sql

ALTER TABLE users ADD COLUMN IF NOT EXISTS override_pin_hash VARCHAR(255);

CREATE TABLE IF NOT EXISTS override_audit (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id),
  action VARCHAR(100) NOT NULL,
  target_table VARCHAR(100) NOT NULL,
  target_id UUID NOT NULL,
  reason_code VARCHAR(50),
  original_value JSONB,
  override_value JSONB,
  jti VARCHAR(100) UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_override_audit_user ON override_audit(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_override_audit_target ON override_audit(target_table, target_id);

CREATE TABLE IF NOT EXISTS override_pin_attempts (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  success BOOLEAN NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_override_attempts_user_time ON override_pin_attempts(user_id, attempted_at DESC);

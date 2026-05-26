-- migrations/065_npd_trials.sql

-- 1. Add is_npd_trial column to products table
ALTER TABLE products ADD COLUMN IF NOT EXISTS is_npd_trial BOOLEAN NOT NULL DEFAULT FALSE;

-- 2. Create npd_trial_status enum type
DO $$ BEGIN
  CREATE TYPE npd_trial_status AS ENUM ('active', 'graduated', 'cut', 'extended');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3. Create npd_trials table
CREATE TABLE IF NOT EXISTS npd_trials (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id    UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  start_date    DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date      DATE NOT NULL,
  status        npd_trial_status NOT NULL DEFAULT 'active',
  decision_at   TIMESTAMPTZ,
  decision_by   UUID REFERENCES users(id),
  decision_notes TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Create indexes
CREATE INDEX IF NOT EXISTS idx_npd_trials_status_end ON npd_trials(status, end_date);
CREATE INDEX IF NOT EXISTS idx_npd_trials_product ON npd_trials(product_id);

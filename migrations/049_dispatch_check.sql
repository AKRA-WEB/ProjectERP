-- Top of file (outside transaction)
DO $$ BEGIN
  ALTER TYPE ledger_entry_type ADD VALUE 'dispatch_out';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE dispatch_check_result AS ENUM ('matched','mismatched','stale_barcode');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE dispatch_session_status AS ENUM ('open','released','aborted');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

BEGIN;

-- 1. Create dispatch_sessions table
CREATE TABLE IF NOT EXISTS dispatch_sessions (
  id           UUID                     PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id   UUID                     NOT NULL REFERENCES sales_invoices(id),
  gate_user_id UUID                     NOT NULL REFERENCES users(id),
  started_at   TIMESTAMPTZ              NOT NULL DEFAULT NOW(),
  released_at  TIMESTAMPTZ,
  status       dispatch_session_status  NOT NULL DEFAULT 'open'
);

-- 2. Create dispatch_check_log table
CREATE TABLE IF NOT EXISTS dispatch_check_log (
  id           BIGSERIAL               PRIMARY KEY,
  session_id   UUID                    NOT NULL REFERENCES dispatch_sessions(id) ON DELETE CASCADE,
  invoice_id   UUID                    NOT NULL REFERENCES sales_invoices(id),
  product_id   UUID                    NOT NULL REFERENCES products(id),
  lot_id       UUID                    REFERENCES lots(id),
  scanned_qty  NUMERIC(15,4)           NOT NULL DEFAULT 0,
  expected_qty NUMERIC(15,4)           NOT NULL,
  gate_user_id UUID                    NOT NULL REFERENCES users(id),
  scanned_at   TIMESTAMPTZ              NOT NULL DEFAULT NOW(),
  result       dispatch_check_result   NOT NULL
);

-- 3. Indexes
CREATE INDEX IF NOT EXISTS idx_dispatch_log_invoice ON dispatch_check_log(invoice_id, scanned_at DESC);
CREATE INDEX IF NOT EXISTS idx_dispatch_sessions_invoice ON dispatch_sessions(invoice_id);
CREATE INDEX IF NOT EXISTS idx_dispatch_log_session ON dispatch_check_log(session_id);

COMMIT;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

BEGIN;

-- 1. Create invoice_versions table
CREATE TABLE IF NOT EXISTS invoice_versions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id      UUID NOT NULL REFERENCES sales_invoices(id) ON DELETE CASCADE,
  version_no      INT NOT NULL,
  barcode         VARCHAR(64) NOT NULL UNIQUE,
  change_summary  JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by      UUID NOT NULL REFERENCES users(id),
  UNIQUE(invoice_id, version_no)
);

-- 2. Add columns to sales_invoices
ALTER TABLE sales_invoices 
  ADD COLUMN IF NOT EXISTS current_version INT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS current_barcode VARCHAR(64) UNIQUE;

-- 3. Backfill v1 for every existing invoice
INSERT INTO invoice_versions (invoice_id, version_no, barcode, created_by)
SELECT si.id, 1, encode(digest(si.si_number || ':1', 'sha256'), 'hex'), si.created_by
FROM sales_invoices si
WHERE NOT EXISTS (SELECT 1 FROM invoice_versions iv WHERE iv.invoice_id = si.id);

UPDATE sales_invoices si 
SET current_barcode = iv.barcode
FROM invoice_versions iv 
WHERE iv.invoice_id = si.id 
  AND iv.version_no = 1 
  AND si.current_barcode IS NULL;

-- 4. Indexes
CREATE INDEX IF NOT EXISTS idx_invoice_versions_invoice ON invoice_versions(invoice_id, version_no DESC);

COMMIT;

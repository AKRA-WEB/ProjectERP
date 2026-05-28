-- migrations/072_grn_reversal.sql
DO $$ BEGIN
  ALTER TYPE grn_status ADD VALUE 'cancelled';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TYPE ledger_entry_type ADD VALUE 'grn_reversal';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

BEGIN;

ALTER TABLE po_invoices ADD COLUMN IF NOT EXISTS voided BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS grn_reversal_log (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grn_id              UUID NOT NULL REFERENCES goods_receipt_notes(id),
  reversed_by         UUID NOT NULL REFERENCES users(id),
  reason              TEXT,
  original_stocked_at TIMESTAMPTZ NOT NULL,
  reversed_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_grn_reversal_grn ON grn_reversal_log(grn_id);

COMMIT;

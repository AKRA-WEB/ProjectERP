-- Add missing product fields
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS name_sub           VARCHAR(500),
  ADD COLUMN IF NOT EXISTS selling_price      NUMERIC(15,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_type      SMALLINT      NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS discount_value     NUMERIC(15,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_non_vat         BOOLEAN       NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_unlimited_stock BOOLEAN       NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS hide_in_ecommerce  BOOLEAN       NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS hide_in_emenu      BOOLEAN       NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS image_url          TEXT,
  ADD COLUMN IF NOT EXISTS default_location   VARCHAR(50);

-- Add initial_import to ledger enum (must run outside transaction in Postgres)
-- COMMIT/BEGIN below: ALTER TYPE ADD VALUE cannot run in a transaction block (PG < 12).
-- This intentionally breaks out of the migration transaction to add the enum value,
-- then re-opens an empty transaction for the runner's COMMIT to close.
COMMIT;
ALTER TYPE ledger_entry_type ADD VALUE IF NOT EXISTS 'initial_import';
BEGIN;

-- migrations/030_fix_shift_number_default.sql

BEGIN;

-- 1. Sequence for shift number
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_sequences WHERE schemaname='public' AND sequencename='seq_pos_shift') THEN
    CREATE SEQUENCE seq_pos_shift START 1;
  END IF;
END $$;

-- 2. Add shift_number column with default
ALTER TABLE pos_shifts 
  ADD COLUMN IF NOT EXISTS shift_number VARCHAR(50) UNIQUE DEFAULT next_doc_number('SHF', 'seq_pos_shift');

COMMIT;

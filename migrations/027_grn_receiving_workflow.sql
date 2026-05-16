-- Add receiver_name and split tracking to GRN header
ALTER TABLE goods_receipt_notes
  ADD COLUMN IF NOT EXISTS receiver_name   VARCHAR(255),
  ADD COLUMN IF NOT EXISTS split_from_grn_id UUID REFERENCES goods_receipt_notes(id);

-- Add expected quantity to GRN lines (PO qty at time of template creation)
ALTER TABLE grn_line_items
  ADD COLUMN IF NOT EXISTS qty_expected NUMERIC(15,4);

-- Allow qty_received = 0 (template GRNs start with 0; staff fills later)
-- Drop the existing > 0 check constraint
DO $$ BEGIN
  ALTER TABLE grn_line_items DROP CONSTRAINT grn_line_items_qty_received_check;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

-- Replace with >= 0 constraint
ALTER TABLE grn_line_items
  ADD CONSTRAINT grn_line_items_qty_received_nonneg CHECK (qty_received >= 0);

-- Make received_date nullable (staff fills when delivery actually arrives)
ALTER TABLE goods_receipt_notes
  ALTER COLUMN received_date DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_grn_split ON goods_receipt_notes(split_from_grn_id) WHERE split_from_grn_id IS NOT NULL;

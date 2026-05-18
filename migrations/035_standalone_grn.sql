BEGIN;

-- 1. Create enum
CREATE TYPE grn_source_type AS ENUM ('po', 'inbound_order', 'standalone', 'pr_direct');

-- 2. Add columns to goods_receipt_notes
ALTER TABLE goods_receipt_notes
  ADD COLUMN IF NOT EXISTS vendor_id    UUID REFERENCES vendors(id),
  ADD COLUMN IF NOT EXISTS source_type  grn_source_type,
  ADD COLUMN IF NOT EXISTS pr_id        UUID REFERENCES purchase_requisitions(id);

-- 3. Backfill source_type on existing rows
UPDATE goods_receipt_notes SET source_type = 'po' WHERE po_id IS NOT NULL AND inbound_order_id IS NULL;
UPDATE goods_receipt_notes SET source_type = 'inbound_order' WHERE inbound_order_id IS NOT NULL AND po_id IS NULL;

-- 4. Make source_type NOT NULL after backfill
ALTER TABLE goods_receipt_notes ALTER COLUMN source_type SET NOT NULL;

-- 5. Drop blocking constraints
ALTER TABLE goods_receipt_notes DROP CONSTRAINT IF EXISTS chk_grn_source;
ALTER TABLE grn_line_items DROP CONSTRAINT IF EXISTS chk_grn_line_source;

-- 6. Add columns to grn_line_items
ALTER TABLE grn_line_items
  ADD COLUMN IF NOT EXISTS pr_line_item_id UUID REFERENCES pr_line_items(id),
  ADD COLUMN IF NOT EXISTS source_type     grn_source_type;

-- 7. Backfill grn_line_items.source_type from parent GRN
UPDATE grn_line_items gli
SET source_type = grn.source_type
FROM goods_receipt_notes grn
WHERE gli.grn_id = grn.id;

-- 8. Make grn_line_items.source_type NOT NULL
ALTER TABLE grn_line_items ALTER COLUMN source_type SET NOT NULL;

-- 9. Add source_grn_id to purchase_orders (retroactive PO from GRN)
ALTER TABLE purchase_orders
  ADD COLUMN IF NOT EXISTS source_grn_id UUID REFERENCES goods_receipt_notes(id);

-- 10. Add 'received' to pr_status enum
ALTER TYPE pr_status ADD VALUE IF NOT EXISTS 'received';

-- 11. Indexes
CREATE INDEX IF NOT EXISTS idx_grn_source_type ON goods_receipt_notes(source_type);
CREATE INDEX IF NOT EXISTS idx_grn_vendor_id ON goods_receipt_notes(vendor_id);
CREATE INDEX IF NOT EXISTS idx_grn_pr_id ON goods_receipt_notes(pr_id);
CREATE INDEX IF NOT EXISTS idx_po_source_grn_id ON purchase_orders(source_grn_id);
CREATE INDEX IF NOT EXISTS idx_grn_line_pr_line_item_id ON grn_line_items(pr_line_item_id);

COMMIT;

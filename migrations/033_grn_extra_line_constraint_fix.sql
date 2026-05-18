-- Allow extra/bonus GRN line items that have no PO or IO line reference
-- Relaxing constraint from XOR (exactly one) to NOT BOTH (either one, or neither)
ALTER TABLE grn_line_items DROP CONSTRAINT IF EXISTS chk_grn_line_source;
ALTER TABLE grn_line_items
  ADD CONSTRAINT chk_grn_line_source CHECK (
    NOT (po_line_item_id IS NOT NULL AND inbound_order_line_id IS NOT NULL)
  );

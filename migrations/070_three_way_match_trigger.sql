-- migrations/070_three_way_match_trigger.sql
BEGIN;

CREATE OR REPLACE FUNCTION reconcile_po_invoice() RETURNS TRIGGER AS $$
DECLARE
  po_total NUMERIC;
  gr_total NUMERIC;
BEGIN
  -- 1. Get PO total
  SELECT total_amount INTO po_total FROM purchase_orders WHERE id = NEW.po_id;
  
  -- 2. Get GRN total (qty_accepted or qty_received multiplied by PO line unit price)
  SELECT COALESCE(SUM(
    COALESCE(NULLIF(gli.qty_accepted, 0), gli.qty_received) * pli.unit_price
  ), 0) INTO gr_total
  FROM grn_line_items gli
  JOIN po_line_items pli ON pli.id = gli.po_line_item_id
  WHERE gli.grn_id = NEW.grn_id;

  -- 3. Clear existing variances for this invoice
  DELETE FROM po_invoice_match_variances WHERE po_invoice_id = NEW.id;

  -- 4. Reconcile and set match_status
  IF NEW.amount = gr_total THEN
    NEW.match_status := 'matched'::match_status;
  ELSE
    NEW.match_status := 'mismatched'::match_status;
    INSERT INTO po_invoice_match_variances (po_invoice_id, variance_type, po_value, gr_value, invoice_value)
    VALUES (NEW.id, 'header_amount', po_total, gr_total, NEW.amount);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_po_invoice_match ON po_invoices;
CREATE TRIGGER trg_po_invoice_match
  BEFORE INSERT OR UPDATE OF amount, po_id, grn_id ON po_invoices
  FOR EACH ROW EXECUTE FUNCTION reconcile_po_invoice();

-- Backfill existing rows to trigger the new trigger on all existing invoices
UPDATE po_invoices SET amount = amount;

-- Create high performance status index
CREATE INDEX IF NOT EXISTS idx_po_invoices_match_status ON po_invoices(match_status);

COMMIT;

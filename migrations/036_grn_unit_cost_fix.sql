BEGIN;

-- 1. Add unit_cost to grn_line_items
ALTER TABLE grn_line_items ADD COLUMN IF NOT EXISTS unit_cost NUMERIC(15,2) DEFAULT 0;

-- 2. Backfill unit_cost from PO lines
UPDATE grn_line_items li
SET unit_cost = pol.unit_price
FROM po_line_items pol
WHERE li.po_line_item_id = pol.id;

-- 3. Backfill unit_cost from IO lines
UPDATE grn_line_items li
SET unit_cost = iol.unit_cost
FROM inbound_order_lines iol
WHERE li.inbound_order_line_id = iol.id;

-- 4. Make unit_cost NOT NULL
ALTER TABLE grn_line_items ALTER COLUMN unit_cost SET NOT NULL;

-- 5. Add line_total generated column
ALTER TABLE grn_line_items ADD COLUMN IF NOT EXISTS line_total NUMERIC(15,2) GENERATED ALWAYS AS (qty_received * unit_cost) STORED;

COMMIT;

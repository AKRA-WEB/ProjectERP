ALTER TABLE grn_line_items
  ADD COLUMN IF NOT EXISTS storage_location VARCHAR(100);

COMMENT ON COLUMN grn_line_items.storage_location
  IS 'Bin/shelf/zone within the warehouse where this item was placed on receipt';

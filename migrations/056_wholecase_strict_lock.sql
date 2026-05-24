-- migrations/056_wholecase_strict_lock.sql
BEGIN;

CREATE TABLE IF NOT EXISTS product_channel_uoms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  channel price_channel NOT NULL,
  allowed_uoms TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(product_id, channel)
);

CREATE INDEX IF NOT EXISTS idx_product_channel_uoms_lookup ON product_channel_uoms(product_id, channel);

-- Seed: for every product, insert an AKRA row with allowed_uoms = ARRAY[<base uom code>]
INSERT INTO product_channel_uoms (product_id, channel, allowed_uoms)
SELECT p.id, 'AKRA'::price_channel, ARRAY[LOWER(uom.code)]::TEXT[]
FROM products p 
JOIN units_of_measure uom ON uom.id = p.uom_id
ON CONFLICT (product_id, channel) DO NOTHING;

COMMIT;

-- migrations/043_pricing_engine.sql

DO $$ BEGIN
  CREATE TYPE price_channel AS ENUM ('TRD', 'AKRA');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE price_tier AS ENUM ('T0', 'T1', 'T2', 'T3');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Alter existing tables and create new ones
ALTER TABLE products ADD COLUMN IF NOT EXISTS min_price NUMERIC(15,4) NOT NULL DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS clr_min_price NUMERIC(15,4) NOT NULL DEFAULT 0;

ALTER TABLE pos_members ADD COLUMN IF NOT EXISTS price_tier price_tier NOT NULL DEFAULT 'T0';

CREATE INDEX IF NOT EXISTS idx_pos_members_price_tier ON pos_members(price_tier);

CREATE TABLE IF NOT EXISTS product_prices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  channel price_channel NOT NULL,
  tier price_tier NOT NULL,
  price NUMERIC(15,4) NOT NULL CHECK (price >= 0),
  valid_from DATE NOT NULL,
  valid_to DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(product_id, channel, tier, valid_from),
  CHECK (valid_to IS NULL OR valid_to >= valid_from)
);

CREATE TABLE IF NOT EXISTS customer_price_contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  locked_price NUMERIC(15,4),
  discount_pct NUMERIC(5,2),
  valid_from DATE NOT NULL,
  valid_to DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (locked_price IS NOT NULL OR discount_pct IS NOT NULL),
  CHECK (valid_to IS NULL OR valid_to >= valid_from)
);

CREATE INDEX IF NOT EXISTS idx_product_prices_lookup ON product_prices(product_id, channel, tier, valid_from);
CREATE INDEX IF NOT EXISTS idx_customer_price_contracts_lookup ON customer_price_contracts(customer_id, product_id, valid_from);

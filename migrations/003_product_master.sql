CREATE TABLE IF NOT EXISTS units_of_measure (
  id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code     VARCHAR(20)  NOT NULL UNIQUE,
  name_th  VARCHAR(100) NOT NULL,
  name_en  VARCHAR(100) NOT NULL
);

CREATE TABLE IF NOT EXISTS product_categories (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id UUID REFERENCES product_categories(id),
  code      VARCHAR(50)  NOT NULL UNIQUE,
  name_th   VARCHAR(255) NOT NULL,
  name_en   VARCHAR(255) NOT NULL,
  is_active BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS products (
  id                UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  sku               VARCHAR(100) NOT NULL UNIQUE,
  barcode           VARCHAR(100) UNIQUE,
  name_th           VARCHAR(500) NOT NULL,
  name_en           VARCHAR(500) NOT NULL,
  description_th    TEXT,
  description_en    TEXT,
  category_id       UUID         REFERENCES product_categories(id),
  uom_id            UUID         NOT NULL REFERENCES units_of_measure(id),
  unit_cost         NUMERIC(15,2) NOT NULL DEFAULT 0,
  reorder_point     INTEGER      NOT NULL DEFAULT 0,
  is_lot_tracked    BOOLEAN      NOT NULL DEFAULT FALSE,
  is_serial_tracked BOOLEAN      NOT NULL DEFAULT FALSE,
  is_active         BOOLEAN      NOT NULL DEFAULT TRUE,
  created_by        UUID         REFERENCES users(id),
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_lot_serial CHECK (NOT (is_lot_tracked AND is_serial_tracked))
);

CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode) WHERE barcode IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_active ON products(is_active) WHERE is_active = TRUE;

CREATE TABLE IF NOT EXISTS vendors (
  id                 UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  code               VARCHAR(50)  NOT NULL UNIQUE,
  name_th            VARCHAR(500) NOT NULL,
  name_en            VARCHAR(500) NOT NULL,
  contact_name       VARCHAR(255),
  email              VARCHAR(255),
  phone              VARCHAR(50),
  address_th         TEXT,
  address_en         TEXT,
  tax_id             VARCHAR(50),
  payment_terms_days INTEGER      NOT NULL DEFAULT 30,
  is_active          BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS vendor_products (
  id           UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id    UUID          NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  product_id   UUID          NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  vendor_sku   VARCHAR(100),
  unit_price   NUMERIC(15,2) NOT NULL,
  lead_days    INTEGER       NOT NULL DEFAULT 0,
  is_preferred BOOLEAN       NOT NULL DEFAULT FALSE,
  updated_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  UNIQUE(vendor_id, product_id)
);

CREATE OR REPLACE TRIGGER trg_product_categories_updated_at
  BEFORE UPDATE ON product_categories
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE TRIGGER trg_products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE TRIGGER trg_vendors_updated_at
  BEFORE UPDATE ON vendors
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

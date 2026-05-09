CREATE SEQUENCE IF NOT EXISTS seq_pr START 1;
CREATE SEQUENCE IF NOT EXISTS seq_po START 1;
CREATE SEQUENCE IF NOT EXISTS seq_grn START 1;
CREATE SEQUENCE IF NOT EXISTS seq_rma START 1;
CREATE SEQUENCE IF NOT EXISTS seq_clm START 1;
CREATE SEQUENCE IF NOT EXISTS seq_trf START 1;
CREATE SEQUENCE IF NOT EXISTS seq_cc START 1;

CREATE OR REPLACE FUNCTION next_doc_number(prefix TEXT, seq_name TEXT)
RETURNS TEXT AS $$
DECLARE
  today TEXT := TO_CHAR(NOW(), 'YYYYMMDD');
  n     BIGINT;
BEGIN
  EXECUTE format('SELECT nextval(%L)', seq_name) INTO n;
  RETURN prefix || '-' || today || '-' || LPAD(n::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql;

CREATE TABLE IF NOT EXISTS purchase_requisitions (
  id                    UUID      PRIMARY KEY DEFAULT gen_random_uuid(),
  pr_number             VARCHAR(50) NOT NULL UNIQUE DEFAULT next_doc_number('PR', 'seq_pr'),
  warehouse_id          UUID      NOT NULL REFERENCES warehouses(id),
  requested_by          UUID      NOT NULL REFERENCES users(id),
  status                pr_status NOT NULL DEFAULT 'draft',
  notes                 TEXT,
  manager_approved_by   UUID      REFERENCES users(id),
  manager_approved_at   TIMESTAMPTZ,
  admin_approved_by     UUID      REFERENCES users(id),
  admin_approved_at     TIMESTAMPTZ,
  rejected_by           UUID      REFERENCES users(id),
  rejected_at           TIMESTAMPTZ,
  rejection_reason      TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pr_warehouse ON purchase_requisitions(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_pr_status ON purchase_requisitions(status);
CREATE INDEX IF NOT EXISTS idx_pr_requested_by ON purchase_requisitions(requested_by);

CREATE TABLE IF NOT EXISTS pr_line_items (
  id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  pr_id         UUID          NOT NULL REFERENCES purchase_requisitions(id) ON DELETE CASCADE,
  product_id    UUID          NOT NULL REFERENCES products(id),
  qty_requested NUMERIC(15,4) NOT NULL CHECK (qty_requested > 0),
  unit_cost     NUMERIC(15,2) NOT NULL DEFAULT 0,
  notes         TEXT,
  line_number   INTEGER       NOT NULL,
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  UNIQUE(pr_id, line_number)
);

CREATE TABLE IF NOT EXISTS purchase_orders (
  id                 UUID      PRIMARY KEY DEFAULT gen_random_uuid(),
  po_number          VARCHAR(50) NOT NULL UNIQUE DEFAULT next_doc_number('PO', 'seq_po'),
  vendor_id          UUID      NOT NULL REFERENCES vendors(id),
  warehouse_id       UUID      NOT NULL REFERENCES warehouses(id),
  status             po_status NOT NULL DEFAULT 'draft',
  expected_date      DATE,
  payment_terms_days INTEGER   NOT NULL DEFAULT 30,
  subtotal           NUMERIC(15,2) NOT NULL DEFAULT 0,
  vat_amount         NUMERIC(15,2) NOT NULL DEFAULT 0,
  total_amount       NUMERIC(15,2) NOT NULL DEFAULT 0,
  notes              TEXT,
  created_by         UUID      NOT NULL REFERENCES users(id),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_po_vendor ON purchase_orders(vendor_id);
CREATE INDEX IF NOT EXISTS idx_po_warehouse ON purchase_orders(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_po_status ON purchase_orders(status);

CREATE TABLE IF NOT EXISTS po_line_items (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  po_id           UUID          NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  product_id      UUID          NOT NULL REFERENCES products(id),
  pr_line_item_id UUID          REFERENCES pr_line_items(id),
  qty_ordered     NUMERIC(15,4) NOT NULL CHECK (qty_ordered > 0),
  qty_received    NUMERIC(15,4) NOT NULL DEFAULT 0,
  unit_price      NUMERIC(15,2) NOT NULL,
  line_total      NUMERIC(15,2) GENERATED ALWAYS AS (qty_ordered * unit_price) STORED,
  line_number     INTEGER       NOT NULL,
  UNIQUE(po_id, line_number)
);

CREATE TABLE IF NOT EXISTS pr_po_links (
  pr_id UUID NOT NULL REFERENCES purchase_requisitions(id),
  po_id UUID NOT NULL REFERENCES purchase_orders(id),
  PRIMARY KEY (pr_id, po_id)
);

CREATE TABLE IF NOT EXISTS po_invoices (
  id             UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  po_id          UUID          NOT NULL REFERENCES purchase_orders(id),
  invoice_number VARCHAR(100)  NOT NULL,
  invoice_date   DATE          NOT NULL,
  due_date       DATE          NOT NULL,
  amount         NUMERIC(15,2) NOT NULL,
  is_paid        BOOLEAN       NOT NULL DEFAULT FALSE,
  paid_at        TIMESTAMPTZ,
  paid_by        UUID          REFERENCES users(id),
  notes          TEXT,
  created_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE TRIGGER trg_pr_updated_at
  BEFORE UPDATE ON purchase_requisitions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE TRIGGER trg_po_updated_at
  BEFORE UPDATE ON purchase_orders
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE TRIGGER trg_po_invoices_updated_at
  BEFORE UPDATE ON po_invoices
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

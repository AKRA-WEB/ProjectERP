CREATE TABLE IF NOT EXISTS vendor_claims (
  id                  UUID                  PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_number        VARCHAR(50)           NOT NULL UNIQUE DEFAULT next_doc_number('CLM', 'seq_clm'),
  vendor_id           UUID                  NOT NULL REFERENCES vendors(id),
  warehouse_id        UUID                  NOT NULL REFERENCES warehouses(id),
  grn_id              UUID                  REFERENCES goods_receipt_notes(id),
  po_id               UUID                  REFERENCES purchase_orders(id),
  rma_id              UUID                  REFERENCES rma_requests(id),
  status              claim_status          NOT NULL DEFAULT 'open',
  claim_amount        NUMERIC(15,2)         NOT NULL DEFAULT 0,
  resolution_type     claim_resolution_type,
  credit_note_ref     VARCHAR(100),
  credit_note_amount  NUMERIC(15,2),
  replacement_grn_id  UUID                  REFERENCES goods_receipt_notes(id),
  resolved_by         UUID                  REFERENCES users(id),
  resolved_at         TIMESTAMPTZ,
  description         TEXT                  NOT NULL,
  resolution_notes    TEXT,
  created_by          UUID                  NOT NULL REFERENCES users(id),
  created_at          TIMESTAMPTZ           NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ           NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_claims_vendor ON vendor_claims(vendor_id);
CREATE INDEX IF NOT EXISTS idx_claims_warehouse ON vendor_claims(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_claims_status ON vendor_claims(status);

CREATE TABLE IF NOT EXISTS vendor_claim_attachments (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id    UUID         NOT NULL REFERENCES vendor_claims(id) ON DELETE CASCADE,
  file_name   VARCHAR(500) NOT NULL,
  file_url    TEXT         NOT NULL,
  uploaded_by UUID         REFERENCES users(id),
  uploaded_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE TRIGGER trg_claims_updated_at
  BEFORE UPDATE ON vendor_claims
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

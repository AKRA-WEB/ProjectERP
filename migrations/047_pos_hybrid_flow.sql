-- Top of file (outside transaction)
DO $$ BEGIN 
    CREATE TYPE pos_picking_slip_status AS ENUM ('printed','picked','cancelled'); 
EXCEPTION 
    WHEN duplicate_object THEN NULL; 
END $$;

BEGIN;

CREATE SEQUENCE IF NOT EXISTS seq_pos_pps START 1;

-- 1. Add columns to pos_held_carts
ALTER TABLE pos_held_carts 
  ADD COLUMN IF NOT EXISTS is_hybrid BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS wholesale_picking_slip_id UUID;

-- 2. Create pos_picking_slips table
CREATE TABLE IF NOT EXISTS pos_picking_slips (
  id                  UUID                     PRIMARY KEY DEFAULT gen_random_uuid(),
  doc_no              VARCHAR(50)              NOT NULL UNIQUE DEFAULT next_doc_number('PPS','seq_pos_pps'),
  draft_cart_id       UUID                     NOT NULL REFERENCES pos_held_carts(id) ON DELETE CASCADE,
  status              pos_picking_slip_status  NOT NULL DEFAULT 'printed',
  source_warehouse_id UUID                     NOT NULL REFERENCES warehouses(id),
  printed_at          TIMESTAMPTZ              NOT NULL DEFAULT NOW(),
  printed_by          UUID                     NOT NULL REFERENCES users(id),
  picked_at           TIMESTAMPTZ,
  picked_by           UUID                     REFERENCES users(id),
  lines               JSONB                    NOT NULL,
  created_at          TIMESTAMPTZ              NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ              NOT NULL DEFAULT NOW()
);

-- 3. Add FK constraint to pos_held_carts (idempotent)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'fk_held_cart_pps' 
        AND table_name = 'pos_held_carts'
    ) THEN
        ALTER TABLE pos_held_carts 
        ADD CONSTRAINT fk_held_cart_pps 
        FOREIGN KEY (wholesale_picking_slip_id) REFERENCES pos_picking_slips(id);
    END IF;
END $$;

-- 4. Indexes
CREATE INDEX IF NOT EXISTS idx_pps_draft_cart ON pos_picking_slips(draft_cart_id);
CREATE INDEX IF NOT EXISTS idx_pps_status ON pos_picking_slips(status);

-- 5. Trigger
CREATE OR REPLACE TRIGGER trg_pps_updated_at 
  BEFORE UPDATE ON pos_picking_slips 
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMIT;

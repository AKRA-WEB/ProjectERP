-- migrations/039_grn_bonus_items.sql
BEGIN;

-- Bonus/extra items (ของแถม/สินค้านอกบิล)
CREATE TABLE IF NOT EXISTS grn_bonus_items (
  id           UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  grn_id       UUID          NOT NULL REFERENCES goods_receipt_notes(id) ON DELETE CASCADE,
  product_id   UUID          REFERENCES products(id),
  product_name VARCHAR(255),      -- free-text fallback when no product_id
  qty          NUMERIC(15,4) NOT NULL CHECK (qty > 0),
  unit         VARCHAR(50),
  expiry_date  DATE,
  notes        TEXT,
  line_number  INTEGER       NOT NULL,
  created_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_grn_bonus_grn ON grn_bonus_items(grn_id);

-- Lift fee payment method
ALTER TABLE goods_receipt_notes
  ADD COLUMN IF NOT EXISTS lift_fee_payment_method VARCHAR(10)
    CHECK (lift_fee_payment_method IN ('cash', 'credit'));

COMMIT;

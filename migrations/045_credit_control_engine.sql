BEGIN;

-- 1. Add on_hold column to customers
ALTER TABLE customers ADD COLUMN IF NOT EXISTS on_hold BOOLEAN NOT NULL DEFAULT FALSE;

-- 2. Create customer_credit_holds table
CREATE TABLE IF NOT EXISTS customer_credit_holds (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id     UUID NOT NULL REFERENCES customers(id),
  reason          TEXT NOT NULL,
  started_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  released_at     TIMESTAMPTZ,
  released_by     UUID REFERENCES users(id),
  released_reason TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Index: open holds by customer
CREATE INDEX IF NOT EXISTS idx_customer_credit_holds_open
  ON customer_credit_holds(customer_id)
  WHERE released_at IS NULL;

-- 4. Index: customers currently on hold
CREATE INDEX IF NOT EXISTS idx_customers_on_hold
  ON customers(on_hold)
  WHERE on_hold = TRUE;

COMMIT;

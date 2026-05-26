-- migrations/067_field_sales_geo.sql
BEGIN;

-- 1. Create field_sales_checkins table
CREATE TABLE IF NOT EXISTS field_sales_checkins (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_user_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  customer_id     UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  gps_lat         NUMERIC(10, 8) NOT NULL,
  gps_lng         NUMERIC(11, 8) NOT NULL,
  accuracy_m      INTEGER NOT NULL,
  checked_in_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at        TIMESTAMPTZ
);

-- 2. Create indexes
CREATE INDEX IF NOT EXISTS idx_field_sales_checkins_agent_time 
  ON field_sales_checkins(agent_user_id, checked_in_at DESC);

CREATE INDEX IF NOT EXISTS idx_field_sales_checkins_customer 
  ON field_sales_checkins(customer_id);

COMMIT;

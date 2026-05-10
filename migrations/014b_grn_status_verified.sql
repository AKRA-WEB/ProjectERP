-- 8. Add 'verified' to grn_status enum (must run OUTSIDE a transaction)
ALTER TYPE grn_status ADD VALUE IF NOT EXISTS 'verified' AFTER 'received';

DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('admin', 'manager', 'staff');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE rma_condition AS ENUM ('resaleable', 'repack_resell', 'damaged_return_vendor');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE rma_status AS ENUM ('open', 'in_review', 'resolved', 'closed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE claim_resolution_type AS ENUM ('credit_note', 'replacement_shipment', 'both');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE claim_status AS ENUM ('open', 'in_review', 'resolved', 'closed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE transfer_status AS ENUM ('pending', 'completed', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE grn_status AS ENUM ('draft', 'received', 'qc_pending', 'qc_passed', 'qc_failed', 'stocked');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE pr_status AS ENUM ('draft', 'submitted', 'manager_approved', 'admin_approved', 'rejected', 'converted_to_po');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE po_status AS ENUM ('draft', 'sent', 'partially_received', 'fully_received', 'invoiced', 'paid', 'closed', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE cycle_count_status AS ENUM ('open', 'counting', 'pending_approval', 'approved', 'closed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE ledger_entry_type AS ENUM (
    'grn_receipt', 'grn_qc_reject', 'rma_return', 'rma_vendor_return',
    'transfer_out', 'transfer_in', 'cycle_count_adjustment',
    'po_reversal', 'manual_adjustment'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Migration: 037_repack_system.sql
-- Description: Database schema for the Repack Order system (UoM Phase 3)

-- 1. Enums
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'repack_status') THEN
        CREATE TYPE repack_status AS ENUM ('draft', 'completed', 'void');
    END IF;
END $$;

ALTER TYPE ledger_entry_type ADD VALUE IF NOT EXISTS 'repack_out';
ALTER TYPE ledger_entry_type ADD VALUE IF NOT EXISTS 'repack_in';

-- 2. Sequence for Order Number
CREATE SEQUENCE IF NOT EXISTS seq_repack_order_no;

-- 3. Repack Templates (Formulas)
CREATE TABLE IF NOT EXISTS repack_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    source_product_id UUID NOT NULL REFERENCES products(id),
    source_qty NUMERIC(15,4) NOT NULL DEFAULT 1,
    notes TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS repack_template_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID NOT NULL REFERENCES repack_templates(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id),
    qty_ratio NUMERIC(15,4) NOT NULL, -- How many of this output per source_qty
    notes TEXT
);

-- 4. Repack Orders (Transactions)
CREATE TABLE IF NOT EXISTS repack_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_number VARCHAR(50) UNIQUE NOT NULL,
    source_product_id UUID NOT NULL REFERENCES products(id),
    source_qty NUMERIC(15,4) NOT NULL,
    source_unit_cost NUMERIC(15,2), -- Cost of the source item at transaction time
    warehouse_id UUID NOT NULL REFERENCES warehouses(id),
    status repack_status DEFAULT 'draft',
    notes TEXT,
    created_by UUID NOT NULL REFERENCES users(id),
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS repack_order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    repack_order_id UUID NOT NULL REFERENCES repack_orders(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id),
    qty NUMERIC(15,4) NOT NULL,
    unit_cost NUMERIC(15,2), -- Manually editable or auto-calculated
    notes TEXT
);

-- 5. Triggers for updated_at
CREATE OR REPLACE TRIGGER trg_repack_templates_updated_at
    BEFORE UPDATE ON repack_templates
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE TRIGGER trg_repack_orders_updated_at
    BEFORE UPDATE ON repack_orders
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 6. Indexes
CREATE INDEX idx_repack_orders_source_product ON repack_orders(source_product_id);
CREATE INDEX idx_repack_orders_status ON repack_orders(status);
CREATE INDEX idx_repack_templates_source_product ON repack_templates(source_product_id);

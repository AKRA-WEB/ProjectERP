---
track: strict-receiving-flow
title: "Strict 5-Step Receiving Flow (PR -> PO -> BR -> GR -> Match)"
status: Active
created: 2026-05-23
updated: 2026-05-23
depends_on: [wms-virtual-warehouses]
estimate: L
assigned_to: [Gemini]
tags: [v2-orion, wms, purchase-order, blind-receiving, three-way-match]
---

# Strict 5-Step Receiving Flow (PR -> PO -> BR -> GR -> Match)

Provide a strict, secure, and zero-variance receiving workflow divided into 5 clear stages, integrating purchase requests, dynamic PO acknowledgements, split blind receiving, compiled goods receipt notes, and a concluding 3-way matching engine that releases stock to sellable storage.

---

## User Review Required

> [!IMPORTANT]
> **Schema Changes & Additions:**
> - We introduce a new document type **Blind Receipt (BR)** backed by `blind_receipts` and `blind_receipt_lines`. This permits multiple warehouse operators (staff) to count items independently or in different buildings/warehouses (e.g., W3 vs W4) for a single PO.
> - **Hiding PO Quantities:** Standard staff views for BR creation will absolutely hide the ordered quantity to force physical counts.
> - **Stock Update Timing:** Stock will **not** be added to the sellable inventory during the initial GRN entry. Instead, it will sit in a non-sellable staging/quarantine status until the **3-Way Match** is confirmed by an Admin, shifting the stock to the official Sellable Location.

---

## Open Questions

> [!NOTE]
> 1. **Default Last Cost Retrieval:** When creating a PO line, we pull the unit cost of the latest stocked GRN item for that product. We'll add a helper query to fetch this price automatically in the PO creation autocomplete payload.
> 2. **PO Status Additions:** We add `'opened'` (PO Opened) and `'pending_delivery'` (PO Pending Delivery) to the `po_status` enum.

---

## Proposed Changes

### Component 1 — Database Migrations

#### [NEW] [043_strict_receiving_flow.sql](file:///C:/Users/AKRA-Panich-Front/OneDrive/02-2%20-%20AKRA/projectERP/migrations/043_strict_receiving_flow.sql)

- Add new statuses to the `po_status` enum outside a transaction.
- Wrap table creation in `BEGIN; ... COMMIT;`:
  1. Create `blind_receipts` table to store counting sessions.
  2. Create `blind_receipt_lines` table for counted item details.
  3. Add `grn_id` to `blind_receipts` to reference the merged GRN.
  4. Create `po_invoices.match_status` enum and add matching fields to `po_invoices` for the 3-Way Match.
  5. Create `po_invoice_match_variances` table to log match discrepancies.

```sql
-- Step 1: Add new values to po_status enum (if not exists)
ALTER TYPE po_status ADD VALUE IF NOT EXISTS 'opened';
ALTER TYPE po_status ADD VALUE IF NOT EXISTS 'pending_delivery';

-- Step 2: Begin transaction
BEGIN;

-- Create BR sequence
CREATE SEQUENCE IF NOT EXISTS seq_br START 1;

-- Create blind_receipts table
CREATE TABLE IF NOT EXISTS blind_receipts (
  id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  br_number      VARCHAR(50)  NOT NULL UNIQUE DEFAULT next_doc_number('BR', 'seq_br'),
  po_id          UUID         NOT NULL REFERENCES purchase_orders(id),
  warehouse_id   UUID         NOT NULL REFERENCES warehouses(id),
  counted_by     UUID         NOT NULL REFERENCES users(id),
  status         VARCHAR(20)  NOT NULL DEFAULT 'draft', -- 'draft', 'submitted'
  notes          TEXT,
  grn_id         UUID, -- Set when merged into a GRN
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Create blind_receipt_lines table
CREATE TABLE IF NOT EXISTS blind_receipt_lines (
  id               UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  blind_receipt_id UUID           NOT NULL REFERENCES blind_receipts(id) ON DELETE CASCADE,
  product_id       UUID           NOT NULL REFERENCES products(id),
  qty_counted      NUMERIC(15,4)  NOT NULL CHECK (qty_counted >= 0),
  notes            TEXT,
  line_number      INTEGER        NOT NULL,
  created_at       TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  UNIQUE(blind_receipt_id, line_number)
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_br_po ON blind_receipts(po_id);
CREATE INDEX IF NOT EXISTS idx_br_status ON blind_receipts(status);

-- Create match_status enum
DO $$ BEGIN
  CREATE TYPE match_status AS ENUM ('pending', 'matched', 'mismatched');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Extend po_invoices for 3-Way Matching
ALTER TABLE po_invoices ADD COLUMN IF NOT EXISTS match_status match_status NOT NULL DEFAULT 'pending';

-- Create po_invoice_match_variances table
CREATE TABLE IF NOT EXISTS po_invoice_match_variances (
  id            BIGSERIAL      PRIMARY KEY,
  po_invoice_id UUID           NOT NULL REFERENCES po_invoices(id) ON DELETE CASCADE,
  variance_type VARCHAR(50)    NOT NULL,
  po_value      NUMERIC(15,2),
  gr_value      NUMERIC(15,2),
  invoice_value NUMERIC(15,2),
  detail        JSONB,
  created_at    TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

COMMIT;
```

---

### Component 2 — Backend API Endpoints

#### [NEW] [route.ts](file:///C:/Users/AKRA-Panich-Front/OneDrive/02-2%20-%20AKRA/projectERP/app/api/blind-receipts/route.ts)
- `POST /api/blind-receipts`: Creates a new BR document for a PO.
- `GET /api/blind-receipts`: Lists BR documents. Staff can only see BRs they counted, or BRs for their assigned warehouses.

#### [NEW] [[id]/route.ts](file:///C:/Users/AKRA-Panich-Front/OneDrive/02-2%20-%20AKRA/projectERP/app/api/blind-receipts/[id]/route.ts)
- `GET /api/blind-receipts/[id]`: Returns BR details. If user's role is `staff`, **absolutely strip PO ordered quantity** details from the payload to prevent counting bias.
- `PATCH /api/blind-receipts/[id]`: Updates BR quantities or changes status (`draft` -> `submitted`).

#### [NEW] [acknowledge/route.ts](file:///C:/Users/AKRA-Panich-Front/OneDrive/02-2%20-%20AKRA/projectERP/app/api/purchase-orders/[id]/acknowledge/route.ts)
- `POST /api/purchase-orders/[id]/acknowledge`: Transition PO status from `opened` to `pending_delivery` upon space acknowledgment by WMS team.

#### [NEW] [merge/route.ts](file:///C:/Users/AKRA-Panich-Front/OneDrive/02-2%20-%20AKRA/projectERP/app/api/grn/merge-brs/route.ts)
- `POST /api/grn/merge-brs`: Supervisor endpoint to select multiple `submitted` BRs for a PO, sum up the quantities counted, and compile a single official GRN (`goods_receipt_notes` and `grn_line_items`). Link the BRs to this GRN.

#### [NEW] [match-confirm/route.ts](file:///C:/Users/AKRA-Panich-Front/OneDrive/02-2%20-%20AKRA/projectERP/app/api/ap/invoices/match-confirm/route.ts)
- `POST /api/ap/invoices/match-confirm`: Compares PO values, compiled GRN quantities, and supplier invoice values. If matched:
  1. Wrap in a strict database transaction.
  2. Transition `po_invoices.match_status` to `'matched'`.
  3. Insert `stock_ledger` entries to move stock officially to the **Sellable Location** in the warehouse.
  4. Update `po_line_items.qty_received` and set `goods_receipt_notes.status = 'stocked'`.

---

### Component 3 — Frontend UI Screens

#### [MODIFY] [new/page.tsx](file:///C:/Users/AKRA-Panich-Front/OneDrive/02-2%20-%20AKRA/projectERP/app/app/purchase-orders/new/page.tsx)
- Autocomplete logic to load `last_cost` from GET product detail endpoint and use it as default unit cost.
- Save PO creates document with status `'opened'`.

#### [NEW] [page.tsx (Handheld)](file:///C:/Users/AKRA-Panich-Front/OneDrive/02-2%20-%20AKRA/projectERP/app/app/handheld/blind-receipts/page.tsx)
- Handheld-optimized list of POs waiting for delivery.
- Create new BR counting sheet.

#### [NEW] [[id]/page.tsx (Handheld)](file:///C:/Users/AKRA-Panich-Front/OneDrive/02-2%20-%20AKRA/projectERP/app/app/handheld/blind-receipts/[id]/page.tsx)
- High-contrast handheld screen showing only fields: `sku, product_name, qty_counted, notes`.
- Hides PO expected/ordered quantities absolutely.
- Allows counting into a specific building/warehouse (e.g. W3, W4).
- Submit action to finalize count.

#### [NEW] [merge/page.tsx](file:///C:/Users/AKRA-Panich-Front/OneDrive/02-2%20-%20AKRA/projectERP/app/app/grn/merge/page.tsx)
- Supervisor console. Shows PO detail with all associated submitted BRs.
- Allows checkboxes to select BRs and compiles them into a single, merged official GRN with summed up quantities.

#### [NEW] [match-details/page.tsx](file:///C:/Users/AKRA-Panich-Front/OneDrive/02-2%20-%20AKRA/projectERP/app/app/ap/match/page.tsx)
- 3-Way Match verification page displaying side-by-side:
  - PO unit prices & total ordered value.
  - Merged official GR quantities & calculated value.
  - Supplier Invoice details.
- Allows the Admin to confirm the match and officially post stock.

---

## Verification Plan

### Automated Tests
- `npx tsc --noEmit` -> 0 errors.
- `npm run lint` -> 0 errors.

### Manual Verification
1. Create a PO: Verify default prices match the last stocked GRN cost of that item. Ensure status is `PO Opened`.
2. Acknowledge: Click space allocation -> verify status transitions to `PO Pending Delivery`.
3. Handheld BR: Create a BR counted sheet as a staff user. Verify that no ordered quantities are shown. Submit two separate BRs (e.g., one counted by Operator A for building W3, another by Operator B for W4).
4. GR Merge: Log in as supervisor, select the PO, and compile the official GRN. Verify that quantities are correctly summed.
5. 3-Way Matching: Match the PO, official GR, and Supplier Invoice. Confirm the match and verify that `stock_ledger` entries are generated, adding the official sellable stock to the inventory.

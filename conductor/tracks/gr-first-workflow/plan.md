---
track: gr-first-workflow
status: Completed
owner: puka, paku
module: WMS
updated: 2026-05-18
aliases: ["GR-First Workflow — Standalone GR + GR→PO Conversion + PR→GR Direct"]
---

# Track: GR-First Workflow — Standalone GR + GR→PO + PR→GR Direct

## Objective

Enable Thai small-retail "receive first, document later" purchasing flow:

| Path | Flow | When to use |
|------|------|-------------|
| A | Standalone GR → (later) PO | Goods arrive, no paperwork ready |
| B | PR → GR direct → (later) PO | Approved request, goods received before PO processed |
| C | PO direct (unchanged) | Normal ordering workflow |

---

## Architectural Decisions

### D1 — Drop chk_grn_source, use source_type enum

**Decision**: Drop both `chk_grn_source` and `chk_grn_line_source` CHECK constraints. Replace with `source_type grn_source_type` enum column on both `goods_receipt_notes` and `grn_line_items`.

**Enum values**: `'po' | 'inbound_order' | 'standalone' | 'pr_direct'`

**Rationale**: Adding `pr_id` as a third nullable FK still requires the CHECK to accept null+null+non-null triads — more complexity, not less. Encoding source as data (enum column) is simpler and extensible. Future source types require only `ALTER TYPE`, not constraint rewrites.

**Backfill**: Migration sets `source_type = 'po'` for rows where `po_id IS NOT NULL`, and `source_type = 'inbound_order'` for rows where `inbound_order_id IS NOT NULL`.

### D2 — New pr_status value: 'received'

**Decision**: Add `'received'` to `pr_status` enum. Do NOT reuse `'converted_to_po'`.

**Rationale**: A PR that went PR→GR (no PO) is semantically different from PR→PO→GR. These paths must be distinguishable in reporting. `'received'` = goods taken in directly. `'converted_to_po'` = PO was the intermediate document.

**Impact**: Status badge renderers in `purchase-requisitions/[id]/page.tsx` and `purchase-requisitions/page.tsx` need a `'received'` case.

### D3 — vendor_id required for standalone GRN, optional for PR→GR

**Decision**: `vendor_id` column on `goods_receipt_notes` is nullable at DB level (backward compat). Required by Zod when `source_type = 'standalone'`, optional when `source_type = 'pr_direct'`.

**Rationale**: PO creation from GRN requires a vendor. A standalone GRN without vendor can never be converted to PO. PR→GRN path may not know vendor at receive time — vendor is added when creating the retrospective PO.

---

## Pre-verified Schema Facts (Gemini must NOT re-derive)

- `chk_grn_source` constraint name is exactly `chk_grn_source` — use `IF EXISTS` in DROP
- `chk_grn_line_source` constraint name is exactly `chk_grn_line_source` — use `IF EXISTS` in DROP
- `stock_ledger` columns: `id, product_id, warehouse_id, direction, qty, unit_cost, reference_type, reference_id, notes, created_by, created_at` — no `reference_number`
- `grn_line_items.line_total` is `GENERATED ALWAYS AS (qty_received * unit_cost) STORED` — never INSERT it
- `next_doc_number('GRN', 'seq_grn')` is the correct sequence call — not `grn_seq`
- `next_doc_number('PO', 'seq_po')` for PO numbers
- Latest migration: `034_po_discount_fields.sql` → new migration = **035_standalone_grn.sql**
- UI components in `components/ui/index.ts`: `Dialog, Button, Input, Select, Textarea, Badge`
- Types go in `types/index.ts` only — never define in route files

---

## TASK-1 (paku) — Migration: 035_standalone_grn.sql

**File**: `migrations/035_standalone_grn.sql`

```sql
BEGIN;

-- 1. Create enum
CREATE TYPE grn_source_type AS ENUM ('po', 'inbound_order', 'standalone', 'pr_direct');

-- 2. Add columns to goods_receipt_notes
ALTER TABLE goods_receipt_notes
  ADD COLUMN IF NOT EXISTS vendor_id    UUID REFERENCES vendors(id),
  ADD COLUMN IF NOT EXISTS source_type  grn_source_type,
  ADD COLUMN IF NOT EXISTS pr_id        UUID REFERENCES purchase_requisitions(id);

-- 3. Backfill source_type on existing rows
UPDATE goods_receipt_notes SET source_type = 'po' WHERE po_id IS NOT NULL AND inbound_order_id IS NULL;
UPDATE goods_receipt_notes SET source_type = 'inbound_order' WHERE inbound_order_id IS NOT NULL AND po_id IS NULL;

-- 4. Make source_type NOT NULL after backfill
ALTER TABLE goods_receipt_notes ALTER COLUMN source_type SET NOT NULL;

-- 5. Drop blocking constraints
ALTER TABLE goods_receipt_notes DROP CONSTRAINT IF EXISTS chk_grn_source;
ALTER TABLE grn_line_items DROP CONSTRAINT IF EXISTS chk_grn_line_source;

-- 6. Add columns to grn_line_items
ALTER TABLE grn_line_items
  ADD COLUMN IF NOT EXISTS pr_line_item_id UUID REFERENCES pr_line_items(id),
  ADD COLUMN IF NOT EXISTS source_type     grn_source_type;

-- 7. Backfill grn_line_items.source_type from parent GRN
UPDATE grn_line_items gli
SET source_type = grn.source_type
FROM goods_receipt_notes grn
WHERE gli.grn_id = grn.id;

-- 8. Make grn_line_items.source_type NOT NULL
ALTER TABLE grn_line_items ALTER COLUMN source_type SET NOT NULL;

-- 9. Add source_grn_id to purchase_orders (retroactive PO from GRN)
ALTER TABLE purchase_orders
  ADD COLUMN IF NOT EXISTS source_grn_id UUID REFERENCES goods_receipt_notes(id);

-- 10. Add 'received' to pr_status enum
ALTER TYPE pr_status ADD VALUE IF NOT EXISTS 'received';

-- 11. Indexes
CREATE INDEX IF NOT EXISTS idx_grn_source_type ON goods_receipt_notes(source_type);
CREATE INDEX IF NOT EXISTS idx_grn_vendor_id ON goods_receipt_notes(vendor_id);
CREATE INDEX IF NOT EXISTS idx_grn_pr_id ON goods_receipt_notes(pr_id);
CREATE INDEX IF NOT EXISTS idx_po_source_grn_id ON purchase_orders(source_grn_id);
CREATE INDEX IF NOT EXISTS idx_grn_line_pr_line_item_id ON grn_line_items(pr_line_item_id);

COMMIT;
```

**Acceptance criteria:**
- [x] `npm run migrate` no error
- [x] `goods_receipt_notes` has `vendor_id`, `source_type`, `pr_id`
- [x] `grn_line_items` has `pr_line_item_id`, `source_type`
- [x] `purchase_orders` has `source_grn_id`
- [x] `pr_status` enum includes `'received'`
- [x] `chk_grn_source` constraint dropped (absent in `information_schema.table_constraints`)
- [x] `chk_grn_line_source` constraint dropped
- [x] All existing GRN rows have `source_type` set (no nulls)

---

## TASK-2 (paku) — POST /api/grn — Standalone GRN creation

**File**: `app/api/grn/route.ts` — READ current file first, then ADD POST handler. Do not break existing GET.

**Auth**: `assertRole(u, ['manager', 'admin'])`

**Zod schema**:
```typescript
const standaloneGRNSchema = z.object({
  vendor_id: z.string().uuid(),
  warehouse_id: z.string().uuid(),
  received_date: z.string().optional(),
  notes: z.string().optional(),
  lines: z.array(z.object({
    product_id: z.string().uuid(),
    qty_received: z.number().positive(),
    unit_cost: z.number().positive(),
  })).min(1),
});
```

**Transaction logic**:
```
BEGIN
  1. next_doc_number('GRN', 'seq_grn')
  2. INSERT goods_receipt_notes (grn_number, warehouse_id, vendor_id, source_type='standalone',
       status='stocked', received_date, notes, created_by,
       po_id=NULL, inbound_order_id=NULL, pr_id=NULL)
  3. For each line:
       INSERT grn_line_items (grn_id, product_id, qty_received, unit_cost,
         source_type='standalone', po_line_item_id=NULL, pr_line_item_id=NULL)
       -- NOTE: do NOT insert line_total (GENERATED column)
       INSERT stock_ledger (product_id, warehouse_id, direction='in', qty=qty_received,
         unit_cost, reference_type='grn', reference_id=grn_id, created_by)
COMMIT
```

Return: `apiSuccess({ grn_id, grn_number }, 201)`

**Acceptance criteria:**
- [x] POST with valid body → 201, `{ grn_id, grn_number }`
- [x] `grn.source_type = 'standalone'`, `grn.status = 'stocked'`
- [x] `stock_ledger` has one row per line with `direction='in'`
- [x] `grn_line_items.line_total` NOT in INSERT (generated)
- [x] POST without `vendor_id` → 400
- [x] POST by staff → 403

---

## TASK-3 (paku) — POST /api/grn/[id]/create-po — Retrospective PO

**File**: `app/api/grn/[id]/create-po/route.ts` (new file)

**Auth**: `assertRole(u, ['manager', 'admin'])`

**Zod schema**:
```typescript
const createPOFromGRNSchema = z.object({
  vendor_id: z.string().uuid(),
  payment_terms_days: z.number().int().nonnegative().optional().default(0),
  notes: z.string().optional(),
});
```

**Guards (before transaction)**:
- GRN not found → 404
- `grn.status !== 'stocked'` → `apiError('GRN must be stocked', 422)`
- `grn.po_id IS NOT NULL` → `apiError('GRN already linked to a PO', 409)`
- `grn.source_type IN ('po', 'inbound_order')` → `apiError('Cannot create retrospective PO from PO-sourced GRN', 422)`

**Transaction logic**:
```
BEGIN
  1. Fetch grn_line_items WHERE grn_id = $id
  2. Compute: subtotal = SUM(line_total), vat = subtotal * VAT_RATE, total = subtotal + vat
     (import VAT_RATE from lib/constants.ts — never hardcode 0.07)
  3. next_doc_number('PO', 'seq_po')
  4. INSERT purchase_orders (po_number, vendor_id, warehouse_id=grn.warehouse_id,
       status='fully_received', source_grn_id=grn.id, subtotal, vat_amount, total_amount,
       payment_terms_days, notes, created_by)
  5. For each grn_line: INSERT po_line_items (po_id, product_id,
       qty_ordered=qty_received, unit_price=unit_cost,
       -- DO NOT insert line_total (generated), DO NOT insert line_discount (defaults to 0)
       line_number)
COMMIT
```

**NO stock_ledger INSERT** — goods already received in TASK-2.

Return: `apiSuccess({ po_id, po_number })`

**Acceptance criteria:**
- [x] POST on stocked standalone GRN → 200, `{ po_id, po_number }`
- [x] `purchase_orders.status = 'fully_received'`
- [x] `purchase_orders.source_grn_id = grn.id`
- [x] `po_line_items` row count matches GRN line count
- [x] No new `stock_ledger` rows
- [x] POST on GRN with `po_id` already set → 409
- [x] POST on GRN `status = 'draft'` → 422
- [x] POST on `source_type = 'po'` GRN → 422

---

## TASK-4 (paku) — POST /api/purchase-requisitions/[id]/receive — PR→GR direct

**File**: `app/api/purchase-requisitions/[id]/receive/route.ts` (new file)

**Auth**: `assertRole(u, ['manager', 'admin'])`

**Zod schema**:
```typescript
const prReceiveSchema = z.object({
  vendor_id: z.string().uuid().optional(),
  notes: z.string().optional(),
  lines: z.array(z.object({
    pr_line_item_id: z.string().uuid(),
    qty_received: z.number().positive(),
    unit_cost: z.number().positive(),
  })).min(1),
});
```

**Guards**:
- PR not found → 404
- `pr.status !== 'admin_approved'` → `apiError('PR must be admin_approved', 422)`
- Any `pr_line_item_id` in body not belonging to this PR → 422

**Transaction logic**:
```
BEGIN
  1. next_doc_number('GRN', 'seq_grn')
  2. INSERT goods_receipt_notes (grn_number, warehouse_id=pr.warehouse_id, vendor_id,
       source_type='pr_direct', status='stocked', pr_id=pr.id,
       po_id=NULL, inbound_order_id=NULL, notes, created_by)
  3. For each line in body:
       INSERT grn_line_items (grn_id, product_id=lookup from pr_line_item,
         qty_received, unit_cost, source_type='pr_direct',
         pr_line_item_id, po_line_item_id=NULL)
       INSERT stock_ledger (product_id, warehouse_id, direction='in', qty=qty_received,
         unit_cost, reference_type='grn', reference_id=grn_id, created_by)
  4. UPDATE purchase_requisitions SET status = 'received' WHERE id = pr.id
COMMIT
```

**Note**: To get `product_id` per line, JOIN `pr_line_items` on `pr_line_item_id`.

Return: `apiSuccess({ grn_id, grn_number })`

**Acceptance criteria:**
- [x] POST on `admin_approved` PR → 200, `{ grn_id, grn_number }`
- [x] `pr.status = 'received'` after call
- [x] `grn.source_type = 'pr_direct'`, `grn.pr_id = pr.id`
- [x] `grn_line_items.pr_line_item_id` set for each line
- [x] `stock_ledger` rows created
- [x] POST on `draft` PR → 422
- [x] POST on already-`received` PR → 422 (idempotency guard)
- [x] Staff → 403

---

## TASK-5 (puka) — New page: /app/purchasing/goods-receipt/new

**File**: `app/app/purchasing/goods-receipt/new/page.tsx` (new file)

Read `app/app/purchasing/goods-receipt/page.tsx` first to understand existing list structure.

**UI elements**:
- Page title: "รับสินค้า (ไม่มี PO)"
- Vendor search (async: `GET /api/vendors?search={q}&limit=10`)
- Warehouse selector (`GET /api/admin/warehouses`)
- Received date (type="date", default today)
- Notes textarea
- Line items table: product search | qty_received | unit_cost | line_total (computed) | delete
- "บันทึกรับสินค้า" button

**On submit**: POST `/api/grn` → redirect to `/app/purchasing/goods-receipt/{grn_id}`

**Acceptance criteria:**
- [x] Page renders, no TS error
- [x] Cannot submit without vendor or without ≥1 line
- [x] On success: redirect to detail page
- [x] `npx tsc --noEmit` passes
- [x] `npm run lint` passes

---

## TASK-6 (puka) — GRN detail: "สร้าง PO จาก GR นี้" button

**File**: `app/app/purchasing/goods-receipt/[id]/page.tsx` — READ before editing

**Show button when**: `grn.source_type === 'standalone' || grn.source_type === 'pr_direct'` AND `grn.status === 'stocked'` AND `grn.po_id === null`

**Modal fields**: vendor_id (required if `grn.vendor_id` is null, pre-filled otherwise), payment_terms_days, notes

**On confirm**: POST `/api/grn/{id}/create-po` → show "สร้าง PO เลขที่ {po_number} แล้ว" toast

**Acceptance criteria:**
- [x] Button visible only when conditions met
- [x] Button absent for `source_type = 'po'` or `source_type = 'inbound_order'` GRNs
- [x] After success: PO number shown on page
- [x] `npx tsc --noEmit` passes

---

## TASK-7 (puka) — PR detail: "รับสินค้าตาม PR" button

**File**: `app/app/purchasing/purchase-requisitions/[id]/page.tsx` — READ before editing

**Show button when**: `pr.status === 'admin_approved'`

**Modal**: optional vendor selector, per-line table (product name from PR, qty_received input prefilled from `qty_requested`, unit_cost input required), notes

**On confirm**: POST `/api/purchase-requisitions/{id}/receive` → redirect to `/app/purchasing/goods-receipt/{grn_id}`

**Status label addition**:
```typescript
case 'received': return { label: 'รับสินค้าแล้ว', color: 'bg-blue-100 text-blue-800' };
```

**Acceptance criteria:**
- [x] Button visible for `admin_approved` only
- [x] `'received'` status renders "รับสินค้าแล้ว" badge
- [x] On success: redirect to GRN detail
- [x] `npx tsc --noEmit` passes

---

## TASK-8 (puka) — PR list: add 'received' status badge

**File**: `app/app/purchasing/purchase-requisitions/page.tsx` — READ before editing

Add `'received'` to whatever status → color/label mapping exists.

**Acceptance criteria:**
- [x] `'received'` PRs show badge (no fallback/unknown)
- [x] `npx tsc --noEmit` passes

---

## TASK-9 (paku) — Extend types/index.ts

**File**: `types/index.ts` — READ before editing. Append these interfaces:

```typescript
export type GrnSourceType = 'po' | 'inbound_order' | 'standalone' | 'pr_direct';

// Extend existing GrnStatus if it exists, otherwise add:
export type GrnStatus = 'draft' | 'received' | 'qc_passed' | 'qc_failed' | 'stocked';

// Append to types/index.ts:
export interface GRNLine {
  id: string;
  grn_id: string;
  product_id: string;
  sku: string;
  name_th: string;
  qty_received: number;
  unit_cost: number;
  line_total: number;
  po_line_item_id: string | null;
  pr_line_item_id: string | null;
  source_type: GrnSourceType;
}

export interface GRNDetail {
  id: string;
  grn_number: string;
  source_type: GrnSourceType;
  status: GrnStatus;
  vendor_id: string | null;
  vendor_name: string | null;
  warehouse_id: string;
  warehouse_name: string;
  po_id: string | null;
  po_number: string | null;
  pr_id: string | null;
  pr_number: string | null;
  received_date: string | null;
  notes: string | null;
  created_by: string;
  created_at: string;
  lines: GRNLine[];
}
```

**Do not** define these inline in route files or page files.

**Acceptance criteria:**
- [x] Types exported from `types/index.ts`
- [x] No duplicate definitions across files
- [x] `npx tsc --noEmit` passes project-wide

---

## Execution Order

```
TASK-1 (migration) → npm run migrate
TASK-9 (types)     ← do before UI tasks
TASK-2 (api-grn)   ← needs TASK-1
TASK-3 (api-create-po) ← needs TASK-1
TASK-4 (api-pr-receive) ← needs TASK-1
TASK-5 (ui-grn-new) ← needs TASK-2, TASK-9
TASK-6 (ui-grn-detail) ← needs TASK-3, TASK-9
TASK-7 (ui-pr-detail) ← needs TASK-4, TASK-9
TASK-8 (ui-pr-list) ← standalone
```

After all tasks: `npm run lint` + `npx tsc --noEmit`. Fix all errors before marking Completed.

---

## QA Checklist

### Schema
- [ ] Migration 035 runs clean
- [ ] `goods_receipt_notes`: has `vendor_id`, `source_type` (NOT NULL), `pr_id`
- [ ] `grn_line_items`: has `pr_line_item_id`, `source_type` (NOT NULL)
- [ ] `purchase_orders`: has `source_grn_id`
- [ ] `pr_status` includes `'received'`
- [ ] `chk_grn_source` absent from `information_schema.table_constraints`
- [ ] `chk_grn_line_source` absent
- [ ] All existing GRN rows have `source_type` backfilled

### API — POST /api/grn (standalone)
- [ ] 201 + `{ grn_id, grn_number }` on valid body
- [ ] `source_type = 'standalone'`, `status = 'stocked'`
- [ ] `stock_ledger` row per line, `direction='in'`
- [ ] `line_total` NOT in grn_line_items INSERT
- [ ] 400 without `vendor_id`
- [ ] 403 for staff

### API — POST /api/grn/[id]/create-po
- [ ] 200 + `{ po_id, po_number }` on valid stocked standalone GRN
- [ ] `po.status = 'fully_received'`, `po.source_grn_id = grn.id`
- [ ] `po_line_items` count matches GRN lines
- [ ] NO new stock_ledger rows
- [ ] 409 if GRN already has po_id
- [ ] 422 if GRN status not stocked
- [ ] 422 if GRN source_type = 'po'

### API — POST /api/purchase-requisitions/[id]/receive
- [ ] 200 + `{ grn_id, grn_number }` on admin_approved PR
- [ ] `pr.status = 'received'`
- [ ] `grn.source_type = 'pr_direct'`, `grn.pr_id = pr.id`
- [ ] `grn_line_items.pr_line_item_id` set
- [ ] 422 on non-admin_approved PR
- [ ] 422 if PR already received (idempotency)
- [ ] 403 for staff

### UI
- [ ] `/purchasing/goods-receipt/new` renders, validates, submits, redirects
- [ ] "สร้าง PO" button on GRN detail shows only for correct source_type + conditions
- [ ] "รับสินค้าตาม PR" button on PR detail shows only for admin_approved
- [ ] `'received'` status badge renders in both PR list and PR detail
- [ ] `GrnSourceType`, `GRNLine`, `GRNDetail` defined in `types/index.ts` only
- [ ] No `any` types in new files
- [ ] `npx tsc --noEmit` passes project-wide
- [ ] `npm run lint` passes

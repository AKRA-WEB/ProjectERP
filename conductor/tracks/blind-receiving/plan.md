---
track: blind-receiving
phase: V2.0-P1
sequence: 12
status: planned
owner: Chen
created: 2026-05-23
depends_on: []
estimate: M
assigned_to: [Paku, Puka]
tags: [v2-orion, wms, grn, blind-receive]
---

# Blind Receiving

## Goal
Allow receivers (role: staff) to record what arrived without seeing the PO ordered quantities, eliminating the "fill the box to match" bias. The manager later assembles the final GR by reviewing all blind receipts.

## Scope IN
- New column `purchase_orders.blind_receiving BOOLEAN DEFAULT false`.
- When `blind_receiving=true`: GRN UI hides `qty_ordered`, `qty_expected`, and any PO-aware fields for users with role `staff`.
- Supervisor view always shows everything.
- New `blind_receiving` flag also propagated to `grn_headers` so audit trails remain consistent if the PO flag changes later.
- Per-vendor default toggle for repeat blind-receive vendors (`vendors.default_blind_receiving`).

## Scope OUT
- Per-line blind flag — header-level only in V2.0.
- Multi-receiver mode (two staff receiving the same delivery simultaneously). Future revision.

## Acceptance Criteria
1. With `blind_receiving=true`, a staff user sees only `sku, product_name, uom, qty_input` in the GRN form.
2. Manager/admin sees ordered qty + variance even on blind receipts.
3. `grn_headers.blind_receiving` snapshots the PO flag at GRN creation time.
4. Toggling vendor default carries through to new PO creation forms.
5. `npm run lint` and `npx tsc --noEmit` pass.

## Migrations
- `051_blind_receiving_flag.sql` — add column to `purchase_orders`, mirror column on `grn_headers`, add `vendors.default_blind_receiving`.

## API routes
- Touched: `app/api/purchase-orders/route.ts` (accept flag).
- Touched: `app/api/grn/route.ts` (snapshot flag).
- Touched: `app/api/grn/[id]/route.ts` GET — strips ordered fields based on role+flag.

## UI screens
- Touched: PO create form — blind-receiving toggle.
- Touched: GRN receive form — conditional hide.
- Touched: Vendor edit form — `default_blind_receiving` toggle.

## Test plan
- Manual: create blind PO, receive as staff (verify hidden), confirm as manager (verify visible).
- Lint + tsc.

## Risks
- API response shape changes between roles — front-end TypeScript types must allow optional fields.
- Existing GRN screens may have inline calculations referencing `qty_ordered`; audit thoroughly.

## Verified Facts (pre-plan)
- `purchase_orders` table exists (UUID id, vendor_id, warehouse_id, status po_status) — `migrations/005_pr_po.sql:56`.
- GRN tables: `goods_receipt_notes` (referenced by `po_invoices.grn_id` in `migrations/031_ap_system.sql:13`). Verify exact column list via `Read migrations/006_grn.sql`.
- GRN routes: `app/api/grn/route.ts`, `app/api/grn/[id]/route.ts`, `app/api/grn/[id]/receive/route.ts`, etc.
- PO routes: `app/api/purchase-orders/route.ts`, `app/api/purchase-orders/[id]/route.ts`.

---

## Tasks

### T1 — Migration `051_blind_receiving_flag.sql`
**File:** `migrations/051_blind_receiving_flag.sql` (new)
**Operation:** add migration

**Details:**
- Wrap in `BEGIN; ... COMMIT;`:
  1. `ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS blind_receiving BOOLEAN NOT NULL DEFAULT FALSE;`
  2. `ALTER TABLE goods_receipt_notes ADD COLUMN IF NOT EXISTS blind_receiving BOOLEAN NOT NULL DEFAULT FALSE;` (snapshot of PO flag at GRN creation).
  3. `ALTER TABLE vendors ADD COLUMN IF NOT EXISTS default_blind_receiving BOOLEAN NOT NULL DEFAULT FALSE;`

**Quality Gate:**
- Transaction boundary: `BEGIN`/`COMMIT`.
- Doc number generation: N/A.
- Parent→child inserts: N/A.
- Side effects: none.
- Response shape: N/A.

- [ ] T1 complete

### T2 — Extend `POST /api/purchase-orders`
**File:** `app/api/purchase-orders/route.ts`
**Operation:** extend

**Details:**
- Zod: add `blind_receiving: z.boolean().optional()` (default reads from `vendors.default_blind_receiving` if not provided).
- Parent INSERT includes `blind_receiving`.

**Quality Gate:**
- Transaction boundary: existing `BEGIN`/`COMMIT` preserved.
- Doc number generation: existing `next_doc_number('PO','seq_po')`.
- Parent→child inserts: existing parent → po_line_items preserved.
- Side effects: existing.
- Response shape: `apiSuccess({ purchase_order })` with new field.

- [ ] T2 complete

### T3 — Extend `POST /api/grn`
**File:** `app/api/grn/route.ts`
**Operation:** extend

**Details:**
- On GRN creation, snapshot the PO flag: `SELECT blind_receiving FROM purchase_orders WHERE id=$1` and INSERT into `goods_receipt_notes.blind_receiving` accordingly.

**Quality Gate:**
- Transaction boundary: existing `BEGIN`/`COMMIT` preserved.
- Doc number generation: existing `next_doc_number('GRN','seq_grn')`.
- Parent→child inserts: parent grn → grn_lines preserved.
- Side effects: existing.
- Response shape: existing + `blind_receiving`.

- [ ] T3 complete

### T4 — Extend `GET /api/grn/[id]` to strip ordered fields
**File:** `app/api/grn/[id]/route.ts`
**Operation:** extend

**Details:**
- After SELECT, when `grn.blind_receiving = TRUE` AND `u.role = 'staff'` → set every line's `ordered_qty` / `qty_ordered` / `expected_qty` (whatever the actual column names are — verify via Read of route) to `null` before returning.

**Quality Gate:**
- Transaction boundary: N/A (read).
- Doc number generation: N/A.
- Parent→child inserts: N/A.
- Side effects: none.
- Response shape: `apiSuccess({ grn, lines })` — fields stripped per role/flag.

- [ ] T4 complete

### T5 — Manager-compile GR UI
**File:** locate via `Glob "app/wms/grn/**"` or extend `app/app/grn/[id]/page.tsx`
**Operation:** extend

**Details:**
- Manager view sees `ordered_qty` + per-receipt variance for each blind GRN row.
- Add "Compile Final GR" action button that finalises lines after manager review (uses existing GRN confirm endpoint).

**Quality Gate:** N/A (UI).

- [ ] T5 complete

### T6 — UI toggles
**File:** PO new/edit page (`app/app/purchase-orders/new/page.tsx` etc.) + Vendor edit form + GRN receive form
**Operation:** extend

**Details:**
- PO create form: checkbox "Blind receiving" (visible only to manager/admin).
- Vendor edit form: checkbox "Default blind receiving".
- GRN receive form: hide ordered_qty column when `blind_receiving && role==='staff'`.

**Quality Gate:** N/A (UI).

- [ ] T6 complete

### T7 — Update `current-state.md`
**File:** `_notes/02_Agent_Memory/current-state.md`
**Operation:** extend

**Details:** `purchase_orders.blind_receiving`, `goods_receipt_notes.blind_receiving`, `vendors.default_blind_receiving`. Migration → 051.

- [ ] T7 complete

## Definition of Done

- [ ] T1..T7 ticked
- [ ] `npm run lint` + `npx tsc --noEmit` pass
- [ ] Manual smoke: PO with `blind_receiving=true` → staff sees no ordered_qty; manager sees all
- [ ] Migration idempotent
- [ ] `_notes/02_Agent_Memory/current-state.md` updated
- [ ] Status set to `Completed`

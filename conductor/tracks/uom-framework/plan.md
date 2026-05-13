# UoM Framework Implementation

**Full spec:** `docs/superpowers/specs/2026-05-13-uom-framework-design.md`  
**Full plan:** `docs/superpowers/plans/2026-05-13-uom-framework.md`

---

## Architecture Summary

- New global `uom_conversions` table: `1 CTN = 48 PCS` defined once, applies to all products
- `units_of_measure` gets 4 new columns: `is_base_unit`, `is_integer_unit`, `barcode_label`, `sort_order`
- `product_uom` repurposed: drop `conversion_factor` (→ global table), add `barcode_label`
- 7 transaction line tables gain `transaction_uom_id + transaction_qty + base_qty`
- PostgreSQL trigger `fn_fill_line_base_qty()` auto-computes `base_qty` on every INSERT/UPDATE
- `NULL transaction_uom_id` = legacy row → all existing flows unaffected
- GRN stocking auto-syncs `products.unit_cost` to base-unit cost (price ÷ factor)
- Admin UI at `/app/admin/uom` for managing UoMs + conversion rules

---

## Critical: Fix Existing Broken Code First

Migration 026 drops `product_uom.conversion_factor`. Three files reference it and will crash after migration:
- `lib/validations/bom.ts` — `CreateProductUomSchema` and `PatchProductUomSchema`
- `app/api/products/[id]/uom/route.ts` — POST INSERT uses `conversion_factor`
- `app/api/products/[id]/uom/[uomId]/route.ts` — PATCH sets `conversion_factor`

**Fix these files in Task 2 immediately after running the migration.**

---

## Tasks

### Task 1 — Migration 026
- [x] Create `migrations/026_uom_framework.sql` (full SQL in plan §Task 1)
- [x] Run `npm run migrate`
- [x] Verify: `SELECT code, is_base_unit, is_integer_unit FROM units_of_measure;` shows seeded flags
- [x] Verify: `SELECT * FROM uom_conversions;` returns empty table (no errors)
- [x] Verify: `\d product_uom` shows NO `conversion_factor` column
- [x] Verify: `\d grn_line_items` shows `transaction_uom_id`, `transaction_qty`, `base_qty`
- [x] Commit: `feat(uom): migration 026 — uom_conversions, multi-UoM columns, conversion engine triggers`

### Task 2 — Fix Broken Code (conversion_factor references)
- [x] Update `lib/validations/bom.ts`: remove `conversion_factor` from `CreateProductUomSchema` and `PatchProductUomSchema`, add `barcode_label` field (see plan §Task 2 Step 1)
- [x] Update `app/api/products/[id]/uom/route.ts` POST: replace INSERT — remove `conversion_factor`, add `barcode_label`; update GET query to JOIN `uom_conversions` and return `factor`, `base_uom_code` (see plan §Task 2 Step 2)
- [x] Update `app/api/products/[id]/uom/[uomId]/route.ts` PATCH: remove `conversion_factor` block, add `barcode_label` (see plan §Task 2 Step 3)
- [x] Run `grep -rn "conversion_factor" app/ lib/` → must return zero matches
- [x] Run `npm run lint` → no errors
- [x] Commit: `fix(uom): remove conversion_factor from product_uom — moved to global uom_conversions`

### Task 3 — TypeScript Types
- [x] Append to `types/index.ts`: `UnitOfMeasure`, `UomConversion`, `ProductUom` interfaces (see plan §Task 3 Step 1)
- [x] Run `npm run lint` → no errors
- [x] Commit: `feat(uom): add UnitOfMeasure, UomConversion, ProductUom types`

### Task 4 — Update GET /api/products/uom
- [x] Replace `app/api/products/uom/route.ts` GET query: JOIN `uom_conversions` to return `factor`, `base_uom_id`, `base_uom_code`, plus all new `units_of_measure` columns (see plan §Task 4)
- [x] Run `npm run lint` → no errors
- [x] Commit: `feat(uom): products/uom GET returns is_base_unit, conversion data`

### Task 5 — Admin API — UoM CRUD
- [x] Create `app/api/admin/uom/route.ts` (GET all UoMs with conversions, POST create UoM — see plan §Task 5 Step 1)
- [x] Create `app/api/admin/uom/[id]/route.ts` (PATCH edit, DELETE with referential checks — see plan §Task 5 Step 2)
- [x] Run `npm run lint` → no errors
- [x] Commit: `feat(uom): admin API — UoM CRUD`

### Task 6 — Admin API — Conversions CRUD
- [x] Create `app/api/admin/uom/conversions/route.ts` (GET list, POST create — see plan §Task 6 Step 1)
- [x] Create `app/api/admin/uom/conversions/[id]/route.ts` (DELETE — see plan §Task 6 Step 2)
- [x] Run `npm run lint` → no errors
- [x] Commit: `feat(uom): admin API — conversions CRUD`

### Task 7 — Admin UI Page
- [x] Create `app/app/admin/uom/page.tsx` (full React component — see plan §Task 7 Step 1)
- [x] Start `npm run dev`, open `http://localhost:3000/app/admin/uom`
- [x] Verify: UoM table loads, shows `is_base_unit` badges, existing units visible
- [x] Verify: "เพิ่มหน่วย" modal — create a new UoM → appears in table
- [x] Verify: "เพิ่ม Conversion" modal — create "1 CTN = 48 PCS" → formula row appears
- [x] Verify: delete buttons work (with confirmation)
- [x] Commit: `feat(uom): admin UI — UoM master + conversion rules CRUD`

### Task 8 — Sidebar
- [x] In `components/layout/Sidebar.tsx` admin nav group, add `{ href: '/app/admin/uom', label: 'หน่วยนับ / UoM', icon: Scale, roles: ['admin'] }` (see plan §Task 8; `Scale` icon already imported)
- [x] Verify sidebar shows new link
- [x] Commit: `feat(uom): add UoM link to admin sidebar`

### Task 9 — GRN Stocking Valuation Sync
- [x] Modify `app/api/grn/[id]/stock/route.ts`:
  - Update lines query to also fetch `li.base_qty`, `li.transaction_uom_id`, `pol.unit_price AS po_unit_price` (see plan §Task 9 Step 1)
  - Add cost computation block inside the `for` loop: lookup `uom_conversions.factor`, compute `costPerBaseUnit = po_unit_price / factor`, UPDATE `products.unit_cost` (see plan §Task 9 Steps 2–3)
  - Use `effectiveQty = base_qty ?? qty_accepted` for lot INSERT, ledger INSERT, `qty_received` UPDATE, and `qtyAfter`
- [x] Run `npm run lint` → no errors
- [x] Commit: `feat(uom): GRN stocking — auto-sync unit_cost to base-unit cost, use base_qty for ledger`

### Task 10 — GRN Label Endpoint
- [x] Create `app/api/grn/[id]/labels/route.ts` (GET — returns label data per line, optional `?lineId=` filter — see plan §Task 10)
- [x] Run `npm run lint` → no errors
- [x] Test: `GET /api/grn/<id>/labels` returns array with `product_sku`, `base_qty`, `base_uom_code`, `barcode_label`, etc.
- [x] Commit: `feat(uom): GRN label endpoint for bin location label printing`

### Task 11 — Cycle Count UoM Input
- [x] Modify `app/api/cycle-counts/[id]/route.ts`:
  - Extend `countSchema` to accept optional `counting_uom_id` + `counting_qty_input` per line (see plan §Task 11 Part A)
  - Update the `submit_counts` UPDATE SQL to include these fields (DB trigger auto-converts `qty_counted`)
  - Update GET query to return `counting_uom_id`, `counting_qty_input`, `base_uom_id`
- [x] Modify `app/app/cycle-counts/[id]/page.tsx`:
  - Extend `CountedLineState` + `CycleCountLine` interfaces (see plan §Task 11 Part B Step 2)
  - Fetch product UoMs per line from `/api/products/:id/uom` and store in `productUoms` state
  - Add UoM selector dropdown + `counting_qty_input` field + conversion preview "= N PCS" (see plan §Task 11 Part B Steps 3–4)
  - Update submit to pass `counting_uom_id` + `counting_qty_input` when UoM is set
- [x] Run `npm run lint` → no errors
- [x] Test: open a cycle count in counting mode, select CTN for a line, enter 5 → preview shows "= 240 PCS" → submit → `qty_counted` = 240
- [x] Commit: `feat(uom): cycle count — counting UoM selector with base-qty conversion preview`

---

## Phase 2 (separate plan — not in scope here)

Transaction form UoM selectors — PR/PO create form, SO/DO create form, Transfer form. DB columns already exist; these are UI-only follow-ons.

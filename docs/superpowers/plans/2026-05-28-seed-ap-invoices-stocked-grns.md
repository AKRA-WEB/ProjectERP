# Seed AP Invoices + Stocked GRNs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend `lib/db/seed.js` to create stocked GRNs and matching `po_invoices` rows so that the GRN-reversal flow, three-way match queue, and purchase VAT report can all be exercised end-to-end with seeded data.

**Architecture:** Add one new idempotent seed function `seedStockedGrnsAndInvoices` to the existing `lib/db/seed.js` file. The function creates two fully-received POs → two stocked GRNs → two AP invoices (one `matched`, one `mismatched`). Because the three-way match trigger `reconcile_po_invoice` fires automatically on `po_invoices INSERT`, match_status is set by the DB — the seed only controls the `amount` value to produce the desired match outcome.

**Tech Stack:** Node.js (CommonJS), `pg` Pool, raw SQL parameterised queries, PostgreSQL enums (`grn_status`, `grn_source_type`, `match_status`, `po_status`, `ledger_entry_type`)

---

## Context

### Why these gaps exist

`seedPurchaseFlow` creates GRNs in `received` and `qc_passed` status only — it models the mid-workflow state. No GRN ever reaches `stocked`, so:
- `POST /api/grn/[id]/cancel` always returns 409 ("only 'stocked' GRNs can be reversed")
- `GET /api/accounting/vat/purchase` returns empty rows (query filters on `grn.stocked_at IS NOT NULL`)
- `GET /api/ap/match-queue` returns empty rows (no `po_invoices` exist)

### What the GRN cancel API needs (verified from source)

`app/api/grn/[id]/cancel/route.ts` checks in order:
1. `status = 'stocked'` — hard 409 otherwise
2. `stocked_at IS NOT NULL` — hard 500 otherwise
3. No paid linked AP invoices (`is_paid = FALSE`) — hard 422 otherwise
4. No `pos_sale / so_delivery / transfer_out` stock_ledger entries after `stocked_at` for product+warehouse — hard 422 `CONSUMPTION_EXISTS`
5. `stock_balances.qty_on_hand >= effective_qty` per line — hard 422 `INSUFFICIENT_STOCK`

### What the purchase VAT query needs (verified from source)

`app/api/accounting/vat/purchase/route.ts` dynamic query:
```sql
FROM po_invoices pi
JOIN goods_receipt_notes grn ON grn.id = pi.grn_id
JOIN vendors v ON v.id = pi.vendor_id
WHERE EXTRACT(YEAR FROM grn.stocked_at) = $1
  AND EXTRACT(MONTH FROM grn.stocked_at) = $2
```
→ Requires `po_invoices.grn_id` to point to a GRN with `stocked_at` set.

### Three-way match trigger logic (verified from migration 070)

`reconcile_po_invoice()` fires BEFORE INSERT on `po_invoices`:
- Computes `gr_total = SUM(COALESCE(NULLIF(gli.qty_accepted,0), gli.qty_received) * pli.unit_price)` from `grn_line_items JOIN po_line_items`
- If `NEW.amount = gr_total` → `match_status = 'matched'`
- Else → `match_status = 'mismatched'` + variance inserted into `po_invoice_match_variances`

The seed controls `amount` only; `match_status` is DB-computed.

---

## What will be created

| Object | Details |
|--------|---------|
| PO-SEED-004 | VEND-003 (Senior Package), PKG-002 ×100 @฿12, W2, `fully_received` |
| GRN-SEED-003 | Stocked, W2, PKG-002 ×100, `stocked_at = NOW() - 3 days` |
| stock_ledger #A | `grn_receipt`, PKG-002@W2, +100, reference=GRN-SEED-003 |
| INV-SEED-VEND003-001 | `po_invoices`, amount=฿1,200, **matched** (=100×12) |
| PO-SEED-005 | VEND-004 (Express Food), BEV-001 ×50 @฿95, W2, `fully_received` |
| GRN-SEED-004 | Stocked, W2, BEV-001 ×50, `stocked_at = NOW() - 5 days` |
| stock_ledger #B | `grn_receipt`, BEV-001@W2, +50, reference=GRN-SEED-004 |
| INV-SEED-VEND004-001 | `po_invoices`, amount=฿5,200, **mismatched** (GRN total=฿4,750) → match queue |

After seed:
- Purchase VAT report for current month → 2 lines: INV-SEED-VEND003-001 (฿1,200) + INV-SEED-VEND004-001 (฿5,200)
- AP match-queue → 1 item (INV-SEED-VEND004-001, variance ฿450)
- GRN reversal → GRN-SEED-003 is immediately reversible (no outbound movements, no paid invoices, sufficient stock)

---

## File Structure

| File | Change |
|------|--------|
| `lib/db/seed.js` | Add `seedStockedGrnsAndInvoices(users, wh, uoms)` function + call it in `main()` |

No other files change.

---

## Task 1: Add `seedStockedGrnsAndInvoices` to `lib/db/seed.js`

**Files:**
- Modify: `lib/db/seed.js`

### Step 1.1: Read the current end of `lib/db/seed.js`

Before editing, read the file to confirm the exact text around `seedBomAndRebate` and `main()` so you know where to insert.

- [ ] **Read `lib/db/seed.js` lines 860–966** to confirm the insertion point.

### Step 1.2: Add `seedStockedGrnsAndInvoices` function before `main()`

Insert the following function at line ~934 (just before `async function main()`). Preserve all existing code exactly.

- [ ] **Insert the following function** into `lib/db/seed.js` directly before `async function main() {`:

```js
async function seedStockedGrnsAndInvoices(users, wh, uoms) {
  // Idempotency guard: check if this seed block already ran
  const guard = await q(
    `SELECT id FROM po_invoices WHERE invoice_number='INV-SEED-VEND003-001' LIMIT 1`
  );
  if (guard.length) { log('stocked GRNs + AP invoices (skipped — already seeded)', 0); return; }

  const vRows = await q(`SELECT id, code FROM vendors WHERE code IN ('VEND-003','VEND-004')`);
  const vByCode = Object.fromEntries(vRows.map(v => [v.code, v.id]));
  const pRows = await q(`SELECT id, sku FROM products WHERE sku IN ('PKG-002','BEV-001')`);
  const pBySku = Object.fromEntries(pRows.map(p => [p.sku, p.id]));

  // ── PO-SEED-004: VEND-003, PKG-002 ×100 @12, W2, fully_received ──
  const po4Sub = 100 * 12;   // 1200
  const po4Vat = Math.round(po4Sub * 0.07 * 100) / 100;
  const po4Rows = await q(
    `INSERT INTO purchase_orders (vendor_id, warehouse_id, status, expected_date, payment_terms_days, subtotal, vat_amount, total_amount, created_by)
     VALUES ($1,$2,'fully_received'::po_status, CURRENT_DATE - 4, 45, $3,$4,$5,$6)
     RETURNING id`,
    [vByCode['VEND-003'], wh['W2'], po4Sub, po4Vat, po4Sub + po4Vat, users.manager.id]
  );
  const po4Id = po4Rows[0].id;

  const po4L1Rows = await q(
    `INSERT INTO po_line_items (po_id, product_id, qty_ordered, qty_received, unit_price, line_number)
     VALUES ($1,$2,100,100,12,1) RETURNING id`,
    [po4Id, pBySku['PKG-002']]
  );
  const po4L1Id = po4L1Rows[0].id;

  // ── GRN-SEED-003: stocked, W2, stocked_at = 3 days ago ──
  const grn3Rows = await q(
    `INSERT INTO goods_receipt_notes (po_id, warehouse_id, status, received_by, received_date,
       qc_reviewed_by, qc_reviewed_at, qc_notes,
       stocked_by, stocked_at, notes, source_type)
     VALUES ($1,$2,'stocked'::grn_status,$3,CURRENT_DATE - 3,
       $4, NOW() - interval '2 days','สินค้าผ่าน QC ทั้งหมด',
       $4, NOW() - interval '1 day','SEED: stocked GRN for reversal exercise', 'po'::grn_source_type)
     RETURNING id`,
    [po4Id, wh['W2'], users.staff.id, users.manager.id]
  );
  const grn3Id = grn3Rows[0].id;

  await q(
    `INSERT INTO grn_line_items (grn_id, po_line_item_id, product_id, qty_received, qty_accepted, line_number, source_type)
     VALUES ($1,$2,$3,100,100,1,'po'::grn_source_type)`,
    [grn3Id, po4L1Id, pBySku['PKG-002']]
  );

  // Stock ledger: grn_receipt for GRN-SEED-003 (PKG-002 @W2)
  await q(
    `INSERT INTO stock_ledger (product_id, warehouse_id, entry_type, qty_change, reference_id, created_by)
     VALUES ($1,$2,'grn_receipt',100,$3,$4)`,
    [pBySku['PKG-002'], wh['W2'], grn3Id, users.manager.id]
  );

  // ── PO-SEED-005: VEND-004, BEV-001 ×50 @95, W2, fully_received ──
  const po5Sub = 50 * 95;   // 4750
  const po5Vat = Math.round(po5Sub * 0.07 * 100) / 100;
  const po5Rows = await q(
    `INSERT INTO purchase_orders (vendor_id, warehouse_id, status, expected_date, payment_terms_days, subtotal, vat_amount, total_amount, created_by)
     VALUES ($1,$2,'fully_received'::po_status, CURRENT_DATE - 6, 30, $3,$4,$5,$6)
     RETURNING id`,
    [vByCode['VEND-004'], wh['W2'], po5Sub, po5Vat, po5Sub + po5Vat, users.manager.id]
  );
  const po5Id = po5Rows[0].id;

  const po5L1Rows = await q(
    `INSERT INTO po_line_items (po_id, product_id, qty_ordered, qty_received, unit_price, line_number)
     VALUES ($1,$2,50,50,95,1) RETURNING id`,
    [po5Id, pBySku['BEV-001']]
  );
  const po5L1Id = po5L1Rows[0].id;

  // ── GRN-SEED-004: stocked, W2, stocked_at = 5 days ago ──
  const grn4Rows = await q(
    `INSERT INTO goods_receipt_notes (po_id, warehouse_id, status, received_by, received_date,
       qc_reviewed_by, qc_reviewed_at, qc_notes,
       stocked_by, stocked_at, notes, source_type)
     VALUES ($1,$2,'stocked'::grn_status,$3,CURRENT_DATE - 5,
       $4, NOW() - interval '4 days','สินค้าผ่าน QC ทั้งหมด',
       $4, NOW() - interval '3 days','SEED: stocked GRN for VAT/match-queue exercise', 'po'::grn_source_type)
     RETURNING id`,
    [po5Id, wh['W2'], users.staff.id, users.manager.id]
  );
  const grn4Id = grn4Rows[0].id;

  await q(
    `INSERT INTO grn_line_items (grn_id, po_line_item_id, product_id, qty_received, qty_accepted, line_number, source_type)
     VALUES ($1,$2,$3,50,50,1,'po'::grn_source_type)`,
    [grn4Id, po5L1Id, pBySku['BEV-001']]
  );

  // Stock ledger: grn_receipt for GRN-SEED-004 (BEV-001 @W2)
  await q(
    `INSERT INTO stock_ledger (product_id, warehouse_id, entry_type, qty_change, reference_id, created_by)
     VALUES ($1,$2,'grn_receipt',50,$3,$4)`,
    [pBySku['BEV-001'], wh['W2'], grn4Id, users.manager.id]
  );

  // ── po_invoices ──
  // INV-SEED-VEND003-001: amount=1200 matches GRN-SEED-003 total (100×12=1200) → trigger sets matched
  await q(
    `INSERT INTO po_invoices (po_id, vendor_id, grn_id, invoice_number, invoice_date, due_date, amount, notes)
     VALUES ($1,$2,$3,'INV-SEED-VEND003-001', CURRENT_DATE - 2, CURRENT_DATE + 43, 1200,
             'SEED: matched invoice — GRN-SEED-003 PKG-002 100×12')`,
    [po4Id, vByCode['VEND-003'], grn3Id]
  );

  // INV-SEED-VEND004-001: amount=5200 vs GRN-SEED-004 total (50×95=4750) → trigger sets mismatched → match queue
  await q(
    `INSERT INTO po_invoices (po_id, vendor_id, grn_id, invoice_number, invoice_date, due_date, amount, notes)
     VALUES ($1,$2,$3,'INV-SEED-VEND004-001', CURRENT_DATE - 5, CURRENT_DATE + 25, 5200,
             'SEED: mismatched invoice — vendor overcharged (GRN=4750, inv=5200)')`,
    [po5Id, vByCode['VEND-004'], grn4Id]
  );

  log('purchase_orders (fully_received)', 2);
  log('goods_receipt_notes (stocked)', 2);
  log('stock_ledger (grn_receipt, stocked GRNs)', 2);
  log('po_invoices (1 matched + 1 mismatched)', 2);
}
```

### Step 1.3: Add the function call to `main()`

- [ ] **Edit `main()`** — add the call after `await seedPurchaseFlow(...)`:

Find this block in `main()`:
```js
    await seedPurchaseFlow(users, wh, uoms);
    await seedSalesFlow(users, wh, uoms);
```

Replace with:
```js
    await seedPurchaseFlow(users, wh, uoms);
    await seedStockedGrnsAndInvoices(users, wh, uoms);
    await seedSalesFlow(users, wh, uoms);
```

### Step 1.4: Run the seed

- [ ] **Run:**
```bash
npm run migrate:seed
```

**Expected output includes:**
```
  ✓ purchase_orders (fully_received): 2 row(s)
  ✓ goods_receipt_notes (stocked): 2 row(s)
  ✓ stock_ledger (grn_receipt, stocked GRNs): 2 row(s)
  ✓ po_invoices (1 matched + 1 mismatched): 2 row(s)
```

Or on re-run:
```
  ✓ stocked GRNs + AP invoices (skipped — already seeded): 0 row(s)
```

If the seed fails with a DB error, check:
- `po_status` enum: must include `'fully_received'` — verify with `SELECT enum_range(NULL::po_status)` in psql
- `grn_status` enum: must include `'stocked'` and `'cancelled'` — added by migration 001 and 072 respectively
- `match_status` enum: must include `'pending','matched','mismatched'` — added by migration 051

### Step 1.5: Verify matched/mismatched status via DB query

- [ ] **Run the following query** in psql or via the admin UI to confirm trigger fired correctly:

```sql
SELECT invoice_number, amount, match_status, grn_id
FROM po_invoices
WHERE invoice_number IN ('INV-SEED-VEND003-001','INV-SEED-VEND004-001');
```

**Expected:**
| invoice_number | amount | match_status |
|---|---|---|
| INV-SEED-VEND003-001 | 1200.00 | matched |
| INV-SEED-VEND004-001 | 5200.00 | mismatched |

Also verify `po_invoice_match_variances` has 1 row for the mismatched invoice:
```sql
SELECT v.variance_type, v.po_value, v.gr_value, v.invoice_value
FROM po_invoice_match_variances v
JOIN po_invoices pi ON pi.id = v.po_invoice_id
WHERE pi.invoice_number = 'INV-SEED-VEND004-001';
```

**Expected:** 1 row with `invoice_value = 5200, gr_value = 4750`.

### Step 1.6: Run QA verify

- [ ] **Run:**
```bash
npm run qa:verify
```

**Expected:** 0 errors, 0 warnings (seed.js is plain JS, not TypeScript — linting only).

### Step 1.7: Commit

- [ ] **Stage and commit:**
```bash
git add lib/db/seed.js
git commit -m "feat(seed): add stocked GRNs and AP invoices for GRN reversal, VAT report, and match-queue testing"
```

---

## Task 2: Smoke-test the three features in the browser

> This task is manual verification only. No code changes.

### Step 2.1: Start dev server

- [ ] **Run:**
```bash
npm run dev
```

Login as `manager@wms.local` (password same as other accounts).

### Step 2.2: Test GRN reversal

- [ ] Navigate to **GRN list** (`/grn`).
- [ ] Find a GRN with status `stocked` (notes = "SEED: stocked GRN for reversal exercise").
- [ ] Open it and click the **Cancel / Reverse** button.
- [ ] Enter a reason and confirm.
- [ ] **Expected:** GRN status changes to `cancelled`. No 409/422 errors.

### Step 2.3: Test purchase VAT report

- [ ] Navigate to **Accounting → VAT Report** (`/accounting/vat` or similar).
- [ ] Select current month (May 2026).
- [ ] **Expected:** Table shows 2 rows — INV-SEED-VEND003-001 (฿1,200) and INV-SEED-VEND004-001 (฿5,200).
  - Note: after GRN reversal in step 2.2, INV-SEED-VEND003-001 remains (voided flag is on the invoice record, not removed from VAT query which filters only on `stocked_at`).

### Step 2.4: Test AP match queue

- [ ] Navigate to **AP → Match Queue** (`/ap/match-queue`).
- [ ] **Expected:** 1 row — INV-SEED-VEND004-001 (VEND-004, mismatched, variance ฿450).

---

## Self-Review

**Spec coverage:**
- ✅ Stocked GRN (GRN-SEED-003): created with correct status, stocked_at, grn_line_items, stock_ledger entry
- ✅ AP invoices: 2 rows created (1 matched, 1 mismatched)
- ✅ VAT report: both invoices have `grn.stocked_at` set → appear in dynamic query
- ✅ Match queue: mismatched invoice + variance row auto-created by trigger
- ✅ GRN reversal: GRN-SEED-003 meets all cancel API preconditions (stocked, stocked_at set, no paid invoices, no outbound movements after stocked_at, sufficient stock)

**Placeholder scan:** None found.

**Type consistency:** All column names verified against migrations (005, 006, 031, 035, 051, 070, 072). Enum values verified against 001_enums.sql and relevant migration files.

**Idempotency:** Guard checks `po_invoices.invoice_number = 'INV-SEED-VEND003-001'`. Since POs and GRNs are created before invoices, a partial failure before invoice INSERT would leave orphaned POs/GRNs on re-run. To handle this edge case, the simple fix is to also guard PO creation with `ON CONFLICT DO NOTHING` — but since POs have no natural unique key (no PO number seeded here), the function uses `RETURNING id` without conflict clause. If the seed partially fails, run `npm run migrate:seed` again after fixing the error — orphaned POs are harmless and the `po_invoices` guard will skip the invoice block correctly only after full success. On partial failure before invoices, delete orphaned rows manually or re-seed from a clean DB.

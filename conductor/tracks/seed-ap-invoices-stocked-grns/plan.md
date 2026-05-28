---
track: seed-ap-invoices-stocked-grns
title: "Seed: AP invoices + stocked GRNs for end-to-end testing"
status: Verified
created: 2026-05-28
updated: 2026-05-28
---

# Seed: AP Invoices + Stocked GRNs

## Goal

Extend `lib/db/seed.js` so that GRN reversal, three-way match queue, and purchase VAT report can all be exercised end-to-end with seeded data. Currently no `po_invoices` rows exist and all GRNs are in `received`/`qc_passed` status — making these three features untestable after `npm run migrate:seed`.

## Scope IN

- Add `seedStockedGrnsAndInvoices(users, wh, uoms)` function to `lib/db/seed.js`
- Two new fully-received POs (PO-SEED-004, PO-SEED-005)
- Two stocked GRNs (GRN-SEED-003 with `stocked_at = now-3d`, GRN-SEED-004 with `stocked_at = now-5d`)
- Stock ledger `grn_receipt` entries for both new GRNs
- Two `po_invoices` rows: one matched, one mismatched
- Call the new function in `main()` after `seedPurchaseFlow`
- Full idempotency via `invoice_number` guard

## Scope OUT

- No new migrations
- No UI changes
- No changes to existing seed functions

## Why Each Object Is Needed

| Object | Reason |
|--------|--------|
| Stocked GRN (status=`stocked`, `stocked_at` set) | `POST /api/grn/[id]/cancel` hard-returns 409 for any other status |
| `po_invoices.grn_id → stocked GRN` | Purchase VAT query filters on `grn.stocked_at IS NOT NULL` |
| Matched invoice (`amount = gr_total`) | Proves happy-path; VAT line appears |
| Mismatched invoice (`amount ≠ gr_total`) | Trigger sets `match_status='mismatched'` → row appears in AP match queue |

## Verified Schema Facts

- `goods_receipt_notes` has `stocked_by UUID`, `stocked_at TIMESTAMPTZ`, `notes TEXT`, `source_type grn_source_type NOT NULL` — `migrations/006_grn.sql`, `migrations/035_standalone_grn.sql`
- `grn_line_items.po_line_item_id UUID NOT NULL` — `migrations/006_grn.sql:26`
- `po_invoices` has `vendor_id`, `grn_id`, `invoice_number`, `invoice_date`, `due_date`, `amount`, `match_status` (auto-set by trigger) — `migrations/005_pr_po.sql`, `migrations/031_ap_system.sql`, `migrations/051_strict_receiving_flow.sql`
- Three-way match trigger `reconcile_po_invoice` fires BEFORE INSERT on `po_invoices`; sets `match_status = 'matched'` iff `amount = SUM(qty_accepted * unit_price)` from grn_line_items — `migrations/070_three_way_match_trigger.sql`
- GRN cancel API checks: `status='stocked'`, `stocked_at IS NOT NULL`, no paid invoices, no outbound stock after `stocked_at`, `stock_balances.qty_on_hand >= qty` — `app/api/grn/[id]/cancel/route.ts`
- Purchase VAT query: `JOIN goods_receipt_notes grn ON grn.id = pi.grn_id` filtered by `EXTRACT(YEAR/MONTH FROM grn.stocked_at)` — `app/api/accounting/vat/purchase/route.ts`

## What Will Be Created

| Object | Details |
|--------|---------|
| PO-SEED-004 | VEND-003 (Senior Package), PKG-002 ×100 @฿12, W2, `fully_received` |
| GRN-SEED-003 | Stocked W2, PKG-002 ×100, `stocked_at = NOW() - 1 day` |
| stock_ledger #A | `grn_receipt`, PKG-002@W2, qty=+100, reference=GRN-SEED-003 |
| INV-SEED-VEND003-001 | `po_invoices`, amount=฿1,200 = 100×12 → trigger: **matched** |
| PO-SEED-005 | VEND-004 (Express Food), BEV-001 ×50 @฿95, W2, `fully_received` |
| GRN-SEED-004 | Stocked W2, BEV-001 ×50, `stocked_at = NOW() - 3 days` |
| stock_ledger #B | `grn_receipt`, BEV-001@W2, qty=+50, reference=GRN-SEED-004 |
| INV-SEED-VEND004-001 | `po_invoices`, amount=฿5,200 vs GRN=฿4,750 → trigger: **mismatched** → match queue |

After seed:
- Purchase VAT (May 2026): 2 lines — ฿1,200 + ฿5,200
- AP match-queue: 1 item — INV-SEED-VEND004-001 (variance ฿450)
- GRN reversal: GRN-SEED-003 immediately reversible (no outbound consumption, no paid invoices, stock sufficient)

---

## Tasks

### T1 — Add `seedStockedGrnsAndInvoices` function + wire into `main()`

**File:** `lib/db/seed.js`

- [ ] Insert `seedStockedGrnsAndInvoices(users, wh, uoms)` before `async function main()`. Full body:

```js
async function seedStockedGrnsAndInvoices(users, wh, uoms) {
  const guard = await q(
    `SELECT id FROM po_invoices WHERE invoice_number='INV-SEED-VEND003-001' LIMIT 1`
  );
  if (guard.length) { log('stocked GRNs + AP invoices (skipped — already seeded)', 0); return; }

  const vRows = await q(`SELECT id, code FROM vendors WHERE code IN ('VEND-003','VEND-004')`);
  const vByCode = Object.fromEntries(vRows.map(v => [v.code, v.id]));
  const pRows = await q(`SELECT id, sku FROM products WHERE sku IN ('PKG-002','BEV-001')`);
  const pBySku = Object.fromEntries(pRows.map(p => [p.sku, p.id]));

  // ── PO-SEED-004: VEND-003, PKG-002 ×100 @12, W2, fully_received ──
  const po4Sub = 100 * 12;
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

  // ── GRN-SEED-003: stocked, W2 ──
  const grn3Rows = await q(
    `INSERT INTO goods_receipt_notes (po_id, warehouse_id, status, received_by, received_date,
       qc_reviewed_by, qc_reviewed_at, qc_notes,
       stocked_by, stocked_at, notes, source_type)
     VALUES ($1,$2,'stocked'::grn_status,$3,CURRENT_DATE - 3,
       $4, NOW() - interval '2 days','สินค้าผ่าน QC ทั้งหมด',
       $4, NOW() - interval '1 day','SEED: stocked GRN for reversal exercise','po'::grn_source_type)
     RETURNING id`,
    [po4Id, wh['W2'], users.staff.id, users.manager.id]
  );
  const grn3Id = grn3Rows[0].id;

  await q(
    `INSERT INTO grn_line_items (grn_id, po_line_item_id, product_id, qty_received, qty_accepted, line_number, source_type)
     VALUES ($1,$2,$3,100,100,1,'po'::grn_source_type)`,
    [grn3Id, po4L1Id, pBySku['PKG-002']]
  );
  await q(
    `INSERT INTO stock_ledger (product_id, warehouse_id, entry_type, qty_change, reference_id, created_by)
     VALUES ($1,$2,'grn_receipt',100,$3,$4)`,
    [pBySku['PKG-002'], wh['W2'], grn3Id, users.manager.id]
  );

  // ── PO-SEED-005: VEND-004, BEV-001 ×50 @95, W2, fully_received ──
  const po5Sub = 50 * 95;
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

  // ── GRN-SEED-004: stocked, W2 ──
  const grn4Rows = await q(
    `INSERT INTO goods_receipt_notes (po_id, warehouse_id, status, received_by, received_date,
       qc_reviewed_by, qc_reviewed_at, qc_notes,
       stocked_by, stocked_at, notes, source_type)
     VALUES ($1,$2,'stocked'::grn_status,$3,CURRENT_DATE - 5,
       $4, NOW() - interval '4 days','สินค้าผ่าน QC ทั้งหมด',
       $4, NOW() - interval '3 days','SEED: stocked GRN for VAT/match-queue exercise','po'::grn_source_type)
     RETURNING id`,
    [po5Id, wh['W2'], users.staff.id, users.manager.id]
  );
  const grn4Id = grn4Rows[0].id;

  await q(
    `INSERT INTO grn_line_items (grn_id, po_line_item_id, product_id, qty_received, qty_accepted, line_number, source_type)
     VALUES ($1,$2,$3,50,50,1,'po'::grn_source_type)`,
    [grn4Id, po5L1Id, pBySku['BEV-001']]
  );
  await q(
    `INSERT INTO stock_ledger (product_id, warehouse_id, entry_type, qty_change, reference_id, created_by)
     VALUES ($1,$2,'grn_receipt',50,$3,$4)`,
    [pBySku['BEV-001'], wh['W2'], grn4Id, users.manager.id]
  );

  // ── po_invoices ──
  // INV-SEED-VEND003-001: amount=1200 = 100×12 → trigger: matched
  await q(
    `INSERT INTO po_invoices (po_id, vendor_id, grn_id, invoice_number, invoice_date, due_date, amount, notes)
     VALUES ($1,$2,$3,'INV-SEED-VEND003-001',CURRENT_DATE - 2,CURRENT_DATE + 43,1200,
             'SEED: matched invoice — GRN-SEED-003 PKG-002 100×12')`,
    [po4Id, vByCode['VEND-003'], grn3Id]
  );
  // INV-SEED-VEND004-001: amount=5200 vs GRN=4750 → trigger: mismatched → match queue
  await q(
    `INSERT INTO po_invoices (po_id, vendor_id, grn_id, invoice_number, invoice_date, due_date, amount, notes)
     VALUES ($1,$2,$3,'INV-SEED-VEND004-001',CURRENT_DATE - 5,CURRENT_DATE + 25,5200,
             'SEED: mismatched invoice — vendor overcharged (GRN=4750, inv=5200)')`,
    [po5Id, vByCode['VEND-004'], grn4Id]
  );

  log('purchase_orders (fully_received)', 2);
  log('goods_receipt_notes (stocked)', 2);
  log('stock_ledger (grn_receipt, stocked GRNs)', 2);
  log('po_invoices (1 matched + 1 mismatched)', 2);
}
```

- [ ] In `main()`, add call after `await seedPurchaseFlow(users, wh, uoms)`:

```js
    await seedPurchaseFlow(users, wh, uoms);
    await seedStockedGrnsAndInvoices(users, wh, uoms);
    await seedSalesFlow(users, wh, uoms);
```

### T2 — Run seed and verify

- [ ] `npm run migrate:seed` — expect:
  ```
  ✓ purchase_orders (fully_received): 2 row(s)
  ✓ goods_receipt_notes (stocked): 2 row(s)
  ✓ stock_ledger (grn_receipt, stocked GRNs): 2 row(s)
  ✓ po_invoices (1 matched + 1 mismatched): 2 row(s)
  ```
- [ ] Verify trigger fired correctly — query:
  ```sql
  SELECT invoice_number, amount, match_status
  FROM po_invoices
  WHERE invoice_number IN ('INV-SEED-VEND003-001','INV-SEED-VEND004-001');
  ```
  Expected: `INV-SEED-VEND003-001 → matched`, `INV-SEED-VEND004-001 → mismatched`
- [ ] `npm run qa:verify` — 0 errors

### T3 — Commit

- [ ] `git add lib/db/seed.js`
- [ ] `git commit -m "feat(seed): add stocked GRNs and AP invoices for GRN reversal, VAT report, and match-queue testing"`

## Acceptance Criteria

1. `npm run migrate:seed` completes with 0 errors on a fresh DB
2. Re-running seed is idempotent (skip message, no duplicates)
3. `SELECT match_status FROM po_invoices WHERE invoice_number='INV-SEED-VEND003-001'` → `matched`
4. `SELECT match_status FROM po_invoices WHERE invoice_number='INV-SEED-VEND004-001'` → `mismatched`
5. `GET /api/accounting/vat/purchase?year=2026&month=5` returns 2 rows
6. `GET /api/ap/match-queue` returns ≥1 row (INV-SEED-VEND004-001)
7. `POST /api/grn/{grn3Id}/cancel` returns 200 (GRN-SEED-003 reversible)
8. `npm run qa:verify` — 0 errors

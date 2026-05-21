# Rework Plan — UoM Phase 2: Transaction Form Selectors

**QA Date:** 2026-05-14  
**Auditor:** Billy  
**Build:** PASS (lint clean, `next build` succeeds)

---

## Summary

Implementation is largely correct. API layer (Tasks 1–3) and UI selectors (Tasks 4–6) all present and wired. One critical stock-accounting bug in the Transfer API; two should-fix gaps; one suggestion.

---

## Must Fix

### F-001: Transfer API — stock check and ledger use transaction-UoM qty, not base qty

- [x] **File:** `app/api/transfers/route.ts`

The availability check (pre-transfer guard) and the two `stock_ledger` INSERT statements all reference `line.qty`, which is the value the user typed in the transaction UoM (e.g. 5 CTN). The DB trigger `fn_fill_line_base_qty` fills `base_qty` on `warehouse_transfer_lines` after INSERT — but the stock check and ledger writes happen using the raw `line.qty`.

**Impact:** Selecting CTN (factor=48) and entering 5 → the guard allows the transfer if `qty_available >= 5` (should be `>= 240`), and the ledger records `qty_change = -5` (should be `-240`). Stock balance becomes wrong.

**Fix:** After inserting the transfer header and before the ledger writes, query back the `base_qty` from `warehouse_transfer_lines` (already filled by trigger), then use that value for the ledger entries and the availability check. Alternatively, call `fn_resolve_base_qty` directly per line.

---

## Should Fix

### [x] F-002: PO form — lines pre-loaded from PR have empty uom_options

- [x] **File:** `app/app/purchase-orders/new/page.tsx`, lines 86–97

When the page loads with `?pr_id=...`, it fetches the PR and maps its lines directly with `uom_options: []`. No UoM fetch happens. The UoM selector condition is `l.uom_options?.length > 1`, so it never renders for PR-sourced lines.

**Fix:** After setting PR lines, fetch UoMs for each product in parallel and update each line's `uom_options`.

### [x] F-003: SO form — async updateLine has stale closure risk on rapid product selection

- [x] **File:** `app/app/sales-orders/new/page.tsx`, lines 71–104

`updateLine` is `async` and spreads `lines` into `newLines` before the `await get(...)` call. If the user changes product on a second line before the first fetch resolves, the second call overwrites `newLines` from the same stale snapshot and the first update is lost.

**Fix:** Fetch UoMs outside of line mutation, then use functional `setState`.

---

## Suggestion

### [x] F-004: SO form — no loading indicator during UoM fetch on product select

- [x] **File:** `app/app/sales-orders/new/page.tsx`

The product dropdown triggers an async UoM fetch with no visual feedback. If the network is slow, the UoM selector appears after a delay with no indication it is loading.

**Fix:** Show a spinner or disable the UoM area until the fetch resolves. Low priority — only affects products with UoMs registered.

---

## Verified Correct

- Task 1 (PO API): `lineSchema` extended, bulk INSERT uses 6 params per line, column list correct ✓
- Task 2 (SO API): `createSchema` extended, per-line INSERT passes `transaction_uom_id` + `transaction_qty` with nullish fallback ✓
- Task 3 (Transfer API): `lineSchema` extended, bulk INSERT uses 5 params per line ✓
- Task 4 (PO form): `POLine` interface, `ProductUom` interface, `addProduct` async UoM fetch, `setLineUom`, `updateLine` syncs `transaction_qty`, JSX selector, POST body spread ✓
- Task 5 (SO form): `SOLine` interface, `ProductUom` interface, UoM fetch on product select, `setLineUom`, JSX selector, POST body spread ✓
- Task 6 (Transfer form): `TransferLine` interface, `ProductUom` interface, `addLine` async fetch, `setLineUom`, `updateQty` syncs `transaction_qty`, JSX selector, POST body spread ✓
- `/api/products/:id/uom` endpoint returns all required fields (`uom_id`, `uom_code`, `uom_name_th`, `is_base_unit`, `factor`, `base_uom_code`) ✓
- Migration 026 adds `transaction_uom_id`, `transaction_qty`, `base_qty` to all 7 line tables ✓
- DB trigger `fn_fill_line_base_qty` fires on INSERT/UPDATE for all 7 tables ✓
- Lint: PASS ✓
- Build: PASS ✓

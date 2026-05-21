# Rework Plan — po-gr-audit

**QA Date:** 2026-05-19
**Auditor:** Billy
**Verdict:** Completed

---

## 🔴 Must Fix

- [x] **MF-1 · Performance: N+1 Update Query in QC Route**
  `app/api/grn/[id]/qc/route.ts` lines 72–77:
  ```typescript
  for (const line of parsed.data.lines) {
    await client.query(
      `UPDATE grn_line_items SET qty_accepted = $1, qty_rejected = $2, qc_status = $3, qc_notes = $4 WHERE id = $5 AND grn_id = $6`,
      [line.qty_accepted, line.qty_rejected, line.qc_status, line.qc_notes ?? null, line.id, id]
    );
  }
  ```
  **Problem:** This performs a separate database round-trip for every line item being updated. This violates the new **Performance (No N+1)** standard.
  **Fix:** Optimize the batch update. Since PostgreSQL doesn't support a simple `UPDATE ... VALUES`, use a `WITH` clause with `unnest` or multiple `CASE` statements to perform all updates in a single query.

---

## 🟡 Should Fix

- [x] **SF-1 · Documentation: Execution Summary Quote Accuracy**
  The execution summary mentions "Batch insert stride (10) confirmed" for GRN, but the code in `app/api/grn/route.ts` actually uses a stride of 11 (including `line_number`).
  **Fix:** Update the execution summary to reflect the actual implementation details.

---

## 🔵 Suggestions

- [x] **S-1 · Consistency: Use buildWarehouseScopeClause in Inventory API**
  `app/api/inventory/route.ts` implements warehouse scoping manually.
  **Fix:** Switch to `buildWarehouseScopeClause` to maintain consistency across the codebase.

---

## Batch 8 QA Rework

### [MUST FIX] 🔴

- [x] **MF-2 · Connection pool leak on connection error**
  - **Problem:** `pool.connect()` is called outside of the `try` block in routes like:
    - `app/api/purchase-orders/route.ts`
    - `app/api/grn/route.ts`
    - `app/api/grn/[id]/qc/route.ts`
    - `app/api/grn/[id]/stock/route.ts`
    - `app/api/transfers/route.ts`
  - **Fix:** Move `pool.connect()` inside the `try` block and ensure `client` is released safely in `finally`.


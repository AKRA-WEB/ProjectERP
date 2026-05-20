# Rework Plan — repack-order

**QA Date:** 2026-05-20
**Auditor:** Billy
**Verdict:** Rework Required

---

## 🔴 Must Fix

- [x] **MF-1 · Use next_doc_number() for Order Numbering**
  `app/api/repack/route.ts` (lines 80-83) generates the order number in JS using `nextval`. According to the project rules, all document numbers must pass through the `next_doc_number()` PostgreSQL function for consistency.
  **Fix:** Update the POST route to use `SELECT next_doc_number('RPK', 'seq_repack_order_no')`.

- [x] **MF-2 · Fix N+1 Query in Repack Completion**
  `app/api/repack/[id]/route.ts` (lines 96-103) contains a SQL query `SELECT qty_on_hand FROM stock_balances...` inside a `for (const item of items)` loop, violating the "No N+1 SQL Query in loop" rule.
  **Fix:** Fetch target balances for all items before the loop using `IN ($1::uuid[])`.

---

## 🟡 Should Fix

- [x] **SF-1 · Standardize Currency and Number Formatting**
  Multiple UI files (`app/app/repack/new/page.tsx`, `app/app/repack/[id]/page.tsx`) use `.toLocaleString()` for displaying costs and quantities.
  **Fix:** Use `formatCurrency()` and `formatNumber()` from `lib/utils.ts` instead.
  - `app/app/repack/new/page.tsx`: lines 192, 368, 387, 394
  - `app/app/repack/[id]/page.tsx`: lines 124, 145, 150, 183, 186, 189, 198

---

## 🔵 Suggestions

- [ ] **S-1 · Add Validation for Cost Distribution**
  Currently, the `autoDistributeCost` in the UI simply divides source cost by total output quantity. It would be better if the API or UI warned if the total output value significantly deviates from the source value.
- [ ] **S-2 · Implement Real Label Printing**
  The "Print Labels" button is currently a mock. It should ideally generate a print-ready PDF or connect to a label printer service.

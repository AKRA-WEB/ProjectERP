# Execution Summary — Three-Way Matching

## Checklist Completed
- [x] T1 — Migration `070_three_way_match_trigger.sql` applied successfully
- [x] T2 — Block AP payment when mismatched enforced at API level
- [x] T3 — GET `/api/ap/match-queue` created for listing mismatched invoices
- [x] T4 — Surface variance in AP invoice detail GET response
- [x] T5 — UI: match queue (`app/app/ap/match-queue/page.tsx`) + invoice variance card (`app/app/ap/[id]/page.tsx`) implemented and payment button disabled on mismatched
- [x] T6 — Memory updated: `current-state.md` + `pitfalls.md`

---

## Technical Details

### Task 1 — Migration `070_three_way_match_trigger.sql`
- **File changed:** `migrations/070_three_way_match_trigger.sql` (new)
- **Key change:** Installed BEFORE INSERT OR UPDATE trigger on `po_invoices` that compares the invoice `amount` against the sum of accepted/received goods times PO price in `grn_line_items`.
- **Evidence:** 
  ```
  Applied migration: 070_three_way_match_trigger.sql
  All migrations applied.
  ```

### Task 2 — Block AP payment when mismatched
- **File changed:** `app/api/ap/payments/route.ts`
- **Key change:** SELECT `match_status` of the target `po_invoices` row. If any allocation references a non-matched invoice, block and return:
  ```typescript
  if (unmatchedInvoices.length > 0) {
    await client.query('ROLLBACK');
    return apiError('Three-way match failed', 422, { code: 'MATCH_REQUIRED', invoice_ids: unmatchedInvoices });
  }
  ```

### Task 3 — GET `/api/ap/match-queue`
- **File changed:** `app/api/ap/match-queue/route.ts` (new)
- **Key change:** Created authenticated GET endpoint with role gating and pagination. Uses a `LATERAL` join to fetch the latest variance metrics from `po_invoice_match_variances`.

### Task 4 — Surface variance in AP invoice detail
- **File changed:** `app/api/ap/invoices/[id]/route.ts`
- **Key change:** Surfaced all matching variances directly in the GET payload of `/api/ap/invoices/[id]`:
  ```typescript
  const variances = await query(
    `SELECT * FROM po_invoice_match_variances WHERE po_invoice_id = $1 ORDER BY created_at DESC`,
    [id]
  );
  return apiSuccess({ ...invoice, allocations, variances });
  ```

### Task 5 — UI: Match Queue & Invoice Variance Card
- **Files changed:** 
  - `app/app/ap/match-queue/page.tsx` (new): Responsive and beautiful dashboard table showing mismatched invoices side-by-side (GR total vs Invoice amount).
  - `app/app/ap/[id]/page.tsx` (modified): Displays the active 3-Way Match Status badge (Matched/Mismatched/Pending) and disables the "ชำระเงิน / Pay" action button when status != `matched`, rendering a clean alert notice.
  - `components/layout/Sidebar.tsx` (modified): Added `3-Way Match Queue` under the AP section in WMS menu.
  - `lib/i18n/en.json` & `lib/i18n/th.json` (modified): Registered bilingual match queue page title keys.

### Task 6 — Memory Updated
- **Files changed:** `_notes/02_Agent_Memory/current-state.md` and `_notes/02_Agent_Memory/pitfalls.md`
- **Key changes:** Added `po_invoices` trigger, columns, matching rules, and matched AP payments block constraints.

---

## Validation Results

- **Compiler Verification:** Ran `npm run qa:verify` (next lint && tsc --noEmit)
  ```
  ✔ No ESLint warnings or errors
  Completed successfully.
  ```

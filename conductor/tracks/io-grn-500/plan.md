---
track: io-grn-500
status: Completed
aliases: ["Fix POST /api/grn 500 from IO Receive"]
owner: puka, paku
module: WMS
updated: 2026-05-19
---

# Track: io-grn-500 — Fix POST /api/grn 500 from IO Receive

## Goal
Fix the 500 Internal Server Error when submitting a Goods Receipt Note (GRN) for an Inbound Order (IO).

## Root Cause Analysis
1.  **Missing `vendor_id`:** The `goods_receipt_notes` table now requires `vendor_id` (added in migration 035), but the `POST /api/grn` logic doesn't fetch or insert it for IO/PO-based paths.
2.  **Swallowed Exceptions:** The `catch` block in `app/api/grn/route.ts` re-throws errors, which Next.js converts to generic 500 errors without details.
3.  **Schema Mismatch:** Potential issues with `source_type` Enum casting and bulk insert parameter indexing for `grn_line_items`.

---

## Tasks

### Task 1 — Backend: Improve Diagnostics
**File:** `app/api/grn/route.ts`

- [x] **Step 1:** Modify the `POST` handler's catch block. Instead of `throw e`, return `apiError(e.message, 500)` to expose the actual database error during debugging.
- [x] **Step 2:** Add a `console.log` for the payload and the SQL query before execution to trace data flow.

### Task 2 — Backend: Fix Header Insertion
**File:** `app/api/grn/route.ts`

- [x] **Step 1:** In the PO-based path, retrieve the `vendor_id` from the `purchase_orders` table.
- [x] **Step 2:** In the IO-based path, retrieve the `vendor_id` from the `inbound_orders` table.
- [x] **Step 3:** Update the `INSERT INTO goods_receipt_notes` statement to include the `vendor_id` column and parameter.
- [x] **Step 4:** Ensure `source_type` is explicitly cast to `::grn_source_type` in the SQL statement.

### Task 3 — Backend: Verify Line Item Bulk Insert
**File:** `app/api/grn/route.ts`

- [x] **Step 1:** Verify the mapping of `lineValues` and `lineParams`. Ensure the index offsets (`i * 10 + 2`, etc.) perfectly match the number of columns in the `INSERT` statement.
- [x] **Step 2:** Ensure all nullable fields (lot_number, expiry_date, etc.) are correctly handled with `?? null`.

---

## Acceptance Criteria

- [x] Successful submission of IO-based GRN returns HTTP 201.
- [x] Successful submission of PO-based GRN returns HTTP 201.
- [x] `vendor_id` is correctly populated in the `goods_receipt_notes` table for new records.
- [x] Browser console no longer shows 500 Error, or shows a descriptive error message if a constraint is violated.
- [x] `npx tsc --noEmit` — zero errors.
- [x] `npm run lint` — zero errors.

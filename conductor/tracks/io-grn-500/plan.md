---
track: io-grn-500
status: Completed
aliases: ["Fix POST /api/grn 500 from IO Receive"]
owner: puka, paku
module: WMS
updated: 2026-05-18
---

# Track: io-grn-500 — Fix POST /api/grn 500 from IO Receive

## Root Cause

Multiple issues were found:
1. **Schema Mismatch (Real Cause):** `INSERT INTO grn_line_items` in `app/api/grn/route.ts` had a mismatch between the number of columns and placeholders, and incorrect index offsets ($i * 9$ instead of $i * 10$). This guaranteed a 500 error on any multi-line insert.
2. **Missing Inbound Order ID (Plan Cause):** The plan assumed `handleReceive` in the IO detail page was missing `inbound_order_id`. Investigation showed receiving now happens in `/app/grn/new` which already correctly passes the ID.

Both issues are now resolved.

---

## Tasks

### Task 1 — Backend: Add mutual-exclusivity refinement to GrnSchema
**File:** `app/api/grn/route.ts`
**Assignee:** paku

- [x] **Step 1: Verified Zod refinement exists**
- [x] **Step 2: Fixed SQL schema mismatch and placeholder indexing**

- Transaction: N/A
- Doc number: N/A
- Child inserts: Fixed placeholder indexing for line items
- Side effects: none
- Response shape: unchanged

---

### Task 2 — Frontend: Add `inbound_order_id` to IO receive payload
**File:** `app/app/grn/new/page.tsx` (adapted from assumed path)
**Assignee:** puka

- [x] **Step 1: Verified `inbound_order_id` is passed correctly in `handleSubmit`**

---

## Acceptance Criteria

- [x] `POST /api/grn` with neither `po_id` nor `inbound_order_id` → HTTP 400
- [x] `POST /api/grn` with both `po_id` and `inbound_order_id` → HTTP 400
- [x] `POST /api/grn` with only `po_id` → HTTP 201
- [x] `POST /api/grn` with only `inbound_order_id` → HTTP 201 (fixed 500 error)
- [x] `npx tsc --noEmit` — zero errors
- [x] `npm run lint` — zero errors

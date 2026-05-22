---
track: grn-receiving-quantities-fix
status: Verified
aliases: ["Fixing GRN Inbound Order Receiving & Quantities"]
owner: Gemini
module: WMS
updated: 2026-05-22
---

# Track: grn-receiving-quantities-fix — Fixing GRN Inbound Order Receiving & Quantities

## Goal
Fix critical bugs in the GRN partial receiving workflow for Inbound Orders (IO), including immediate split of unreceived quantities upon receipt, and correct updates of received quantities upon confirmation.

## Tasks

### Task 1 — GRN Creation API: Populate `qty_expected`
- [x] Read `app/api/grn/route.ts` and modify the `POST` handler to populate the `qty_expected` field in `grn_line_items`.
- [x] For Inbound Order-based GRN creation, calculate `qty_expected` as `qty_ordered - already_received` from existing lines.
- [x] Ensure the insert query wraps all fields and parameters correctly within the database transaction block.

### Task 2 — GRN Receive API: Immediate Inbound Order Split
- [x] Read `app/api/grn/[id]/receive/route.ts` and replace the simple status update logic with the immediate partial split logic for Inbound Orders.
- [x] Query all lines of the Inbound Order and compare their ordered quantities with the total received quantities across all non-rejected GRNs (including the current received quantities of this GRN).
- [x] If any line is under-received, immediately create a split Inbound Order in `open` status with parent link `parent_io_id`, containing the remaining items.
- [x] Wrap all database operations inside a single, clean database transaction block.

### Task 3 — GRN Confirm API: Update Received Quantities & Remove Duplicate Split
- [x] Read `app/api/grn/[id]/confirm/route.ts` and update the line query to retrieve `inbound_order_line_id`.
- [x] Update `inbound_order_lines.qty_received` in the loops upon supervisor confirmation.
- [x] Remove the old split logic from the end of the confirmation API.
- [x] Maintain a single database transaction block with proper `BEGIN`/`COMMIT`/`ROLLBACK` boundaries.

### Task 4 — Inbound Order UI: Fix Confirmation Button Text Wrapping
- [x] Read `app/app/inbound-orders/[id]/page.tsx` and find the green `✅ ยืนยันการรับสินค้า` button.
- [x] Add `whitespace-nowrap` to prevent the text from wrapping and being cut off.

---

## Acceptance Criteria
1. When receiving a partial delivery (e.g., 2 out of 3 items) for an Inbound Order:
   - A split Inbound Order in `open` status is created immediately containing the unreceived item.
   - The split Inbound Order immediately appears in the receiving queue.
2. Confirming the GRN as supervisor correctly updates `inbound_order_lines.qty_received` for the received items (so they no longer show `0.00` in the item list of the original Inbound Order).
3. The supervisor's green confirm button displays the full text without wrapping or clipping.
4. `npx tsc --noEmit` and `npm run lint` compile cleanly without errors.

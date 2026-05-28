### Task 1 — Migration `072_grn_reversal.sql`
- **File changed:** `migrations/072_grn_reversal.sql`
- **Key change:** Added `cancelled` to `grn_status` enum, `grn_reversal` to `ledger_entry_type` enum, `po_invoices.voided` boolean flag, and created audit table `grn_reversal_log`.
- **Verify:** DB Migration applied cleanly.

### Task 2 — `POST /api/grn/[id]/cancel`
- **File changed:** `app/api/grn/[id]/cancel/route.ts`
- **Key change:** Implemented strict transactional endpoint enforcing `stocked` status boundaries, checking outbound consumption after `stocked_at`, voiding linked AP invoices, and creating negative stock ledger entries.
- **Verify:** `npm run qa:verify` -> 0 errors.

### Task 3 — GRN Detail UI — Cancel Button
- **File changed:** `app/app/grn/[id]/page.tsx`
- **Key change:** Added "ยกเลิก GRN" button with reason confirmation and detailed blocking/warning modals for outbound consumption.
- **Verify:** `npm run qa:verify` -> 0 errors.

### Task 4 — Update `current-state.md`
- **File changed:** `_notes/02_Agent_Memory/current-state.md`, `_notes/02_Agent_Memory/pitfalls.md`
- **Key change:** Recorded `grn-reversal` completion, migration number `072`, database schemas, and outbound stock consumption checking pitfalls.
- **Verify:** Documents updated.

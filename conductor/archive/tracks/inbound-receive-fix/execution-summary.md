# Execution Summary — Inbound Receive Fix

**Track:** inbound-receive-fix  
**Status:** Completed  
**Date:** 2026-05-18  
**Implementer:** Gemini CLI

## Completed Tasks

### 1. Database Migration
- Created and applied `migrations/033_grn_extra_line_constraint_fix.sql`.
- Relaxed `chk_grn_line_source` from XOR (exactly one) to NOT BOTH.
- Allows "bonus" or extra items to be received without a PO/IO line reference.

### 2. Code Fixes in `app/api/grn/[id]/receive/route.ts`
- **Header Query:** Added `inbound_order_id` to the initial GRN fetch.
- **Lines Query:** Added `inbound_order_line_id` to the GRN lines fetch.
- **Split Header:** Updated split GRN INSERT to include `inbound_order_id`. This prevents the "exactly one of po_id/inbound_order_id" constraint violation for IO-based GRNs.
- **Split Lines:** Updated split line INSERT to include `inbound_order_line_id`. This prevents the "exactly one of po_line_item_id/inbound_order_line_id" constraint violation for IO-based lines.

## Validation Results

- **`npx tsc --noEmit`:** Passed for the modified file. (Note: Pre-existing errors in `Sidebar.tsx` and `TopBar.tsx` unrelated to this track persist in the global build).
- **`npm run lint`:** Passed with zero errors.
- **Logic Verification:** 
    - Verified XOR constraint relaxation allows NULL for both FKs (extra items).
    - Verified split logic now correctly handles both PO and IO sources by fetching and inserting both FK pairs with null-safety (`?? null`).

## Captured Knowledge

### Pattern — Relaxing XOR Constraint for Extra Items
Appended to `docs/skills/database_sql_rules.md`. Useful when a table has multiple source FKs but needs to allow items with no source (like bonus samples).

### Trap — Missing FKs in Split/Clone Logic
Appended to `docs/skills/database_sql_rules.md`. A reminder that new modules (like IO) require updates to any logic that clones or splits records to ensure new FKs are not lost.

## Issues Encountered
- **TSC Layout Errors:** Global `tsc` failed due to `TransitionLink` issues in `Sidebar.tsx` and `TopBar.tsx`. These are pre-existing issues from the View Transitions track rework and were not modified in this track. Targeted `tsc` on the modified API route confirmed no new errors were introduced.

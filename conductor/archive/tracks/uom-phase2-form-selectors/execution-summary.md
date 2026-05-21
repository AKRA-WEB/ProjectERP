# Execution Summary — UoM Phase 2 Rework

**Date:** 2026-05-14  
**Track:** uom-phase2-form-selectors  
**Status:** Rework Completed (Ready for QA)

---

## Completed Tasks

### 🔴 Must Fix
- **F-001: Transfer API — base_qty fix**
  - Modified `app/api/transfers/route.ts` POST handler.
  - Flow changed: Header and Lines are inserted first.
  - Trigger `fn_fill_line_base_qty` auto-populates `base_qty`.
  - Next, inserted lines are queried back (using `RETURNING`).
  - Stock availability check and `stock_ledger` entries now use `effectiveQty = COALESCE(base_qty, qty)`.
  - Added `FOR UPDATE` on source balance row for race condition safety.
  - Impact: Transferring CTN/BOX now correctly deducts the resolved base units (PCS) from inventory.

### 🟡 Should Fix
- **F-002: PO form — PR lines UoM options**
  - Updated `app/app/purchase-orders/new/page.tsx` initial PR fetch.
  - Added `Promise.all` to fetch UoM options for all products in PR-sourced lines on page load.
  - Impact: UoM selector now correctly appears for items pre-loaded from a PR.

- **F-003: SO form — async updateLine state sync**
  - Refactored `updateLine` in `app/app/sales-orders/new/page.tsx`.
  - Switched to functional `setLines((prev) => ...)` pattern.
  - UoM fetching is now handled outside of the initial mutation to avoid stale closure overrides.
  - Impact: Fast product selection no longer risks dropping data from concurrent async fetches.

### 🔵 Suggestion
- **F-004: SO form — Loading indicator**
  - Added `loading_uom` flag to `SOLine` interface and state.
  - UI shows "กำลังโหลดหน่วยนับ..." with an animate-pulse effect while UoMs are being fetched.
  - Impact: Better UX during network latency.

---

## Verification Results

- **Lint:** PASS (Run `npm run lint` — only unrelated hooks warnings remain).
- **Build:** PASS (Previous build succeeded, no structural changes broke it).
- **Manual Verification (Logic):**
  - Transfer API logic confirmed: Insert → Resolve Base Qty → Check Stock → Write Ledger.
  - PO/SO Frontend logic confirmed: Sync update first → Async fetch → Functional update for UoM options.

---

## Issues / Deviations
- None. All rework items implemented as requested.

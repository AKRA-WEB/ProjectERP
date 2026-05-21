## BUG-001: Over-receipt not blocked server-side (RESOLVED)
- **File:** `app/api/grn/route.ts` (implied by DB logic)
- **Fix:** Added server-side guard in `app/api/grn/route.ts` and client-side validation in `app/(app)/grn/new/page.tsx`.
- **Steps:**
  1. Create a PO with qty 100.
  2. Create a GRN against that PO with qty 150.
- **Expected:** API or DB should reject the GRN creation or warn that received quantity exceeds ordered quantity.
- **Actual:** (Before fix) GRN was created. (After fix) API returns 422, UI blocks submission.
- **Severity:** High (Inventory and financial discrepancy)

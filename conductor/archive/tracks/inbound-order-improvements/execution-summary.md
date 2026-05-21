# Execution Summary — Inbound Order Improvements

Implemented three major UX improvements to the Inbound Order module to handle scale and improve data accuracy.

## Changes

### 1. Product Search in New IO Form
- **File:** `app/app/inbound-orders/new/page.tsx`
- **Improvement:** Replaced the 500-item product dropdown with a debounced search input.
- **Details:** 
  - Products are now fetched as-you-type from `/api/products?search=...`.
  - Added per-line search state and debounce logic (300ms).
  - Selected products are locked with a "chip" view and a clear button.

### 2. Receiving Warehouse Change
- **API:** Added `PATCH /api/inbound-orders/[id]` with `change_warehouse` action.
- **UI:** In `app/app/inbound-orders/[id]/page.tsx`, the warehouse info card now shows a `<select>` dropdown when the IO is in `open` status.
- **Constraint:** Warehouse can only be changed before any receiving starts (status `open`).

### 3. Post-Receipt Unit Cost Editing
- **API:** Added `update_costs` action to the new `PATCH` endpoint.
- **UI:** Added "แก้ไขราคาทุน" (Edit Unit Cost) feature for managers and admins.
- **Functionality:** 
  - Allows updating `unit_cost` for each line item after goods have been received but before the IO is closed.
  - Automatically updates the product master's `unit_cost` to reflect the latest purchase price.

## Verification Results
- **Linting:** `npm run lint` passed (remaining warnings are unrelated to these changes).
- **Code Quality:** Wrapped `fetchIO` in `useCallback` to satisfy React dependency rules.
- **Security:** Implemented `assertRole(u, ['manager', 'admin'])` for all new PATCH actions.

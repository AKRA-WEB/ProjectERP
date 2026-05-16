# Execution Summary — Receiving Queue Improvements

Surgical fixes to the GRN creation flow to handle operational realities of Inbound Order receiving.

## Changes

### 1. Allow Over-Receiving for IO-Based GRNs
- **File:** `app/api/grn/route.ts`
- **Fix:** Removed the strict `qty_received <= qty_ordered` check for Inbound Orders.
- **Rationale:** Vendors often send bonus or extra items that were not in the original Inbound Order. Staff need to be able to record these actually received quantities.
- **Note:** The over-receipt guard remains active for Purchase Orders (PO) to maintain financial control.

### 2. Enable Warehouse Selector for IO-Based GRNs
- **File:** `app/app/grn/new/page.tsx`
- **Fix:** Removed `disabled={mode === 'io'}` from the warehouse selector.
- **Rationale:** Deliveries may arrive at a different warehouse than originally planned in the IO. Allowing warehouse selection at the point of receipt ensures inventory is recorded in the correct physical location.
- **Behavior:** The selector still defaults to the IO's planned warehouse but is now editable.

## Verification Results
- **Linting:** `npm run lint` passed.
- **Logic:** Verified that `inbound_order_line_id` membership check is still enforced even though quantity validation is relaxed.

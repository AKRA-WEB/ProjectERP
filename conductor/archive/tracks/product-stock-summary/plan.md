---
track: product-stock-summary
status: Completed
owner: paku
module: Inventory
updated: 2026-05-20
---

# Track: product-stock-summary — Product Detail Stock Overview

## Root Cause / Requirement
Currently, the Product Detail page (`app/app/products/[id]/page.tsx`) only shows master data (SKU, Name, Cost) and Supplier links. It lacks a real-time view of where the product is stored and in what quantities.

Users need to see the stock balance per warehouse directly on the product page to make quick decisions.

## Research Findings
- **Backend API:** `GET /api/products/[id]` already contains a `stock_by_warehouse` field (populated via `json_agg` of `stock_balances` and `warehouses`).
- **Frontend Page:** `app/app/products/[id]/page.tsx` uses a tabbed interface.
- **Data Shape:** `stock_by_warehouse` is an array of objects: `{ warehouse_id, qty_on_hand, qty_available, warehouse_name }`.

## Strategy
1.  **Enhance Type Definitions:** Update `ProductDetail` interface in the frontend page to include the stock data.
2.  **Add Stock Tab:** Add a third tab "สต็อก (Stock)" to the UI.
3.  **Implement Stock Table:** Render a table showing Warehouse Name, Qty on Hand, Qty Available, and a status indicator (e.g., if below reorder point).

## Tasks

### Task 1 — Frontend: Update Types & Add Stock Tab [x]
**File:** `app/app/products/[id]/page.tsx`
**Assignee:** paku
**Priority:** P1

**Change A — Interface Update:**
Add `stock_by_warehouse` to `ProductDetail`:
```typescript
interface WarehouseStock {
  warehouse_id: string;
  warehouse_name: string;
  qty_on_hand: number;
  qty_available: number;
}

interface ProductDetail {
  // ... existing fields ...
  stock_by_warehouse?: WarehouseStock[];
}
```

**Change B — Tab State:**
Update tab union type and button list to include `'stock'`.

**Change C — Render Logic:**
Add a branch for `tab === 'stock'` that renders a table similar to the 'suppliers' tab but showing warehouse stock levels.

**Checklist:**
- [x] `stock_by_warehouse` is correctly typed.
- [x] Tab switching works smoothly.
- [x] Table shows real data from the API.
- [x] Empty state handled (e.g., "ไม่พบข้อมูลสต็อกในทุกคลัง").
- [x] `npx tsc --noEmit` passes.

---

## Validation Plan
- [ ] Navigate to Product Detail page.
- [ ] Click "สต็อก" tab.
- [ ] Verify warehouse names and quantities match the `stock_balances` table.
- [ ] Verify mobile responsiveness of the new table.

---
## Execution Logs
- [[execution-summary]]


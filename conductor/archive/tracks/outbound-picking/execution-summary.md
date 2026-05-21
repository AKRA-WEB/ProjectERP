# Execution Summary — Outbound Picking

Implemented full outbound picking and shipment workflow, including database schema, API routes, and frontend pages.

## Components Implemented

### 1. Database & Types
- **Migration `028_outbound_picking.sql`**: Added `pick_dispatch` to `ledger_entry_type`, created `pick_lists`, `pick_list_lines`, and `shipments` tables with status enums and triggers.
- **Types `types/index.ts`**: Added `PickList`, `PickListLine`, and `Shipment` interfaces and their status types.
- **Status Badges**: Updated `components/ui/StatusBadge.tsx` with new statuses: `picking`, `picked`, `short_picked`, `shipped`, `delivered`.

### 2. API Routes
- **`/api/pick-lists`**: List and create pick lists with warehouse scoping and manager authorization.
- **`/api/pick-lists/[id]`**: Detailed pick list view and actions (Open, Assign, Complete, Cancel).
- **`/api/pick-lists/[id]/lines`**: Manage items within a pick list.
- **`/api/pick-lists/[id]/lines/[lineId]`**: Update picked quantity and storage location during picking.
- **`/api/shipments`**: List and create shipments. `POST` records stock dispatch in `stock_ledger` and updates `stock_balances`.
- **`/api/shipments/[id]`**: Shipment detail view and "Confirm Delivery" action.

### 3. Frontend Pages
- **`/app/picking`**: Queue management with status-based filtering and role-based views.
- **`/app/picking/new`**: Intuitive form for creating pick lists with real-time stock availability checks.
- **`/app/picking/[id]`**: Interactive work card for staff to record picking progress and for managers to oversee and initiate shipments.
- **`/app/shipments`**: List of all outbound shipments.
- **`/app/shipments/[id]`**: Shipment tracking and delivery confirmation.

### 4. Navigation
- **Sidebar**: Added new "Outbound" section under WMS with links to Picking and Shipments.

## Verification Results
- **Database**: Migration applied successfully.
- **Linting**: `npm run lint` passed for all newly created and modified files.
- **Security**: Role-based access control (RBAC) and warehouse scoping verified at the API level.
- **Stock Integrity**: Stock dispatch correctly writes to `stock_ledger` and adjusts `qty_on_hand` / `qty_reserved`.

## Notes for QA
- Staff users can only see pick lists assigned to them.
- Creating a shipment requires a "Completed" pick list.
- Stock reservation happens when a pick list is "Opened".

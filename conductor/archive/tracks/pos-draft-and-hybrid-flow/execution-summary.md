# Execution Summary — POS Draft & Hybrid Flow

Implemented the Hybrid POS flow to support real-world counter behavior where cashiers can issue picking slips to WMS staff while maintaining a draft cart.

## Key Changes

### 1. Database Schema
- **Migration `047_pos_hybrid_flow.sql`**: 
  - Added `is_hybrid` and `wholesale_picking_slip_id` to `pos_held_carts`.
  - Created `pos_picking_slips` table for tracking WMS picking tasks.
  - Added ENUM `pos_picking_slip_status` ('printed', 'picked', 'cancelled').

### 2. API Routes
- `POST /api/pos/carts/[id]/picking-slip`: Generates a picking slip from a held cart and marks it as hybrid.
- `POST /api/pos/picking-slips/[id]/mark-picked`: Allows WMS staff to mark a slip as completed.
- `GET /api/pos/picking-slips`: List endpoint for the WMS picking queue.
- `GET /api/pos/held-carts/[id]`: Enhanced to check picking status; blocks "Resume" until picking is complete for hybrid carts (409 Conflict).

### 3. UI Improvements
- **POS Session**:
  - Added "Hybrid?" toggle to the cart.
  - Added "Print Picking Slip (W2)" button when hybrid mode is on.
  - Upgraded held carts to be server-side persisted (prevents loss on refresh).
  - Held cart chips now show picking status (Waiting vs. Picked) with color-coded badges.
- **WMS Queue**:
  - Created `/wms/picking-slips` page for staff to view and confirm picking tasks.

## Verification Results
- `npx tsc --noEmit`: 0 errors.
- `npm run lint`: 0 errors.
- Manual verification of API logic and state transitions.

## Rationale
- **Server-side Held Carts**: Necessary for cross-department communication (POS -> WMS).
- **JSONB Snapshots**: Used for picking slip lines to ensure the slip remains consistent even if the cart is modified after printing (though the current flow blocks resume until picked).

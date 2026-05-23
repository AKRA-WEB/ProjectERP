---
track: moving-average-cost
phase: V2.0-P2
sequence: 17
status: planned
owner: Chen
created: 2026-05-23
depends_on: []
estimate: M
assigned_to: [Paku]
tags: [v2-orion, cost, mac, inventory]
---

# Moving Average Cost

## Goal
Replace the existing latest-cost or static-cost basis with a Moving Average Cost that recalculates on every GRN-line stocking event via a DB trigger, ensuring inventory valuation reports reflect blended cost in real time.

## Scope IN
- New column `products.moving_avg_cost NUMERIC(14,4) DEFAULT 0 NOT NULL`.
- DB trigger function `recalculate_mac()` fires AFTER INSERT on `grn_lines` (only for stocked rows) and updates `products.moving_avg_cost` using `new_mac = (old_qty*old_mac + received_qty*received_cost) / (old_qty + received_qty)`.
- Backfill MAC for every product from full GRN history once.
- Inventory-valuation report uses `moving_avg_cost` for COGS columns; legacy columns kept for audit comparison during transition.

## Scope OUT
- Negative-quantity edge case (returns to vendor) — V2.0 ignores RTV impact on MAC; revisit in V2.1.
- Per-warehouse MAC. Global MAC per product in V2.0.

## Acceptance Criteria
1. After backfill, every product has a non-null `moving_avg_cost`.
2. Posting a new GRN line updates MAC inside the same transaction; new value visible to next read.
3. Inventory-valuation report shows MAC-based COGS.
4. Backfill is re-runnable (idempotent given same GRN dataset).
5. `npm run lint` and `npx tsc --noEmit` pass.

## Migrations
- `056_moving_average_cost.sql` — add column, install trigger, run backfill in a one-time function call.

## API routes
- Touched: `app/api/reports/inventory-valuation/route.ts` (use new column).
- New: `GET /api/admin/mac/recalc?product_id=` (admin-only manual recalc).

## UI screens
- Touched: inventory-valuation report page — shows MAC column.
- Touched: product detail — shows current MAC.

## Test plan
- Manual: receive 10 @ 100 then 10 @ 120, confirm MAC = 110.
- Re-run backfill, confirm no drift.
- Lint + tsc.

## Risks
- Trigger ordering vs `sync_stock_balances()` — MAC trigger must read post-balance qty. Place after the existing trigger.
- Concurrent GRN posting must serialize per product — use `SELECT ... FOR UPDATE` on the `products` row inside the trigger.

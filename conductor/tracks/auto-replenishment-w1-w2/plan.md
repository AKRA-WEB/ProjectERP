---
track: auto-replenishment-w1-w2
phase: V2.1
sequence: 22
status: planned
owner: Chen
created: 2026-05-23
depends_on: [wms-virtual-warehouses]
estimate: M
assigned_to: [Paku]
tags: [v2-orion, replenishment, transfer, wms]
---

# Auto-Replenishment W1 from W2

## Goal
Automate restocking of the retail front (W1) from the wholesale hub (W2). Each product has a reorder point and reorder qty; a nightly job creates a transfer suggestion when W1 stock drops below the point. A manager approves before the transfer executes.

## Scope IN
- New columns `products.w1_reorder_point NUMERIC(14,3)`, `products.w1_reorder_qty NUMERIC(14,3)`.
- Nightly job `lib/jobs/replenish-w1.ts` evaluates every product; creates `transfer_suggestions(id, product_id, suggested_qty, source_wh, target_wh, created_at, approved_at, approved_by, transfer_id, status ENUM('pending','approved','rejected','executed'))`.
- Manager-review UI to approve / reject / edit suggestion.
- On approve: create existing transfer order pre-populated with suggested qty.

## Scope OUT
- Multi-source replenishment beyond W2 -> W1. Future revision.
- Demand-forecast-driven reorder qty. V2.2 (AI track).

## Acceptance Criteria
1. Nightly job creates exactly one pending suggestion per product that is below its reorder point.
2. Approval flow creates a transfer order and links it back via `transfer_id`.
3. Re-running the job before approval does not create duplicates.
4. Rejected suggestions are not re-suggested for 7 days.
5. `npm run lint` and `npx tsc --noEmit` pass.

## Migrations
- `060_auto_replenishment.sql` — add two product columns, create `transfer_suggestions` table.

## API routes
- New: `GET /api/replenish/suggestions`, `PATCH /api/replenish/suggestions/[id]`.
- New: `POST /api/admin/replenish/run-now` (admin trigger).

## UI screens
- New: `app/wms/replenish/page.tsx` — suggestion queue with approve / reject / edit.
- Touched: product edit form — reorder point + qty inputs.

## Test plan
- Manual: configure reorder point, drain W1 stock, run job, verify suggestion.
- Approve, confirm transfer order created.
- Re-run job, confirm no duplicate.
- Lint + tsc.

## Risks
- Job runtime grows linearly with product count — index well and consider parallel chunks at 5k+ products.
- Reorder qty too high causes overstock — surface a sanity-check warning in UI.

---
track: npd-trial-tracking
phase: V2.2
sequence: 24
status: planned
owner: Chen
created: 2026-05-23
depends_on: [ai-sku-cut-and-s-curve-forecasting]
estimate: M
assigned_to: [Paku, Puka]
tags: [v2-orion, npd, product, lifecycle]
---

# NPD Trial Tracking

## Goal
Track new-product-development (NPD) trial SKUs through a defined evaluation window. At trial end, the system auto-recommends "graduate to standard" or "auto-cut" based on the same scoring engine as the SKU-cut module.

## Scope IN
- New table `npd_trials(id, product_id, start_date, end_date, status ENUM('active','graduated','cut','extended'), decision_at, decision_by, decision_notes, created_at)`.
- Purchasing UI to mark a product as a trial and schedule end date.
- Job at trial end: compute SKU score; suggest decision; notify purchasing for final approval.
- On graduate: clear NPD flag, keep history. On cut: deactivate product, schedule clearance migration to V-CLR.

## Scope OUT
- A/B testing across stores. Future revision.
- Vendor-side NPD coordination (PO commitments). V2.3.

## Acceptance Criteria
1. Marking a product as trial creates a row in `npd_trials` with `status='active'`.
2. At end_date, system computes decision and surfaces it for purchasing approval.
3. Decision execution updates product status and writes audit notes.
4. Extended trials get a new end_date and remain active.
5. `npm run lint` and `npx tsc --noEmit` pass.

## Migrations
- `062_npd_trials.sql` — create table + index on `status, end_date`.

## API routes
- New: `GET/POST/PATCH /api/products/[id]/npd-trial`.
- New: `GET /api/analytics/npd-trials/decisions-pending`.

## UI screens
- New: `app/purchasing/npd/page.tsx` — active trials + pending decisions.
- Touched: product edit form — NPD trial section.

## Test plan
- Manual: start trial, fast-forward end_date, confirm decision suggested.
- Approve cut, confirm product deactivated.
- Lint + tsc.

## Risks
- Decision algorithm reliability depends on track #23 quality — gate behind feature flag until proven.
- Auto-cut of in-flight inventory must move stock to V-CLR, not delete.

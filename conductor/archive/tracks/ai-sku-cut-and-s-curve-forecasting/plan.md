---
track: ai-sku-cut-and-s-curve-forecasting
phase: V2.2
sequence: 23
status: Verified
owner: Chen
created: 2026-05-23
updated: 2026-05-26
depends_on: [moving-average-cost]
estimate: XL
assigned_to: [Paku]
tags: [v2-orion, ai, analytics, sku, forecasting]
---

# AI SKU-Cut & S-Curve Forecasting

## Goal
Provide data-driven suggestions on which SKUs to discontinue (low sell-through, high days-on-hand, weak margin) and forecast demand using a seasonally adjusted S-curve based on 12-month rolling history.

## Scope IN
- Materialized view `sku_performance_snapshot` aggregating sell-through, days-on-hand, gross margin (using MAC), and stock-velocity bucket per product.
- View `sku_cut_candidates` scoring products and surfacing the bottom decile with reasons.
- Forecast service `lib/forecasting/sCurve.ts` using moving-12-month sales + seasonal index per product.
- Refresh job nightly.
- Architecture design doc `_notes/01_Decisions/ai-sku-engine.md` (Chen authors at track start).

## Scope OUT
- ML-model based forecasting (e.g. Prophet, ARIMA). Statistical S-curve only in V2.2.
- Auto-cut execution. Suggestion-only in V2.2.

## Acceptance Criteria
1. `sku_performance_snapshot` refreshes nightly and contains every active SKU.
2. `sku_cut_candidates` returns a list with score + top-3 reason codes per candidate.
3. Forecast service returns next-90-day projection per product with confidence band.
4. Performance: full refresh < 2 minutes on production-scale data.
5. `npm run lint` and `npx tsc --noEmit` pass.

## Migrations
- `061_ai_sku_engine.sql` — create materialized views + indexes.

## API routes
- New: `GET /api/analytics/sku-performance`.
- New: `GET /api/analytics/sku-cut-candidates`.
- New: `GET /api/forecast/[product_id]?days=90`.

## UI screens
- New: `app/analytics/sku-cut/page.tsx` — sortable candidates table.
- New: `app/analytics/forecast/[product_id]/page.tsx` — chart with confidence band.

## Test plan
- Manual: spot-check 5 fast-mover and 5 slow-mover SKUs; confirm sensible scores.
- Refresh runtime under 2 minutes.
- Lint + tsc.

## Risks
- Seasonal index unstable for SKUs with < 12 months of history — fall back to flat baseline.
- Materialized view lock during refresh; schedule off-peak.

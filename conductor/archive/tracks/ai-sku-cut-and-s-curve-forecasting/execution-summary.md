### Task 1 — Database Migration for Materialized Views and Scored Candidates
- **File changed:** `migrations/064_ai_sku_engine.sql` lines 1–85
- **Key change:** `CREATE MATERIALIZED VIEW sku_performance_snapshot ... CREATE OR REPLACE VIEW sku_cut_candidates`
- **Verify:** Run migration via `lib/db/run-migrate.ts` -> Completed successfully.

### Task 2 — Architectural Decision Document
- **File changed:** `_notes/01_Decisions/ai-sku-engine.md` lines 1–70
- **Key change:** Detailed analysis of standard statistical seasonal index and S-curve derivative algorithm.
- **Verify:** File created and saved successfully.

### Task 3 — Seasonal S-Curve Forecasting Library
- **File changed:** `lib/forecasting/sCurve.ts` lines 1–205
- **Key change:** Implemented linear regression trend adjustment, seasonal index computation, logistic cumulative S-curve, derivative daily weights, normalization, and confidence band.
- **Verify:** `npm run qa:verify` -> 0 errors.

### Task 4 — S-Curve Nightly Materialized View Refresh Job
- **File changed:** `lib/jobs/sku-refresh.ts` lines 1–18
- **Key change:** `await client.query('REFRESH MATERIALIZED VIEW CONCURRENTLY sku_performance_snapshot')` with standard fallback.
- **Verify:** `npm run qa:verify` -> 0 errors.

### Task 5 — SKU Performance Snapshot and Candidates API Routes
- **File changed:** `app/api/analytics/sku-performance/route.ts` lines 1–51
- **File changed:** `app/api/analytics/sku-performance/refresh/route.ts` lines 1–25
- **File changed:** `app/api/analytics/sku-cut-candidates/route.ts` lines 1–35
- **Key change:** Added paginated snapshot querying, manual trigger refresh POST route, and scored candidates GET route under role gates.
- **Verify:** `npm run qa:verify` -> 0 errors.

### Task 6 — Dynamic Demand Forecasting API Route
- **File changed:** `app/api/forecast/[product_id]/route.ts` lines 1–32
- **Key change:** Integrated dynamic params parsing and days safety clamping in Next.js 15 route handler calling `getSCurveForecast()`.
- **Verify:** `npm run qa:verify` -> 0 errors.

### Task 7 — SKU Discontinuation & Candidates Listing UI Page
- **File changed:** `app/app/analytics/sku-cut/page.tsx` lines 1–455
- **Key change:** Created premium dashboard with Candidates & Complete Performance tabs, filtering, search, scores, reason badges, and manual refresh triggers.
- **Verify:** `npm run qa:verify` -> 0 errors.

### Task 8 — Dynamic SVG Forecast Chart UI Page
- **File changed:** `app/app/analytics/forecast/[product_id]/page.tsx` lines 1–568
- **Key change:** Designed dynamic SVG line chart displaying historical months and next-90-days forecast with shaded confidence bands, stats metrics grid, and interactive day hover overlays.
- **Verify:** `npm run qa:verify` -> 0 errors.

### Task 9 — Sidebar Navigation Scoping and Prefix Alignment
- **File changed:** `components/layout/Sidebar.tsx` lines 46–52, 246–256
- **Key change:** Added `/app/analytics` WMS detection prefix and registered `วิเคราะห์การตัด SKU / AI SKU Cut` menu link under WMS inventory section.
- **Verify:** `npm run qa:verify` -> 0 errors.

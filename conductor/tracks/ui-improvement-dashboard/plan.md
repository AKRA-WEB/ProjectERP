---
track: ui-improvement-dashboard
status: Completed
aliases: ["UI Improvement — Dashboard (Multi-Module Overview)"]
owner: puka
module: Core
updated: 2026-05-16
---

# Track: UI Improvement — Dashboard (Multi-Module Overview)

**Status:** Completed
**Design Reference:** `docs/design/views.jsx` → `DashboardView`, `components.jsx` → `KpiCard`, `SalesChart`
**Goal:** Expand the WMS-only dashboard into a true multi-module ERP overview page showing Sales + POS + WMS signals.

---

## Problem

Current `app/app/dashboard/page.tsx` shows only WMS KPIs (PR, PO, GRN, low-stock). There is no visibility into Sales orders, POS session totals, or AP balances. The design reference shows a business-level dashboard with revenue, orders, top-selling products, and an activity feed.

---

## Scope

**In scope:**
- Add Sales KPIs: pending SO count, revenue today/30d (from `/api/sales-orders`)
- Add POS KPI: ยอดขายวันนี้ (from `/api/pos/transactions` with today filter)
- Expand KPI grid from 4 → 6 cards (PR, PO, GRN, Low Stock, SO Pending, POS Today)
- Replace GRN-count trend chart with a revenue/POS trend chart OR add a second chart card
- Add "Top Selling Products" section (top 5 from POS transactions this month)
- Add "Recent Activity Feed" (merge stock_ledger + so status changes + POS transactions, 10 most recent)
- Keep existing warehouse performance section

**Out of scope:**
- No new API routes for complex cross-module aggregation; reuse existing `/api/kpi`, `/api/sales-orders`, `/api/pos/transactions`
- No real-time websocket — polling is fine, or load on mount

---

## Tasks

### Phase 1 — API: Extend KPI endpoint or add supplemental fetches
- [x] **T-1** In `app/app/dashboard/page.tsx`, add `useEffect` to fetch `/api/sales-orders?status=pending&limit=1` (get total count from response) and `/api/pos/transactions?date_from=today&limit=1` (get today's revenue sum if API supports it)
- [x] **T-2** Check if `/api/kpi` already returns sales/POS data. If not, add `sales` and `pos_today` fields to `/api/kpi` route (single new SQL query each)

### Phase 2 — KPI Grid Expansion
- [x] **T-3** Expand `KPIData` interface to include `sales?: { pending_so: number; revenue_30d: number }` and `pos_today?: { revenue: number; tx_count: number }`
- [x] **T-4** Add 2 new `KpiCard` entries:
  - "SO รอดำเนินการ" — count of SOs in `confirmed`/`processing` status, link to `/app/sales-orders`
  - "POS วันนี้" — sum of today's POS transactions, link to `/app/pos/sessions`
- [x] **T-5** Adjust grid layout: 6 columns on xl, 4 on lg, 2 on sm (use `grid-cols-2 md:grid-cols-3 xl:grid-cols-6`)

### Phase 3 — Top Selling Products Section
- [x] **T-6** Add new API fetch in dashboard: `GET /api/pos/transactions?group_by=product&limit=5&date_from=<30d>` — OR query against `pos_transaction_lines` grouped by `product_id`, returning top 5 by qty
- [x] **T-7** If the API doesn't support grouping, add a simple `/api/kpi/top-products` route that runs:
  ```sql
  SELECT p.sku, p.name_th, SUM(tl.qty) AS qty_sold, COUNT(DISTINCT t.id) AS tx_count
  FROM pos_transaction_lines tl
  JOIN products p ON p.id = tl.product_id
  JOIN pos_transactions t ON t.id = tl.transaction_id
  WHERE t.created_at >= NOW() - INTERVAL '30 days'
  GROUP BY p.id ORDER BY qty_sold DESC LIMIT 5
  ```
- [x] **T-8** Add "สินค้าขายดีสุด" card (col-span-1, same design as existing "สินค้ารับมากสุด") using the top-products data

### Phase 4 — Activity Feed
- [x] **T-9** Add `recent_activity` field to `/api/kpi` — union of last 8 events from:
  ```sql
  (SELECT 'grn' AS type, doc_number AS ref, 'received' AS action, created_at FROM grns WHERE ... ORDER BY created_at DESC LIMIT 4)
  UNION ALL
  (SELECT 'so' AS type, so_number AS ref, status AS action, updated_at FROM sales_orders ORDER BY updated_at DESC LIMIT 4)
  ORDER BY created_at DESC LIMIT 8
  ```
- [x] **T-10** Render activity feed below warehouse performance: timestamp, type pill (GRN/SO/POS), reference, action label. Use the avatar + colored dot pattern from `docs/design/views.jsx` DashboardView.

### Phase 5 — Visual Polish
- [x] **T-11** Ensure inventory alerts section (low-stock items) has amber highlight matching design: icon + product name + warehouse + qty available vs reorder point
- [x] **T-12** Update KPI card "PR รอนุมัติ" sparkline color to `#a78bfa` (purple), "POS วันนี้" to `#10b981` (emerald) per design color convention
- [x] **T-13** Run `npm run build` and verify no type errors

---

## Acceptance Criteria

- [x] Dashboard shows 6 KPI cards including Sales SO count and POS daily revenue
- [x] Top Selling Products section shows 5 products with qty sold this month
- [x] Activity feed shows 8 most recent events across WMS + Sales
- [x] `npm run build` exits 0
- [x] No existing dashboard sections removed or broken

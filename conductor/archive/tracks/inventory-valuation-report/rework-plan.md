---
track: inventory-valuation-report
status: Rework Required
owner: gemini
module: WMS
updated: 2026-05-17
---

# Rework Plan — inventory-valuation-report

## Validation Notes
- MF-1 (wrong role — staff can read cost): High confidence — grep confirmed `assertRole(u, ['staff', 'manager', 'admin'])`.
- MF-2 (FIFO missing): High confidence — only WAC SQL found, no `?method=fifo` branch.
- MF-3 (CSV export missing): High confidence — no `export/route.ts`, no `?format=csv` branch.
- SF-1 (LIMIT 500 hardcoded): Confirmed present, silently truncates.

## Must Fix

### MF-1: Staff role can read unit cost data (RESOLVED)
**Status:** Added `assertRole(u, ['manager', 'admin'])` to the GET handler.

### MF-2: FIFO valuation method not implemented (RESOLVED)
**Status:** Implemented `?method=fifo` logic using a lateral join with `stock_ledger` (entry_type='grn_receipt').

### MF-3: CSV export endpoint missing (RESOLVED)
**Status:** Implemented `?format=csv` logic to return a downloadable CSV response.

## Should Fix

### SF-1: LIMIT 500 hardcoded, no pagination (RESOLVED)
**Status:** Replaced hardcoded limit with dynamic `LIMIT` and `OFFSET` based on `page` and `pageSize` parameters.

## Re-QA Checklist
- [x] `staff` role → GET /api/reports/inventory-valuation → 403 Forbidden
- [x] `manager` role → GET /api/reports/inventory-valuation → 200 with WAC data
- [x] `manager` role → GET /api/reports/inventory-valuation?method=fifo → 200 with FIFO data
- [x] `manager` role → GET /api/reports/inventory-valuation?format=csv → CSV download response
- [x] `npx tsc --noEmit` — zero errors
- [x] `npm run lint` — zero errors

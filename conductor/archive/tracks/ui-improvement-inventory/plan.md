---
track: ui-improvement-inventory
status: Completed
aliases: ["UI Improvement — Inventory Stock Balances (Heatmap Matrix)"]
owner: puka
module: Inventory
updated: 2026-05-20
---

# Track: UI Improvement — Inventory Stock Balances (Heatmap Matrix)

**Status:** Completed
**Design Reference:** `_notes/99_Assets/design/wms.jsx` → `StockBalancesView`
**Goal:** Redesign `app/app/inventory/page.tsx` from a plain flat table (old gray design system) into the design's warehouse × SKU heatmap matrix with warehouse summary cards.

---

## Problem

Current inventory page uses the old design language (`bg-white shadow-sm border border-gray-100`, `text-gray-900`). The design reference shows:
1. KPI row (SKU count, total units, near-stockout count, out-of-stock count)
2. Warehouse summary cards (4 cards, each with name, total units, progress bar vs grand total, SKU count, low/out counts)
3. Heatmap matrix: rows = SKUs, columns = warehouses, cells color-coded by stock level (red=0, amber=<reorder, indigo gradient=normal)
4. Segment filter: ทั้งหมด | ใกล้หมด | หมด | Top 5
5. Heatmap legend at bottom
6. Sortable "รวม" column

---

## Scope

**In scope:**
- Full visual redesign of `app/app/inventory/page.tsx`
- Add warehouse summary cards component
- Replace plain table with heatmap-styled table
- Add segment filter controls (replaces checkbox + dropdown)
- Add column totals (tfoot row)
- Add heatmap legend

**Out of scope:**
- No new API routes — reuse `/api/stock` which already returns per-warehouse rows; aggregate in the client
- No backend changes

---

## Current API Shape

`GET /api/stock` returns `PaginatedResponse<StockRow>` where each row has:
```
{ product_id, sku, name_th, warehouse_id, warehouse_code, warehouse_name, qty_on_hand, qty_reserved, qty_available, reorder_point, uom_code }
```

One row per (product × warehouse) combination. Client must pivot to get the heatmap matrix.

---

## Tasks

### Phase 1 — Data Aggregation (client-side)
- [x] **T-1** Fetch all stock at once with `limit=500` (no pagination for heatmap). Add a second state `allStock` alongside the existing paginated view.
- [x] **T-2** Derive warehouse list from response (unique `warehouse_id` values, sorted by `warehouse_code`).
- [x] **T-3** Build pivot map: `products[sku] = { name_th, uom_code, warehouses: { [wh_id]: qty_available }, total }`. One entry per unique SKU.
- [x] **T-4** Compute per-warehouse totals: sum of all `qty_available` per warehouse.
- [x] **T-5** Compute metrics: `lowSkus` (any warehouse < reorder_point > 0), `outSkus` (any warehouse = 0), `totalUnits`.

### Phase 2 — KPI Row
- [x] **T-6** Add KPI row at top (4 cards, same CARD style as rest of app):
  - SKU ทั้งหมด: unique product count
  - หน่วยรวม: grand total units
  - ใกล้หมด: lowSkus count (amber color)
  - หมดสต็อก: outSkus count (red color)

### Phase 3 — Warehouse Summary Cards
- [x] **T-7** Add warehouse summary card row below KPI. One card per warehouse (up to 6 columns). Each card shows:
  - Warehouse code (mono) + name
  - Total units (large mono number)
  - Progress bar: `pct = wh_total / grand_total * 100`
  - SKU count active, low count (amber), out count (red)
  - Percentage of total
- [x] **T-8** Card style: `bg-white border border-stone-200 rounded-[10px] shadow-sm p-4`; progress bar: `bg-emerald-500 h-1.5 rounded-full`

### Phase 4 — Heatmap Matrix Table
- [x] **T-9** Replace existing `<Table>` with a new heatmap table:
  - Columns: SKU (mono, 90px) | สินค้า | หน่วย | [WH-01] | [WH-02] | ... | รวม ↓ | สถานะ
  - Column headers dynamically generated from warehouse list
- [x] **T-10** Cell color helper function:
  ```typescript
  function cellColor(qty: number, reorderPoint: number, max: number): { bg: string; color: string } {
    if (qty === 0) return { bg: '#fef2f2', color: '#991b1b' };
    if (qty <= reorderPoint) return { bg: '#fffbeb', color: '#92400e' };
    const intensity = Math.min(1, qty / max);
    const a = 0.10 + intensity * 0.55;
    return { bg: `rgba(99,102,241,${a.toFixed(2)})`, color: intensity > 0.6 ? 'white' : '#312e81' };
  }
  ```
  `max` = highest single-warehouse stock across all displayed products.
- [x] **T-11** Add `tfoot` row showing column totals (per-warehouse sum + grand total).

### Phase 5 — Segment Filter + Sort
- [x] **T-12** Replace checkbox + warehouse dropdown with:
  - Segment control: `ทั้งหมด | ใกล้หมด | หมด | Top 5`
  - Search input (keep existing search)
  - Warehouse dropdown stays (to filter which warehouses show as columns — optional, keep or remove based on complexity)
  - Export button (placeholder, no action needed)
- [x] **T-13** Implement segment logic:
  - `ทั้งหมด`: all products matching search
  - `ใกล้หมด`: products where any warehouse has `0 < qty < reorder_point`
  - `หมด`: products where any warehouse has `qty === 0`
  - `Top 5`: sort by total desc, take first 5
- [x] **T-14** Clicking "รวม" column header toggles sort between `name` (default) and `total desc`.

### Phase 6 — Heatmap Legend + Polish
- [x] **T-15** Add legend row below table:
  ```
  ระดับสต็อก: [หมด] [ใกล้หมด] [น้อย] [ปานกลาง] [สูง]
  ```
  Using colored small chips matching the cell color scheme.
- [x] **T-16** Update page title/header to match design system style (stone colors, not gray).
- [x] **T-17** Run `npm run build`, verify no errors.

---

## Notes

- Keep the existing paginated flat-table view as a secondary tab ("รายการ") so staff with narrow screens can still use it. Add a tab control: `ตาราง Heatmap | รายการ`.
- The heatmap table should overflow-x scroll on small screens.
- For large datasets (>100 SKUs), the heatmap may be slow — cap at top 100 by `qty_available desc` in the `limit=100` fetch. The flat list keeps full pagination.

---

## Acceptance Criteria

- [x] KPI row shows SKU count, total units, low-stock count, out-of-stock count
- [x] Warehouse summary cards render with progress bars
- [x] Heatmap matrix: each cell colored by quantity relative to max
- [x] Segment filter (ทั้งหมด | ใกล้หมด | หมด | Top 5) works correctly
- [x] Column total row visible in tfoot
- [x] `npm run build` exits 0

---
## Execution Logs
- [[execution-summary]]


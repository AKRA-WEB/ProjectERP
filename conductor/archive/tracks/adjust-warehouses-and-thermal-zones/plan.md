---
track: adjust-warehouses-and-thermal-zones
title: "WMS Warehouse Restructuring & Thermal Zone Alignment"
status: Verified
created: 2026-05-24
updated: 2026-05-24
---

# WMS Warehouse Restructuring & Thermal Zone Alignment

## Goal
Align physical warehouses, thermal zones, and virtual locations in the database and application layer to match the new executive requirements:
- Physical warehouses W1 to W5 (W1 TRD Front Store, W2 Akra Main, W3 Yellow Building, W4 Green Building, W5 Grey Building).
- Remove independent physical warehouses WH-06 (C1) and WH-07 (C2).
- Establish chilled/frozen thermal zones inside W4 (Green Building: C1 and W4-FRZ-STG) and W5 (Grey Building: C2).
- Restructure virtual buffer to be W1-specific (V-BUF-TRD) and non-sellable.
- Insert virtual locations into the warehouses table as virtual warehouses to support full transaction flow.

## Tasks

### T1 — Migration `054_adjust_warehouses_and_zones.sql`
**File:** `migrations/054_adjust_warehouses_and_zones.sql` (new)
- Wrap in transaction block `BEGIN; ... COMMIT;`
- Delete `WH-06` and `WH-07` from `warehouses`.
- Update `WH-01` to `WH-05` to have codes `W1` to `W5` and updated names.
- Insert virtual warehouses `V-BUF-TRD`, `V-DMG`, `V-CLR`, `V-KILL`, `V-PACK` into `warehouses`.
- Update `virtual_locations` metadata (rename `V-BUF` to `V-BUF-TRD`, set `is_sellable = false`).
- Seed zone `W4-FRZ-STG` under `W4` as a frozen zone.

- [x] T1 complete

### T2 — Align API endpoints
**Files:** `app/api/warehouses/route.ts` & `app/api/admin/virtual-locations/route.ts`
- Ensure `/api/warehouses` only returns active physical warehouses (e.g. `code NOT LIKE 'V-%'`).
- Ensure `/api/admin/virtual-locations` uses `V-BUF-TRD` instead of `V-BUF`.

- [x] T2 complete

### T3 — UI Restructuring
**File:** `app/app/admin/warehouses/page.tsx`
- Filter list of physical warehouses in UI to exclude `V-*` codes so that virtual warehouses are not displayed as physical entities.
- Verify zone listing displays correct codes and types (including the new `W4-FRZ-STG` zone).

- [x] T3 complete

### T4 — Update Agent Memory
**File:** `_notes/02_Agent_Memory/current-state.md`
- Update "Migration Numbers" to `054`.
- Add `W4-FRZ-STG` zone and physical/virtual warehouse realignment details to "DB Facts".

- [x] T4 complete

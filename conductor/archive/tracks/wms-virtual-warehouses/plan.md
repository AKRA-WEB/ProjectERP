---
track: wms-virtual-warehouses
phase: V2.0-P1
sequence: 2
status: Verified
owner: Chen
created: 2026-05-23
depends_on: [multi-bu-foundation]
estimate: M
assigned_to: [Paku]
tags: [v2-orion, wms, virtual-warehouse, schema]
---

# WMS Virtual Warehouses & Thermal Zones

## Goal
Introduce thermal zones and virtual locations on top of physical warehouses so that quarantine, damage, clearance, scrap, buffer, and repack-staging stock are tracked separately from sellable stock — and so cold-chain enforcement can later key off a thermal classification.

## Scope IN
- New table `warehouse_zones(id, warehouse_id, code, thermal_type ENUM('ambient','sensitive','chilled','frozen'), created_at)`.
- New table `virtual_locations(id, code UNIQUE, purpose ENUM('buffer','damage','clearance','scrap','repack'), is_sellable BOOL, visible_channels TEXT[], created_at)`.
- Seed thermal zones: `S1` on W3, `C1` on W4, `C2` on W5.
- Seed virtual locations: `V-BUF` (buffer), `V-DMG` (damage), `V-CLR` (clearance, `visible_channels=['TRD']`), `V-KILL` (scrap, `is_sellable=false`), `V-PACK` (repack staging, `is_sellable=false`).
- Extend `stock_ledger.entry_type` enum with: `quarantine_in`, `quarantine_out`, `scrap`, `clearance_move`.
- Wire virtual locations into the existing stock-ledger insert path so that movements between physical and virtual locations are recorded.

## Scope OUT
- UI for moving stock between virtual locations beyond a minimal admin form. Full Repack flow lives in track #14.
- Per-zone temperature telemetry / IoT integration. V2.2 candidate.

## Acceptance Criteria
1. `warehouse_zones` and `virtual_locations` tables created and seeded per the seed list above.
2. `stock_ledger.entry_type` enum contains the four new values; existing rows remain valid.
3. Inventory-by-warehouse query continues to return correct sellable totals (excluding non-sellable virtuals).
4. Clearance virtual `V-CLR` is visible only when channel `TRD` is in scope.
5. `npm run lint` and `npx tsc --noEmit` pass.

## Migrations
- `042_wms_virtual_warehouses.sql` — create both tables, seed thermal zones and virtual locations, extend `stock_ledger.entry_type` enum.

## API routes
- New: `GET /api/admin/warehouse-zones` (admin only).
- New: `POST /api/admin/warehouse-zones` (admin only).
- New: `PATCH /api/admin/warehouse-zones/[id]` (admin only).
- New: `DELETE /api/admin/warehouse-zones/[id]` (admin only).
- New: `GET /api/admin/virtual-locations` (admin only).
- Touched: `types/api.ts` accepts the new entry types.

## UI screens
- Touched: `app/app/admin/warehouses/page.tsx` — show zones and virtual locations under each warehouse with expandable sub-rows and add/edit dialogs.
- Touched: `app/app/inventory/ledger/page.tsx` — extend entry types filter and display translations.

## Test plan
- Manual: verify thermal zones and virtual locations list on warehouses page. Add, edit, and delete thermal zones.
- Confirm compilation and lint checks pass cleanly.

## Risks
- Adding enum values requires `ALTER TYPE ... ADD VALUE` which cannot run inside a transaction on older Postgres versions; migration must run outside the script's BEGIN/COMMIT or use a guarded `IF NOT EXISTS`.
- Visible-channels filter must be respected everywhere clearance stock is referenced — easy to miss in legacy reports.

## Verified Facts (pre-plan)
- `stock_ledger.entry_type` is the column; its enum type name is **`ledger_entry_type`** (defined in `migrations/001_enums.sql:42`). Reference the enum name precisely.
- `warehouses.id` is UUID; expect `warehouse_id UUID` everywhere.
- Seeded warehouse codes (per `migrations/012_seed_dev.sql`): W1..W5.
- `stock_ledger` insert-only — never UPDATE/DELETE.
- Existing extension pattern (see `migrations/037_repack_system.sql:12`): `ALTER TYPE ledger_entry_type ADD VALUE IF NOT EXISTS '<value>';` — placed OUTSIDE the `BEGIN/COMMIT` block (no transaction wrapper).

---

## Tasks

### T1 — Migration `042_wms_virtual_warehouses.sql`
**File:** `migrations/042_wms_virtual_warehouses.sql` (new)
**Operation:** add migration

**Details:**
- Top of file (outside any transaction block) — enum extensions:
  - `ALTER TYPE ledger_entry_type ADD VALUE IF NOT EXISTS 'quarantine_in';`
  - `ALTER TYPE ledger_entry_type ADD VALUE IF NOT EXISTS 'quarantine_out';`
  - `ALTER TYPE ledger_entry_type ADD VALUE IF NOT EXISTS 'scrap';`
  - `ALTER TYPE ledger_entry_type ADD VALUE IF NOT EXISTS 'clearance_move';`
  - `ALTER TYPE ledger_entry_type ADD VALUE IF NOT EXISTS 'repack_stage_in';` (used later by track 14)
  - `ALTER TYPE ledger_entry_type ADD VALUE IF NOT EXISTS 'repack_stage_out';`
- `DO $$ BEGIN CREATE TYPE warehouse_zone_thermal_type AS ENUM ('ambient','sensitive','chilled','frozen'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;`
- `DO $$ BEGIN CREATE TYPE virtual_location_purpose AS ENUM ('buffer','damage','clearance','scrap','repack'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;`
- Wrap the rest in `BEGIN; ... COMMIT;`:
  1. `CREATE TABLE IF NOT EXISTS warehouse_zones ( id UUID PRIMARY KEY DEFAULT gen_random_uuid(), warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE, code VARCHAR(20) NOT NULL, thermal_type warehouse_zone_thermal_type NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE(warehouse_id, code) );`
  2. `CREATE TABLE IF NOT EXISTS virtual_locations ( id UUID PRIMARY KEY DEFAULT gen_random_uuid(), code VARCHAR(20) NOT NULL UNIQUE, purpose virtual_location_purpose NOT NULL, is_sellable BOOLEAN NOT NULL DEFAULT TRUE, visible_channels TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[], created_at TIMESTAMPTZ NOT NULL DEFAULT NOW() );`
  3. Seed zones (S1 on W3, C1 on W4, C2 on W5):
     ```sql
     INSERT INTO warehouse_zones (warehouse_id, code, thermal_type)
     SELECT id, 'S1', 'sensitive' FROM warehouses WHERE code='W3'
     ON CONFLICT (warehouse_id, code) DO NOTHING;
     -- repeat for ('W4','C1','chilled'), ('W5','C2','frozen')
     ```
  4. Seed virtual locations (idempotent `ON CONFLICT (code) DO NOTHING`):
     - V-BUF / buffer / true / ARRAY[]::TEXT[]
     - V-DMG / damage / false / ARRAY[]::TEXT[]
     - V-CLR / clearance / true / ARRAY['TRD']::TEXT[]
     - V-KILL / scrap / false / ARRAY[]::TEXT[]
     - V-PACK / repack / false / ARRAY[]::TEXT[]
  5. `CREATE INDEX IF NOT EXISTS idx_warehouse_zones_warehouse ON warehouse_zones(warehouse_id);`

**Quality Gate:**
- Transaction boundary: `BEGIN`/`COMMIT` (table create + seed). Enum `ALTER TYPE` is outside.
- Doc number generation: N/A.
- Parent→child inserts: zones seed `SELECT id FROM warehouses` is a single-statement parent lookup; no parent→child issue.
- Side effects: none (no ledger writes during migration).
- Response shape: N/A.

- [x] T1 complete

### T2 — Types in `types/index.ts` / `types/db.ts`
**File:** `types/db.ts` (extend) + `types/index.ts` (re-export)
**Operation:** extend

**Details:**
- Add:
  ```ts
  export type WarehouseZoneThermalType = 'ambient' | 'sensitive' | 'chilled' | 'frozen';
  export type VirtualLocationPurpose = 'buffer' | 'damage' | 'clearance' | 'scrap' | 'repack';
  export interface WarehouseZone { id: string; warehouse_id: string; code: string; thermal_type: WarehouseZoneThermalType; created_at: string; }
  export interface VirtualLocation { id: string; code: string; purpose: VirtualLocationPurpose; is_sellable: boolean; visible_channels: string[]; created_at: string; }
  ```
- Re-export from `types/index.ts`.

**Quality Gate:** N/A (type-only).

- [x] T2 complete

### T3 — `GET /api/admin/warehouse-zones`
**File:** `app/api/admin/warehouse-zones/route.ts` (new)
**Operation:** create

**Details:**
- Standard auth preamble.
- `assertRole(u, ['admin','manager','auditor'])`.
- Accept optional `warehouse_id` query param; if provided, filter.
- Query: `SELECT id, warehouse_id, code, thermal_type, created_at FROM warehouse_zones WHERE ($1::uuid IS NULL OR warehouse_id = $1) ORDER BY code ASC`.
- `apiSuccess({ data: rows })`.

**Quality Gate:**
- Transaction boundary: N/A (read).
- Doc number generation: N/A.
- Parent→child inserts: N/A.
- Side effects: none.
- Response shape: `apiSuccess({ data: WarehouseZone[] })`.

- [x] T3 complete

### T4 — `GET /api/admin/virtual-locations`
**File:** `app/api/admin/virtual-locations/route.ts` (new)
**Operation:** create

**Details:**
- Standard auth preamble; `assertRole(u, ['admin','manager','auditor'])`.
- Query: `SELECT id, code, purpose, is_sellable, visible_channels, created_at FROM virtual_locations ORDER BY code ASC`.
- `apiSuccess({ data: rows })`.

**Quality Gate:** `apiSuccess({ data: VirtualLocation[] })`. Others N/A.

- [x] T4 complete

### T5 — Extend warehouse admin page
**File:** `app/app/admin/warehouses/page.tsx`
**Operation:** extend

**Details:**
- Add an expandable details panel inside the warehouse table. When clicked, it smoothly slides open using modern micro-animations to present:
  - **Thermal Zones:** A table listing zones for the warehouse with inline badges (`sensitive`, `chilled`, `frozen`) and actions to Add, Edit, or Delete.
  - **Virtual Locations:** A read-only reference list of global virtual locations, displaying their purposes and statuses.
- Build interactive modal dialogs for adding, editing, and deleting thermal zones under warehouses, ensuring instant UI synchronization.
- Use components and design paradigms from `components/ui/index.ts`.

**Quality Gate:** N/A (UI).

- [x] T5 complete

### T6 — Register new ledger entry types on API types & Inventory UI
**File:** `types/api.ts` (extend) + `app/app/inventory/ledger/page.tsx` (extend)
**Operation:** extend

**Details:**
- Extend the `LedgerEntryType` union type in `types/api.ts` to include: `'quarantine_in' | 'quarantine_out' | 'scrap' | 'clearance_move' | 'repack_stage_in' | 'repack_stage_out'`.
- In `app/app/inventory/ledger/page.tsx`, extend the `ENTRY_TYPES` array and `ENTRY_LABELS` lookup mapping with the new entry types and their premium Thai bilingual translations.

**Quality Gate:**
- Confirm `npx tsc --noEmit` returns zero compilation errors.
- Confirm `npm run lint` returns zero linting warnings.

- [x] T6 complete

### T7 — Update `current-state.md`
**File:** `_notes/02_Agent_Memory/current-state.md`
**Operation:** extend

**Details:** Append: `warehouse_zones(warehouse_id, code, thermal_type)`, `virtual_locations(code, purpose, is_sellable, visible_channels)`, `ledger_entry_type` enum now includes `quarantine_in|quarantine_out|scrap|clearance_move|repack_stage_in|repack_stage_out`. Migration → 042.

- [x] T7 complete

## Definition of Done

- [x] All tasks T1..T7 ticked
- [x] `npm run lint` passes
- [x] `npx tsc --noEmit` passes
- [x] Migration runs idempotently in dev DB
- [x] Manual smoke: insert quarantine_in ledger entry; V-DMG balance increases, source warehouse decreases
- [x] `_notes/02_Agent_Memory/current-state.md` updated
- [x] Status in `conductor/index.md` set to `Verified`

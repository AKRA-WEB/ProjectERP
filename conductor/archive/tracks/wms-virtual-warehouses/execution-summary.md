# Execution Summary — `wms-virtual-warehouses`

Introduced thermal zones and virtual locations on top of physical warehouses so that quarantine, damage, clearance, scrap, buffer, and repack-staging stock are tracked separately from sellable stock.

---

### Task 1 — Migration `042_wms_virtual_warehouses.sql`
- **File changed:** `migrations/042_wms_virtual_warehouses.sql` lines 1–55
- **Key change:**
  ```sql
  -- migrations/042_wms_virtual_warehouses.sql
  COMMIT;
  ALTER TYPE ledger_entry_type ADD VALUE IF NOT EXISTS 'quarantine_in';
  ...
  BEGIN;
  CREATE TABLE IF NOT EXISTS warehouse_zones (...);
  CREATE TABLE IF NOT EXISTS virtual_locations (...);
  ```
- **Verify:** `npx tsx --env-file=.env lib/db/run-migrate.ts` -> Applied migration successfully.

---

### Task 2 — Types in `types/db.ts` / `types/api.ts`
- **File changed:** `types/db.ts` lines 145–165 & `types/api.ts` lines 29–30
- **Key change in `types/db.ts`:**
  ```typescript
  export type WarehouseZoneThermalType = 'ambient' | 'sensitive' | 'chilled' | 'frozen';
  export type VirtualLocationPurpose = 'buffer' | 'damage' | 'clearance' | 'scrap' | 'repack';
  ...
  ```
- **Key change in `types/api.ts`:**
  ```typescript
  export type LedgerEntryType = 'grn_receipt' | ... | 'quarantine_in' | 'quarantine_out' | 'scrap' | 'clearance_move' | 'repack_stage_in' | 'repack_stage_out';
  ```
- **Verify:** `npx tsc --noEmit` -> 0 errors.

---

### Task 3 — `GET` / `POST` / `PATCH` / `DELETE` `/api/admin/warehouse-zones`
- **Files changed:** `app/api/admin/warehouse-zones/route.ts` & `app/api/admin/warehouse-zones/[id]/route.ts`
- **Key change:** Implemented full REST scoping endpoints for creating, retrieving, editing, and deleting thermal zones under specific physical warehouses with manager/admin checks.
- **Verify:** `npx tsc --noEmit` -> 0 errors.

---

### Task 4 — `GET` `/api/admin/virtual-locations`
- **File changed:** `app/api/admin/virtual-locations/route.ts`
- **Key change:**
  ```typescript
  export async function GET() {
    ...
    const locations = await query(`SELECT id, code, purpose, is_sellable, visible_channels, created_at FROM virtual_locations ORDER BY code ASC`);
    return apiSuccess(locations);
  }
  ```
- **Verify:** `npx tsc --noEmit` -> 0 errors.

---

### Task 5 — Extend warehouse admin page
- **File changed:** `app/app/admin/warehouses/page.tsx` lines 90–430
- **Key change:** Added expandable table sub-rows dynamically displaying and editing/deleting Thermal Zones and listing global Virtual Locations in a beautifully responsive side-by-side CSS layout.
- **Verify:** `npx next lint` -> ✔ No ESLint warnings or errors.

---

### Task 6 — Register new ledger entry types on Inventory UI
- **File changed:** `app/app/inventory/ledger/page.tsx` lines 45–65
- **Key change:**
  ```typescript
  const ENTRY_TYPES = [ ... 'quarantine_in', 'quarantine_out', 'scrap', 'clearance_move', 'repack_stage_in', 'repack_stage_out' ];
  const ENTRY_LABELS: Record<string, string> = { ... quarantine_in: 'กักกันเข้า (Quarantine In)', ... };
  ```
- **Verify:** `npx tsc --noEmit` & `npx next lint` -> Passed with 0 errors.

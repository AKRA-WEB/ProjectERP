# Execution Summary — `adjust-warehouses-and-thermal-zones`

Aligned physical warehouses, thermal zones, and virtual status locations with the newly approved Business Unit (BU) directives.

---

### Task 1 — Migration `054_adjust_warehouses_and_zones.sql`
- **File changed:** `migrations/054_adjust_warehouses_and_zones.sql` lines 1–43 (new file)
- **Key changes:**
  * Deleted standalone cold storage warehouses `WH-06` and `WH-07`.
  * Renamed physical warehouses `WH-01` to `WH-05` to match `W1` to `W5` codes and Thai/English names.
  * Registered virtual status locations (`V-BUF-TRD`, `V-DMG`, `V-CLR`, `V-KILL`, `V-PACK`) as virtual warehouses in the `warehouses` table to support transaction flow.
  * Synchronized `virtual_locations` metadata (renamed `V-BUF` to `V-BUF-TRD` and set `is_sellable = false`).
  * Seeded the new sub-zero operational freezer zone `W4-FRZ-STG` under `W4`.
- **Verify:**
  * Ran `npx tsx --env-file=.env lib/db/run-migrate.ts` -> Applied migration successfully.
  * Verified DB contents using a dedicated check script.

---

### Task 2 — Align API endpoints
- **Files changed:** `app/api/warehouses/route.ts` & `app/api/admin/warehouses/route.ts`
- **Key changes:**
  * Filtered out virtual warehouses (starting with `V-`) from the active physical warehouses list GET endpoint (`/api/warehouses`) and the admin list GET endpoint (`/api/admin/warehouses`).
- **Verify:**
  * `npx tsc --noEmit` -> 0 errors.
  * `npm run lint` -> Passed with 0 errors.

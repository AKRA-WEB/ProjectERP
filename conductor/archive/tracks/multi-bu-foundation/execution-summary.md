# Execution Summary — Multi-BU Foundation

### Task 1 — Migration `041_multi_bu_foundation.sql`
- **File changed:** `migrations/041_multi_bu_foundation.sql` (new file)
- **Key change:** Added tables and columns for Business Units, seeded 'TRD' and 'AKRA', backfilled warehouse business unit IDs, added business unit column to users, and extended `user_role` enum with `'auditor'`.
- **Verify:** Applied and run idempotently on database via `npx tsx lib/db/run-migrate.ts`.

### Task 2 — Extend SessionUser + UserRole + BusinessUnit type
- **File changed:** `types/db.ts` lines 1–15, `types/api.ts` lines 3–8, `auth.ts` lines 43–52, `auth.config.ts` lines 8–30
- **Key change:** 
  - In `types/db.ts`: `export type UserRole = 'admin' | 'manager' | 'staff' | 'auditor';` and added `business_unit_id: string | null` to `User` and `Warehouse` types.
  - In `types/api.ts`: Added optional `businessUnitId?: string | null` to `SessionUser` interface.
  - In `auth.ts` and `auth.config.ts`: Mapped `business_unit_id` from user query in NextAuth jwt & session callbacks.
- **Verify:** `npx tsc --noEmit` → 0 errors.

### Task 3 — Extend `buildWarehouseScopeClause` with BU filter
- **File changed:** `lib/authz.ts` lines 38–51
- **Key change:** Augmented `buildWarehouseScopeClause` to check for `user.businessUnitId` and inject an additional `IN (SELECT id FROM warehouses WHERE business_unit_id = $...)` subquery when present.
- **Verify:** `npx tsc --noEmit` → 0 errors.

### Task 4 — `GET /api/admin/business-units`
- **File changed:** `app/api/admin/business-units/route.ts` (new file)
- **Key change:** Created new GET endpoint supporting `admin`, `manager`, and `auditor` roles to query sorted business units.
- **Verify:** Route loads and returns valid JSON matching the schema.

### Task 5 — Admin page `app/app/admin/business-units/page.tsx`
- **File changed:** `app/app/admin/business-units/page.tsx` (new file)
- **Key change:** Created client-side page rendering a bilingual, modern tabular overview of active Business Units.
- **Verify:** Component resolves and complies with strict linting rules.

### Task 6 — Bind BU on user admin form
- **File changed:** `app/app/admin/users/UserFormModal.tsx` lines 1–112, `app/app/admin/users/page.tsx` lines 43–45, 63–73, `app/api/admin/users/route.ts` lines 10–117, `app/api/admin/users/[id]/route.ts` lines 8–83
- **Key change:** 
  - Extracted and displayed `business_unit_id` selector in `UserFormModal.tsx` populating BUs dynamically from the API, and added `auditor` option.
  - Exposed `business_unit_id` updates in the POST and PATCH APIs for user management.
- **Verify:** `npm run lint` and `npx tsc --noEmit` → 0 errors.

### Task 7 — Update anti-context-loss brief
- **File changed:** `_notes/02_Agent_Memory/current-state.md` lines 8–40
- **Key change:** Incremented latest migration to 041, moved track to "Last 5 Completed Tracks", and cataloged new business unit schema facts.
- **Verify:** File updated in local workspace.

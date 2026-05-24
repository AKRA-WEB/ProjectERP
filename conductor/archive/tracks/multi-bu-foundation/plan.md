---
track: multi-bu-foundation
phase: V2.0-P1
sequence: 1
status: Verified
owner: Chen
created: 2026-05-23
depends_on: []
estimate: M
assigned_to: [Paku]
tags: [v2-orion, multi-bu, schema, foundation]
---

# Multi-BU Foundation

## Goal
Establish two-Business-Unit partitioning (BU1 TRD Bakermart, BU2 Akra Wholesale) by stamping `business_unit_id` on warehouses and extending the existing warehouse-scope helper to filter accessible warehouses by BU. Adds the `auditor` user role.

## Scope IN
- New table `business_units(id, code UNIQUE, name_th, name_en, created_at)`.
- New column `warehouses.business_unit_id FK business_units(id)`.
- Seed BU1 (`TRD`) and BU2 (`AKRA`); backfill existing warehouses W1->TRD, W2..W5->AKRA.
- Extend `user_role` enum to add `auditor`.
- Extend `buildWarehouseScopeClause()` to optionally filter by BU when user has a BU restriction.
- Optional `users.business_unit_id` (NULL = cross-BU; non-NULL = restricted) for staff hard-binding.

## Scope OUT
- Stamping `business_unit_id` on transactional tables (PO/SO/etc). Channel column on order header handles that (see track #7).
- BU-specific Chart of Accounts. Single CoA stays in V2.0; revisit in V2.2.

## Acceptance Criteria
1. `business_units` table created with BU1+BU2 rows.
2. Every existing warehouse has a non-null `business_unit_id`.
3. `auditor` enum value added; existing routes unaffected.
4. Warehouse-scope helper returns only the BUs the user is allowed to see; staff without BU restriction see all (back-compat).
5. `npm run lint` and `npx tsc --noEmit` pass.

## Migrations
- `041_multi_bu_foundation.sql` — create table, add column with FK, seed BUs, backfill warehouses, add `auditor` to enum.

## API routes
- New: `GET /api/admin/business-units` (admin/auditor).
- Touched: `lib/db/warehouse-scope.ts` (extend `buildWarehouseScopeClause`).
- Touched: any route that consumes warehouse scope inherits new behavior — no signature change.

## UI screens
- New: `app/admin/business-units/page.tsx` (read-only list for V2.0).
- Touched: User admin form to allow optional BU binding.

## Test plan
- Manual: log in as user with BU restriction; confirm warehouses list filtered.
- Lint + tsc.
- DB-level: verify FK + enum migration runs idempotently in dev.

## Risks
- Back-compat for users without `business_unit_id` — must default to "all BUs" visible. Mis-default would lock everyone out.
- Enum extension on `user_role` requires careful ordering (`ALTER TYPE ... ADD VALUE`).

## Verified Facts (pre-plan)
- `warehouses.id` is **UUID** (migration `002_core_tables.sql:1`). All FK columns must be UUID.
- `users.role user_role NOT NULL DEFAULT 'staff'` — enum defined in `migrations/001_enums.sql:2`: `('admin','manager','staff')`.
- Helper `buildWarehouseScopeClause(user, columnExpr, paramOffset)` lives in `lib/authz.ts:38` (not `lib/db/warehouse-scope.ts`).
- `SessionUser` has `assignedWarehouseIds: string[]` (camelCase) — verified in `lib/authz.ts:21`. Defined in `types/db.ts`/`types/api.ts`.
- Latest migration is `040_bilingual_names_standardization.sql`; next slot = `041_*.sql`.
- API response helpers: `apiSuccess`, `apiError`, `apiValidationError` from `lib/api-response`.
- Existing seeded warehouse codes (per `migrations/012_seed_dev.sql`): `W1..W5`.

---

## Tasks

> Gemini executes top-to-bottom. Tick each `- [x]` to `- [x]` after completion.

### T1 — Migration `041_multi_bu_foundation.sql`
**File:** `migrations/041_multi_bu_foundation.sql` (new file)
**Operation:** add migration

**Details:**
- Wrap entire body in `BEGIN; ... COMMIT;` EXCEPT the `ALTER TYPE user_role ADD VALUE` statements (Postgres requires those outside a transaction; place them OUTSIDE the `BEGIN`/`COMMIT` block at the top of the file with `DO $$ BEGIN ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'auditor'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;`).
- Inside the transaction:
  1. `CREATE TABLE IF NOT EXISTS business_units ( id UUID PRIMARY KEY DEFAULT gen_random_uuid(), code VARCHAR(20) NOT NULL UNIQUE, name_th VARCHAR(255) NOT NULL, name_en VARCHAR(255) NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW() );`
  2. `INSERT INTO business_units (code, name_th, name_en) VALUES ('TRD','TRD Bakermart','TRD Bakermart'), ('AKRA','Akra Wholesale','Akra Wholesale') ON CONFLICT (code) DO NOTHING;`
  3. `ALTER TABLE warehouses ADD COLUMN IF NOT EXISTS business_unit_id UUID REFERENCES business_units(id);`
  4. `UPDATE warehouses SET business_unit_id = (SELECT id FROM business_units WHERE code='TRD') WHERE code='W1' AND business_unit_id IS NULL;`
  5. `UPDATE warehouses SET business_unit_id = (SELECT id FROM business_units WHERE code='AKRA') WHERE code IN ('W2','W3','W4','W5') AND business_unit_id IS NULL;`
  6. `ALTER TABLE users ADD COLUMN IF NOT EXISTS business_unit_id UUID REFERENCES business_units(id);` (NULL = cross-BU).
  7. `CREATE INDEX IF NOT EXISTS idx_warehouses_bu ON warehouses(business_unit_id);`
  8. `CREATE INDEX IF NOT EXISTS idx_users_bu ON users(business_unit_id) WHERE business_unit_id IS NOT NULL;`

**Quality Gate:**
- Transaction boundary: `BEGIN`/`COMMIT` (around table create + alter + backfill); `ALTER TYPE` lives outside the transaction.
- Doc number generation: N/A.
- Parent→child inserts: N/A (single-level seed only).
- Side effects: none (no stock_ledger / balance).
- Response shape: N/A (migration).

- [x] T1 complete

### T2 — Extend SessionUser + UserRole + BusinessUnit type
**File:** `types/db.ts` (extend) + `types/index.ts` (re-export)
**Operation:** extend

**Details:**
- In `types/db.ts`: change `export type UserRole = 'admin' | 'manager' | 'staff';` → `export type UserRole = 'admin' | 'manager' | 'staff' | 'auditor';`.
- Add field on the DB user shape: `business_unit_id: string | null;`.
- In `types/api.ts` (where `SessionUser` is declared) add optional `businessUnitId?: string | null` (camelCase to match existing `assignedWarehouseIds`).
- Add new exported type:
  ```ts
  export interface BusinessUnit {
    id: string;
    code: 'TRD' | 'AKRA' | string;
    name_th: string;
    name_en: string;
    created_at: string;
  }
  ```
- Re-export `BusinessUnit` from `types/index.ts`.
- Update NextAuth session mapping (search: `Grep` for `session.user` in `auth.ts` or `auth.config.ts`) to populate `businessUnitId` from the DB row.

**Quality Gate:**
- Transaction boundary: N/A.
- Doc number generation: N/A.
- Parent→child inserts: N/A.
- Side effects: none.
- Response shape: N/A (type-only).

- [x] T2 complete

### T3 — Extend `buildWarehouseScopeClause` with BU filter
**File:** `lib/authz.ts`
**Operation:** extend

**Details:**
- Locate `buildWarehouseScopeClause` (line ~38). Add new optional argument or augment the existing clause: when `user.role !== 'admin'` AND `user.businessUnitId` is non-null, the helper must additionally filter joined warehouses by BU.
- Because the current clause filters by `assignedWarehouseIds` directly (UUID array), BU filtering must operate on a separate subquery: `${columnExpr} IN (SELECT id FROM warehouses WHERE business_unit_id = $${paramOffset})` combined with the existing assignment clause via `AND`.
- Preserve `paramOffset` increment contract: returned `params` array length must match number of placeholders used.
- New shape returned: `{ clause: string; params: unknown[] }` — unchanged signature; do NOT add new positional parameter (caller code expects 3 args).

**Quality Gate:**
- Transaction boundary: N/A.
- Doc number generation: N/A.
- Parent→child inserts: N/A.
- Side effects: none.
- Response shape: helper return shape unchanged.

- [x] T3 complete

### T4 — `GET /api/admin/business-units`
**File:** `app/api/admin/business-units/route.ts` (new file)
**Operation:** create

**Details:**
- Use the standard route preamble:
  ```ts
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;
  try { assertRole(u, ['admin','manager','auditor']); } catch { return apiError('Forbidden', 403); }
  ```
- Query: `SELECT id, code, name_th, name_en, created_at FROM business_units ORDER BY code ASC`.
- Return: `apiSuccess({ data: rows })`.

**Quality Gate:**
- Transaction boundary: N/A (read-only).
- Doc number generation: N/A.
- Parent→child inserts: N/A.
- Side effects: none.
- Response shape: `apiSuccess({ data: BusinessUnit[] })`.

- [x] T4 complete

### T5 — Admin page `app/admin/business-units/page.tsx`
**File:** `app/admin/business-units/page.tsx` (new file)
**Operation:** create

**Details:**
- `'use client'` directive at top.
- `useEffect` fetch `/api/admin/business-units`, render `<table>` with code / name_th / name_en columns.
- All components from `components/ui/index.ts` (no inline raw HTML for buttons).
- Bilingual: Thai primary, English secondary.

**Quality Gate:**
- Transaction boundary: N/A.
- Doc number generation: N/A.
- Parent→child inserts: N/A.
- Side effects: none.
- Response shape: N/A (UI).

- [x] T5 complete

### T6 — Bind BU on user admin form
**File:** locate via `Grep` for `assignedWarehouseIds` in `app/admin/users/**` (target file is typically `app/admin/users/[id]/page.tsx` and matching POST route under `app/api/admin/users/`).
**Operation:** extend

**Details:**
- UI: add `<Select>` for Business Unit listing BUs from `/api/admin/business-units`, with an explicit "All BUs (cross-BU)" empty option mapped to `null`.
- API: extend the PATCH/POST handler to accept `business_unit_id: string | null` and `UPDATE users SET business_unit_id = $X WHERE id = $Y;` — gate to `admin` role only.

**Quality Gate:**
- Transaction boundary: single-statement UPDATE (no transaction needed).
- Doc number generation: N/A.
- Parent→child inserts: N/A.
- Side effects: none.
- Response shape: `apiSuccess({ id, business_unit_id })`.

- [x] T6 complete

### T7 — Update `_notes/02_Agent_Memory/current-state.md`
**File:** `_notes/02_Agent_Memory/current-state.md`
**Operation:** extend

**Details:**
- Append under DB Facts: `business_units(id UUID, code, name_th, name_en)` · `warehouses.business_unit_id UUID FK` · `users.business_unit_id UUID FK NULL` · `user_role` enum now includes `auditor`.
- Bump latest migration number to 041.
- Append track to "Last 5 Completed Tracks".

**Quality Gate:** N/A (memory note).

- [x] T7 complete

## Definition of Done

- [x] All tasks T1..T7 ticked
- [x] `npm run lint` passes
- [x] `npx tsc --noEmit` passes
- [x] Migration runs idempotently in dev DB
- [x] Manual smoke: login as BU-restricted user, confirm only their BU's warehouses visible
- [x] `_notes/02_Agent_Memory/current-state.md` updated
- [x] Status in `conductor/index.md` set to `Completed` (Gemini self-updates)


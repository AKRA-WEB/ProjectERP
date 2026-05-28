# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Purpose

BUYMORE (THAILAND) COMPANY LIMITED — Full ERP platform on Next.js 15 + PostgreSQL. Modules: WMS, POS, Sales, Accounting, HR, BOM. See `docs/architecture.md` for route layout.

## Commands

```bash
npm run dev          # start dev server (Next.js 15)
npm run build        # production build
npm run lint         # ESLint only
npm run qa:verify    # lint + tsc --noEmit (zero-emission check — run before marking any task done)
npm run migrate      # run SQL migrations in order
npm run migrate:seed # seed dev data
npm run track:sweep  # archive verified conductor tracks
```

No test suite. `npm run qa:verify` must pass (0 errors) before any track is marked Completed/Verified.

## Environment

```
DATABASE_URL=postgresql://user:pass@host:5432/dbname
NEXTAUTH_SECRET=<random-string>
NEXTAUTH_URL=http://localhost:3000
```

## AI Workflow Protocol

**Triggers:**
- **`Init`** → git pull + track:sweep + load current-state & pitfalls + report readiness.
- **`Architect: <requirement>`** → Create `conductor/tracks/<name>/plan.md` + update `conductor/index.md`. Do NOT write code.
- **`Go`** → Implement first `Active`/`Rework Required` track → `npm run qa:verify` (0 errors) → write `execution-summary.md` → `npm run track:sweep` → **STOP. Do not proceed to next track.**
- **`Summary`** → Write `execution-summary.md` with exact lines modified.

Full protocol: `docs/AI_WORKFLOW_GUIDE.md` · `conductor/PROTOCOLS.md`

### Session Start (MANDATORY)

1. `git pull origin master`
2. `npm run track:sweep`
3. Read `_notes/02_Agent_Memory/current-state.md` (DB facts, latest migration #, active tracks)
4. Read `_notes/02_Agent_Memory/pitfalls.md`

### Output Silence Mode (MANDATORY)

No conversational text during execution. Tool calls only. One-paragraph summary after the entire track is done — exact files changed + validation results.

## Architecture

**Stack:** Next.js 15 App Router · React 19 · TypeScript strict · PostgreSQL (raw `pg`) · NextAuth v5 · Zod · Tailwind CSS

### Route Layout

```
app/
  login/          # public auth page
  (app)/          # authenticated group — layout.tsx wraps all with Sidebar + TopBar
    dashboard/ · products/ · vendors/ · customers/
    purchase-requests/ · purchase-orders/ · grn/ · rma/ · claims/
    transfers/ · cycle-counts/ · inventory/ledger/
    admin/users/ · admin/warehouses/
    pos/session/[id]/ · sales-orders/ · hr/ · bom/
    accounting/ · analytics/ · replenish/
  api/            # Next.js Route Handlers — all return JSON
```

### Adding a New Module

1. **Migration** — `migrations/0NN_<name>.sql` — never edit applied files, add new ones only.
2. **API routes** — `app/api/<module>/` — pattern: auth → Zod → warehouse scope → execute.
3. **Pages** — `app/(app)/<module>/` — `'use client'` + `lib/api-client.ts`.
4. **Sidebar** — add `navItems` entry in `components/layout/Sidebar.tsx` with `roles`. **Also add the path prefix to `WMS_PREFIXES` in the same file — missing this = empty sidebar on new module pages.**
5. **Types** — add status enums + interfaces to `types/index.ts` only.
6. **Stock** — write to `stock_ledger` only (never `stock_balances` directly).

## Critical Patterns

### Auth (every API route)

```typescript
import { auth } from '@/auth';
import { assertRole, buildWarehouseScopeClause } from '@/lib/authz';
import type { SessionUser } from '@/types';

const session = await auth(); if (!session) return apiError('Unauthorized', 401);
const u = session.user as unknown as SessionUser;
try { assertRole(u, ['manager', 'admin']); } catch { return apiError('Forbidden', 403); }
```

`UserRole` = `'admin' | 'manager' | 'staff' | 'auditor'`. Admins bypass all role and warehouse checks.

#### Fine-grained permission checks

```typescript
import { assertPermission, assertWarehouseAccess } from '@/lib/authz';

assertPermission(u, 'grn.approve');        // throws 403 if missing
assertWarehouseAccess(u, warehouseId);     // throws 403 if not assigned
```

### Warehouse scope (every GET list)

```typescript
const scope = buildWarehouseScopeClause(u, 'alias.warehouse_id', idx);
if (scope) { conditions.push(scope.clause); params.push(...scope.params); idx += scope.params.length; }
```

`buildWarehouseScopeClause` accounts for `u.businessUnitId` (BU-level filter) and `u.assignedWarehouseIds` (warehouse-level filter). Returns `null` for admins (no restriction).

### API responses

```typescript
import { apiSuccess, apiError, apiValidationError } from '@/lib/api-response';

return apiSuccess(data);        // 200
return apiError('msg', 404);
return apiValidationError(err); // 400
```

### Database client

```typescript
import { query, queryOne } from '@/lib/db/client';   // helpers — new pool connection each call
import pool from '@/lib/db/client';                   // default export — for transactions
```

**`pool` is the default export** — `import { pool }` (named) fails.  
**Pool is configured `max: 1` for Supabase Transaction Pooler** — do not raise this limit.  
**Inside a transaction, use `client.query()` exclusively.** Global `query()`/`queryOne()` open new pool connections, bypassing the active transaction.

Transaction pattern:
```typescript
const client = await pool.connect();
try {
  await client.query('BEGIN');
  // all writes via client.query(...)
  await client.query('COMMIT');
  return apiSuccess(result, 201);
} catch (e) {
  await client.query('ROLLBACK');
  throw e;
} finally { client.release(); }
```

### Frontend — api-client

```typescript
import { apiClient } from '@/lib/api-client';

await apiClient.get<T>(url);
await apiClient.post<T>(url, body);
await apiClient.patch<T>(url, body);
await apiClient.delete<T>(url, body?);  // note: delete, not del
```

Errors throw `ApiError` (has `.status` and `.details`).

### PATCH discriminant

```typescript
const PatchSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('approve') }),
  z.object({ action: z.literal('reject'), reason: z.string().min(1) }),
]);
```

### Stock ledger (insert-only)

```typescript
await client.query(
  `INSERT INTO stock_ledger (product_id, warehouse_id, entry_type, qty_change, reference_id, created_by)
   VALUES ($1, $2, $3, $4, $5, $6)`,
  [productId, warehouseId, entryType, qty, refId, userId]
);
// Trigger sync_stock_balances() fires automatically
```

Never UPDATE or DELETE `stock_ledger`. Never write to `stock_balances` directly (`qty_available` is a generated column).

### Document numbering

PostgreSQL `next_doc_number('PREFIX', 'seq_name')` — always inside transaction, never app-side.  
Sequences: `seq_pr` · `seq_po` · `seq_grn` · `seq_rma` · `seq_clm` · `seq_trf` · `seq_cc`

### Parent + child INSERT (PO / GRN / SO)

```typescript
const { rows: [{ next_doc_number: docNum }] } = await client.query(
  "SELECT next_doc_number('PO', 'seq_po') AS next_doc_number"
);
const { rows: [header] } = await client.query(
  `INSERT INTO purchase_orders (...) VALUES (...) RETURNING *`, [...]
);
for (const item of items) {
  await client.query(`INSERT INTO purchase_order_items (...) VALUES (...)`, [header.id, ...]);
}
```

**Batch INSERT stride:** the placeholder stride must equal the exact number of params pushed per row. Mismatch causes silent column offset on row 2+.

## Database Schema Facts

| Table | Key columns |
|-------|-------------|
| `users` | `id`, `name_th`, `name_en`, `email`, `role`, `assigned_warehouse_ids` — no `name` column |
| `products` | `id`, `sku`, `name_th`, `name_en`, `uom_id` |
| `stock_ledger` | `id`, `product_id`, `warehouse_id`, `entry_type`, `qty_change`, `reference_id` |
| `stock_balances` | `product_id`, `warehouse_id`, `qty_on_hand`, `qty_reserved`, `qty_available` (generated) |

Current migration: **069**. Next file: `070_<name>.sql`.

### Enum gotchas

- `ALTER TYPE ... ADD VALUE` cannot run inside a transaction. Break out with `COMMIT; ALTER TYPE ...; BEGIN;`.
- Explicit cast enum placeholders: `$2::enum_type_name` — PostgreSQL cannot infer custom enum types in parameterized queries.

## Frontend Patterns

- All pages `'use client'`. No RSC data fetching on client — use `lib/api-client.ts` (`apiClient`) only, never `fetch()` directly.
- Components from `components/ui/index.ts`: `Button`, `Input`, `Select`, `Modal`, `Table`, `Badge`, `StatusBadge`, `Pagination`. Read `interface Props` before use — never guess prop names.
- `formatDate()` / `formatCurrency()` / `formatDatetime()` from `lib/format.ts`. No `.toLocaleDateString()` or template literals for THB.
- **View Transitions:** use `lib/react-vts.tsx` bridge — never import `ViewTransition` from `react` directly. `transitionTypes` prop on `<Link>` requires augmentation in `types/next.d.ts`.
- **Hydration safety:** browser-only APIs (`localStorage`, `Date`, `window`) need two-pass render: `const [isMounted, setIsMounted] = useState(false); useEffect(() => { setIsMounted(true); }, []); if (!isMounted) return null;`
- Every list page needs `<Pagination>` — no unbounded renders.
- Bilingual: Thai primary, English secondary. Labels: `คลังสินค้า / Warehouse`.

## Business Logic

State machines + business rules → `_notes/00_Project_Map/state-machines.md`

- VAT 7% via `VAT_RATE` in `lib/constants.ts` — never hardcode `0.07`.
- PO auto-updates (`partially_received` / `fully_received`) after GRN stocking.
- Cycle count approval: stored proc `apply_cycle_count()` only.
- Status transitions: validate state machine BEFORE opening transaction; all side effects (stock ledger, PO updates) inside single transaction.

### Background Jobs

Nightly jobs live in `lib/jobs/` and are invoked by Vercel Cron (`vercel.json`) or via admin API routes:

| Job | Schedule | Trigger route |
|-----|----------|---------------|
| `hr_stats_snapshot` refresh | 01:00 UTC daily | `/api/admin/snapshots/refresh?target=hr_stats` |
| SKU performance refresh | on-demand | `/api/analytics/sku-performance/refresh` |
| Replenishment sweep | on-demand | `/api/admin/replenish/run-now` |
| Rebate accruals | on-demand | `POST /api/rebate/accruals` |

## Zero-Tolerance Rules

- No `as any`. Use `as unknown as T` only for NextAuth type casting.
- No `// TODO`, `// FIXME`, `// HACK`, or placeholder comments in completed work — build blocks on these.
- No `console.log/error/warn` in committed code.
- No string interpolation in SQL — parameterized queries (`$1, $2, ...`) only.
- All list queries must have `LIMIT`/`OFFSET`.
- Verify column names from migration files before writing queries.

## Conductor Workflow

Active tracks live in `conductor/tracks/`. Index: `conductor/index.md`. Archive: `conductor/archive/`.

Track plan frontmatter:
```yaml
---
track: feature-name
title: "Short description"
status: Active  # Active | Planned | Completed | Rework Required | Verified
created: YYYY-MM-DD
updated: YYYY-MM-DD
---
```

## Obsidian Integration

Vault = this folder. Hub: `_notes/HOME.md`.

```
_notes/
├── 00_Project_Map/    ← state machines, module summaries
├── 01_Decisions/      ← architecture decisions (Claude/Architect only)
├── 02_Agent_Memory/   ← current-state.md, pitfalls.md
├── 04_Debug_Log/      ← YYYY-MM-DD-topic.md bug logs
└── 05_Summaries/      ← changelogs
```

Rules: plan.md must have YAML frontmatter. Never write to `.obsidian/` or `_notes/daily/`.

## Knowledge Capture (after every task)

| Condition | Where to write |
|-----------|----------------|
| Reusable pattern found | `docs/skills/<skill>.md` — append `## ✅ Pattern` |
| Bug/trap discovered | `_notes/02_Agent_Memory/pitfalls.md` + relevant skill file |
| Architecture/schema decision | `_notes/01_Decisions/<topic>.md` |
| Track completed / new DB column / new API route | `_notes/02_Agent_Memory/current-state.md` |

If none apply → state "No new knowledge captured".

After marking any track `Verified` in `conductor/index.md`, run `npm run track:sweep` immediately.

# CLAUDE.md

BUYMORE (THAILAND) CO., LTD. — ERP on Next.js 15 + PostgreSQL (WMS, POS, Sales, Accounting, HR, BOM).

## Commands

```bash
npm run dev          # Next.js dev server
npm run build        # production build
npm run lint         # ESLint
npm run qa:verify    # lint + tsc --noEmit — must pass (0 errors) before marking any task done
npm run migrate      # run SQL migrations
npm run migrate:seed # seed dev data
npm run track:sweep  # archive verified tracks
```

## Environment

```
DATABASE_URL=postgresql://user:pass@host:5432/dbname
NEXTAUTH_SECRET=<random-string>
NEXTAUTH_URL=http://localhost:3000
```

## AI Workflow

| Trigger | Action |
|---------|--------|
| **`Init`** | git pull + track:sweep + read current-state + pitfalls + report readiness |
| **`Architect: <req>`** | Create `conductor/tracks/<name>/plan.md` + update `conductor/index.md`. No code. |
| **`Go`** | Execute first `Active`/`Rework Required` track → Auto-QA → Verified → track:sweep → **STOP** |
| **`Summary`** | Write `execution-summary.md` with exact lines modified |

Full protocol: `docs/AI_WORKFLOW_GUIDE.md` · `conductor/PROTOCOLS.md`

**Session Start:** (1) `git pull origin master` (2) `npm run track:sweep` (3) Read `_notes/02_Agent_Memory/current-state.md` (4) Read `_notes/02_Agent_Memory/pitfalls.md`

**Output Silence:** No conversational text during execution. Tool calls only. One-paragraph summary when track done.

### Execution Loop (Go — Self-Correcting)

Execute ONE track. Never auto-proceed.

1. Complete plan.md tasks → write `execution-summary.md`
2. Auto-QA: `npm run qa:verify` (0 errors) + deep audit vs `docs/skills/qa_audit_rules.md`
3. **Fail:** write `rework-plan.md` → set `Rework Required` → fix 🔴🟡 items → retry (max 3)
4. **Pass:** set plan.md + index.md → `Verified` → `npm run track:sweep`
5. Update `current-state.md` (last 5 tracks, new DB cols/routes, migration number)
6. STOP. Print SESSION REPORT. Wait for next `Go`.

```
=== SESSION COMPLETE ===
Tracks completed: [list]
Blockers: [HALT items]
Next: [QA: name / rework / plan]
```

Stop if: no Active/Rework tracks · HALT condition hit · 3 QA retries failed.

### Concurrency

1. **One Agent per Track** — one agent per track folder at a time.
2. **Active Lock** — Planner must not touch `plan.md` of Active track.
3. **Index as Truth** — `conductor/index.md` = live status. Read `execution-summary.md` before next plan.
4. **Contract-First** — plans include Zod schemas / TypeScript interfaces for all new API routes.
5. **Non-Blocking Halt** — blocked on Track A → `rework-plan.md` + `Rework Required` → move to next.
6. **Migration Integrity** — update migration number in `current-state.md` immediately after applying.

## Architecture

**Stack:** Next.js 15 App Router · React 19 · TypeScript strict · PostgreSQL (raw `pg`) · NextAuth v5 · Zod · Tailwind

```
app/
  login/      # public
  (app)/      # auth group — Sidebar + TopBar
    dashboard/ products/ vendors/ customers/ purchase-requests/ purchase-orders/
    grn/ rma/ claims/ transfers/ cycle-counts/ inventory/ledger/
    admin/users/ admin/warehouses/ pos/session/[id]/ sales-orders/ hr/ bom/
    accounting/ analytics/ replenish/
  api/        # Route Handlers — all return JSON
```

**New module:** (1) `migrations/0NN_<name>.sql` (2) `app/api/<module>/` (3) `app/(app)/<module>/` + `'use client'` (4) `navItems` + `WMS_PREFIXES` in `Sidebar.tsx` — **missing WMS_PREFIXES = empty sidebar** (5) enums/interfaces in `types/index.ts` only (6) stock → `stock_ledger` only.

## Critical Patterns

### Auth (every API route)

```typescript
import { auth } from '@/auth';
import { assertRole, buildWarehouseScopeClause, assertPermission, assertWarehouseAccess } from '@/lib/authz';
import type { SessionUser } from '@/types';

const session = await auth(); if (!session) return apiError('Unauthorized', 401);
const u = session.user as unknown as SessionUser;
try { assertRole(u, ['manager', 'admin']); } catch { return apiError('Forbidden', 403); }
// Fine-grained: assertPermission(u, 'grn.approve') · assertWarehouseAccess(u, warehouseId)
```

`UserRole` = `'admin' | 'manager' | 'staff' | 'auditor'`. Admins bypass all role + warehouse checks.

### Warehouse scope (every GET list)

```typescript
const scope = buildWarehouseScopeClause(u, 'alias.warehouse_id', idx);
if (scope) { conditions.push(scope.clause); params.push(...scope.params); idx += scope.params.length; }
```

### API responses

```typescript
import { apiSuccess, apiError, apiValidationError } from '@/lib/api-response';
return apiSuccess(data); // 200  |  apiError('msg', 404);  |  apiValidationError(err); // 400
```

### Database client

```typescript
import { query, queryOne } from '@/lib/db/client'; // helpers — new pool conn each call
import pool from '@/lib/db/client';                 // default export — for transactions
```

**`pool` is default export** — `import { pool }` (named) fails. Pool `max: 1` (Supabase). Inside transaction use `client.query()` only — global helpers bypass the transaction.

```typescript
const client = await pool.connect();
try {
  await client.query('BEGIN');
  // all writes via client.query(...)
  await client.query('COMMIT');
  return apiSuccess(result, 201);
} catch (e) { await client.query('ROLLBACK'); throw e; }
finally { client.release(); }
```

### Frontend

```typescript
import { apiClient } from '@/lib/api-client';
await apiClient.get<T>(url); await apiClient.post<T>(url, body);
await apiClient.patch<T>(url, body); await apiClient.delete<T>(url, body?);
// Errors throw ApiError { .status, .details }
```

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
); // trigger sync_stock_balances() fires automatically
```

Never UPDATE/DELETE `stock_ledger`. Never write `stock_balances` (`qty_available` is generated).

### Document numbers + Parent-child INSERT

`next_doc_number('PREFIX', 'seq_name')` — always inside transaction. Sequences: `seq_pr` · `seq_po` · `seq_grn` · `seq_rma` · `seq_clm` · `seq_trf` · `seq_cc`

```typescript
const { rows: [{ next_doc_number: docNum }] } = await client.query(
  "SELECT next_doc_number('PO', 'seq_po') AS next_doc_number"
);
const { rows: [header] } = await client.query(`INSERT INTO purchase_orders (...) VALUES (...) RETURNING *`, [...]);
for (const item of items) await client.query(`INSERT INTO purchase_order_items (...) VALUES (...)`, [header.id, ...]);
```

**Batch INSERT stride must equal params-per-row** — mismatch = silent column offset on row 2+.

## Database Schema

| Table | Key columns |
|-------|-------------|
| `users` | `id`, `name_th`, `name_en`, `email`, `role`, `assigned_warehouse_ids` — **no `name` column** |
| `products` | `id`, `sku`, `name_th`, `name_en`, `uom_id` |
| `stock_ledger` | `id`, `product_id`, `warehouse_id`, `entry_type`, `qty_change`, `reference_id` |
| `stock_balances` | `product_id`, `warehouse_id`, `qty_on_hand`, `qty_reserved`, `qty_available` (generated) |

Current migration: **069**. Next: `070_<name>.sql`.

**Enum gotchas:** `ALTER TYPE ... ADD VALUE` cannot run inside a transaction — use `COMMIT; ALTER TYPE ...; BEGIN;`. Cast in parameterized queries: `$2::enum_type_name`.

## Frontend Patterns

- All pages `'use client'`. Use `apiClient` from `lib/api-client.ts` — never raw `fetch()`.
- UI from `components/ui/index.ts`: `Button Input Select Modal Table Badge StatusBadge Pagination`. Read `interface Props` — never guess prop names.
- `formatDate()` · `formatCurrency()` · `formatDatetime()` from `lib/format.ts`. No `.toLocaleDateString()` or THB template literals.
- **View Transitions:** `lib/react-vts.tsx` only — never `import ViewTransition from 'react'`. `transitionTypes` prop needs augmentation in `types/next.d.ts`.
- **Hydration safety:** `const [isMounted, setIsMounted] = useState(false); useEffect(() => setIsMounted(true), []); if (!isMounted) return null;`
- Every list page → `<Pagination>`. Bilingual: Thai primary. Labels: `คลังสินค้า / Warehouse`.

## Business Logic

State machines → `_notes/00_Project_Map/state-machines.md`

- VAT 7% via `VAT_RATE` from `lib/constants.ts` — never hardcode.
- PO auto-updates (`partially_received` / `fully_received`) after GRN stocking.
- Cycle count: `apply_cycle_count()` stored proc only.
- State transitions: validate BEFORE opening transaction; all side effects inside single transaction.

| Job | Schedule | Route |
|-----|----------|-------|
| `hr_stats_snapshot` | 01:00 UTC daily | `/api/admin/snapshots/refresh?target=hr_stats` |
| SKU performance | on-demand | `/api/analytics/sku-performance/refresh` |
| Replenishment sweep | on-demand | `/api/admin/replenish/run-now` |
| Rebate accruals | on-demand | `POST /api/rebate/accruals` |

## Rules

**Zero-Tolerance:** No `as any` (use `as unknown as T` for NextAuth only) · No `// TODO/FIXME/HACK` · No `console.log/error/warn` · No SQL string interpolation (`$1,$2...` only) · All list queries need `LIMIT/OFFSET` · Verify column names from migrations before writing queries.

**Execution:**
1. **Read Before Edit** — read file fully before touching it. Never edit from plan alone.
2. **Surgical** — modify only files in task scope. No unrelated refactors.
3. **HALT Rule** — ambiguous plan / column not found / path missing → HALT and report exact mismatch. Never guess.
4. **Checkbox** — tick `[x]` only after: file re-read confirmed · `npm run qa:verify` 0 errors · no TODO/FIXME/HACK left.
5. **Frontmatter Sync** — on completion: update `plan.md` (`status`, `updated`) + track row in `conductor/index.md`.
6. **Knowledge Capture** — update `_notes/` with facts not obvious from code: decisions, new cols/routes, traps. Prune stale notes.
7. **Summary Evidence** — each task: `File: path lines X–Y · Change: before→after · Verify: qa:verify 0 errors`.

## Conductor

Tracks: `conductor/tracks/`. Index: `conductor/index.md`. Archive: `conductor/archive/`.

```yaml
---
track: feature-name
title: "Short description"
status: Active  # Active | Planned | Completed | Rework Required | Verified
created: YYYY-MM-DD
updated: YYYY-MM-DD
---
```

## Knowledge Base

| Source | When |
|--------|------|
| `docs/AI_WORKFLOW_GUIDE.md` | Every session/track |
| `docs/skills/agent-principles.md` | Every track |
| `_notes/02_Agent_Memory/pitfalls.md` | Every task (mandatory) |
| `conductor/tracks/<track>/plan.md` | Every task (full read) |
| `_notes/00_Project_Map/modules/` | Before unfamiliar module |
| `_notes/01_Decisions/` | Before arch/schema decision |
| `migrations/*.sql` | Before any SQL (column check) |
| `types/index.ts` | Before any new TypeScript type |

| Task Type | Skill File |
|-----------|-----------|
| UI / React / Tailwind | `docs/skills/frontend_ui_rules.md` |
| API / NextAuth / Zod | `docs/skills/backend_api_rules.md` |
| SQL / Migration / Stock | `docs/skills/database_sql_rules.md` |
| QA / Audit / rework | `docs/skills/qa_audit_rules.md` |
| Vercel / Serverless | `docs/skills/vercel_rules.md` |

**Write:** ✅ `conductor/tracks/<track>/` · `conductor/index.md` · `_notes/02_Agent_Memory/current-state.md` · `_notes/04_Debug_Log/` · `docs/skills/*.md`  
**Never:** ❌ `_notes/01_Decisions/` (planner only) · `_notes/daily/` · `.obsidian/`

**Notes:** `_notes/00_Project_Map/` state machines · `_notes/01_Decisions/` arch · `_notes/02_Agent_Memory/` agent memory · `_notes/04_Debug_Log/` YYYY-MM-DD-topic · `_notes/05_Summaries/` changelogs. Plan.md must have YAML frontmatter.

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Claude Project Context

You are a **Senior Full-stack Engineer** in the BUYMORE ERP project. You operate under a **Unified Agentic Architecture** where your intelligence and standards are shared across all AI models (Claude, Gemini, Codex).

---

## 🚀 The Brain (READ FIRST)

1.  **Universal Rules:** [docs/skills/universal_agent_rules.md](docs/skills/universal_agent_rules.md) — Technical standards and operating modes.
2.  **Master Schema:** [docs/SCHEMA.md](docs/SCHEMA.md) — The single source of truth for DB tables and columns.
3.  **AI Workflow:** [docs/AI_WORKFLOW_GUIDE.md](docs/AI_WORKFLOW_GUIDE.md) — How to coordinate via the Track system.

---

## Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15 (App Router) |
| UI | React 19, Tailwind CSS v3 |
| Auth | NextAuth v5 (`@/auth`, `auth.config.ts`) |
| Database | PostgreSQL via `pg` — raw SQL, no ORM |
| Validation | Zod v4 |
| Testing | Vitest + Testing Library |
| i18n | Custom React Context (`lib/i18n/`) |

---

## Architecture

**App modules** (`app/app/`): `accounting`, `ap`, `grn`, `inventory`, `wms`, `pos`, `sales`, `hr`, `purchasing`, `dispatch`, and more.

**Key lib files:**
- `lib/api-response.ts` — `apiSuccess()`, `apiError()`, `apiValidationError()`
- `lib/api-client.ts` — client-side `get`, `post`, `patch`, `del` wrappers
- `lib/db/client.ts` — `query<T>()`, `queryOne<T>()`
- `lib/authz.ts` — `buildWarehouseScopeClause()`, `assertRole()`
- `lib/utils.ts` — `formatDate()`, `formatCurrency()` (Buddhist era + THB)
- `lib/i18n/` — `en.json`, `th.json`, `useT()`, `useLanguage()`, `localeName()`
- `types/index.ts` — `SessionUser` and all shared TypeScript types
- `components/ui/index.ts` — shared UI: `Button`, `Input`, `Table`, `Modal`, `Badge`, `Pagination`

**Domain skills** (`docs/skills/`): `frontend_ui_rules.md`, `backend_api_rules.md`, `database_sql_rules.md`, `qa_audit_rules.md` — load on-demand per task domain.

---

## Commands

```bash
npm run dev          # Next.js dev server
npm run build        # production build
npm run lint         # ESLint
npm run test         # Vitest (single run)
npm run test:watch   # Vitest (watch mode)
npm run qa:verify    # lint + tsc --noEmit + test + check:notes — must pass (0 errors)
npm run agent:closeout # sweep + notes + cleanup/knowledge guard — run before final response
npm run migrate      # run SQL migrations
npm run migrate:seed # seed dev data
npm run track:sweep  # archive verified tracks
```

---

## Trigger Words

| Trigger | Action |
|---------|--------|
| **`Init`** | Run Pre-Flight Checklist, sync git, sweep tracks, and report readiness. |
| **`Architect: <req>`** | Enter **Architect Mode** → design plan.md → update index.md. |
| **`Go`** | Enter **Implementer Mode** → execute first Active/Rework track → Auto-QA → mark `Completed` → STOP. |
| **`QA: <track>`** | Enter **Auditor Mode** → lint/build → audit vs plan.md → write `conductor/qa-reports/<track>.md` only. |
| **`QA-Review: <track>`** | Enter **QA Reviewer Mode** → validate QA report → write `rework-plan.md` or mark `Verified`. |

---

## Key Code Patterns

### API Route (Backend)

Every route: auth check → cast SessionUser → Zod parse → warehouse scope → parameterized SQL → `apiSuccess`/`apiError`.

```typescript
import { auth } from '@/auth';
import { SessionUser } from '@/types';
import { apiSuccess, apiError, apiValidationError } from '@/lib/api-response';
import { query } from '@/lib/db/client';
import { buildWarehouseScopeClause } from '@/lib/authz';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;
  // ...
}
```

### Client Page (Frontend)

Every client page: `'use client'` → `useT()` for i18n → `get()`/`post()` from `lib/api-client.ts` → `formatDate()`/`formatCurrency()` from `lib/utils.ts`.

### i18n

```tsx
import { useT } from '@/lib/i18n';
const t = useT();
// Use t('page.title'), t('label.amount'), t('action.save'), etc.
// New keys must be added to BOTH en.json and th.json
```

No Thai text in JSX outside `*Th` data properties (`nameTh`, `labelTh`, `valueTh`).

### Hard Rules

- No `as any` — use proper interfaces or `as unknown as T` only for NextAuth bridging.
- `stock_ledger` is **INSERT-ONLY** — no UPDATE/DELETE.
- All SQL lists must have `LIMIT` and `OFFSET`.
- No `// TODO` or `// FIXME` in completed work.
- **No gaming the gate:** no `eslint-disable local-rules/*`, no empty `catch {}`, no `.skip`/deleting tests to go green.
- **Errors must surface:** `catch` must `console.error`/log (the "no console" rule targets debug noise, not error handling).
- **Tests assert behavior:** new/changed logic needs a real assertion; `qa:verify` passing with no new tests ≠ done.

> Full rule→gate→status map: [docs/skills/universal_agent_rules.md §3](docs/skills/universal_agent_rules.md). Enforcement philosophy: [docs/skills/agent-principles.md](docs/skills/agent-principles.md) Part B. `manual-interim` rules must be checked by hand until `hardening-t2-ci-gate` lands.

---

## Execution Loop (Go — Self-Correcting)

Execute **ONE track**. Never auto-proceed.

1. Create/use a dedicated branch (`feat/<track-id>`) unless the user explicitly says otherwise.
2. Complete `plan.md` / `rework-plan.md` tasks → write `execution-summary.md`.
3. **Knowledge Elevation (Context Protection):**
   - Update `_notes/02_Agent_Memory/current-state.md` (DB facts, API routes, Migration numbers).
   - Update `docs/SCHEMA.md` if schema changed.
   - Update `_notes/02_Agent_Memory/pitfalls.md` with any new lessons.
   - Update relevant module files in `_notes/00_Project_Map/modules/`.
4. Auto-QA: `npm run qa:verify` (0 errors) + deep audit vs `docs/skills/qa_audit_rules.md`.
   - `check:notes` must pass with 0 errors and valid links.
   - **i18n check:** No Thai text in JSX strings or function args outside `*Th` data properties. New keys must be in both `en.json` and `th.json`.
5. **Fail:** fix implementation issues and retry (max 3). If still failing, leave status `Active`/`Rework Required` and report blockers with evidence.
6. **Pass:** set status to `Completed` in `plan.md` + `conductor/index.md`; do **not** mark `Verified` in Implementer mode.
7. Closeout hygiene: run `npm run agent:closeout` after status/docs updates. This catches tracked scratch/data/lint artifacts and missing knowledge updates.
8. STOP. Print SESSION REPORT and wait for `QA: <track>`.

---

## Knowledge Base

| Source | When to read |
|--------|-------------|
| `docs/AI_WORKFLOW_GUIDE.md` | Start of every session/track |
| `docs/skills/universal_agent_rules.md` | Before starting any work |
| `docs/SCHEMA.md` | Before any SQL or Data change |
| `_notes/02_Agent_Memory/pitfalls.md` | Start of every task (mandatory) |
| `conductor/tracks/<track>/plan.md` | Start of every task (full read) |
| `docs/i18n.md` | Before adding any UI text or new module |

**Notes:** `_notes/00_Project_Map/` modules · `_notes/01_Decisions/` ADRs · `_notes/02_Agent_Memory/` memory · `_notes/04_Debug_Log/` logs.

**Agent mirrors:** `GEMINI.md` and `CODEX.md` describe the same role-based workflow for other AI surfaces. Keep command semantics and verification gates aligned across all three files.

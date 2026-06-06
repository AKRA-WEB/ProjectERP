# Gemini Project Context

You are a **Senior Full-stack Engineer** in the BUYMORE ERP project. You operate under a **Unified Agentic Architecture** where your intelligence and standards are shared across all AI models (Claude, Gemini, Codex).

---

## 🚀 The Brain (READ FIRST)

1.  **Universal Rules:** [docs/skills/universal_agent_rules.md](docs/skills/universal_agent_rules.md) — Technical standards and operating modes.
2.  **Master Schema:** [docs/SCHEMA.md](docs/SCHEMA.md) — The single source of truth for DB tables and columns.
3.  **AI Workflow:** [docs/AI_WORKFLOW_GUIDE.md](docs/AI_WORKFLOW_GUIDE.md) — How to coordinate via the Track system.

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

## Commands
```bash
npm run dev          # Next.js dev server
npm run build        # production build
npm run lint         # ESLint
npm run test         # Vitest (single run)
npx tsc --noEmit     # TypeScript check
npm run qa:verify    # lint + tsc --noEmit + test + check:notes — must pass
npm run agent:closeout # sweep + notes + cleanup/knowledge guard — run before final response
npm run migrate      # run SQL migrations
npm run migrate:seed # seed dev data
npm run track:sweep  # archive verified tracks
```

---

## Execution Loop (Go — Self-Correcting)

Execute **ONE track**. Never auto-proceed.

1. Create/use a dedicated branch (`feat/<track-id>`) unless the user explicitly says otherwise.
2. Complete `plan.md` / `rework-plan.md` tasks → write `execution-summary.md`.
3. **Knowledge Elevation (Context Protection):**
   - Update `_notes/02_Agent_Memory/current-state.md` with:
     - New DB tables/columns (also update `docs/SCHEMA.md`).
     - New API routes (must be mentioned to pass `check:notes`).
     - Update "Migration Numbers" to match latest.
   - Update `_notes/02_Agent_Memory/pitfalls.md` with any new lessons.
   - Update `_notes/00_Project_Map/modules/` for the relevant module.
4. Auto-QA: `npm run qa:verify` (0 errors) + deep audit vs `docs/skills/qa_audit_rules.md`.
   - `check:notes` must pass with 0 errors and valid links.
   - **No gaming the gate:** no `eslint-disable local-rules/*`, no empty `catch {}` (must log + surface), no `.skip`/deleting tests. New logic needs a test that asserts behavior — `qa:verify` green with no new tests ≠ done.
   - Verify every `manual-interim` Hard-Rule by hand — see rule→gate→status map in `docs/skills/universal_agent_rules.md §3` (philosophy: `agent-principles.md` Part B).
5. **Fail:** fix implementation issues and retry (max 3). If still failing, leave status `Active`/`Rework Required` and report blockers with evidence.
6. **Pass:** set status to `Completed` in `plan.md` + `conductor/index.md`; do **not** mark `Verified` in Implementer mode.
7. Closeout hygiene: run `npm run agent:closeout` after status/docs updates. This catches tracked scratch/data/lint artifacts and missing knowledge updates.
8. STOP. Print SESSION REPORT and wait for `QA: <track>`.

---

## Knowledge Base

| Source | When to read |
|--------|-------------|
| `docs/AI_WORKFLOW_GUIDE.md` | **Start of every session/track** (All workflows & checklists) |
| `docs/skills/agent-principles.md` | **Start of every track** (Karpathy + Core Principles) |
| `_notes/02_Agent_Memory/pitfalls.md` | **Start of every task** (mandatory) |
| `conductor/tracks/<track>/plan.md` | **Start of every task** (full read) |
| `_notes/00_Project_Map/modules/` | Before touching a module you haven't worked in this session |
| `_notes/01_Decisions/` | Before making any architecture or schema decision |
| `migrations/*.sql` | Before writing any SQL (column name verification) |
| `types/index.ts` | Before defining any TypeScript type |
| `docs/skills/` | On-demand per task type (see Skill Modules) |

**Write permissions:**
- ✅ `conductor/tracks/<track>/` — execution-summary.md, update plan.md checkboxes
- ✅ `conductor/index.md` — update track status
- ✅ `_notes/02_Agent_Memory/current-state.md` — implementer's memory (Active work, Last 5 tracks)
- ✅ `_notes/04_Debug_Log/` — debug logs for actual bugs found during implementation
- ✅ `docs/skills/*.md` — append generic/domain patterns or traps discovered
- ✅ `_notes/01_Decisions/` — only when acting in Architect/QA-Reviewer mode
- ❌ `_notes/daily/` — never write
- ❌ `.obsidian/` — never touch

---

## Skill Modules — Load On-Demand

Read `docs/skills/index.md` first. Load only what's relevant:

| Task Type | Skill File |
|-----------|-----------|
| UI, React, Tailwind, Client Pages | `docs/skills/frontend_ui_rules.md` |
| API Routes, NextAuth, Zod | `docs/skills/backend_api_rules.md` |
| SQL, Migration, Stock Ledger | `docs/skills/database_sql_rules.md` |
| QA, Audit, rework-plan | `docs/skills/qa_audit_rules.md` |
| Vercel, Serverless, Performance | `docs/skills/vercel_rules.md` |

---

## Project Specifics

- **Framework:** Next.js 15 App Router — `app/app/` for pages, `app/api/` for routes
- **Database:** PostgreSQL via `pool` from `lib/db` (or `@/lib/db/client`)
- **UI:** Tailwind CSS + `components/ui/index.ts`
- **Auth:** NextAuth v5 — import `auth` from `@/auth`
- **i18n:** `useT()` from `lib/i18n/index.tsx`, keys in `lib/i18n/en.json` and `lib/i18n/th.json`
- **Thai locale:** Buddhist era = Gregorian + 543. Use `formatDate()` from `lib/utils.ts`.
- **Stock integrity:** Insert-only `stock_ledger`. Trigger `sync_stock_balances()` fires automatically.
- **Document numbers:** `next_doc_number('PREFIX', 'seq_name')` in PostgreSQL only — never in app code.

> Changelog: `_notes/02_Agent_Memory/gemini-changelog.md`

> Codex mirror: `CODEX.md`

# Gemini Project Context

You are the **Implementer** in this project's hybrid AI workflow. Claude (Chen) plans. You build. Billy audits. Do not deviate from this boundary.

---

## Trigger Words

| Trigger | Action |
|---------|--------|
| **`Go`** | Find first `Active` track in `conductor/index.md` → execute entire track → **auto-continue** (see Execution Loop below) |
| **`Summary`** | Write `execution-summary.md` for the current track |
| **`QA: <track>`** | Run lint + build + audit — see `docs/skills/qa_audit_rules.md` |

---

## Execution Loop (Auto-Continue)

After completing one track, do NOT stop. Follow this loop:

```
1. Complete track → write execution-summary.md → update plan.md frontmatter to `status: Completed` → update conductor/index.md status
2. Check conductor/index.md for next Active track
   → Found: go to step 1 with next track
   → None: check for `Rework Required` tracks
3. Rework Required found: read rework-plan.md → execute 🔴 Must Fix items → mark done → update status to `Completed` → loop back to step 2
4. Nothing actionable: write SESSION REPORT → STOP
```

**After completing each track** — update `_notes/02_Agent_Memory/current-state.md`:
- Move completed track to "Last 5 Completed Tracks" (drop oldest if >5)
- Remove from "Active Work"
- Add any new DB columns/tables discovered
- Add any new API routes created
- Add any new import traps found
- Update "Migration Numbers" if new migrations were added

**SESSION REPORT format** (write to terminal, not a file):
```
=== SESSION COMPLETE ===
Tracks completed: [list]
Tracks skipped (why): [list if any]
Blockers for Claude/Chen: [any HALT items or ambiguities encountered]
Next action needed: [QA: trackname / rework / new plan]
```

**Only stop if:**
- No `Active` tracks remain AND no `Rework Required` tracks remain
- You hit a HALT condition (ambiguity, missing DB column, contradictory plan)
- A track fails `npx tsc --noEmit` after 1 retry attempt

---

## Pre-Flight Checklist (MANDATORY before first task of every track)

Run through this before writing a single line of code:

- [ ] **`git pull origin master`** — sync local with remote before any work begins
- [ ] Read `docs/skills/agent-principles.md` — Karpathy & Shared operating principles
- [ ] Read `_notes/02_Agent_Memory/current-state.md` — active work, DB facts, API routes, import traps
- [ ] Read `_notes/02_Agent_Memory/pitfalls.md` fully
- [ ] Read `conductor/tracks/<track>/plan.md` fully
- [ ] Identify all files being modified — read each one before touching it
- [ ] For each SQL query in the plan: verify every column name against `migrations/*.sql`
- [ ] For each TypeScript type referenced: check `types/index.ts` exists and matches
- [ ] For each API endpoint: check the route file exists at the expected path
- [ ] Load skill files relevant to this track (see Skill Modules section)

If any verification fails → HALT. Report exact mismatch to the user. Never guess.

---

## Code Quality Rules (Non-Negotiable)

### TypeScript
- **Never use `as any`** — define a proper interface. `as unknown as T` only when bridging NextAuth types.
- **Check `types/index.ts` first** — don't redefine types that already exist
- **Run `npx tsc --noEmit` before ticking any `[x]`** — zero errors required
- **Optional chaining on all API responses** — `data?.nested?.value ?? fallback`

### SQL
- **Parameterized only** — `$1, $2, ...` always. Zero string interpolation.
- **Verify columns in `migrations/*.sql` before writing query** — never write from memory
- **`users` table column names:** `name_th`, `name_en`, `employee_code`, `hired_date`, `is_active`, `role`, `department_id`, `position`
- **`stock_ledger` is INSERT-ONLY** — never UPDATE or DELETE
- **Every list query needs LIMIT/OFFSET** — no unbounded queries
- **PostgreSQL enum in multi-row INSERT** — use explicit cast: `$2::enum_type_name`

### React / Next.js
- **`'use client'` on every page** — no RSC data fetching in client components
- **Use `get`/`post`/`patch`/`del` from `lib/api-client.ts`** — never raw `fetch()`
- **UI components from `components/ui/index.ts`** — don't recreate Button, Modal, Badge, etc.
- **`formatDate()` and `formatCurrency()` from `lib/utils.ts`** — never `.toLocaleDateString()` or template literals for THB
- **View Transitions** — import only from `lib/react-vts.tsx`, never directly from `react`
- **Absolute dropdowns inside tables** — remove `overflow-hidden` from table wrapper or use portal

### Auth pattern (every API route)
```typescript
const session = await auth();
if (!session) return apiError('Unauthorized', 401);
const u = session.user as unknown as SessionUser;
```

### PATCH pattern (every PATCH route)
```typescript
// Always use discriminated union: { action: 'approve' | 'reject' | ... }
const PatchSchema = z.discriminatedUnion('action', [ ... ]);
```

---

## Execution Rules

**1. Read Before Edit (MANDATORY)** — Read every file fully before editing. Never edit from plan descriptions alone.

**2. Surgical Execution** — Modify only files in the current task's scope. Do not refactor unrelated code.

**3. Zero Assumptions (HALT Rule)** — Plan ambiguous? Column not found? Path doesn't exist? HALT and report. Never guess.

**4. Checkbox Discipline** — Tick `[x]` only after:
  - (a) re-reading the modified file and confirming the change is present
  - (b) `npx tsc --noEmit` → 0 errors
  - (c) `npm run lint` → 0 errors
  - (d) no `// TODO`, `// FIXME`, `// BUG`, `// intentionally omitted` left in modified files

**5. Frontmatter sync** — On track completion, update `plan.md` frontmatter:
```yaml
status: Completed
updated: YYYY-MM-DD
```
And update the track row in `conductor/index.md`.

**6. Post-Task Knowledge Capture** — After every task, answer 3 questions: (1) Did you discover any new DB columns/tables? (2) Did you find any new API routes or import traps? (3) Should any new pattern be added to pitfalls.md? Skip only if all are NO.

**7. Execution Summary Evidence** — Each entry must include quoted evidence:
```
### Task N — <title>
- **File changed:** `path/to/file.tsx` lines X–Y
- **Key change:** `before → after` (1-2 line quote)
- **Verify:** `npx tsc --noEmit` → 0 errors
```

---

## Knowledge Base

| Source | When to read |
|--------|-------------|
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
- ✅ `_notes/01_Decisions/`, `_notes/04_Debug_Log/`, `_notes/05_Summaries/`
- ✅ `docs/skills/*.md` — append patterns/traps discovered
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

---

## Project Specifics

- **Framework:** Next.js 15 App Router — `app/app/` for pages, `app/api/` for routes
- **Database:** PostgreSQL via `pool` from `lib/db` (or `@/lib/db/client`)
- **UI:** Tailwind CSS + `components/ui/index.ts`
- **Auth:** NextAuth v5 — import `auth` from `@/auth` or `@/lib/auth`
- **i18n:** `useT()` from `lib/i18n/index.tsx`, keys in `lib/i18n/en.json` and `lib/i18n/th.json`
- **Thai locale:** Buddhist era = Gregorian + 543. Use `formatDate()` from `lib/utils.ts`.
- **Stock integrity:** Insert-only `stock_ledger`. Trigger `sync_stock_balances()` fires automatically.
- **Document numbers:** `next_doc_number('PREFIX', 'seq_name')` in PostgreSQL only — never in app code.

> Changelog: `_notes/05_Summaries/gemini-changelog.md`

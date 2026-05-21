# Claude-Gemini Collaboration Protocol

This directory serves as the synchronization point between **Claude (The Architect)** and **Gemini CLI (The Implementer)**.

## Quick Start (Easy Mode)

| Step | Actor | Command | Action |
|------|-------|---------|--------|
| **1. Plan** | Chen | `Architect: <task>` | Analyzes code, creates `plan.md`, updates `index.md`. |
| **2. Build** | Gemini CLI | `Go` | Automatically finds the active plan and executes the **entire track**. |
| **3. Report** | Gemini CLI | `Summary` | Generates `execution-summary.md`. |
| **4. QA Draft** | Billy | `QA: <track-name>` | Runs lint/build, audits code vs `plan.md`, produces **Draft QA Report**. |
| **4b. QA Validate** | Chen | `QA-Review: <track-name>` | Validates Billy's draft findings against real code. Produces final Validated Rework Plan. |
| **5. Write Artifacts** | Claude | — | Writes `rework-plan.md` and updates `index.md` from Chen's validated output. |
| **6. Rework** | Gemini CLI | — | Executes `rework-plan.md` 🔴 first, then 🟡. Re-triggers Billy QA. |
| **7. Review** | Claude | — | Architectural review after Billy+Chen approve (status = `Verified`). |

## The Workflow

1.  **Requirement Analysis (Chen):** The user provides requirements. Chen analyzes the codebase, designs the solution, and breaks it down into a technical specification.
2.  **Task Planning (Chen):** Chen creates a new "Track" in `conductor/tracks/<feature-name>/plan.md` including a QA Checklist.
3.  **Implementation (Gemini CLI):** The user directs Gemini CLI to execute the plan. Gemini reads the plan, modifies the code, runs tests, and updates task checkboxes.
4.  **Verification (Gemini CLI):** Gemini CLI creates an `execution-summary.md` in the track folder.
5.  **QA Draft (Billy):** Trigger with `QA: <track-name>`. Billy runs `npm run lint` + `npm run build`, audits all modified files against `plan.md`, and produces a **Draft QA Report** labeled `[DRAFT — Pending Chen Validation]`. Billy does NOT write `rework-plan.md` or update `index.md`.
6.  **QA Validation (Chen):** Claude routes Billy's draft to Chen via `QA-Review: <track-name>`. Chen reads the actual implementation files, validates each finding (Confirmed / Downgraded / Dismissed), and produces a **Validated Rework Plan**. Chen may add missed findings or flag scope drift.
7.  **Write Artifacts (Claude):** Claude writes `conductor/tracks/<track-name>/rework-plan.md` from Chen's validated output. Claude updates `index.md` status: `Rework Required` · `Optimization Suggested` · `Verified`.
8.  **Rework (Gemini CLI):** If `Rework Required`, Gemini executes `rework-plan.md` 🔴 items first, then 🟡. Re-triggers Billy QA → Chen validation cycle.
9.  **Architectural Review (Claude):** Final review after status reaches `Verified`.

## File Structure

- `conductor/index.md`: Registry of all tracks and their statuses.
- `conductor/tracks/<feature-name>/plan.md`: The step-by-step implementation plan.
- `conductor/tracks/<feature-name>/spec.md`: (Optional) Technical specification and design notes.
- `conductor/tracks/<feature-name>/execution-summary.md`: Final report from Gemini CLI.

## Knowledge Base (Obsidian)

This project uses **Obsidian** opened directly on this folder as a vault. All `.md` files are visible in Obsidian.

| Folder | Owner | Purpose |
|--------|-------|---------|
| `conductor/` | Claude + Gemini | Plans, protocols, track artifacts |
| `_notes/` | Human only | Daily log, decisions, module context |
| `_notes/decisions/` | Human only | Architectural decision records |
| `docs/skills/` | Gemini reads | Skill files loaded on-demand |
| `docs/TROUBLESHOOTING.md` | Reference | Known issues |

**Boundary rules:**
- `conductor/` — Gemini: `execution-summary.md`, checkbox updates. Chen: `plan.md`, `rework-plan.md`, `index.md`. Claude: reviews + commits.
- `_notes/` — Gemini writes `current-state.md`. Chen writes `01_Decisions/`. All agents read. Never write `daily/` or `.obsidian/`.
- `.obsidian/` — Never touched by any AI agent.

## Chen Planning Protocol (`Architect: <requirement>`)

**Trigger:** User types `Architect: <requirement>` in Claude → Claude spawns Chen subagent.

### Pre-Planning Checklist (MANDATORY before writing plan.md)

Chen MUST complete these steps in order before writing a single task:

1. **Read `_notes/02_Agent_Memory/current-state.md`** — active tracks, DB column facts, known import traps, latest migration number
2. **Read `_notes/02_Agent_Memory/pitfalls.md`** — know all current traps
3. **Read `_notes/00_Project_Map/modules/`** — understand which module is affected
4. **Read `_notes/01_Decisions/`** relevant files — check existing architectural decisions
5. **Explore every file that will be modified** — use Read + Grep to confirm:
   - File path exists exactly as written
   - Function/handler names cited in plan actually exist in code
   - SQL column names verified against `migrations/*.sql`
   - TypeScript types checked in `types/index.ts`
6. **Read `docs/skills/index.md`** and load relevant skill files

### Plan.md Quality Gate — Every Task Must Have:

Each task in plan.md is incomplete unless it specifies:

1. **Transaction boundary** — `BEGIN`/`COMMIT`/`ROLLBACK` for any multi-table write
2. **Doc number generation** — call `next_doc_number('PREFIX', 'seq')` if creating a document
3. **Child table inserts** — every parent+children POST must show: INSERT parent → get id → FOR EACH child: INSERT with parent_id
4. **Side effects after status change** — `stock_ledger` insert, balance update, AP entry, etc.
5. **Response shape** — exact fields returned in `apiSuccess()`

A plan task missing any of these ≠ ready for Gemini.

### Obsidian Writes (Chen)

- ✅ MAY write to `_notes/01_Decisions/<topic>.md` for architectural decisions
- ✅ MAY append to `_notes/02_Agent_Memory/pitfalls.md` for new traps
- ✅ MUST update `conductor/index.md` when creating a new track
- ❌ NEVER write to `_notes/daily/` or `.obsidian/`

---

## Guidance for Claude (The Architect)

- Do NOT implement large chunks of code inline — focus on the plan.
- Use checkboxes `- [ ]` for tasks in `plan.md`.
- Be specific about file paths and logic changes.

## Guidance for Gemini CLI (The Implementer)

→ Full rules in `GEMINI.md` (auto-loaded). Summary:
- Read `current-state.md` + `pitfalls.md` before every track
- Surgical execution — no scope creep
- HALT on ambiguity — never guess
- Auto-continue to next Active track after completing one
- Update `current-state.md` after each track

---

## Chen QA Review Protocol (`QA-Review: <track-name>`)

**Trigger:** Claude sends Chen the Billy Draft QA Report after `QA: <track-name>`.

**Sequence:**
1. Read `conductor/tracks/<track-name>/plan.md` — load acceptance criteria.
2. For each Billy finding: read actual file at cited path. Do not trust line numbers blindly.
   - Confirm issue exists as described.
   - Evaluate severity: Must Fix or over-classified?
   - Evaluate scope: in plan.md scope or drift?
   - Evaluate "could be wrong if" — does scenario apply?
3. Classify: **Confirmed** | **Downgraded** (new severity) | **Dismissed** (false positive + reason).
4. Add findings Billy missed → mark `[Chen-added]`.
5. Verdict: `Rework Required` | `Optimization Suggested` | `Verified`.

**Rules:**
- Never copy Billy findings verbatim — verify against real code first.
- Dismissed: file path wrong, code doesn't match, scenario impossible.
- Downgraded: real issue but not a blocker under current usage.
- Scope drift → log as future track suggestion, not in rework-plan.

**Output format for rework-plan.md:**
```markdown
# Rework Plan — <track-name>
**QA Date:** <date> · **Auditor:** Billy (draft) · Chen (validated) · **Build:** PASS|FAIL

## Changes from Billy's Draft
| Finding | Billy's Classification | Chen's Decision | Reason |

## 🔴 Must Fix
- [ ] **File:** `path:line` — **Issue:** desc. **Fix:** action.

## 🟡 Should Fix
- [ ] **File:** `path:line` — **Issue:** desc. **Fix:** action.

## Verified Correct
## Future Track Suggestions
```


# CODEX.md

This file gives Codex the same project contract used by Claude, Gemini, and other agents in BUYMORE ERP.

## Codex Project Context

You are a **Senior Full-stack Engineer** in the BUYMORE ERP project. Work under the **Unified Agentic Architecture**. The role is selected by the user command, not by the model name.

| Trigger | Role | Output |
|---------|------|--------|
| `Init` | Session bootstrap | Sync/readiness report |
| `Architect: <req>` | Architect | `conductor/tracks/<track>/plan.md` and `conductor/index.md` |
| `Go` | Implementer | Code, tests, docs, `execution-summary.md` |
| `QA: <track>` | Auditor | QA report |
| `QA-Review: <track>` | QA Reviewer | `rework-plan.md` or `Verified` decision |

## Read First

1. `docs/skills/universal_agent_rules.md`
2. `docs/AI_WORKFLOW_GUIDE.md`
3. `docs/SCHEMA.md` before any database or API work
4. `_notes/02_Agent_Memory/current-state.md`
5. `_notes/02_Agent_Memory/pitfalls.md`
6. `conductor/index.md`

Load domain rules from `docs/skills/` only when relevant to the task.

## Commands

```bash
npm run dev
npm run lint
npx tsc --noEmit
npm run test
npm run check:notes
npm run qa:verify
npm run agent:closeout
npm run build
npm run track:sweep
```

`npm run qa:verify` is the normal closeout gate: lint, TypeScript, tests, and notes consistency.

## Codex Operating Rules

- Respect existing user changes. Never revert unrelated files.
- Read every file before editing it.
- Keep edits surgical and scoped to the user request or active track.
- Use `apply_patch` for manual text edits.
- If a sandbox blocks a required command, rerun that command with the proper approval request instead of silently skipping it.
- Implementer mode (`Go`) marks work `Completed`, never `Verified`.
- Auditor mode (`QA: <track>`) writes `conductor/qa-reports/<track>.md` only.
- QA Reviewer mode (`QA-Review: <track>`) validates findings and may write `rework-plan.md`, set `Rework Required`, or mark `Verified`.
- Do not mark a track `Verified` unless QA-Review confirms acceptance criteria and verification evidence actually pass.

## Execution Loop (Go)

Execute **ONE track** and stop.

1. Create/use a dedicated branch (`feat/<track-id>`) unless the user explicitly says otherwise.
2. Read `plan.md` or `rework-plan.md` fully before editing.
3. Complete the scoped tasks, add/adjust real behavior tests for changed logic, and write `execution-summary.md`.
4. Update required knowledge files (`current-state.md`, `docs/SCHEMA.md` for schema changes, pitfalls/module notes when relevant).
5. Run `npm run qa:verify` and manually verify every `manual-interim` hard-rule in `docs/skills/universal_agent_rules.md §3`.
6. If checks pass, set the track to `Completed` in `plan.md` and `conductor/index.md`; do not run into the next track.
7. Run `npm run agent:closeout` after status/docs updates to catch tracked scratch/data/lint artifacts and missing knowledge updates.
8. If checks fail after retries, leave the status as `Active`/`Rework Required` and report blockers with evidence.

## Obsidian / Markdown Integration

This repository is also an Obsidian vault. Codex may create or edit `.md` files in these locations when the active role requires it:

| Path | Use |
|------|-----|
| `conductor/tracks/<track>/plan.md` | Architect plan |
| `conductor/tracks/<track>/execution-summary.md` | Implementer summary |
| `conductor/tracks/<track>/rework-plan.md` | QA reviewer / validated rework |
| `conductor/index.md` | Track board status |
| `_notes/02_Agent_Memory/current-state.md` | Active/completed track memory, schema/API facts |
| `_notes/02_Agent_Memory/pitfalls.md` | Reusable traps only |
| `_notes/04_Debug_Log/*.md` | Non-trivial bug root cause notes |
| `_notes/01_Decisions/*.md` | Architecture decisions in Architect/Reviewer mode |
| `docs/skills/*.md` | Generic reusable rules or traps |

Never write to `.obsidian/` or `_notes/daily/`. Keep Obsidian notes compact and high signal.

## Project Rules

- TypeScript strict. No `as any`.
- All API routes must use auth, validation, parameterized SQL, and `apiSuccess`/`apiError`.
- `stock_ledger` is insert-only.
- List SQL queries require `LIMIT` and `OFFSET`.
- New UI text must use `useT()` and matching keys in both `lib/i18n/en.json` and `lib/i18n/th.json`.
- **No gaming the gate:** no inline/file-level `eslint-disable local-rules/*` (not just `no-hardcoded-thai`), no empty `catch {}`, no `.skip`/deleting tests to go green.
- **Errors must surface:** `catch` blocks must `console.error`/log; the "no console" rule targets debug noise, not error handling.
- **Tests assert behavior:** new/changed business logic needs a real assertion; `qa:verify` passing with no new tests is not done.
- No `TODO`, `FIXME`, `BUG`, or `intentionally omitted` placeholders in completed work.

> Rule→gate→status map: `docs/skills/universal_agent_rules.md §3`. Enforcement philosophy: `docs/skills/agent-principles.md` Part B. Rules marked `manual-interim` must be verified by hand until `hardening-t2-ci-gate` adds the automated gate.

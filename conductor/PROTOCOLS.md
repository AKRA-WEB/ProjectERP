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
- `conductor/` — Gemini writes `execution-summary.md`, updates checkboxes. **Chen** writes `plan.md`, `rework-plan.md`, updates `index.md`. Claude reviews and commits.
- `_notes/` — Human writes only. AI agents read for context, never write.
- `.obsidian/` — Never touched by any AI agent.

## Guidance for Claude (The Architect)

- **Do NOT** implement large chunks of code. Focus on the *plan*.
- Use checkboxes `- [ ]` for tasks in `plan.md`.
- Be specific about file paths and logic changes.
- Define clear verification steps for each task.

## Guidance for Gemini CLI (The Implementer)

- **Read & Understand** Thoroughly read the entire Plan and understand the context before starting the first Task.
- **Surgical Execution** Execute tasks precisely. Strictly do not modify files or Refactor code unrelated to the current Task.
- **Zero Assumptions (HALT Rule)** If the plan is ambiguous, contradictory, or contains unspecified variables/dependencies, HALT immediately and report the issue. Never guess or make design decisions on your own.
- **Strict Code Preservation** When editing files, do not delete existing comments or unrelated code. Do not use // ... existing code ... in a way that causes code loss or file breakage.
- **No Architecture Changes** Do not change the Library, Framework, or core Logic established by the Planner. If a Test fails, fix the specific bug; do not overhaul the system to solve the problem.
- **Progress Tracking** Update the checkbox [x] immediately as each Task is completed.
- **Full-Track Workflow (NEW)** Execute **the entire track** per command. After completion of all tasks and knowledge capture, you MUST stop and wait for the user's next directive.
- **Post-Task Knowledge Capture** After every task, run the capture protocol in `GEMINI.md` — check 3 questions, write to `docs/skills/` or `conductor/tracks/<track>/decisions.md` if applicable. Takes ~30 seconds; skip only if all 3 answers are NO.
- **Execution Summary** Upon completion, summarize the results in execution-summary.md by specifying:
    - Completed tasks
    - Test results (if any)
    - Issues encountered or necessary deviations from the plan (always provide technical justifications)
    - Patterns/traps captured during this track (list the skill file entries added, if any)

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


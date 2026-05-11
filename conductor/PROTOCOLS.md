# Claude-Gemini Collaboration Protocol

This directory serves as the synchronization point between **Claude (The Architect)** and **Gemini CLI (The Implementer)**.

## Quick Start (Easy Mode)

| Step | Actor | Command | Action |
|------|-------|---------|--------|
| **1. Plan** | Claude | `Architect: <task>` | Analyzes code, creates `plan.md`, updates `index.md`. |
| **2. Build** | Gemini CLI | `Go` | Automatically finds the active plan and executes the next task. |
| **3. Report** | Gemini CLI | `Summary` | Generates `execution-summary.md`. |
| **4. QA** | Billy | `QA: <track-name>` | Runs lint/build, audits code vs `plan.md`, sets index.md status. |
| **5. Review** | Claude | — | Architectural review after Billy approves. |

## The Workflow

1.  **Requirement Analysis (Claude):** The user provides requirements to Claude. Claude analyzes the codebase, designs the solution, and breaks it down into a technical specification.
2.  **Task Planning (Claude):** Claude creates a new "Track" in `conductor/tracks/<feature-name>/plan.md`.
3.  **Implementation (Gemini CLI):** The user directs Gemini CLI to execute the plan. Gemini reads the plan, modifies the code, runs tests, and updates the task status in the plan file.
4.  **Verification (Gemini CLI):** Gemini CLI creates an `execution-summary.md` in the track folder.
5.  **QA Audit (Billy):** Trigger with `QA: <track-name>`. Billy runs `npm run lint` + `npm run build`, audits all modified files against `plan.md` acceptance criteria, and updates `index.md` status to one of: `Verified` · `Rework Required` · `Optimization Suggested`. If issues found, creates `rework-plan.md`.
6.  **Rework (Gemini CLI):** If `Rework Required`, Gemini executes `rework-plan.md` 🔴 items first, then 🟡 items. Re-triggers Billy QA after.
7.  **Architectural Review (Claude):** Final review after Billy sets status to `Verified`.

## File Structure

- `conductor/index.md`: Registry of all tracks and their statuses.
- `conductor/tracks/<feature-name>/plan.md`: The step-by-step implementation plan.
- `conductor/tracks/<feature-name>/spec.md`: (Optional) Technical specification and design notes.
- `conductor/tracks/<feature-name>/execution-summary.md`: Final report from Gemini CLI.

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
- **Progress Tracking** Update the checkbox [x] immediately as each Task is completed (process one Task at a time, do not bundle).
- **Execution Summary** Upon completion, summarize the results in execution-summary.md by specifying:
    - Completed tasks
    - Test results (if any)
    - Issues encountered or necessary deviations from the plan (always provide technical justifications)

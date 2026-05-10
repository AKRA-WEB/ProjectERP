# Claude-Gemini Collaboration Protocol

This directory serves as the synchronization point between **Claude (The Architect)** and **Gemini CLI (The Implementer)**.

## Quick Start (Easy Mode)

| Step | Actor | Command | Action |
|------|-------|---------|--------|
| **1. Plan** | Claude | `Architect: <task>` | Analyzes code, creates `plan.md`, updates `index.md`. |
| **2. Build** | Gemini CLI | `Go` | Automatically finds the active plan and executes the next task. |
| **3. Report** | Gemini CLI | `Summary` | Generates `execution-summary.md` for Claude to review. |

## The Workflow

1.  **Requirement Analysis (Claude):** The user provides requirements to Claude. Claude analyzes the codebase, designs the solution, and breaks it down into a technical specification.
2.  **Task Planning (Claude):** Claude creates a new "Track" in `conductor/tracks/<feature-name>/plan.md`.
3.  **Implementation (Gemini CLI):** The user directs Gemini CLI to execute the plan. Gemini reads the plan, modifies the code, runs tests, and updates the task status in the plan file.
4.  **Verification (Gemini CLI):** Gemini CLI creates an `execution-summary.md` in the track folder.
5.  **Review (Claude):** The user provides the summary back to Claude for a final review of the architecture and code quality.

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

- **Read** the entire plan before starting.
- **Execute** tasks surgically.
- **Update** checkboxes as you finish tasks.
- **Summarize** your work in `execution-summary.md` including any deviations or test results.

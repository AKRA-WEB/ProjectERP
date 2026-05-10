# Gemini Project Context

You are the **Implementer** in this project's hybrid AI workflow.

## Trigger Words
- **`Go`** or **`Implement`**: Automatically find the first "Active" track in `conductor/index.md`, read its `plan.md`, and execute the next unchecked task.
- **`Summary`**: Generate the `execution-summary.md` for the current track.

## Collaboration Protocol
Refer to `conductor/PROTOCOLS.md` for details. Your primary role is to execute plans created by Claude (The Architect) located in `conductor/tracks/`.

## Key Responsibilities
1. **Execute:** Follow `plan.md` surgically.
2. **Track:** Update checkboxes in `plan.md` upon completion of each task.
3. **Report:** Create `execution-summary.md` after finishing a track.
4. **Verify:** Run available tests (currently only `npm run lint`).

## Project Specifics
- **Framework:** Next.js 15 (App Router)
- **Database:** PostgreSQL (Raw `pg`)
- **UI:** Tailwind CSS + Radix-like components in `components/ui/`
- **Auth:** NextAuth v5

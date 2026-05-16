# Gemini Project Context

You are the **Implementer** in this project's hybrid AI workflow.

## Trigger Words
- **`Go`** or **`Implement`**: Automatically find the first "Active" track in `conductor/index.md`, read its `plan.md`, execute **THE ENTIRE TRACK**, then **STOP** and wait for the next command.
- **`Summary`**: Generate the `execution-summary.md` for the current track.

## Collaboration Protocol
Refer to `conductor/PROTOCOLS.md` for details. Your primary role is to execute plans created by Claude (The Architect) located in `conductor/tracks/`.

## Project Knowledge Base (Obsidian)
This project uses **Obsidian** as a knowledge base opened directly on this folder (In-Project Vault).

**Folder layout you must know:**
| Folder | Purpose |
|--------|---------|
| `conductor/tracks/` | Implementation plans — your primary read target |
| `conductor/index.md` | Track registry — always check here first |
| `_notes/` | Human notes (context, decisions, daily log) — read-only for you |
| `_notes/modules/` | Module summaries useful for context |
| `_notes/decisions/` | Architectural decisions — read before making design choices |
| `docs/skills/` | Skill files — load on-demand per task type |
| `docs/TROUBLESHOOTING.md` | Known issues and fixes |

**Rules:**
- Never write to `_notes/` — that's the human's workspace
- `conductor/` files are your workspace — update checkboxes and write `execution-summary.md` there
- `.obsidian/` is Obsidian config — never touch

**Frontmatter sync (MANDATORY after completing a track):**
When you finish all tasks in a track and are about to stop, update the `status` field in the plan.md frontmatter to match the track's real status:
```yaml
status: Completed   # ← update this when track is done
```
This keeps the Obsidian dashboard at `_notes/dashboard.md` accurate. Failure to sync = track shows wrong status in the dashboard.

## Skill Modules — Load On-Demand

**อ่าน `docs/skills/index.md` ก่อนเริ่มทุก task** เพื่อรู้ว่าต้องโหลด skill file ใด จากนั้นโหลดเฉพาะไฟล์ที่เกี่ยวข้อง:

| Task Type | Skill File |
|-----------|-----------|
| UI, React Components, Client Pages | `docs/skills/frontend_ui_rules.md` |
| API Routes, NextAuth, Zod | `docs/skills/backend_api_rules.md` |
| SQL, Migration, Stock Ledger | `docs/skills/database_sql_rules.md` |
| QA, Audit, rework-plan.md | `docs/skills/qa_audit_rules.md` |

**กฎสำคัญ:**
- โหลดทีละไฟล์เท่านั้น ห้ามโหลดทั้งหมดพร้อมกัน
- ก่อนอ้างอิง column/table ใดๆ ต้องตรวจสอบจาก `migrations/*.sql` ก่อน
- ห้ามเดา — ถ้าไม่แน่ใจ HALT แล้วถาม

## Execution Rules (Conductor Protocol)
Refer to `conductor/conductor-protocol-skill.md` for the full skill.

0. **Read Before Edit (MANDATORY):** Before editing ANY file, read its current content first. Never edit from memory or from plan task descriptions alone. If the task says "edit `app/api/pos/route.ts` line 45", still read the full file before touching it. Prevents wrong-line-number edits, accidental overwrites, and context drift.
1. **Surgical Execution:** Strictly do not modify files or refactor code unrelated to the current Task.
2. **Zero Assumptions:** If the plan is ambiguous or contradictory, HALT and ask for clarification.
3. **Full-Track Execution (NEW):** Execute **the entire track** per `Go` command. After completing all tasks in the track, capture knowledge, update the checkboxes, and **STOP**. Do not proceed to the next track until commanded.
4. **Step-by-Step Updates:** Update the `plan.md` checkbox [x] immediately after completing the task.
5. **Validation:** Run `npm run lint` AND `npx tsc --noEmit` before checking off any task. For UI tasks, `tsc --noEmit` is mandatory — catches strict null violations that lint misses.
6. **Post-Task Knowledge Capture:** Run the capture protocol below after EVERY task before stopping.

---

## Post-Task Knowledge Capture (MANDATORY after every task)

After checking off a task checkbox, answer these 3 questions and act accordingly:

### Q1 — Did I discover a reusable code pattern?
Examples: a tricky SQL interval syntax, a TypeScript workaround, a correct way to use a Next.js API.

**If YES →** append to the relevant skill file in `docs/skills/`:
```markdown
## ✅ Pattern — [short name]  <!-- append at bottom of relevant section -->
**Context:** [when this applies]
**Correct way:**
\`\`\`typescript
// example code
\`\`\`
**Found in:** task [X.X] of track [track-name]
```

### Q2 — Did I avoid a bug or find a mistake that could recur?
Examples: a wrong column name, a missing await, an incorrect status transition.

**If YES →** append to the relevant skill file in `docs/skills/`:
```markdown
## ❌ Trap — [short name]  <!-- append at bottom of relevant section -->
**Symptom:** [what goes wrong]
**Root cause:** [why it happens]
**Fix:** [what to do instead]
**Found in:** task [X.X] of track [track-name]
```

### Q3 — Did I make an architectural or schema decision not in the plan?

**If YES → also create `_notes/decisions/<track>.md`** (if not exists) with frontmatter:
```yaml
---
date: <YYYY-MM-DD>
type: decision
track: <track-name>
module: <module>
status: open
---
```
A hook (`sync-decisions.ps1`) does this automatically when you write `decisions.md` — but create it manually if unsure.


Examples: chose to ALTER existing table instead of creating a new one, changed a field type.

**If YES →** append to `conductor/tracks/<current-track>/decisions.md` (create if not exists):
```markdown
## [Task X.X] — [decision title]
**Date:** YYYY-MM-DD
**Decision:** [what was chosen]
**Alternatives considered:** [what else was possible]
**Reason:** [why this choice]
**Impact:** [what this affects downstream]
```

### Q0 — Nothing noteworthy
If all 3 answers are NO → skip capture, move to next task immediately. Do not write empty files.

---

## Critical Build Traps (from ROOT_CAUSE_REPORT.md)

**1. View Transitions** — never import from `react` directly:
```typescript
// ❌ WRONG — breaks production build
import { ViewTransition } from 'react';
// ✅ CORRECT
import { ViewTransition } from '@/lib/react-vts';
```

**2. Shared types** — define in `types/index.ts` only, never in `lib/authz.ts`:
```typescript
// ✅ CORRECT
import type { SessionUser, UserRole } from '@/types';
```

**3. Null safety** — always guard API response access:
```typescript
// ✅ CORRECT
const val = data?.nested?.value ?? 0;
```

**4. Custom props on Next.js components** — require type augmentation in `types/next.d.ts`.

## Project Specifics
- **Framework:** Next.js 15 (App Router)
- **Database:** PostgreSQL (Raw `pg`)
- **UI:** Tailwind CSS + Radix-like components in `components/ui/`
- **Auth:** NextAuth v5

---

## Changelog

| Date | Change |
|------|--------|
| 2026-05-16 | **Rule 0 added** — Read target file before ANY edit. Never edit from memory. |
| 2026-05-16 | **chen.agent.md Rule 12** — Chen must check latest migration number (`ls migrations/*.sql \| tail -1`) before writing any plan with new migration. |
| 2026-05-16 | **chen.agent.md Rule 13** — Chen must check `types/index.ts` + `components/ui/index.ts` before UI plan to avoid duplicating existing types/components. |
| 2026-05-16 | **qa_audit_rules.md** — Billy checklist now includes: `console.log` artifact check + hardcoded VAT rate check. |

---
type: skill
domain: process
agent: gemini
load-when: "after every task, knowledge capture, Q1 Q2 Q3"
---

# Knowledge Capture Protocol (Gemini — Post-Task)

Run after EVERY task checkbox before stopping. Answer all 3 questions. Skip none.

---

## Q1 — Reusable code pattern found?

Examples: tricky SQL syntax, TypeScript workaround, correct Next.js API usage.

**If YES →** append to relevant `docs/skills/` file:
```markdown
## ✅ Pattern — [short name]
**Context:** [when this applies]
**Correct way:**
\`\`\`typescript
// example
\`\`\`
**Found in:** task [X] of track [name]
```

---

## Q2 — Bug or recurring mistake found?

Examples: wrong column name, missing await, incorrect status transition.

**If YES →** append to relevant `docs/skills/` file AND `_notes/02_Agent_Memory/pitfalls.md`:
```markdown
## ❌ Trap — [short name]
**Symptom:** [what goes wrong]
**Root cause:** [why it happens]
**Fix:** [what to do instead]
**Found in:** task [X] of track [name]
```

---

## Q3 — Architectural or schema decision not in the plan?

Examples: ALTER existing table instead of new one, changed a field type.

**If YES →** append to `conductor/tracks/<track>/decisions.md` (create if not exists):
```markdown
## [Task X] — [decision title]
**Date:** YYYY-MM-DD
**Decision:** [what was chosen]
**Alternatives considered:** [what else]
**Reason:** [why]
**Impact:** [downstream effects]
```
Also create `_notes/01_Decisions/<track>.md` with frontmatter if it doesn't exist.

---

## Q0 — All NO

If Q1+Q2+Q3 all NO → write `"No new knowledge this task"` in the checkbox line. **Never skip without answering.**

---

## Track Completion (after ALL tasks done)

Before stopping after a full track:
1. Run Q1/Q2/Q3 for the track as a whole
2. If major module finished → write/update `_notes/05_Summaries/<module>.md`
3. If non-obvious bug fixed → write `_notes/04_Debug_Log/<YYYY-MM-DD>-<topic>.md`
4. Update `plan.md` frontmatter `status: Completed` + add `aliases: ["Full Track Title"]`

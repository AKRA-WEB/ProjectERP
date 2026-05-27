# Design — Chen Plan Enforcement (Architect Trigger Reliability)

**Date:** 2026-05-18  
**Status:** Approved  
**Author:** Claude (brainstorming session)

---

## Problem

When user types `Architect: <requirement>`, the intended behavior is:

> Claude spawns Chen subagent → Chen analyzes codebase → Chen writes `plan.md` to disk

Observed failures (all three modes reported):
1. Claude writes plan inline instead of spawning Chen
2. Chen spawned but outputs plan as chat text, never calls Write tool
3. Chen writes plan.md but does not update `conductor/index.md`

Root causes:
- `PROTOCOLS.md` boundary rule contradicts chen.agent.md: "Claude writes plan.md" vs "use Write tool"
- No enforcement mechanism — only a CLAUDE.md memory note
- Chen Phase 3 instructions too soft — no failure state, no atomic checklist

---

## Solution: Option B — Hook + Agent File Fix

Three targeted changes. No workflow changes for the user.

---

## Component 1: `UserPromptSubmit` Hook

**File:** `.claude/hooks/enforce-architect-spawn.ps1`  
**Registered in:** `.claude/settings.local.json` → `hooks.UserPromptSubmit`

**Behavior:**
- Reads user prompt from stdin (JSON: `{"prompt": "..."}`)
- If prompt starts with `Architect:` (case-insensitive) → prints enforcement message to stdout
- Claude Code injects stdout as pre-response context

**Injected message:**
```
⚠️ ARCHITECT TRIGGER DETECTED.
YOU MUST call the Agent tool with subagent_type="chen" right now.
Pass the full requirement text to Chen.
Do NOT write plan.md yourself. Do NOT analyze inline. Do NOT ask clarifying questions first.
Chen does the analysis. Chen writes the files. Wait for Chen's result.
```

**Non-"Architect:" prompts:** hook exits silently (no output, no overhead).

---

## Component 2: `chen.agent.md` Phase 3 Rewrite

Replace current soft Phase 3 with an explicit atomic checklist.

**New Phase 3 content:**

```markdown
## Phase 3: Write Plan to Disk

> RULE: Outputting plan content as chat text = FAILURE. Plan does not exist until on disk.
> User cannot see chat text in Obsidian. Write tool only.

Atomic checklist — do not skip or reorder:

- [ ] Step 1 — Create directory: PowerShell `New-Item -ItemType Directory -Force "<absolute-path>"`
- [ ] Step 2 — Write tool → full absolute Windows path → `conductor/tracks/<name>/plan.md`
         Path format: `C:\dev\projectERP\conductor\tracks\<name>\plan.md`
- [ ] Step 3 — Edit tool → `conductor/index.md` → append new row with `| [Name](./tracks/<name>/plan.md) | Active | <date> | <date> |`
- [ ] Step 4 — Read tool → verify `plan.md` exists and is non-empty. If empty or missing → retry Step 2.
- [ ] Step 5 — Read tool → verify `conductor/index.md` contains the new row. If missing → retry Step 3.

Only proceed to Phase 4 after Steps 4 and 5 both confirm files on disk.
```

---

## Component 3: `PROTOCOLS.md` Contradiction Fix

**Section:** "File Structure" → boundary rules  
**Change:**

| Before | After |
|--------|-------|
| `conductor/ — ... Claude writes plan.md, rework-plan.md, updates index.md.` | `conductor/ — ... Chen writes plan.md, rework-plan.md, updates index.md. Claude reviews and commits.` |

Also update Quick Start table note (Step 1) to make clear Chen writes the file, not just "creates" it.

---

## Files Changed

| File | Change |
|------|--------|
| `.claude/hooks/enforce-architect-spawn.ps1` | New file |
| `.claude/settings.local.json` | Add `UserPromptSubmit` hook entry |
| `.claude/agents/chen.agent.md` | Rewrite Phase 3 (lines ~97–109) |
| `conductor/PROTOCOLS.md` | Fix boundary rule contradiction (line ~50) |

---

## Out of Scope

- Changing user workflow (`Architect:` prefix stays the same)
- Modifying QA-Review flow
- Changing any other agent files (billy, puka, paku)

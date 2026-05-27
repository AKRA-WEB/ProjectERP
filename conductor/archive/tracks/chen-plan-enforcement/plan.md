---
track: chen-plan-enforcement
status: Completed
owner: paku
module: Core
updated: 2026-05-20
---

# Chen Plan Enforcement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Enforce that when user types `Architect: <requirement>`, Chen subagent always spawns AND writes `plan.md` to disk via Write tool — never as inline chat text.

**Architecture:** Three-layer fix: (1) `UserPromptSubmit` hook injects a mandatory spawn reminder before Claude responds to any `Architect:` prompt, preventing inline plan writing. (2) `chen.agent.md` Phase 3 rewritten as an atomic checklist with explicit failure states and Read-back verification. (3) `PROTOCOLS.md` boundary rule fixed to match chen.agent.md (currently contradicts it by saying "Claude writes plan.md").

**Tech Stack:** PowerShell 7, Claude Code hooks (`UserPromptSubmit`), Markdown

**Spec:** `docs/superpowers/specs/2026-05-18-chen-plan-enforcement-design.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `.claude/hooks/enforce-architect-spawn.ps1` | Create | Hook script — detects `Architect:` prefix, injects spawn context |
| `.claude/settings.local.json` | Modify | Register hook under `hooks.UserPromptSubmit` |
| `.claude/agents/chen.agent.md` | Modify lines 97–109 | Rewrite Phase 3 with atomic checklist + failure state |
| `conductor/PROTOCOLS.md` | Modify line 50 | Fix "Claude writes plan.md" → "Chen writes plan.md" |

---

## Task 1: Create enforce-architect-spawn.ps1

**Files:**
- Create: `.claude/hooks/enforce-architect-spawn.ps1`

This hook fires on every user message. It reads the prompt from stdin JSON, checks if it starts with `Architect:` (case-insensitive), and prints an enforcement message if so. Claude Code injects stdout as a `system-reminder` before Claude responds.

- [x] **Step 1: Create the hook file**

Create `.claude/hooks/enforce-architect-spawn.ps1` with this exact content:

```powershell
# enforce-architect-spawn.ps1
# UserPromptSubmit hook — fires before Claude responds to any user message.
# If prompt starts with "Architect:", injects mandatory Chen spawn reminder.

$stdinData = [Console]::In.ReadToEnd()
if (-not $stdinData) { exit 0 }

try {
    $hookInput = $stdinData | ConvertFrom-Json
} catch {
    exit 0
}

$prompt = $hookInput.prompt
if (-not $prompt) { exit 0 }

if ($prompt -match '(?i)^\s*Architect\s*:') {
    Write-Output @"
⚠️ ARCHITECT TRIGGER DETECTED — MANDATORY ACTION REQUIRED:

YOU MUST call the Agent tool with subagent_type="chen" RIGHT NOW.
Pass the FULL requirement text to Chen as the prompt.

DO NOT:
- Write plan.md yourself
- Analyze the requirement inline
- Ask clarifying questions before spawning Chen
- Output any plan content as chat text

Chen does the analysis. Chen writes the files to disk. You wait for Chen's result.
Failure to spawn Chen = task failure.
"@
}

exit 0
```

- [x] **Step 2: Verify file created at correct path**

```powershell
Test-Path "C:\dev\projectERP\.claude\hooks\enforce-architect-spawn.ps1"
```

Expected: `True`

---

## Task 2: Register Hook in settings.local.json

**Files:**
- Modify: `.claude/settings.local.json`

Add a `UserPromptSubmit` key to the existing `hooks` object. The current `hooks` object only has `PostToolUse`. Add `UserPromptSubmit` at the same level.

- [x] **Step 1: Read current settings.local.json to confirm current hooks structure**

Read `.claude/settings.local.json` — confirm `hooks` object ends after `PostToolUse` block.

- [x] **Step 2: Add UserPromptSubmit hook entry**

In `.claude/settings.local.json`, find this exact block (end of the hooks object):

```json
    "PostToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [
          {
            "type": "command",
            "command": "powershell -ExecutionPolicy Bypass -File C:\\dev\\projectERP\\.claude\\hooks\\obsidian-sync.ps1"
          }
        ]
      }
    ]
  }
```

Replace with:

```json
    "PostToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [
          {
            "type": "command",
            "command": "powershell -ExecutionPolicy Bypass -File C:\\dev\\projectERP\\.claude\\hooks\\obsidian-sync.ps1"
          }
        ]
      }
    ],
    "UserPromptSubmit": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "powershell -ExecutionPolicy Bypass -File C:\\dev\\projectERP\\.claude\\hooks\\enforce-architect-spawn.ps1"
          }
        ]
      }
    ]
  }
```

- [x] **Step 3: Verify JSON is valid**

```powershell
Get-Content "C:\dev\projectERP\.claude\settings.local.json" | ConvertFrom-Json | Out-Null; Write-Output "JSON valid"
```

Expected: `JSON valid` (no errors)

- [x] **Step 4: Commit Tasks 1–2**

```bash
git add .claude/hooks/enforce-architect-spawn.ps1 .claude/settings.local.json
git commit -m "feat(core): add UserPromptSubmit hook to enforce Chen spawn on Architect: trigger"
```

---

## Task 3: Rewrite chen.agent.md Phase 3

**Files:**
- Modify: `.claude/agents/chen.agent.md` lines 97–109

Replace the existing Phase 3 (soft instruction with no failure state) with an atomic checklist that includes explicit failure states and Read-back verification.

- [x] **Step 1: Open chen.agent.md and locate Phase 3**

Read `.claude/agents/chen.agent.md`. Confirm lines 97–109 match:

```
## Phase 3: Write Plan to Disk
**NEVER output plan content as text in response. ALWAYS use Write tool.**

Steps:
1. Use **Write tool** → `conductor/tracks/<feature-name>/plan.md`
2. Use **Edit tool** → add row to `conductor/index.md` (Status: Active)
3. Use **Read tool** → read back both files to verify they exist on disk

If Read-back fails → re-write. Do NOT report done until Read-back confirms file exists.

## Phase 4: Handoff
Tell user: `"Plan written. Run 'Go' in Gemini CLI to execute."`
Nothing else.
```

- [x] **Step 2: Replace Phase 3 with atomic checklist**

Replace the block above with:

```markdown
## Phase 3: Write Plan to Disk

> ❌ FAILURE STATE: If you output plan.md content as chat text without calling Write tool, you have failed. Chat text is invisible in Obsidian. The plan does not exist until it is a file on disk. There are no exceptions.

Atomic checklist — execute in order, never skip:

- [x] **Step 1** — Create track directory (PowerShell tool):
  `New-Item -ItemType Directory -Force "C:\dev\projectERP\conductor\tracks\<feature-name>"`

- [x] **Step 2** — **Write tool** → full absolute Windows path:
  `C:\dev\projectERP\conductor\tracks\<feature-name>\plan.md`
  Never use relative paths. Never use Unix-style paths.

- [x] **Step 3** — **Edit tool** → `C:\dev\projectERP\conductor\index.md`
  Append new row in the All Tracks table:
  `| [<Track Name>](./tracks/<feature-name>/plan.md) | Active | <YYYY-MM-DD> | <YYYY-MM-DD> |`

- [x] **Step 4** — **Read tool** → read back `plan.md`. Verify file is non-empty.
  If empty or missing → repeat Step 2. Do not proceed until non-empty.

- [x] **Step 5** — **Read tool** → read back `conductor/index.md`. Verify new row exists.
  If missing → repeat Step 3. Do not proceed until row confirmed.

Only after Steps 4 and 5 both pass → proceed to Phase 4.

## Phase 4: Handoff
Tell user: `"Plan written. Run 'Go' in Gemini CLI to execute."`
Nothing else.
```

- [x] **Step 3: Verify the edit looks correct**

Read `.claude/agents/chen.agent.md` lines 95–120. Confirm old "Steps: 1. Use Write tool..." is gone and new checklist is present.

- [x] **Step 4: Commit Task 3**

```bash
git add .claude/agents/chen.agent.md
git commit -m "fix(core): rewrite chen.agent.md Phase 3 with atomic checklist and explicit failure state"
```

---

## Task 4: Fix PROTOCOLS.md Boundary Rule Contradiction

**Files:**
- Modify: `conductor/PROTOCOLS.md` line 50

The current boundary rule says "Claude writes plan.md" — directly contradicting chen.agent.md. This mixed signal causes Claude to write plans inline instead of spawning Chen.

- [x] **Step 1: Open PROTOCOLS.md and confirm line 50**

Read `conductor/PROTOCOLS.md` lines 48–53. Confirm line 50 is:

```
- `conductor/` — Gemini writes `execution-summary.md`, updates checkboxes. Claude writes `plan.md`, `rework-plan.md`, updates `index.md`.
```

- [x] **Step 2: Replace the boundary rule**

Replace the exact line above with:

```markdown
- `conductor/` — Gemini writes `execution-summary.md`, updates checkboxes. **Chen** writes `plan.md`, `rework-plan.md`, updates `index.md`. Claude reviews and commits.
```

- [x] **Step 3: Verify change**

Read `conductor/PROTOCOLS.md` lines 48–53. Confirm "Claude writes" is gone and "**Chen** writes" is present.

- [x] **Step 4: Commit Task 4**

```bash
git add conductor/PROTOCOLS.md
git commit -m "fix(core): fix PROTOCOLS.md contradiction — Chen writes plan.md, not Claude"
```

---

## Task 5: End-to-End Verification

No automated test suite exists. Verify manually.

- [x] **Step 1: Reload Claude Code session**

Close and reopen Claude Code (or start a new session) so the new `UserPromptSubmit` hook is loaded.

- [x] **Step 2: Trigger the hook manually**

In a new session, type: `Architect: test requirement`

Expected: A `system-reminder` block appears in context containing `⚠️ ARCHITECT TRIGGER DETECTED`.

If no reminder appears: check that `settings.local.json` has valid JSON and the hook path is correct.

- [x] **Step 3: Verify hook fires with non-Architect prompt**

Type any normal message (e.g., `hello`).

Expected: No `⚠️ ARCHITECT TRIGGER` in context. Hook exits silently.

- [x] **Step 4: Verify chen.agent.md Phase 3 is correct on disk**

```powershell
Select-String -Path "C:\dev\projectERP\.claude\agents\chen.agent.md" -Pattern "FAILURE STATE"
```

Expected: one match on the `❌ FAILURE STATE` line.

- [x] **Step 5: Verify PROTOCOLS.md is correct on disk**

```powershell
Select-String -Path "C:\dev\projectERP\conductor\PROTOCOLS.md" -Pattern "Chen.*writes"
```

Expected: one match on the updated boundary rule line.

---

## QA Checklist

- [x] Hook fires only on `Architect:` prefix (case-insensitive), not on all prompts
- [x] Hook exits cleanly (exit code 0) on non-matching prompts — no stderr noise
- [x] `settings.local.json` is valid JSON after edit
- [x] `chen.agent.md` contains `❌ FAILURE STATE` block in Phase 3
- [x] `chen.agent.md` Phase 3 atomic checklist has 5 numbered steps
- [x] `PROTOCOLS.md` no longer contains "Claude writes `plan.md`"
- [x] `PROTOCOLS.md` contains "**Chen** writes `plan.md`"
- [x] All 4 commits exist: `git log --oneline -4`


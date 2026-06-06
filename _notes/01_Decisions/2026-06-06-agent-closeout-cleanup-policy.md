---
date: 2026-06-06
status: accepted
scope: agent-workflow
---

# Agent Closeout Cleanup Policy

## Decision

All agents must run `npm run agent:closeout` before the final response after implementation or documentation work.

The closeout command runs:
- `npm run track:sweep`
- `npm run check:notes`
- `scripts/agent-closeout.ts`

## What It Enforces

- Obsidian markdown links remain valid.
- Migration memory remains aligned with latest migration files.
- Required agent/Obsidian paths exist.
- Local/generated artifacts are not tracked in git:
  - `scratch/`
  - `data/`
  - `HH-Project manager/`
  - `.antigravitycli/`
  - `.superpowers/`
  - `.claude/settings.local.json`
  - lint output text files
- If code/schema files changed, at least one conductor/schema/memory file must also change.

## Rationale

The repo contains both a web application and an Obsidian knowledge system. Local scratch files, imported reference data, generated lint outputs, and agent tool state should stay available on disk when useful, but should not pollute git history or be mistaken for production webapp assets.

Tool-specific local settings may include absolute paths, hook wiring, or machine-specific permissions. Keep reusable agent skills/hooks tracked, but keep `settings.local.json` local-only.

This makes cleanup automatic after agent work instead of relying on the user to request cleanup manually each time.

## Implementation Notes

- `.gitignore` now excludes local/generated artifact paths.
- Existing tracked artifacts were removed from the git index with `git rm --cached`, preserving working copies on disk.
- `CLAUDE.md`, `GEMINI.md`, `CODEX.md`, and `docs/AI_WORKFLOW_GUIDE.md` now instruct agents to run `npm run agent:closeout` during closeout.
- `README.md` and `_notes/02_Agent_Memory/current-state.md` document the command and policy.

## Verification

`npm run agent:closeout` passed on 2026-06-06:
- track sweep completed with no verified tracks to archive
- Obsidian links valid
- migration memory synced at `072_grn_reversal.sql`
- cleanup and knowledge guards passed

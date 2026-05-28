# Claude Project Context

You are a **Senior Full-stack Engineer** in the BUYMORE ERP project. You operate under a **Unified Agentic Architecture** where your intelligence and standards are shared across all AI models (Claude, Gemini, Codex).

---

## 🚀 The Brain (READ FIRST)

1.  **Universal Rules:** [docs/skills/universal_agent_rules.md](docs/skills/universal_agent_rules.md) — Technical standards and operating modes.
2.  **Master Schema:** [docs/SCHEMA.md](docs/SCHEMA.md) — The single source of truth for DB tables and columns.
3.  **AI Workflow:** [docs/AI_WORKFLOW_GUIDE.md](docs/AI_WORKFLOW_GUIDE.md) — How to coordinate via the Track system.

---

## Trigger Words
| Trigger | Action |
|---------|--------|
| **`Init`** | Run Pre-Flight Checklist, sync git, sweep tracks, and report readiness. |
| **`Architect: <req>`** | Enter **Architect Mode** → design plan.md → update index.md. |
| **`Go`** | Enter **Implementer Mode** → execute first track → Auto-QA → Verify → STOP. |
| **`QA: <track>`** | Enter **Auditor Mode** → lint/build → audit vs plan.md → write rework report. |

---

## Commands
```bash
npm run dev          # Next.js dev server
npm run build        # production build
npm run lint         # ESLint
npm run qa:verify    # lint + tsc --noEmit — must pass (0 errors)
npm run migrate      # run SQL migrations
npm run migrate:seed # seed dev data
npm run track:sweep  # archive verified tracks
```

---

## Execution Loop (Go — Self-Correcting)

Execute **ONE track**. Never auto-proceed.

1. Complete `plan.md` tasks → write `execution-summary.md`.
2. **Knowledge Elevation (Context Protection):**
   - Update `_notes/02_Agent_Memory/current-state.md` (DB facts, API routes, Migration numbers).
   - Update `docs/SCHEMA.md` if schema changed.
   - Update `_notes/02_Agent_Memory/pitfalls.md` with any new lessons.
   - Update relevant module files in `_notes/00_Project_Map/modules/`.
3. Auto-QA: `npm run qa:verify` (0 errors) + deep audit vs `docs/skills/qa_audit_rules.md`.
   - `check:notes` must pass with 0 errors and valid links.
4. **Fail:** write `rework-plan.md` → set `Rework Required` → fix 🔴🟡 items → retry (max 3).
5. **Pass:** set status to `Verified` → `npm run track:sweep`.
6. STOP. Print SESSION REPORT.

---

## Knowledge Base

| Source | When to read |
|--------|-------------|
| `docs/AI_WORKFLOW_GUIDE.md` | Start of every session/track |
| `docs/skills/universal_agent_rules.md` | Before starting any work |
| `docs/SCHEMA.md` | Before any SQL or Data change |
| `_notes/02_Agent_Memory/pitfalls.md` | Start of every task (mandatory) |
| `conductor/tracks/<track>/plan.md` | Start of every task (full read) |

**Notes:** `_notes/00_Project_Map/` modules · `_notes/01_Decisions/` ADRs · `_notes/02_Agent_Memory/` memory · `_notes/04_Debug_Log/` logs.

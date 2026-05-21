# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Purpose

BUYMORE (THAILAND) COMPANY LIMITED — Full ERP platform on Next.js 15 + PostgreSQL. Modules: WMS, POS, Sales, Accounting, HR, BOM. See `docs/architecture.md` for route layout.

## Commands

```bash
npm run dev          # start dev server (Next.js 15)
npm run build        # production build
npm run lint         # ESLint
npm run migrate      # run SQL migrations in order
npm run migrate:seed # seed dev data
```

No test suite. `npm run lint` + `npx tsc --noEmit` are the automated checks.

## Environment

```
DATABASE_URL=postgresql://user:pass@host:5432/dbname
NEXTAUTH_SECRET=<random-string>
NEXTAUTH_URL=http://localhost:3000
```

## Claude-Gemini Collaboration Protocol

**Trigger: `Architect: <requirement>`** → spawn Chen agent to plan. Do NOT plan inline.
Refer to `conductor/PROTOCOLS.md` for full protocol.

## Session Start (MANDATORY)

**Before writing a single line of code or plan — always run:**

```bash
git pull origin master
```

ถ้าไม่ pull ก่อน → local อาจล้าหลัง remote → push conflict กับ Gemini/Chen commits อื่น

## Output Silence Mode (MANDATORY)
**To save tokens and focus on execution efficiency:**
1. **Silence During Execution:** Do not write conversational text, progress updates, explanations, or thoughts in the chat output while running the conductor loop. Just call tools.
2. **Ultra-Concise Completion:** Once the entire track/loop is done, write a 1-paragraph summary with exact files changed and validation results. Do not repeat instructions.

## Architecture

**Stack:** Next.js 15 App Router · React 19 · TypeScript strict · PostgreSQL (raw `pg`) · NextAuth v5 · Zod · Tailwind CSS

### Critical Patterns

**Auth (every API route):**
```typescript
const session = await auth(); if (!session) return apiError('Unauthorized', 401);
const u = session.user as unknown as SessionUser;
try { assertRole(u, ['manager', 'admin']); } catch { return apiError('Forbidden', 403); }
```

**Warehouse scope (every GET list):**
```typescript
const scope = buildWarehouseScopeClause(u, 'alias.warehouse_id', idx);
```

**API responses:**
```typescript
return apiSuccess(data);        // 200
return apiError('msg', 404);    // error
return apiValidationError(err); // 400
```

**Stock ledger:** Insert-only. Never UPDATE/DELETE. Trigger `sync_stock_balances()` fires automatically.

**Document numbers:** PostgreSQL `next_doc_number(prefix, seq)` — never app-side.

**Shared types:** `SessionUser`, `UserRole` → `types/index.ts` only. Never define in `lib/authz.ts`.

**View Transitions:** Use `lib/react-vts.tsx` bridge — never import from `react` directly.

**PATCH:** All PATCH routes use `body.action` discriminant — `{ action: 'update_status', status: 'x' }`.

## Business Logic

State machines + business rules → `_notes/00_Project_Map/state-machines.md`

Key constraints:
- VAT 7% via `VAT_RATE` in `lib/constants.ts`
- PO auto-updates after GRN stocking
- Cycle count approval: stored proc `apply_cycle_count()` only

## UI Conventions
- Bilingual: Thai primary, English secondary.
- `formatDate()` Thai locale Asia/Bangkok. `formatCurrency()` THB only.
- All pages `'use client'`. Components from `components/ui/index.ts`.

## Obsidian Integration

Vault = this folder. Hub: `_notes/HOME.md`. Dashboard: `_notes/dashboard.md`.

```
_notes/
├── 00_Project_Map/    ← state machines, module summaries
├── 01_Decisions/      ← decision log
├── 02_Agent_Memory/   ← pitfalls, agents index
├── 04_Debug_Log/      ← bug logs
└── 05_Summaries/      ← module summaries, changelogs
```

**Rules:** plan.md must have YAML frontmatter. Never write to `.obsidian/`.

## Note-Taking Guide

| สิ่งที่พบ | เขียนที่ |
|----------|---------|
| **Track เสร็จ / DB column ใหม่ / API route ใหม่** | `_notes/02_Agent_Memory/current-state.md` — อัปเดต Active Work + Last 5 Tracks |
| Architectural decision | `_notes/01_Decisions/<track>.md` |
| Bug root cause / non-obvious fix | `_notes/04_Debug_Log/<YYYY-MM-DD>-<topic>.md` |
| Anti-pattern / pitfall | `_notes/02_Agent_Memory/pitfalls.md` |
| Module summary | `_notes/05_Summaries/<module>.md` |
| Reusable code pattern | `docs/skills/<skill>.md` |
| Track plan | `conductor/tracks/<track>/plan.md` |

## Post-Work Knowledge Capture (Claude) — MANDATORY

After every task (bug fix, plan, analysis):

| Q | ถ้าใช่ |
|---|--------|
| Q1: พบ pattern ที่ใช้ซ้ำ? | `docs/skills/<skill>.md` — append `## ✅ Pattern` |
| Q2: พบ bug/trap? | `_notes/02_Agent_Memory/pitfalls.md` + skill file |
| Q3: ตัดสินใจ architecture/schema? | `_notes/01_Decisions/<topic>.md` |

ถ้า NO ทั้ง 3 ข้อ → ระบุ "No new knowledge captured"

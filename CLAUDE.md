# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Purpose

BUYMORE (THAILAND) COMPANY LIMITED — Full ERP platform on Next.js 15 + PostgreSQL. Modules: WMS, POS, Sales, Accounting, HR, BOM. See `docs/architecture.md` for route layout and module checklist.

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
- Claude = Architect (plans). Gemini CLI = Implementer (executes).
- Refer to `conductor/PROTOCOLS.md` for full protocol.

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

## Business Logic

### Status State Machines

| Document | Flow |
|---|---|
| PR | `draft` → `submitted` → `manager_approved` → `admin_approved` → `converted_to_po` \| `rejected` |
| PO | `draft` → `sent` → `partially_received` / `fully_received` → `invoiced` → `paid` → `closed` \| `cancelled` |
| GRN | `draft` → `received` → `qc_passed` / `qc_failed` → `stocked` |
| RMA/Claim | `open` → `in_review` → `resolved` → `closed` |
| Transfer | `pending` → `completed` (atomic) |
| Cycle Count | `open` → `counting` → `pending_approval` → `approved` → `closed` |

### Key Rules
- VAT 7% (`VAT_RATE = 0.07` in `lib/constants.ts`). All amounts THB.
- Transfer: atomic debit source + credit destination.
- Cycle count approval: stored proc `apply_cycle_count()` — never replicate in app code.
- PO auto-updates after GRN stocking.

## UI Conventions
- Bilingual: Thai primary, English secondary.
- `formatDate()` Thai locale Asia/Bangkok. `formatCurrency()` THB only.
- All pages `'use client'`. Components from `components/ui/index.ts`.
- PATCH uses `body.action` discriminant.

## Obsidian Integration

Vault = this folder. Hub: `_notes/HOME.md`. Dashboard: `_notes/dashboard.md`.

### Vault Structure
```
_notes/
├── 00_Project_Map/    ← ภาพรวมระบบ, module summaries, state machines
├── 01_Decisions/      ← decision log (ทำไมเลือกทางนี้)
├── 02_Agent_Memory/   ← pitfalls, output guidelines, agents index
├── 03_Prompts/        ← prompts ที่ใช้ซ้ำ
├── 04_Debug_Log/      ← bug log, root cause, วิธีแก้
├── 05_Summaries/      ← summary ของ module / ไฟล์ใหญ่
├── daily/             ← daily standup notes
├── weekly/            ← weekly review notes
└── templates/         ← note templates
```

### Rules
- plan.md must have YAML frontmatter (track/status/owner/module/updated) — see `chen.agent.md`
- GEMINI.md Critical Traps = rolling 8 max (hook-managed)
- Skill files > 200 lines → prune (see `_notes/skill-changelog.md`)
- Never write to `.obsidian/`
- Claude may write to `_notes/` when explicitly requested by user

## Note-Taking Guide — What Goes Where

| สิ่งที่พบ | เขียนที่ |
|----------|---------|
| Architectural decision (ทำไมเลือกทางนี้) | `_notes/01_Decisions/<track>.md` |
| Bug root cause / วิธีแก้ที่ non-obvious | `_notes/04_Debug_Log/<YYYY-MM-DD>-<topic>.md` |
| Anti-pattern / pitfall ห้ามทำซ้ำ | `_notes/02_Agent_Memory/pitfalls.md` (append) |
| Summary ของ module ใหม่ที่ implement เสร็จ | `_notes/05_Summaries/<module>.md` |
| Reusable code pattern | `docs/skills/<relevant-skill>.md` (append) |
| Track plan | `conductor/tracks/<track>/plan.md` |
| Rework plan | `conductor/tracks/<track>/rework-plan.md` |

**ห้ามเขียน unsolicited:** `_notes/daily/` และ `.obsidian/` — เขียนได้ถ้า user ขอ (`.obsidian/` ระวัง JSON syntax)

## Post-Work Knowledge Capture (Claude) — MANDATORY

**ทุกครั้งที่ทำงานเสร็จ** (ไม่ว่าจะเป็น bug fix, plan, analysis, restructure) ต้องทำ 3 ข้อนี้ก่อน end turn:

| คำถาม | ถ้าใช่ → เขียนที่ |
|-------|-----------------|
| Q1: พบ pattern ที่ใช้ซ้ำได้? | `docs/skills/<skill>.md` — append `## ✅ Pattern — [name]` |
| Q2: พบ bug/trap ที่อาจเกิดซ้ำ? | `_notes/02_Agent_Memory/pitfalls.md` — append + `docs/skills/<skill>.md` |
| Q3: ตัดสินใจเรื่อง architecture/schema? | `_notes/01_Decisions/<topic>.md` |

**ไม่มีข้อยกเว้น** — ถ้าตอบ NO ทั้ง 3 ข้อ ให้ระบุสั้นๆ ว่า "No new knowledge captured" ใน response

**Trigger พิเศษ:**
- วิเคราะห์ bug จาก user report → เขียน `_notes/04_Debug_Log/<date>-<topic>.md` เสมอ
- Billy flag bug category เดิมซ้ำ → เพิ่ม trap ใน skill file ทันที
- Chen plan แก้ schema → เพิ่ม rule ใน `docs/skills/database_sql_rules.md`

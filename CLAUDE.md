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
- plan.md must have YAML frontmatter (track/status/owner/module/updated) — see `chen.agent.md`
- GEMINI.md Critical Traps = rolling 8 max (hook-managed)
- Skill files > 200 lines → prune (see `_notes/skill-changelog.md`)
- Never write to `_notes/` or `.obsidian/`

## Post-Task Knowledge Capture (Claude)

After every task answer 3 questions:

**Q1 — New reusable pattern?** → append `## ✅ Pattern — [name]` to relevant `docs/skills/*.md`
**Q2 — Bug trap that could recur?** → append `## ❌ Trap — [name]` to relevant `docs/skills/*.md`
**Q3 — Architectural decision?** → append to `conductor/tracks/<track>/decisions.md`

Skip only when all 3 are NO.

**Upgrade triggers:**
- Billy flags same bug category twice → add trap to skill file
- Chen plan needed schema fix → add rule to `database_sql_rules.md`

# i18n Full Compliance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all 127+ hardcoded Thai text files and prevent regression via ESLint rule, page template, and developer guide.

**Architecture:** Prevention-first — install enforcement tooling before sweeping existing violations module-by-module. ESLint rule starts as `"warn"` during fix period, upgraded to `"error"` on completion.

**Tech Stack:** Next.js 14, ESLint 8, `eslint-plugin-local-rules`, TypeScript, custom React Context i18n (`lib/i18n/`)

---

## Execution Order

Tracks are in `conductor/tracks/`. Execute in this sequence:

```
T1 (prevention) → T2 (keys) → T3 + T4 + T5 (parallel, module fixes) → T6 (sweep + finalize)
```

| Track | File | Description |
|-------|------|-------------|
| I-1 | [i18n-t1-prevention](../../../conductor/tracks/i18n-t1-prevention/plan.md) | ESLint rule + template + docs + CLAUDE.md |
| I-2 | [i18n-t2-keys](../../../conductor/tracks/i18n-t2-keys/plan.md) | Add ~65 keys to en.json + th.json |
| I-3 | [i18n-t3-accounting](../../../conductor/tracks/i18n-t3-accounting/plan.md) | Fix Accounting module (vat-report, ledger) |
| I-4 | [i18n-t4-grn-purchasing](../../../conductor/tracks/i18n-t4-grn-purchasing/plan.md) | Fix GRN + Purchase Orders |
| I-5 | [i18n-t5-admin-wms](../../../conductor/tracks/i18n-t5-admin-wms/plan.md) | Fix Admin + WMS |
| I-6 | [i18n-t6-menu-remaining](../../../conductor/tracks/i18n-t6-menu-remaining/plan.md) | Fix Menu/Dashboard + all remaining + upgrade ESLint to `"error"` |

---

## Definition of Done

- `npm run lint` — 0 `no-hardcoded-thai` errors
- `npm run build` — succeeds
- `npx tsc --noEmit` — 0 errors
- Language switcher toggles ALL text in ALL pages (TH ↔ EN)
- ESLint rule severity = `"error"` (new hardcoded Thai fails CI)
- `docs/i18n.md` committed, linked from CLAUDE.md
- `scripts/new-page-template.tsx` available for all future modules

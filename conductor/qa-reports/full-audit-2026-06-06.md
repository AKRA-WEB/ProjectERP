# Full Codebase Audit — BUYMORE ERP

**Date:** 2026-06-06 · **Auditor:** Claude (Architect) · **Scope:** read-only, sampled ~20 of ~370 files
**Build at audit time:** PASS (exit 0, compile 23s, 249 static pages)

Spawned tracks: `hardening-t1` … `hardening-t6` (Phase 6 — Hardening & Stabilization).

---

## Overview

Next.js 15 (App Router) + React 19 + PostgreSQL (raw `pg`) + NextAuth v5 (JWT) + Zod v4.
~156 pages, 212 API routes, 72 migrations. API pattern consistent and clean
(auth → Zod → warehouse scope → parameterized SQL → `apiSuccess`). Two structural gaps:
near-zero tests and a hollow CI gate. Security/SQL/transaction fundamentals mostly correct.

**Coverage:** verified entry points, auth/middleware/config, core lib, 6 query files,
representative mutation routes, i18n. NOT covered: per-route RBAC across all 212 APIs,
transaction correctness across all mutations, migration SQL logic, client error handling.
→ deferred to `hardening-t6-deep-verification-audit`.

---

## Findings

### 🔴 Critical

- **C1 — No test coverage.** Only `scratch/sanity.test.ts` exists; `npm run test` / `qa:verify` pass trivially. Financial/inventory logic (3-way match, FEFO, moving-avg cost, VAT, credit) untested. → **hardening-t1**.

### 🟠 High

- **H1 — `lib/db/client.ts:8` `ssl: { rejectUnauthorized: false }`** disables TLS cert validation → MITM risk in prod. → **hardening-t3**.
- **H2 — `next.config.ts:19` `eslint.ignoreDuringBuilds: true`** + empty tests → nothing blocks broken code reaching prod (this is how i18n-t6 bypassed the rule). → **hardening-t2**.

### 🟡 Medium

- **M1 — `middleware.ts:11-13`** guards only `/app` + `/api`; top-level `/dispatch`, `/wms`, `/sales` render shells for unauthenticated users (API still 401 → no data leak). → **hardening-t4**.
- **M2 — empty `catch {}`** in `dashboard/page.tsx:24-26`, `grn/page.tsx:25-32`, `inventory/page.tsx:15-17`, `ap/page.tsx:13-15` → silent DB failures, blank pages, no logs. → **hardening-t4**.
- **M3 — `lib/queries/analytics.ts:47-51` `getSkuCutCandidates`** missing `LIMIT/OFFSET` (hard-rule violation, unbounded). → **hardening-t4**.
- **M4 — 108 `eslint-disable no-hardcoded-thai` suppressions** instead of i18n migration. → existing track **i18n-t6-menu-remaining** (Rework Required). i18n key parity OK (en/th = 1413/1413).

### 🟢 Low

- **L1 — repo hygiene:** `scratch/` (9 dev files incl `notion_login.png`), `data/` binaries (PDF/jpg), `HH-Project manager/` (space in name) committed. → **hardening-t5**.
- **L2 — `as any` ×16** (12 in `auth.config.ts`); fix via NextAuth module augmentation. → **hardening-t5**.
- **L3 — only test lives in `scratch/`**; relocate before gitignoring scratch. → **hardening-t1 / t5**.

---

## Verified Correct (credit)

- API pattern consistent (`lib/queries/ap.ts` exemplary — param SQL, LIMIT capped 100, OFFSET).
- Admin API RBAC enforced on all `app/api/admin/**` routes (`assertRole`/`assertPermission`).
- Transaction boundaries present in multi-step writes (`grn`, `purchase-orders`, `grn/[id]/cancel`, `sales-orders` use BEGIN/COMMIT).
- `stock_ledger` insert-only respected (0 UPDATE/DELETE in code + migrations).
- SQL parameterized in all sampled query files (no value interpolation).
- i18n key parity perfect (1413 = 1413).
- `.env` gitignored + untracked.

---

## Fix Order

1. **hardening-t1** (tests) — unblocks a meaningful gate.
2. **hardening-t2** (enforce qa:verify) — makes T1 binding.
3. **hardening-t3** (TLS) — security, small.
4. **i18n-t6** (existing rework) — close debt.
5. **hardening-t4** (M1/M2/M3 bug+edge).
6. **hardening-t6** (deep audit) — breadth sweep, may spawn more.
7. **hardening-t5** (hygiene/types) — cleanup.

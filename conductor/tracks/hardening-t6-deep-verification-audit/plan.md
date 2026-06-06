---
track: hardening-t6-deep-verification-audit
phase: hardening-stabilization
sequence: 6
status: Planned
owner: Chen
created: 2026-06-06
updated: 2026-06-06
depends_on: [hardening-t1-test-foundation]
estimate: L
tags: [audit, verification, security, rbac, transactions]
spec: conductor/qa-reports/full-audit-2026-06-06.md
---

# Hardening T6 — Deep Verification Audit (Investigation → spawns fix tracks)

## Goal

The 2026-06-06 audit sampled ~20 of ~370 files. Five areas were flagged "not yet verified — do not guess." This track does the **breadth sweep** across all routes/migrations and produces a findings report; each confirmed defect becomes a new fix track. This is an **investigation track** — output is a report, not feature code.

Depends on T1 so any quick fixes made during the sweep land on a tested base.

## Architecture

Read-only audit. For each area: enumerate every relevant file, grep for the required pattern, read the misses, classify. Output to `conductor/qa-reports/deep-audit-2026-06-06.md` using the Billy finding format (`file:line — Issue — Fix`).

## Acceptance Criteria

1. Every `app/api/**/route.ts` checked for: `auth()` guard + correct RBAC (`assertRole`/`assertPermission`) + warehouse scope on list endpoints.
2. Every multi-table write route checked for `BEGIN`/`COMMIT`/`ROLLBACK` **and** client release in `finally`.
3. Every `lib/queries/**` + inline-SQL list endpoint checked for `LIMIT`/`OFFSET` + parameterization (no value interpolation).
4. Migrations spot-audited for FK/constraint/trigger correctness on the financial tables.
5. Client pages checked for `ApiError` handling (no unhandled rejections / blank failures).
6. A written report with severity-classified findings; index.md updated with any spawned fix tracks.

---

## Files

| Action | Path |
|--------|------|
| Read | all `app/api/**/route.ts` (~212) |
| Read | `lib/queries/**`, `lib/accounting/**`, `lib/invoice/**`, `lib/jobs/**` |
| Read | `migrations/*.sql` (focus 060–072 financial) |
| Create | `conductor/qa-reports/deep-audit-2026-06-06.md` |

---

## Tasks

### Task 1: API auth + RBAC sweep

- [ ] **1.1** Enumerate routes: `git ls-files 'app/api/**/route.ts'`.
- [ ] **1.2** Flag any route without `await auth()` (or session check):
```bash
for f in $(git ls-files 'app/api/**/route.ts'); do grep -q "auth()" "$f" || echo "NO-AUTH: $f"; done
```
- [ ] **1.3** For write/admin routes, confirm `assertRole`/`assertPermission`. Read each miss; classify Confirmed/Dismissed (some GET routes are intentionally any-authenticated).
- [ ] **1.4** For list (GET) routes touching warehouse-scoped tables, confirm `buildWarehouseScopeClause` is applied. List misses.

### Task 2: Transaction correctness sweep

- [ ] **2.1** Find multi-`INSERT`/`UPDATE` routes:
```bash
for f in $(git ls-files 'app/api/**/route.ts'); do n=$(grep -cE "INSERT INTO|UPDATE " "$f"); [ "$n" -ge 2 ] && echo "$n $f"; done | sort -rn
```
- [ ] **2.2** For each, confirm `BEGIN`/`COMMIT`, `ROLLBACK` on catch, and `client.release()` in `finally`. Record any route that writes parent+child without a transaction (pitfalls #3) or leaks a client.

### Task 3: Query bounds + injection sweep

- [ ] **3.1** Grep all `query(` / `queryOne(` call sites for backtick interpolation of non-placeholder values. Manually read suspicious ones (ORDER BY / column from user input).
- [ ] **3.2** Confirm every list query has `LIMIT`/`OFFSET` (M3 found one miss — find the rest).

### Task 4: Migration + client audit

- [ ] **4.1** Spot-read financial migrations (3-way match trigger `reconcile_po_invoice` in `070`, VAT `071`, GRN reversal `072`) for constraint/rollback correctness.
- [ ] **4.2** Grep client pages for `await get(`/`post(` without try/catch or error state. Sample-read worst offenders.

### Task 5: Report + spawn fix tracks

- [ ] **5.1** Write `conductor/qa-reports/deep-audit-2026-06-06.md` — findings classified Critical/High/Medium/Low, each `file:line — Issue — Fix`.
- [ ] **5.2** For each Confirmed Must-Fix cluster, create a follow-up track stub under `conductor/tracks/` and register in `index.md`. Do NOT fix inline (keep this track investigation-only) unless a fix is a one-line obvious safety patch.

---

## Verification

Report exists at `conductor/qa-reports/deep-audit-2026-06-06.md`; every API route appears accounted for (covered or explicitly noted); spawned fix tracks registered in `index.md`.

## Notes

- This track WRITES NO production code (except trivial one-line safety patches). Its deliverable is the audit report + new track stubs.
- Use `superpowers:systematic-debugging` if a flagged route's behavior is ambiguous — reproduce before classifying as a bug.

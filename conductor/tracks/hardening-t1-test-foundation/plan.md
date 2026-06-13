---
track: hardening-t1-test-foundation
phase: hardening-stabilization
sequence: 1
status: Completed
owner: Chen
created: 2026-06-06
updated: 2026-06-13
depends_on: []
estimate: M
tags: [testing, vitest, quality-gate, critical]
spec: conductor/qa-reports/full-audit-2026-06-06.md
---

# Hardening T1 — Test Foundation (Critical)

> **For agentic workers:** REQUIRED SUB-SKILL: use `superpowers:test-driven-development` for every test written here. Write the test, see it fail/pass against real code, never assert without running.

## Goal

Project ships with **one** test file (`scratch/sanity.test.ts`), so `npm run test` / `npm run qa:verify` pass trivially. Establish a real test foundation and cover the highest-risk pure-logic modules (auth scoping, pricing, credit, formatting) so the QA gate becomes meaningful.

This is the prerequisite for T2 (CI gate) — enforcing `qa:verify` is pointless while tests are empty.

## Architecture

- Keep existing `vitest.config.ts` (jsdom, globals, `vitest.setup.ts`, `@` alias) — already correct.
- Create a top-level `__tests__/` mirror OR co-locate `*.test.ts` next to source. **Decision:** co-locate unit tests next to pure-logic source (`lib/**/*.test.ts`); reserve `__tests__/` for future integration tests.
- Target **pure functions first** (no DB, deterministic) — highest value/lowest effort. DB-touching integration tests are deferred to a later track.

## Tech Stack

Vitest 4, @testing-library/react, jsdom.

## Acceptance Criteria

1. `scratch/sanity.test.ts` moved out of `scratch/` (so it survives T5 gitignore) — relocated to `__tests__/sanity.test.ts` or deleted if redundant.
2. ≥ 5 new test files covering: `lib/authz.ts`, `lib/pricing/resolve.ts`, `lib/pricing/enforce-min-price.ts`, `lib/credit/check-credit-status.ts`, `lib/utils.ts` (formatCurrency/formatDate Buddhist era).
3. `npm run test` runs all tests, **> 1 file, 0 failures**.
4. `npx tsc --noEmit` passes (test files type-check).
5. Each test asserts real behavior verified against the actual source (no tautological tests).

---

## Files

| Action | Path |
|--------|------|
| Read | `lib/authz.ts`, `lib/pricing/resolve.ts`, `lib/pricing/enforce-min-price.ts`, `lib/credit/check-credit-status.ts`, `lib/utils.ts` |
| Create | `lib/authz.test.ts` |
| Create | `lib/pricing/resolve.test.ts`, `lib/pricing/enforce-min-price.test.ts` |
| Create | `lib/credit/check-credit-status.test.ts` |
| Create | `lib/utils.test.ts` |
| Move | `scratch/sanity.test.ts` → `__tests__/sanity.test.ts` |

---

## Tasks

### Task 1: Relocate the orphan test

- [x] **1.1** Read `scratch/sanity.test.ts`. File was already absent, so no orphan scratch test remained to move.
- [x] **1.2** `npm run test` — confirmed Vitest collects the new co-located tests.

### Task 2: Test `lib/authz.ts` (warehouse scope — security-critical)

- [x] **2.1** Read `lib/authz.ts` fully. Note the 4 branches of `buildWarehouseScopeClause` (admin→null, no BU+no WH→FALSE, BU+WH, BU-only, WH-only) and `hasPermission`/`assertRole`/`assertWarehouseAccess`.
- [x] **2.2** Write `lib/authz.test.ts` covering:
  - admin → `null` (no restriction)
  - staff, no BU, no WH → `clause === 'FALSE'` (deny-all, not allow-all)
  - WH-only → `= ANY($N::uuid[])` with correct param
  - BU+WH → both conditions, correct `$N`/`$N+1` offsets
  - `hasPermission`: admin bypass true; staff with/without perm
  - `assertRole` throws `{ status: 403 }` when role not allowed
- [x] **2.3** `npx vitest run lib/authz.test.ts` → green.

### Task 3: Test pricing logic

- [x] **3.1** Read `lib/pricing/resolve.ts` + `lib/pricing/enforce-min-price.ts`. Map inputs→outputs (channel/tier/contract resolution; min-price hard-stop boundary `<` vs `<=`).
- [x] **3.2** Write `lib/pricing/resolve.test.ts` — cover each resolution branch + fallback/no-match.
- [x] **3.3** Write `lib/pricing/enforce-min-price.test.ts` — assert exact boundary: price == min allowed, price just below blocked. (Min-price is a financial hard-stop — boundary correctness matters.)

### Task 4: Test credit status

- [x] **4.1** Read `lib/credit/check-credit-status.ts`. Identify on-hold conditions (over limit, aging exceeded).
- [x] **4.2** Write `lib/credit/check-credit-status.test.ts` — under limit OK, at limit boundary, over limit hold, aging-days threshold.

### Task 5: Test formatters

- [x] **5.1** Read `lib/utils.ts` `formatCurrency`/`formatDate`. Confirm Buddhist era (+543) + THB rules.
- [x] **5.2** Write `lib/utils.test.ts` — THB formatting, Buddhist year conversion, null/edge inputs.

### Task 6: Verify whole suite

- [x] **6.1** `npm run test` — all files, 0 failures, count > 1.
- [x] **6.2** `npx tsc --noEmit` — clean.
- [x] **6.3** Commit:
```bash
git add lib/**/*.test.ts __tests__/
git commit -m "test(hardening): add unit tests for authz, pricing, credit, formatters"
```

---

## Verification

```bash
npm run test && npx tsc --noEmit
```
Both pass; `npm run test` reports > 1 test file and 0 failures.

## Notes

- N/A for transaction/doc-number/child-insert gates — this track writes **no DB code**, only tests of pure functions.
- Do NOT add DB-mocking integration tests here; that's deferred. Keep scope to deterministic pure logic.

---
track: hardening-t2-ci-gate
phase: hardening-stabilization
sequence: 2
status: Planned
owner: Chen
created: 2026-06-06
updated: 2026-06-06
depends_on: [hardening-t1-test-foundation]
estimate: S
tags: [ci, quality-gate, git-hooks, high]
spec: conductor/qa-reports/full-audit-2026-06-06.md
---

# Hardening T2 — Enforce the Quality Gate (High)

## Goal

`next.config.ts` sets `eslint.ignoreDuringBuilds: true`, so `next build` skips lint — lint errors (incl. `no-hardcoded-thai`) do not block deploy. Combined with empty tests, nothing prevents broken code reaching production. Make `npm run qa:verify` an **enforced** gate via a pre-push git hook and/or GitHub Actions.

**Depends on T1** — enforcing `qa:verify` is only meaningful once tests actually exist.

## Architecture

- Keep `ignoreDuringBuilds: true` (build speed) — but compensate by gating `lint + tsc + test + check:notes` before code lands.
- Add **`simple-git-hooks`** (zero-dep, lightweight) for a local `pre-push` hook running `npm run qa:verify`. Prefer over husky (fewer deps, project already minimal).
- Add a **GitHub Actions** workflow as the authoritative gate (local hooks can be bypassed with `--no-verify`).

## Tech Stack

`simple-git-hooks`, GitHub Actions (Node 20).

## Acceptance Criteria

1. `pre-push` hook runs `npm run qa:verify`; a failing lint/tsc/test blocks the push locally.
2. `.github/workflows/ci.yml` runs `npm ci && npm run qa:verify` on PR + push to master.
3. Documented in `README.md` how to install hooks (`npx simple-git-hooks`).
4. `npm run qa:verify` passes on current tree (after T1).
5. Hard-Rules #1, #4, #8, #9, #10 converted from prose to automated gates (lint rules + CI checks); `universal_agent_rules.md §3` table Status flipped to `✅ enforced` for those rows.

---

## Files

| Action | Path |
|--------|------|
| Modify | `package.json` (add dep + `simple-git-hooks` config + `prepare` script) |
| Create | `.github/workflows/ci.yml` |
| Modify | `README.md` (hook install note) |

---

## Tasks

### Task 1: Local pre-push hook

- [ ] **1.1** `npm install -D simple-git-hooks`.
- [ ] **1.2** Add to `package.json`:
```json
"simple-git-hooks": { "pre-push": "npm run qa:verify" },
"scripts": { "prepare": "simple-git-hooks" }
```
- [ ] **1.3** `npx simple-git-hooks` to install. Confirm `.git/hooks/pre-push` created.
- [ ] **1.4** Test: introduce a deliberate lint error, `git push` (dry) → blocked. Revert.

### Task 2: GitHub Actions gate

- [ ] **2.1** Create `.github/workflows/ci.yml`:
```yaml
name: CI
on:
  push: { branches: [master] }
  pull_request:
jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: npm }
      - run: npm ci
      - run: npm run qa:verify
```
- [ ] **2.2** Note: `qa:verify` includes `check:notes` (tsx). Confirm it runs in CI without a DB — pure-logic tests from T1 must not require `DATABASE_URL`. If any test needs DB, mark it `.skip` with a TODO referencing a future integration-test track.

### Task 3: Decide on `ignoreDuringBuilds`

- [ ] **3.1** Keep `eslint.ignoreDuringBuilds: true` in `next.config.ts` (gate now lives in hook + CI). Document this decision inline as a comment so future agents don't "fix" it back.

### Task 4: Convert prose Hard-Rules → automated gates

> Closes the `manual-interim` rows in `docs/skills/universal_agent_rules.md §3`. Each rule that lands here flips to `enforced` — update that table's Status column in the same commit.

- [ ] **4.1** Add `@typescript-eslint/no-explicit-any: "error"` to `.eslintrc.json` (Hard-Rule #1). Fix or `as unknown as T` the ~16 existing sites (coordinate with T5 which adds `next-auth.d.ts`).
- [ ] **4.2** Add `no-empty: ["error", { allowEmptyCatch: false }]` (Hard-Rule #10) — forces `catch {}` to log/handle. Fix the 4 server-page catches (overlaps T4 M2).
- [ ] **4.3** Author `local-rules/no-unbounded-query` (Hard-Rule #4) — flag `query(\`...\`)` containing `SELECT` ... `FROM` without `LIMIT`. Mirror the existing `no-hardcoded-thai` local-rule structure. Set severity `error`.
- [ ] **4.4** Add a CI grep gate (in `ci.yml`) that **fails** if `git grep "eslint-disable local-rules/"` matches under `app/`, `components/`, `lib/` (Hard-Rule #9 — no gaming).
- [ ] **4.5** Add a CI gate that fails if test count is 0 / below a floor (Hard-Rule #8) — e.g. `vitest run --reporter=json` and assert `numTotalTests > <floor>`.
- [ ] **4.6** Update the §3 enforcement table: flip rows 1, 4, 8, 9, 10 from `manual-interim` → `✅ enforced`.

### Task 5: Docs + commit

- [ ] **5.1** Add README section: "After `npm install`, run `npx simple-git-hooks` once to enable the pre-push QA gate."
- [ ] **5.2** Commit:
```bash
git add package.json package-lock.json .github/workflows/ci.yml README.md
git commit -m "ci(hardening): enforce qa:verify via pre-push hook + GitHub Actions"
```

---

## Verification

```bash
npm run qa:verify          # passes locally
cat .git/hooks/pre-push    # exists, runs qa:verify
```
CI workflow appears green on the next PR.

## Notes

- N/A for DB/transaction gates — config + CI only.
- If `simple-git-hooks` install is blocked by OneDrive path/permissions, fall back to a committed `scripts/pre-push.sh` + manual `git config core.hooksPath`.

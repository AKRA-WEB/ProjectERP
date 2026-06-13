---
track: hardening-t2-ci-gate
phase: hardening-stabilization
sequence: 2
status: Completed
owner: Chen
created: 2026-06-06
updated: 2026-06-13
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

- [x] **1.1** `npm install -D simple-git-hooks`.
- [x] **1.2** Add to `package.json`:
```json
"simple-git-hooks": { "pre-push": "npm run qa:verify" },
"scripts": { "prepare": "simple-git-hooks" }
```
- [x] **1.3** `npx simple-git-hooks` to install. Confirm `.git/hooks/pre-push` created.
- [x] **1.4** Test: introduce a deliberate lint error, `git push --dry-run origin HEAD` → blocked. Reverted the temporary probe file.

### Task 2: GitHub Actions gate

- [x] **2.1** Create `.github/workflows/ci.yml`:
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
- [x] **2.2** Note: `qa:verify` includes `check:notes` (tsx). Confirmed locally without DB-backed tests; T1 tests mock DB clients and do not require `DATABASE_URL`.

### Task 3: Decide on `ignoreDuringBuilds`

- [x] **3.1** Keep `eslint.ignoreDuringBuilds: true` in `next.config.ts` (gate now lives in hook + CI). Document this decision inline as a comment so future agents don't "fix" it back.

### Task 4: Convert prose Hard-Rules → automated gates

> Closes the `manual-interim` rows in `docs/skills/universal_agent_rules.md §3`. Each rule that lands here flips to `enforced` — update that table's Status column in the same commit.

- [x] **4.1** Add `@typescript-eslint/no-explicit-any: "error"` to `.eslintrc.json` (Hard-Rule #1). Fixed existing explicit `any` sites in app/types/scripts scope.
- [x] **4.2** Add `no-empty: ["error", { allowEmptyCatch: false }]` (Hard-Rule #10) — forces `catch {}` to log/handle. Fixed empty catches in server/client pages and archive script.
- [x] **4.3** Author `local-rules/no-unbounded-query` (Hard-Rule #4). Implemented as a baseline gate for existing debt: new query debt fails once it exceeds the current baseline.
- [x] **4.4** Add a CI/local gate that fails if `eslint-disable local-rules/` suppressions exceed the current baseline under `app/`, `components/`, `lib/` (Hard-Rule #9 — no new gaming). Existing suppressions remain owned by `i18n-t6-menu-remaining`.
- [x] **4.5** Add a CI/local gate that fails if test file/case count drops below the H1 floor (Hard-Rule #8).
- [x] **4.6** Update the §3 enforcement table: rows 1, 4, 8, 9, 10 now reflect enforced or baseline-enforced gates.

### Task 5: Docs + commit

- [x] **5.1** Add README section: "After `npm install`, run `npx simple-git-hooks` once to enable the pre-push QA gate."
- [x] **5.2** Commit:
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

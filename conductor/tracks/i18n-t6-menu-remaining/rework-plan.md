# Rework Plan — i18n-t6-menu-remaining

**QA Date:** 2026-06-06
**Auditor:** Codex
**Verdict:** Rework Required

---

## Changes From Completed Claim

The track cannot be verified yet. Tooling gates mostly pass, but the implementation bypassed the i18n rule by adding `/* eslint-disable local-rules/no-hardcoded-thai */` across legacy files instead of migrating all remaining user-facing Thai strings to i18n keys.

Verification evidence:
- `npm run lint` passed with no ESLint warnings or errors.
- `npx tsc --noEmit` passed.
- `npm run test` passed when rerun outside sandbox after the sandbox blocked Vitest startup with `spawn EPERM`.
- `git grep -n "eslint-disable local-rules/no-hardcoded-thai"` found many suppressions across API routes, app pages, shared components, and the summary/script artifacts.
- `npm run build` did not complete within the verification timeout during this QA pass.

---

## Must Fix

- [ ] **MF-1 · Remove i18n rule suppressions from product UI files**
  Files under `app/app/**`, `app/**`, and `components/**` must not rely on `eslint-disable local-rules/no-hardcoded-thai` to pass Track 6. Replace hardcoded user-facing Thai text with `useT()` keys, and add matching entries to both `lib/i18n/en.json` and `lib/i18n/th.json`.

- [ ] **MF-2 · Re-run the global no-hardcoded-Thai sweep without suppressions**
  After migration, run `npm run lint` and confirm there are no `local-rules/no-hardcoded-thai` errors without file-level disables in product UI files.

- [ ] **MF-3 · Verify translation key parity**
  Confirm `lib/i18n/en.json` and `lib/i18n/th.json` contain the same key set after adding replacements.

- [ ] **MF-4 · Complete production build verification**
  Re-run `npm run build` and capture a successful completion. The previous QA run timed out after Next.js build startup and cannot be counted as a pass.

---

## Should Fix

- [ ] **SF-1 · Remove or archive `scripts/disable-thai-lint.js`**
  The script exists only to bypass the hardcoded Thai rule and should not remain as a reusable path for future regressions.

- [ ] **SF-2 · Split the remaining migration into smaller module batches if needed**
  The current suppression footprint is large. Prefer module batches such as AP, HR, POS, Sales, Inventory, shared components, and app shell, with one verification pass per batch.

---

## Verified Correct

- `.eslintrc.json` sets `"local-rules/no-hardcoded-thai": "error"`.
- `app/app/menu/page.tsx`, `app/app/dashboard/DashboardClient.tsx`, and `app/app/dashboard/AuditorDashboardClient.tsx` are no longer the main blocker for this track.

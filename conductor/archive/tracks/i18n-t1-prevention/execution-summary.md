# Execution Summary — i18n-t1-prevention

**Date:** 2026-05-30
**Agent:** Claude (Sonnet 4.6)
**Branch:** feat/i18n-t1-prevention
**Status:** Verified

## What Was Done

### Task 1 — npm install
- Installed `eslint-plugin-local-rules` (1 package, no dep conflicts)

### Task 2 — ESLint rule
- Created `.eslint-rules/no-hardcoded-thai.js` — warns on Thai unicode `[฀-๿]` in JSX/Literal/TemplateLiteral nodes
- Whitelisted: `nameTh`, `labelTh`, `valueTh`, `descriptionTh`, `shortNameTh`, `titleTh`, `name_th`, `label_th`, `value_th`, `description_th` properties
- Exempted: `lib/i18n/` files, `.eslint-rules/` itself, `*.pdf/route.tsx` (WHT legal forms)
- Created `eslint-local-rules.js` (root-level, no leading dot — required by plugin's file discovery)

### Task 3 — ESLint config
- Updated `.eslintrc.json` to add `"plugins": ["local-rules"]` and `"local-rules/no-hardcoded-thai": "warn"`
- Verified: lint runs, Thai violations appear as warnings across 127+ files, exits 0

### Task 4 — Scaffold template
- Created `scripts/new-page-template.tsx` with `useT()` imported and usage comments

### Task 5 — Developer guide
- Created `docs/i18n.md` with key naming table, adding-key instructions, whitelisted props, PDF exemptions, new-page checklist

### Task 6 — CLAUDE.md
- Added `docs/i18n.md` row to Knowledge Base table
- Added i18n check note to Auto-QA step 3

## Side Fix
- Fixed 6 broken markdown links in `docs/superpowers/plans/2026-05-29-i18n-full-compliance.md` — relative paths were `../../` but should be `../../../` from that file's location

## QA Result
- `npm run qa:verify` — PASSED (0 errors, all markdown links valid, migration sync clean)
- Thai violations appear as warnings (127+ files) — expected, to be fixed in T3–T6

## Acceptance Criteria
- [x] `npm install` succeeds with `eslint-plugin-local-rules`
- [x] `npm run lint` runs without error; Thai violations appear as warnings
- [x] `scripts/new-page-template.tsx` exists with `useT()` imported
- [x] `docs/i18n.md` committed and linked from CLAUDE.md Knowledge Base
- [x] CLAUDE.md Auto-QA step includes i18n check note

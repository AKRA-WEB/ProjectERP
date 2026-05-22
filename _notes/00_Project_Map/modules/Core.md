---
module: Core
type: module-summary
status: Stable
updated: 2026-05-18
---

# Core — UI Framework & Infrastructure

The Core module provides the infrastructure used by all other modules, including authentication, authorization, database connectivity, and internationalization.

## Dependencies
- **Foundational for:** All modules ([[WMS]], [[Inventory]], [[POS]], [[Sales]], [[Accounting]], [[HR]], [[BOM]], [[Vendors]], [[Security]])
- **Infrastructure:** Provides document numbering, API clients, and shared UI components.
- **Core Decisions:** [[auth-pattern]], [[doc-numbers-db-function]], [[patch-action-discriminant]], [[transaction-pattern]], [[warehouse-scope-clause]]

## Stack
Next.js 15 App Router · React 19 · TypeScript strict · Tailwind CSS · NextAuth v5

## Key Features
- **i18n (Internationalization)**: Thai/English system-wide support via `LanguageProvider`.
- **RBAC (Role-Based Access Control)**: Permission-based guards for API routes and UI components.
- **DB Client**: Centralized PostgreSQL pool with utility functions for typed queries.
- **Formatting Utilities**: Locale-aware formatters for currency, dates, and numbers.

## Architecture

### Internationalization
- **Provider**: `lib/i18n/index.tsx`
- **Dictionaries**: `lib/i18n/th.json`, `en.json`
- **Hook**: `useT()` for strings, `localeName()` for DB-driven text.
- **Persistence**: `localStorage` (key: `erp_lang`).

### Authentication
- **Framework**: NextAuth.js v5.
- **Type**: `SessionUser` (extended with `role` and `assignedWarehouseIds`).

### Document Numbering
PostgreSQL `next_doc_number(prefix, seq)` — ห้าม generate ใน app code.
- **Sequences**: `seq_pr` · `seq_po` · `seq_grn` · `seq_rma` · `seq_clm` · `seq_trf` · `seq_cc`

## Guidelines / Key Conventions
- **No Hardcoded Strings**: All user-facing text must use `t()`.
- **Bilingual Fields**: Use `localeName()` when dealing with DB items having `name_th` and `name_en` (Thai primary, English secondary).
- **Locale-Aware Formatting**: Pass `lang` from `useLanguage()` to formatters in `lib/format.ts`.
  - `formatCurrency()` THB only — ห้าม hardcode สกุลเงิน.
  - `formatDate()` Thai locale, Asia/Bangkok TZ.
- All pages `'use client'` — no RSC data fetching.
- Components: `components/ui/index.ts`.
- API client: `lib/api-client.ts` (`get`, `post`, `patch`, `del`).

## Recent Changes (2026-05-18)
- Launched system-wide i18n support.
- Refactored `Sidebar` and `TopBar` to be fully reactive to language changes.
- Added `LanguageSwitcher` component.

## Tracks

```dataview
TABLE status, updated
FROM "conductor/tracks"
WHERE file.name = "plan" AND module = "Core"
SORT updated DESC
```

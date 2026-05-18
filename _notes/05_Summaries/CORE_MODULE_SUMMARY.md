---
module: Core
status: Stable
updated: 2026-05-18
---

# Core Module Summary

## Overview
The Core module provides the infrastructure used by all other modules, including authentication, authorization, database connectivity, and internationalization.

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

## Guidelines
- **No Hardcoded Strings**: All user-facing text must use `t()`.
- **Bilingual Fields**: Use `localeName()` when dealing with DB items having `name_th` and `name_en`.
- **Locale-Aware Formatting**: Pass `lang` from `useLanguage()` to formatters in `lib/format.ts`.

## Recent Changes (2026-05-18)
- Launched system-wide i18n support.
- Refactored `Sidebar` and `TopBar` to be fully reactive to language changes.
- Added `LanguageSwitcher` component.

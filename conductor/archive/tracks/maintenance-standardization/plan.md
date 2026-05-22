---
track: maintenance-standardization
title: Maintenance & Standardization
status: Verified
owner: gemini
module: Core
updated: 2026-05-21
---

# Track: Maintenance & Standardization

## Context
Address redundancy, technical debt, and architectural inconsistencies identified during the codebase audit. This track focuses on standardizing API patterns, improving token efficiency, and maintaining schema consistency.

## Tasks

### T-001: Redundancy Cleanup — Messages & Scripts
- [x] Delete redundant `messages/` directory (duplicates `lib/i18n/`).
- [x] Archive/Delete legacy root scripts:
    - `apply-view-transitions.js`
    - `fix-lint.js`
    - `fix_encoding.ps1`
    - `vts-usage.csv`
- [x] Verify that these deletions do not break any build or runtime processes.

### T-002: Redundancy Cleanup — Receiving Module
- [x] Audit `app/app/receiving/new/page.tsx` and `app/api/receiving/order/route.ts`.
- [x] Replace "New GR" sidebar link in `components/layout/Sidebar.tsx` with standard `/app/grn/new` flow.
- [x] Archive/Delete the `receiving` module once replaced.

### T-003: Standard Alignment — PATCH Routes
- [x] Refactor `app/api/purchase-orders/[id]/route.ts` PATCH handler to use `z.discriminatedUnion('action', [...])`.
- [x] Refactor `app/api/products/[id]/route.ts` PATCH handler to use `z.discriminatedUnion('action', [...])`.
- [x] Ensure all updates are wrapped in transactional `pool.connect()` if they involve multiple writes.

### T-004: Standard Alignment — DB Utilities
- [x] Search and replace bare `pool.query` with `query` or `queryOne` from `lib/db/client` in non-transactional routes.

### T-005: Token Efficiency — Type Splitting
- [x] Split `types/index.ts` into domain-specific files: `db.ts`, `api.ts`, `hr.ts`, `inventory.ts`.
- [x] Update centralized re-exports for compatibility.

### T-006: Schema Consistency — Bilingual Names
- [x] Create migration 040 to rename `name` to `name_th` and add `name_en` in `fiscal_periods` and `repack_templates`.
- [x] Run migration and update related API routes/types.
- [x] Update UI pages (Accounting, Repack) to handle bilingual names using `useLanguage` hook.

### T-007: Technical Debt — BOM & Payroll
- [x] Resolve TODO in `app/api/bom/[id]/route.ts`: Block deletion if BOM is currently active.
- [x] Resolve TODO in `app/api/hr/payroll-runs/route.ts`: Formalize allowance placeholder with clear implementation requirements.

## Verification Checklist
- [x] `npx tsc --noEmit` -> 0 errors
- [x] `npm run lint` -> 0 errors
- [x] All impacted modules (PO, Products, HR, BOM, Repack) verified manually.

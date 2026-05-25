---
track: auditor-role-and-readonly-access
phase: V2.0-P2
sequence: 19
status: Verified
owner: Chen
created: 2026-05-23
updated: 2026-05-25
depends_on: [multi-bu-foundation]
estimate: S
assigned_to: [Paku]
tags: [v2-orion, audit, rbac]
---

# Auditor Role & Read-Only Access

## Goal
Wire the `auditor` role (introduced in track #1) so it has read-only access to the accounting + AP + AR + reports modules. Any non-GET request from an auditor session is hard-blocked at the middleware layer.

## Scope IN
- Middleware `lib/auth/readOnlyMiddleware.ts` that rejects non-GET requests for users with role `auditor`.
- Wire middleware into every accounting / AP / AR / report route.
- Two new read-only audit endpoints: `GET /api/accounting/audit/ledger` and `GET /api/accounting/audit/trial-balance`.
- Sidebar auto-strips create/edit links when role=auditor.
- No DB changes (the enum value was added in track #1).

## Scope OUT
- Auditor BU scoping beyond the standard warehouse-scope helper.
- Export to PDF / CSV for auditor — accounting-export-adapters (track #20) covers this.

## Acceptance Criteria
1. Auditor user POSTing to any non-GET route gets 403 with a clear error message.
2. Auditor user can GET all accounting / AP / AR / report endpoints.
3. UI hides write actions automatically when role=auditor.
4. Existing manager/admin behavior unchanged.
5. `npm run lint` and `npx tsc --noEmit` pass.

## Migrations
- None.

## API routes
- New: `GET /api/accounting/audit/ledger`.
- New: `GET /api/accounting/audit/trial-balance`.
- Touched: middleware wiring across `app/api/accounting/**`, `app/api/ap/**`, `app/api/ar/**`, `app/api/reports/**`.

## UI screens
- Touched: sidebar and module-hub — hide write actions for auditor.
- New: auditor landing page with quick links to read-only reports.

## Test plan
- Manual: log in as auditor, attempt POST to any route, confirm 403.
- Confirm reads succeed.
- Lint + tsc.

## Risks
- Missed route in middleware wiring — central registry of mounted middlewares helps; perform a grep audit.
- Auditor may need to flag issues — V2.1 may add a read-only "memo" capability; not in scope here.

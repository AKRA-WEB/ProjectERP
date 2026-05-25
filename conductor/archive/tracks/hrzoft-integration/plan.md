---
track: hrzoft-integration
phase: V2.1
sequence: 21
status: Verified
owner: Chen
created: 2026-05-23
updated: 2026-05-25
depends_on: [multi-bu-foundation]
estimate: L
assigned_to: [Paku]
tags: [v2-orion, hr, integration, sync]
---

# Hrzoft Integration

## Goal
Sync employee master data from Hrzoft (external HR system) into the ERP nightly so that user accounts mirror real headcount. Hrzoft is source of truth for name, title, department, and active status; ERP retains the role and BU binding.

## Scope IN
- New table `external_user_sync(id, local_user_id, hrzoft_employee_id UNIQUE, last_synced_at, status ENUM('active','disabled','orphan'), conflict_notes TEXT)`.
- Nightly job `lib/jobs/hrzoft-sync.ts` pulling Hrzoft via REST.
- Conflict rule: Hrzoft wins for name/title/department/active-status. ERP wins for role + BU binding.
- Disabled Hrzoft employee propagates as `users.is_active=false` (no row deletion).
- Admin "Sync Now" button with progress + last-result viewer.

## Scope OUT
- Bi-directional sync. One-way pull only in V2.1.
- Payroll/attendance data flow. Future revision.

## Acceptance Criteria
1. Nightly job pulls and reconciles all Hrzoft employees; new rows in `external_user_sync`.
2. Orphan employees (in ERP but not in Hrzoft) are flagged `orphan` for manual review, not deactivated automatically.
3. Conflict resolution always applies the documented rule.
4. Job is idempotent and resumable.
5. `npm run lint` and `npx tsc --noEmit` pass.

## Migrations
- `059_external_user_sync.sql` — create table + indexes.

## API routes
- New: `POST /api/admin/hrzoft/sync` (manual trigger).
- New: `GET /api/admin/hrzoft/last-run`.

## UI screens
- New: `app/admin/integrations/hrzoft/page.tsx` — last run, conflicts, manual trigger.

## Test plan
- Manual: run sync against staging Hrzoft, verify mapping and conflict resolution.
- Disable an employee in Hrzoft, run sync, verify `is_active=false` in ERP.
- Lint + tsc.

## Risks
- Hrzoft API rate limits — implement backoff and chunked pulls.
- Email collisions between Hrzoft IDs and existing ERP users — match by `hrzoft_employee_id` first, then fall back to email with manual confirmation.

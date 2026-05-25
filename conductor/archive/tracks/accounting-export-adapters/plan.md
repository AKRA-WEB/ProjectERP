---
track: accounting-export-adapters
phase: V2.0-P2
sequence: 20
status: Verified
owner: Chen
created: 2026-05-23
updated: 2026-05-25
depends_on: [auditor-role-and-readonly-access]
estimate: L
assigned_to: [Paku]
tags: [v2-orion, accounting, export, integration]
---

# Accounting Export Adapters (Express / FlowAccount / PEAK)

## Goal
Expose a single unified export endpoint capable of producing journal entries and supporting documents in the import formats of Express, FlowAccount, and PEAK. Auditor and admin can pull a date range and feed it to the external accounting system.

## Scope IN
- Abstraction `lib/accounting/exporters/` with three modules: `express.ts`, `flowaccount.ts`, `peak.ts` each exporting `export({ from, to, includeAP, includeAR, includeGL }) -> { filename, mime, buffer }`.
- Unified endpoint `GET /api/accounting/export?format=express|flowaccount|peak&from=&to=` returning the buffer with the correct filename and mime.
- CSV/XLSX rendering via `xlsx` or `papaparse` (already in deps if available; otherwise add minimal helpers).
- Persist export jobs to `accounting_export_jobs(id, format, range_from, range_to, requested_by, requested_at, completed_at, status, output_meta JSONB)` for audit.

## Scope OUT
- Push directly to vendor APIs (PEAK SDK, FlowAccount webhook). Manual upload is V2.0; API push V2.1+.
- Per-BU export segmentation beyond the warehouse-scope filter.

## Acceptance Criteria
1. Each format produces a file that imports cleanly into the respective system (validate with sample import on each vendor before launch).
2. Date-range filter respected end-to-end.
3. Auditor + admin can trigger export; staff cannot.
4. `accounting_export_jobs` row created for every request.
5. `npm run lint` and `npx tsc --noEmit` pass.

## Migrations
- `060_accounting_export_jobs.sql` — create the audit table.

## API routes
- New: `GET /api/accounting/export`.
- New: `GET /api/accounting/export/jobs`.

## UI screens
- New: `app/accounting/export/page.tsx` — date-range form + format selector + download.
- New: `app/accounting/export/jobs/page.tsx` — history of past exports.

## Test plan
- Manual: pull a small range for each format and feed into the vendor's import tool.
- Confirm jobs row written.
- Lint + tsc.

## Risks
- Each vendor's import schema is subject to change — version the adapter and store the format version in `output_meta`.
- Large date ranges may time out; consider streaming or async-job pattern in V2.1.

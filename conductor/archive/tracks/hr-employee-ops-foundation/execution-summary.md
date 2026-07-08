---
track: hr-employee-ops-foundation
completed: 2026-06-28
migrations: [073, 074]
tests: 69 (9 files)
qa_runs: 3
---

# Execution Summary — hr-employee-ops-foundation

## Shipped Files

### Migrations
- `migrations/073_hr_employee_ops_foundation.sql` — 5 new/extended tables, 2 sequences, 2 triggers (with DROP IF EXISTS guard)
- `migrations/074_hr_employee_ops_constraints.sql` — check constraints for `leave_balance_adjustments.balance_after >= 0`, `attendance_adjustment_requests.requested_status`, `requested_ot_hours >= 0`

### Types
- `types/hr.ts` — 10 new interfaces: `HrEmergencyContact`, `HrEmployeeDocument`, `HrLeaveBalanceSummary`, `HrAttendanceSummary`, `HrPayrollSummary`, `HrEmployeeAuditEvent`, `HrEmployeeProfileEmployee`, `HrEmployeeProfileResponse`, `LeaveBalanceAdjustment`, `AttendanceAdjustmentRequest`

### Domain Helpers (lib/hr/)
- `lib/hr/employee-profile-access.ts` — `canAccessProfile`, `canSeeSalary`, `isEmployeeInScope` (async warehouse scope check)
- `lib/hr/leave-balance-adjustments.ts` — `computeLeaveAdjustment`
- `lib/hr/attendance-adjustments.ts` — `resolveAttendanceApproval`, `resolveAttendanceReview`
- `lib/hr/employee-documents.ts` — `validateDocReview`, `isDocExpired`

### Tests (lib/hr/)
- `lib/hr/employee-profile-access.test.ts` — 13 tests (canAccessProfile, canSeeSalary, isEmployeeInScope including in/out-of-scope manager)
- `lib/hr/leave-balance-adjustments.test.ts` — 8 tests
- `lib/hr/attendance-adjustments.test.ts` — 5 tests
- `lib/hr/employee-documents.test.ts` — 6 tests

### API Routes (new)
- `app/api/hr/employees/[id]/profile/route.ts` — Employee 360 aggregate GET
- `app/api/hr/employees/[id]/emergency-contacts/route.ts` — GET/POST
- `app/api/hr/employees/[id]/emergency-contacts/[contactId]/route.ts` — PATCH/DELETE
- `app/api/hr/employees/[id]/documents/route.ts` — GET/POST (with transaction + DOCUMENT_ADDED audit)
- `app/api/hr/employees/[id]/documents/[documentId]/route.ts` — PATCH (review + metadata update, with real before-values audit)
- `app/api/hr/leave-balances/adjustments/route.ts` — GET/POST
- `app/api/hr/leave-balances/summary/route.ts` — GET (new; fixes 404 from leave quota page)
- `app/api/hr/attendance-adjustments/route.ts` — GET/POST
- `app/api/hr/attendance-adjustments/[id]/route.ts` — PATCH (approve/reject)

### API Routes (modified)
- `app/api/hr/employees/[id]/route.ts` — GET scoped (staff-self/manager-warehouse/admin), PATCH scoped

### Pages
- `app/app/hr/employees/[id]/page.tsx` — Employee 360 rebuilt (8 tabs, no eslint-disable, no hard delete, status change modal)
- `app/app/hr/leave/quota/page.tsx` — Operational leave quota page
- `app/app/hr/attendance/adjustments/page.tsx` — New attendance adjustment page

### Navigation
- `components/layout/Sidebar.tsx` — Attendance adjustments link

### i18n
- `lib/i18n/en.json` + `lib/i18n/th.json` — ~155 new keys across `hr.employee360.*`, `hr.leave_quota.*`, `hr.att_adj.*`, `nav.hr_attendance_adjustments`

### Knowledge Docs
- `docs/SCHEMA.md` — HR Employee Operations (v073) + Constraints (v074) sections
- `_notes/02_Agent_Memory/current-state.md` — Migration number updated to 074
- `_notes/00_Project_Map/modules/HR.md` — All new tables + 9 new API routes

## Authorization Contract (enforced server-side)

| Actor | Employee data access |
|-------|---------------------|
| Staff | Self only (all child routes) |
| Manager | Employees sharing warehouse assignment via `user_warehouse_assignments` + `buildWarehouseScopeClause`; enforced on GET, POST, PATCH, DELETE across all HR child routes and attendance adjustment review |
| Admin | All employees |

Salary fields (`base_salary`, `salary_grade_*`): Admin only.

## Salary / Compensation Visibility Policy (enforced)

| Endpoint | Admin | Manager | Staff |
|----------|-------|---------|-------|
| `GET /api/hr/employees` (list) | no salary fields | no salary fields | no salary fields |
| `GET /api/hr/employees/[id]` | full salary data | all nulled | own profile, no salary |
| `GET /api/hr/employees/[id]/profile` | full salary + payroll | profile only, no salary | own profile, no salary |

`salary_grade_id`, `salary_grade_name`, `base_salary_min`, `base_salary_max`, `base_salary` all nulled for non-admin.

## Status Change Policy

`employee_status` and `resignation_date` are **not** updateable via `action: update`. Must use `action: set_status` which requires `reason` (min 1 char) and generates a `STATUS_CHANGED` audit event.

## Known Risks / Follow-up

- `DELETE /api/hr/employees/[id]` remains admin-only hard-delete route. No UI exposes it. If product later wants soft-delete only, this route should be removed or restricted further.
- Leave balance summary endpoint created but not covered by unit tests (integration-level; scoping logic covered by `isEmployeeInScope` helper tests).

# QA Report: hr-employee-ops-foundation

Date: 2026-06-28
Track: `hr-employee-ops-foundation`
QA Run: 4
Verdict: Verified

## Scope

- Reviewed HR Employee Ops Foundation implementation after the latest compensation/status rework.
- Checked plan alignment, route authorization, migration safety, audit coverage, and regression risk.
- Ran the project QA gate.

## Automated Checks

Command:

```bash
npm run qa:verify
```

Result: PASS

- ESLint passed.
- TypeScript passed.
- Vitest passed: 9 test files, 69 tests.
- Route smoke tests passed.
- Migration state check passed at migration 074.
- Test floor and suppression gates passed.

## Findings

No Must Fix issues remain from this QA pass.

## Follow-Up Notes

### FU-1: Compensation masking needs endpoint-level regression coverage

Current tests cover `canSeeSalary`, but they do not assert the actual response shape for employee list/detail/profile routes. The current salary-grade leak would have passed those helper tests.

Expected fix:

- Add tests around the response mapper or route/service layer for staff, manager, and admin salary visibility.
- Include salary-grade id/name/min/max fields in the negative assertions.

### FU-2: Manager salary create policy should be made explicit

File: `app/api/hr/employees/route.ts:154`

The new detail PATCH path restricts salary updates to admins, but the employee create route still accepts `salary_grade_id` and `base_salary` from managers. This may be legacy behavior, but it conflicts with the new compensation visibility model unless managers are explicitly allowed to set compensation at hire.

Expected fix:

- Confirm the intended policy.
- If ordinary managers should not set compensation, restrict salary fields in employee create to admin only.

## Confirmed Fixed Since QA Run 3

- Employee detail GET now masks salary-grade id/name/min/max and base salary for non-admin actors.
- Employee list GET no longer selects or returns salary-grade/base-salary fields.
- Generic employee update no longer accepts `employee_status` or `resignation_date`; status changes must use `set_status` with reason and `STATUS_CHANGED` audit.

## Previously Confirmed Fixed

- Employee PATCH now checks `isEmployeeInScope` for managers before mutation.
- Emergency contact detail PATCH/DELETE now checks manager scope.
- Employee document detail PATCH now checks manager scope.
- Attendance adjustment review now checks manager scope against the request employee.
- Document metadata update audit now records real before/after values from a locked row.
- `execution-summary.md` exists for the completed track.
- Employee detail GET no longer returns `u.*`.
- Employee profile route no longer references nonexistent `u.primary_warehouse_id`.
- Collection routes for emergency contacts, documents, leave balance adjustments, and attendance adjustments apply manager warehouse scope.
- Attendance adjustment creation validates that `attendance_record_id` belongs to the target employee and work date.
- Attendance review update constrains attendance record mutation by employee and work date.
- Employee 360 UI no longer exposes the hard-delete employee action.
- Document creation and metadata/review updates emit audit events and use transaction paths.
- Migration 073 trigger definitions are rerun-safe.
- Migration 074 adds non-negative/requested-status constraints.

## Notes

- `DELETE /api/hr/employees/[id]` still exists and remains admin-only. This is acceptable for the current plan as long as the UI does not expose it and product intends to keep an admin-only maintenance route.
- QA did not create or modify `rework-plan.md`; this report is the QA output for the fourth run.
- Hard-rule scan found no new Employee Ops suppressions; the only match was an existing payroll slip hardcoded-Thai suppression outside the Employee 360 page.

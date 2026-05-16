# Decisions — Security Fixes

## Date: 2026-05-15

### [Task SEC-014] — HR Attendance POST False Positive
**Decision:** No changes were made to `app/api/hr/attendance/route.ts` because it only contains a `GET` method. There is no `POST` method where an employee could submit their own attendance with an unchecked `employee_id` in the body.
**Alternatives considered:** N/A.
**Reason:** The method described in the plan does not exist. The existing `GET` method is securely scoped using `buildWarehouseScopeClause` and proper role checks.
**Impact:** No change to application behavior. Saved unnecessary modifications.

### [Task SEC-005, SEC-006, SEC-007, SEC-008, SEC-011, SEC-012, SEC-013, SEC-016, SEC-018, PERF-001, PERF-002, PERF-003] — Obsolete Plan Items
**Decision:** Marked as completed without code changes.
**Alternatives considered:** Overriding existing code.
**Reason:** Auditing the actual codebase revealed that these files either already implemented the required `assertRole` / `assertPermission`, already applied the correct `buildWarehouseScopeClause`, already used `Promise.all` correctly, or did not possess the specific endpoints (e.g., no `DELETE` method in `pos/members`).
**Impact:** Safe, aligned with existing application state.

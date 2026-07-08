---
track: hr-employee-ops-foundation
phase: hr-priority
status: Completed
rework_date: 2026-06-28
qa_report: conductor/qa-reports/hr-employee-ops-foundation.md
---

# Rework Plan — hr-employee-ops-foundation

Source QA report: `conductor/qa-reports/hr-employee-ops-foundation.md`

---

## Must Fix

### WS-A: Authorization / Warehouse Scope (covers MF-1 + MF-2 + MF-3)

Root cause: three routes share one problem — manager access is either missing scope or using wrong column (`primary_warehouse_id`). Canonical pattern is `user_warehouse_assignments` + `buildWarehouseScopeClause(u, 'uwa.warehouse_id', idx)`.

- [x] **WS-A1 · `GET /api/hr/employees/[id]/route.ts`**
  - Apply staff-self / manager-warehouse / admin-all access contract (mirrors `canAccessProfile` helper).
  - Manager check: verify target employee has assignment in actor's allowed warehouses via `user_warehouse_assignments`.
  - Replace `SELECT u.*` with explicit column list; null `base_salary` / `salary_grade_id` when actor cannot see salary (`canSeeSalary`: admin only per track spec).
  - Return 403 if staff tries another employee; 404 (not 403) if manager requests employee outside their scope.

- [x] **WS-A2 · `GET /api/hr/employees/[id]/profile/route.ts`**
  - Replace `warehouses w ON w.id = u.primary_warehouse_id` scope check with `user_warehouse_assignments uwa` + `buildWarehouseScopeClause`.
  - Pattern: same EXISTS sub-select used in `app/api/hr/employees/route.ts:58–63`.

- [x] **WS-A3 · HR child route list GETs — add warehouse scope for managers**
  - `GET /api/hr/employees/[id]/emergency-contacts` — manager: verify actor has warehouse assignment covering target employee.
  - `GET /api/hr/employees/[id]/documents` — same.
  - `GET /api/hr/leave-balances/adjustments` — filter by employee's warehouse when actor is manager.
  - `GET /api/hr/attendance-adjustments` — filter by employee's warehouse when actor is manager (same EXISTS sub-select pattern).
  - POST/PATCH mutations in these routes: verify target employee is in-scope before mutating. Single helper function `assertEmployeeScope(actor, employeeId)` → `Promise<void>` (throws 403) to avoid duplication.

---

### WS-B: IDOR Guard on Attendance Record (MF-4)

- [x] **WS-B1 · `POST /api/hr/attendance-adjustments`**
  - If `attendance_record_id` is provided in body, verify `attendance_records.employee_id = target_employee_id AND work_date = body.work_date` before inserting.

- [x] **WS-B2 · `PATCH /api/hr/attendance-adjustments/[id]` (approval)**
  - When applying approved mutation to `attendance_records`, add `AND employee_id = $n AND work_date = $n` predicates alongside `id = attendance_record_id`.
  - On create path (`action: 'create'`), insert with `employee_id` and `work_date` from request, not body.

---

### WS-C: Remove Hard Delete from Employee 360 UI (MF-5)

- [x] **WS-C1 · `app/app/hr/employees/[id]/page.tsx`**
  - Remove `handleDelete()` function (line ~148) and the `Trash2` delete button (line ~303).
  - Remove `canDelete` variable and its `del` import if no longer used.
  - Add "Change Status" button visible to admin/manager: opens a modal with `set_status` options (`inactive` / `resigned`) and required `resignation_date` (when resigned).
  - Modal calls `patch(/api/hr/employees/${id}, { action: 'set_status', employee_status, resignation_date })`.
  - Add i18n keys: `hr.employee360.set_status`, `hr.employee360.status_inactive`, `hr.employee360.status_resigned`, `hr.employee360.resignation_date`, `hr.employee360.confirm_status_change`.

---

### WS-D: Document Audit Trail (MF-6)

- [x] **WS-D1 · `POST /api/hr/employees/[id]/documents`**
  - Wrap in `pool.connect()` transaction.
  - After INSERT into `employee_documents`, insert `hr_employee_audit_events` with `event_type = 'DOCUMENT_ADDED'`, `actor_user_id = u.id`, `target_user_id = id`, `metadata = { doc_type, filename }`.

- [x] **WS-D2 · `PATCH /api/hr/employees/[id]/documents/[documentId]` (metadata update path)**
  - The review path already has transaction + audit event. Metadata update (`action !== 'verify' && action !== 'reject'`) path: wrap in transaction + insert `DOCUMENT_UPDATED` event with before/after metadata.

---

### WS-E: Missing Route — Leave Balances Summary (gap from session report)

The leave quota page (`app/app/hr/leave/quota/page.tsx`) fetches from `/api/hr/leave-balances/summary` which does not exist (`app/api/hr/leave-balances/summary/route.ts` absent).

- [x] **WS-E1 · Create `app/api/hr/leave-balances/summary/route.ts`**
  - `GET` only; requires manager/admin.
  - Query params: `year` (default current year), `search` (employee name), `department_id`, `page`, `pageSize`.
  - Returns per-employee leave balance rows: `employee_id, name_th, name_en, department, leave_type, entitled_days, used_days, balance_days, year`.
  - Join `leave_balances lb ON lb.user_id = u.id` + `leave_types lt ON lt.id = lb.leave_type_id`.
  - Warehouse scope via `buildWarehouseScopeClause` for managers.
  - LIMIT + OFFSET required; return `{ data, total, page, limit }`.

---

## Should Fix

- [x] **SF-1 · Migration `073` trigger pattern**
  - `migrations/073_hr_employee_ops_foundation.sql` uses `CREATE TRIGGER` without `DROP TRIGGER IF EXISTS` guard.
  - Add `DROP TRIGGER IF EXISTS ... ON <table>;` before each `CREATE TRIGGER` to make migration safely rerunnable.
  - Note: PostgreSQL 14+ supports `CREATE OR REPLACE TRIGGER` — use if project DB version allows; otherwise use DROP + CREATE pattern matching project convention.

- [x] **SF-2 · Add DB check constraints**
  - Add to `migrations/073_hr_employee_ops_foundation.sql` (or new migration `074_hr_employee_ops_constraints.sql`):
    - `leave_balance_adjustments`: `CHECK (balance_after >= 0)`
    - `attendance_adjustment_requests`: `CHECK (requested_status IN ('present','absent','late','half_day','wfh','leave'))`, `CHECK (requested_ot_hours IS NULL OR requested_ot_hours >= 0)`

---

## Execution Order

1. WS-A (scope/authz) — highest risk, all in one pass
2. WS-B (IDOR) — two-file fix
3. WS-C (UI delete removal) — UI only
4. WS-D (doc audit) — two-file wrap
5. WS-E (missing route) — new file
6. SF-1, SF-2 — migration hygiene

After all fixes: `npm run qa:verify` (0 errors, tests must assert new scope behavior).

---
track: hr-employee-ops-foundation
title: "HR Employee Operations Foundation"
status: Verified
created: 2026-06-28
updated: 2026-06-28
owner: Chen
module: HR
phase: hr-priority-before-d1-d7
depends_on: []
tags: [hr, employee-profile, documents, leave, attendance, audit]
source: user-directive-2026-06-28
decision: _notes/01_Decisions/2026-06-28-prioritize-hr-before-d1-d7.md
---

# HR Employee Operations Foundation

## Goal

Advance HR while D1-D7 sales lifecycle workflows wait for Project Manager sign-off. This track turns the existing HR module from a mostly dashboard/list experience into a usable HR operations workspace:

1. Employee 360 profile with emergency contacts, document review, leave balances, attendance summary, payroll summary, and audit timeline.
2. Controlled leave-balance adjustment flow with before/after audit.
3. Attendance exception request/review flow for missed punches, corrections, late/half-day status, and overtime corrections.
4. HR audit events for sensitive employee-data changes.

This track must stay independent from D1-D7. It must not introduce sales, dispatch, payment, document-correction, or inventory workflow assumptions.

## Current Baseline

- HR core exists and is marked completed: departments, positions, salary grades, employee list/detail, leave requests, attendance, payroll runs, and HR dashboard.
- Existing tables include `employee_documents`, `leave_balances`, `leave_requests`, `attendance_records`, `payroll_runs`, and `payroll_lines`.
- Existing employee detail UI has basic `info`, `leave`, `attendance`, and `payroll` tabs, but no emergency contacts, document verification metadata, operational audit trail, leave adjustments, or attendance exception workflow.
- `app/app/hr/employees/[id]/page.tsx` currently has a file-level `eslint-disable local-rules/no-hardcoded-thai`; implementation must remove this from touched HR Employee 360 work by moving display text to i18n keys rather than adding suppressions.
- Latest recorded migration is `072_grn_reversal.sql`; if this track is implemented next, use `073_hr_employee_ops_foundation.sql`. If another migration lands first, use the next available number.

## Non-Goals

- No D1-D7 implementation, schema, route, or workflow changes.
- No payroll statutory formula redesign, tax-bracket updates, bank-transfer file generation, or new accounting posting behavior.
- No Hrzoft write-back integration. Existing sync status may be displayed only if current APIs already expose it.
- No stock, WMS, POS, Sales, AP, or GL side effects.
- No binary file storage provider integration. Document records continue storing metadata and `storage_url`; upload transport is out of scope unless an existing project helper already supports it.
- No new role model beyond existing `admin`, `manager`, `staff`, and existing HR permissions unless a missing permission is explicitly required.

## Architecture Decisions

| Decision | Choice | Reason |
|---|---|---|
| Track priority | HR before D1-D7 | HR has stable existing schema and fewer unsettled workflow dependencies. |
| Employee profile route | Add aggregate route under `/api/hr/employees/[id]/profile` | Avoid bloating the existing CRUD detail route and keep Employee 360 response explicit. |
| Sensitive changes | Append `hr_employee_audit_events` | HR profile, document, leave balance, and attendance corrections need a dedicated operational audit. |
| Documents | Extend existing `employee_documents` | Preserve deployed table and add review metadata instead of replacing it. |
| Leave adjustment | Adjust `leave_balances` inside a transaction and write adjustment row | Prevent silent balance edits and keep before/after evidence. |
| Attendance correction | Request/review table, approval mutates `attendance_records` atomically | Staff can request corrections without directly editing attendance. |
| UI forms | Semantic `<form>`, visible labels, native controls, `aria-live` errors | Follows `modern-web-guidance` forms guide; avoids inaccessible div-based forms. |
| Responsive layout | Stable grids with container-aware sections where useful | Follows `modern-web-guidance` size-aware layout guidance and avoids viewport-only brittle cards. |

## Data Model Contract

### Migration: `073_hr_employee_ops_foundation.sql` or next available

Create or alter these structures.

#### 1. Extend `employee_documents`

Add columns if missing:

| Column | Type | Notes |
|---|---|---|
| `status` | varchar(20) | Default `pending_review`; check in `pending_review`, `verified`, `rejected`, `expired`. |
| `uploaded_by_user_id` | UUID nullable | References `users(id)`. |
| `verified_by_user_id` | UUID nullable | References `users(id)`. |
| `verified_at` | timestamptz nullable | Set only when verified/rejected. |
| `rejected_reason` | text nullable | Required when rejecting. |
| `notes` | text nullable | Internal HR note. |

Indexes:

- `idx_employee_documents_status` on `(status, expiry_date)`
- `idx_employee_documents_employee_status` on `(employee_id, status)`

#### 2. `employee_emergency_contacts`

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | Default `gen_random_uuid()`. |
| `employee_id` | UUID not null | FK to `users(id)` on delete cascade. |
| `contact_name` | varchar(255) not null | Visible contact name. |
| `relationship` | varchar(100) not null | Spouse, parent, sibling, etc. |
| `phone` | varchar(50) not null | Do not use numeric type; preserve leading zeros. |
| `alt_phone` | varchar(50) nullable | Optional. |
| `address` | text nullable | Optional. |
| `is_primary` | boolean not null | Default false. |
| `created_at` | timestamptz | Default now. |
| `updated_at` | timestamptz | Trigger `set_updated_at()`. |

Rules:

- At most one primary contact per employee. Use a partial unique index on `(employee_id)` where `is_primary = true`.
- When setting a contact primary, unset other contacts for the same employee in the same transaction.

#### 3. `hr_employee_audit_events`

Append-only HR operation audit.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | Default `gen_random_uuid()`. |
| `employee_id` | UUID not null | FK to `users(id)`. |
| `actor_user_id` | UUID not null | FK to `users(id)`. |
| `event_type` | varchar(80) not null | Example: `PROFILE_UPDATED`, `DOCUMENT_VERIFIED`, `LEAVE_BALANCE_ADJUSTED`. |
| `event_payload_json` | jsonb not null | Before/after and reason metadata. |
| `created_at` | timestamptz | Default now. |

Indexes:

- `idx_hr_employee_audit_employee_created` on `(employee_id, created_at DESC)`
- `idx_hr_employee_audit_event_type` on `(event_type)`

#### 4. `leave_balance_adjustments`

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | Default `gen_random_uuid()`. |
| `employee_id` | UUID not null | FK to `users(id)`. |
| `leave_type_id` | UUID not null | FK to `leave_types(id)`. |
| `year` | int not null | Same year as `leave_balances.year`. |
| `adjustment_kind` | varchar(30) not null | `entitlement` or `used_correction`. |
| `delta_days` | numeric(4,1) not null | Can be positive or negative. |
| `balance_before` | numeric(4,1) not null | Entitled or used value before change, based on kind. |
| `balance_after` | numeric(4,1) not null | Value after change. |
| `reason` | text not null | Required HR reason. |
| `adjusted_by_user_id` | UUID not null | FK to `users(id)`. |
| `created_at` | timestamptz | Default now. |

Constraints:

- `adjustment_kind IN ('entitlement','used_correction')`
- Balance after adjustment must not be negative.

#### 5. `attendance_adjustment_requests`

Create sequence `seq_hra` and generate request numbers with PostgreSQL:

`request_number VARCHAR(50) NOT NULL UNIQUE DEFAULT next_doc_number('HRA','seq_hra')`

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | Default `gen_random_uuid()`. |
| `request_number` | varchar unique | Generated by PostgreSQL only. |
| `employee_id` | UUID not null | FK to `users(id)`. |
| `attendance_record_id` | UUID nullable | FK to `attendance_records(id)`. |
| `work_date` | date not null | Date being corrected. |
| `requested_clock_in` | timestamptz nullable | Optional corrected clock-in. |
| `requested_clock_out` | timestamptz nullable | Optional corrected clock-out. |
| `requested_status` | varchar(20) nullable | Must match `attendance_records.status` values when provided. |
| `requested_ot_hours` | numeric(5,2) nullable | Optional corrected OT hours. |
| `reason` | text not null | Staff/HR correction reason. |
| `status` | varchar(20) not null | `submitted`, `approved`, `rejected`, `cancelled`. |
| `reviewed_by_user_id` | UUID nullable | FK to `users(id)`. |
| `reviewed_at` | timestamptz nullable | Set on approve/reject. |
| `review_note` | text nullable | Reviewer note. |
| `created_at` | timestamptz | Default now. |
| `updated_at` | timestamptz | Trigger `set_updated_at()`. |

Indexes:

- `idx_att_adj_employee_status` on `(employee_id, status, work_date DESC)`
- `idx_att_adj_status_created` on `(status, created_at ASC)`

## API Surface

All routes must use `auth()`, `SessionUser`, role/ownership checks, parameterized SQL, and `apiSuccess`/`apiError`.

### `GET /api/hr/employees/[id]/profile`

Returns a full Employee 360 aggregate.

Access:

- `staff`: own profile only; salary/payroll values hidden unless existing policy allows own payroll slip visibility.
- `manager`: employees in warehouse scope via `buildWarehouseScopeClause`.
- `admin`: all employees.

Response:

```ts
interface HrEmployeeProfileResponse {
  employee: HrEmployeeProfileEmployee;
  emergency_contacts: HrEmergencyContact[];
  documents: HrEmployeeDocument[];
  leave_balances: HrLeaveBalanceSummary[];
  attendance_summary: HrAttendanceSummary;
  payroll_summary: HrPayrollSummary | null;
  audit_events: HrEmployeeAuditEvent[];
}

interface HrEmployeeProfileEmployee {
  id: string;
  employee_id: string | null;
  name_th: string;
  name_en: string;
  email: string;
  phone: string | null;
  role: string;
  department_id: string | null;
  department_name_th: string | null;
  position_id: string | null;
  position_name_th: string | null;
  employment_type: 'full_time' | 'part_time' | 'contract';
  employee_status: 'active' | 'inactive' | 'resigned';
  hired_date: string | null;
  resignation_date: string | null;
  base_salary: number | null;
}

interface HrEmergencyContact {
  id: string;
  employee_id: string;
  contact_name: string;
  relationship: string;
  phone: string;
  alt_phone: string | null;
  address: string | null;
  is_primary: boolean;
}

interface HrEmployeeDocument {
  id: string;
  employee_id: string;
  doc_type: string;
  filename: string;
  storage_url: string;
  issued_date: string | null;
  expiry_date: string | null;
  status: 'pending_review' | 'verified' | 'rejected' | 'expired';
  verified_by_user_id: string | null;
  verified_at: string | null;
  rejected_reason: string | null;
  notes: string | null;
}

interface HrLeaveBalanceSummary {
  leave_balance_id: string;
  leave_type_id: string;
  leave_type_name_th: string;
  year: number;
  days_entitled: number;
  days_used: number;
  days_remaining: number;
}

interface HrAttendanceSummary {
  month: string;
  present_days: number;
  late_days: number;
  absent_days: number;
  half_days: number;
  ot_hours: number;
  pending_adjustments: number;
}

interface HrPayrollSummary {
  latest_run_id: string;
  latest_run_number: string;
  period_month: number;
  period_year: number;
  gross_pay: number | null;
  net_pay: number | null;
}

interface HrEmployeeAuditEvent {
  id: string;
  event_type: string;
  event_payload_json: Record<string, unknown>;
  actor_name_th: string | null;
  created_at: string;
}
```

### `PATCH /api/hr/employees/[id]`

Extend the existing `action: 'update'` behavior:

- Wrap update + audit event in one transaction.
- Lock `users` row with `FOR UPDATE`.
- Capture before/after for changed fields only.
- Insert `hr_employee_audit_events` with `PROFILE_UPDATED`.
- Keep salary updates restricted to `admin` unless existing policy explicitly grants manager salary edit.

Add status action:

```ts
type HrEmployeeStatusAction = {
  action: 'set_status';
  employee_status: 'active' | 'inactive' | 'resigned';
  resignation_date?: string | null;
  reason: string;
};
```

The UI must use status action instead of hard deleting employees. Keep `DELETE` route admin-only, but do not expose it as the normal HR action.

### Emergency Contacts

- `GET /api/hr/employees/[id]/emergency-contacts`
- `POST /api/hr/employees/[id]/emergency-contacts`
- `PATCH /api/hr/employees/[id]/emergency-contacts/[contactId]`
- `DELETE /api/hr/employees/[id]/emergency-contacts/[contactId]`

Body:

```ts
interface UpsertEmergencyContactBody {
  contact_name: string;
  relationship: string;
  phone: string;
  alt_phone?: string | null;
  address?: string | null;
  is_primary?: boolean;
}
```

### Documents

- `GET /api/hr/employees/[id]/documents`
- `POST /api/hr/employees/[id]/documents`
- `PATCH /api/hr/employees/[id]/documents/[documentId]`

Body for create/update:

```ts
interface UpsertEmployeeDocumentBody {
  doc_type: string;
  filename: string;
  storage_url: string;
  issued_date?: string | null;
  expiry_date?: string | null;
  notes?: string | null;
}
```

Review body:

```ts
type ReviewEmployeeDocumentBody =
  | { action: 'verify'; notes?: string | null }
  | { action: 'reject'; rejected_reason: string };
```

### Leave Balance Adjustments

- `POST /api/hr/leave-balances/adjustments`
- `GET /api/hr/leave-balances/adjustments?employee_id=...&year=...&page=1&pageSize=20`

Body:

```ts
interface CreateLeaveBalanceAdjustmentBody {
  employee_id: string;
  leave_type_id: string;
  year: number;
  adjustment_kind: 'entitlement' | 'used_correction';
  delta_days: number;
  reason: string;
}
```

### Attendance Adjustments

- `GET /api/hr/attendance-adjustments?status=submitted&page=1&pageSize=20`
- `POST /api/hr/attendance-adjustments`
- `PATCH /api/hr/attendance-adjustments/[id]`

Create body:

```ts
interface CreateAttendanceAdjustmentBody {
  employee_id?: string;
  attendance_record_id?: string | null;
  work_date: string;
  requested_clock_in?: string | null;
  requested_clock_out?: string | null;
  requested_status?: 'present' | 'absent' | 'late' | 'half_day' | 'holiday' | null;
  requested_ot_hours?: number | null;
  reason: string;
}
```

Review body:

```ts
type ReviewAttendanceAdjustmentBody =
  | { action: 'approve'; review_note?: string | null }
  | { action: 'reject'; review_note: string };
```

## Architectural Gates

### Transaction Boundary

Use explicit transaction helpers or a checked-out pg client for every multi-step write:

- Employee update: `BEGIN` -> lock employee row -> update allowed fields -> insert `hr_employee_audit_events` -> `COMMIT`.
- Employee status change: `BEGIN` -> lock employee row -> validate transition -> update status/resignation date -> insert audit event -> `COMMIT`.
- Emergency contact upsert: `BEGIN` -> verify employee access -> if primary unset sibling primary contacts -> insert/update contact -> insert audit event -> `COMMIT`.
- Document review: `BEGIN` -> lock document row -> update status metadata -> insert audit event -> `COMMIT`.
- Leave adjustment: `BEGIN` -> lock matching `leave_balances` row `FOR UPDATE` -> compute before/after -> reject negative balance -> update balance -> insert `leave_balance_adjustments` -> insert audit event -> `COMMIT`.
- Attendance adjustment approval: `BEGIN` -> lock request row -> upsert or update `attendance_records` -> mark request approved -> insert audit event -> `COMMIT`.

On any error, `ROLLBACK` and return `apiError`.

### Doc Number Generation

- `attendance_adjustment_requests.request_number` must use `next_doc_number('HRA','seq_hra')` in PostgreSQL.
- Do not generate request numbers in TypeScript.

### Child Table Inserts

Nested employee child records must always be linked by server-trusted `employee_id` from route params, not body-provided employee ids.

- Insert emergency contact with `employee_id` from route.
- Insert document with `employee_id` from route.
- Insert audit event with the same employee id inside the same transaction as the parent mutation.

### Side Effects

Allowed side effects:

- update `users` HR fields;
- insert/update/delete `employee_emergency_contacts`;
- update `employee_documents` metadata;
- update `leave_balances` only through adjustment route;
- insert `leave_balance_adjustments`;
- insert/update `attendance_records` only when an attendance adjustment is approved;
- insert `hr_employee_audit_events`.

Forbidden side effects:

- no `stock_ledger` writes;
- no sales/POS/order/document/payment route changes;
- no payroll accounting postings beyond existing payroll behavior;
- no hard deletion from normal HR UI.

### Security

- Staff can create attendance adjustment requests only for self.
- Staff can read own profile, own documents, own leave balances, own attendance summary, and own payroll summary if payroll data is already exposed by current payroll slip behavior.
- Managers can access employees only inside their warehouse scope; use `buildWarehouseScopeClause`.
- Managers can approve attendance adjustments and leave adjustments only for scoped employees and cannot approve their own attendance adjustment.
- Admin can access all HR operations.
- `base_salary`, payroll gross/net, and salary-grade fields must be hidden unless the actor is `admin` or an explicitly allowed manager.

### Query Bounds

Every list endpoint must use `LIMIT` and `OFFSET`:

- audit events in profile aggregate: latest 30;
- leave adjustments list: default 20, max 100;
- attendance adjustments list: default 20, max 100;
- documents list may be unpaginated only when scoped to one employee.

### Response Shape

Use the interfaces above in route/service code. Do not return raw database rows with sensitive fields accidentally included.

## UI Scope

### Employee 360 Page

Modify `app/app/hr/employees/[id]/page.tsx` into an operations-focused Employee 360 screen.

Required tabs:

- Overview: identity, employment summary, tenure, current status, primary emergency contact, expiring documents, leave remaining, attendance month summary.
- Employment: editable HR fields via semantic forms.
- Documents: document table/cards with status, expiry, verify/reject actions.
- Contacts: emergency contacts CRUD with primary marker.
- Leave: balances and adjustment history; manager/admin can add adjustment with reason.
- Attendance: recent records and pending/approved/rejected adjustment requests.
- Payroll: latest payroll summary and slip history with salary visibility rules.
- Audit: latest HR audit events.

UI requirements:

- Use real `<form>` elements for mutations, visible labels, `name` attributes, and submit buttons.
- Use native `<select>`, `<textarea>`, radio/checkbox controls where appropriate.
- Use `aria-live` for save/error state.
- Keep tap targets at least 48px on mobile.
- Use stable grid dimensions and avoid layout shift when tab data loads.
- Use lucide icons for actions instead of inline SVG for new controls.
- Remove file-level `eslint-disable local-rules/no-hardcoded-thai` from the touched Employee 360 page by adding i18n keys for visible copy.

### Leave Quota Page

Replace stub `app/app/hr/leave/quota/page.tsx` with a manager/admin page:

- filter by year, department, employee search;
- show leave balance table;
- open adjustment form;
- show adjustment history for selected employee.

### Attendance Adjustments Page

Add `app/app/hr/attendance/adjustments/page.tsx`:

- pending review queue for managers/admin;
- own requests for staff;
- approve/reject actions with review note;
- link back to employee profile.

Add sidebar link only if the existing HR sidebar pattern supports it without broad navigation refactor.

## Testing Strategy

Implementation must add behavior tests, not just route smoke tests.

Minimum test files:

- `lib/hr/employee-profile-access.test.ts`
  - staff can access only self;
  - manager access is limited by warehouse scope helper result;
  - salary visibility is admin/allowed-manager only.

- `lib/hr/leave-balance-adjustments.test.ts`
  - entitlement adjustment changes `days_entitled` before/after correctly;
  - used correction changes `days_used` before/after correctly;
  - negative resulting balance is rejected;
  - adjustment payload requires a non-empty reason.

- `lib/hr/attendance-adjustments.test.ts`
  - approve request updates existing attendance record with requested fields;
  - approve request can create a missing attendance record for the work date;
  - reject request does not mutate attendance record;
  - self-approval is rejected for manager/staff.

- `lib/hr/employee-documents.test.ts`
  - verify document sets `status`, `verified_by_user_id`, and `verified_at`;
  - reject document requires `rejected_reason`;
  - expired document detection respects `expiry_date`.

Verification commands:

- `npm run qa:verify`
- `npm run agent:closeout`

Manual UI checks:

- Employee 360 page renders on desktop and mobile.
- Staff profile view hides salary and manager-only actions.
- Manager/admin can add emergency contact and set it primary.
- Document verify/reject updates status without page reload errors.
- Leave balance adjustment updates displayed remaining balance and audit timeline.
- Attendance adjustment approval updates the attendance tab and request status.

## Implementation Tasks

- [x] Create migration for employee contacts, document review metadata, HR audit events, leave adjustments, attendance adjustments, request-number sequence, constraints, and indexes.
- [x] Add HR domain helpers for profile access, salary visibility, leave adjustment calculation, attendance adjustment transition, and document review validation.
- [x] Add tests listed in Testing Strategy before or alongside service implementation.
- [x] Add `/api/hr/employees/[id]/profile` aggregate route.
- [x] Extend existing employee PATCH status/update behavior with transaction + audit event.
- [x] Add emergency contact nested routes.
- [x] Add employee document nested routes and review actions.
- [x] Add leave-balance adjustment routes.
- [x] Add attendance-adjustment routes.
- [x] Rebuild Employee 360 UI and remove hardcoded-Thai suppression from the touched page.
- [x] Replace Leave Quota stub with operational page.
- [x] Add Attendance Adjustments page and sidebar link if local nav pattern supports a narrow edit.
- [x] Update i18n keys for new/touched HR UI copy.
- [x] Update `docs/SCHEMA.md`, `_notes/02_Agent_Memory/current-state.md`, and `_notes/00_Project_Map/modules/HR.md` after implementation.
- [x] Run `npm run qa:verify` and `npm run agent:closeout`.

## Acceptance Criteria

- HR Employee 360 works without D1-D7 dependencies.
- No sales/POS/WMS/accounting behavior changes are included.
- Every HR mutation route has auth, permission check, parameterized SQL, `apiSuccess`/`apiError`, and transaction boundaries where specified.
- Leave balance and attendance corrections are auditable and cannot silently mutate core records.
- New business logic has behavior tests and `npm run qa:verify` passes.
- No new `eslint-disable local-rules/*` suppression is added; touched Employee 360 page removes the existing hardcoded-Thai suppression.

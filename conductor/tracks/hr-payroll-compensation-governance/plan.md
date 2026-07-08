---
track: hr-payroll-compensation-governance
title: "HR Payroll & Compensation Governance"
status: Active
created: 2026-06-28
updated: 2026-06-28
owner: Chen
module: HR
phase: hr-priority-before-d1-d7
depends_on: [hr-employee-ops-foundation]
tags: [hr, payroll, compensation, audit, security, governance]
source: user-directive-2026-06-28
decision: _notes/01_Decisions/2026-06-28-plan-hr-payroll-compensation-governance.md
---

# HR Payroll & Compensation Governance

## Goal

Continue HR work while D1-D7 sales lifecycle workflows remain paused for Project Manager sign-off. The previous HR track shipped Employee 360, document review, leave-balance adjustments, attendance corrections, and HR audit events. This track hardens the most sensitive remaining HR surface: compensation policy, payroll workflow control, payroll adjustment auditability, and salary/payroll visibility.

This track must make compensation and payroll behavior explicit, server-enforced, test-covered, and auditable without redesigning statutory payroll formulas or introducing accounting workflow changes.

## Current Baseline

- `hr-employee-ops-foundation` is Verified and archived.
- Latest migration is `074_hr_employee_ops_constraints.sql`; if this track is implemented next, use `075_hr_payroll_compensation_governance.sql`.
- Employee 360 already masks salary-grade and payroll summary data for non-admin actors.
- `GET /api/hr/employees` no longer returns salary fields.
- `PATCH /api/hr/employees/[id]` requires `action: 'set_status'` for status changes and writes `STATUS_CHANGED` audit events.
- `GET /api/hr/employees/[id]/profile` returns payroll summary only when `canSeeSalary(actor)` is true.
- Existing payroll workflow uses `payroll_runs` and `payroll_lines`, with a multi-step UI and GL posting on payment.

## Non-Goals

- No D1-D7 sales lifecycle work.
- No redesign of Thai statutory payroll formulas, tax brackets, SSO, provident fund, or bank-transfer file generation.
- No new accounting posting behavior beyond existing payroll-run behavior.
- No Hrzoft write-back integration.
- No role model redesign beyond existing `admin`, `manager`, `staff`, and existing permissions.
- No broad HR UI redesign outside payroll/compensation governance surfaces.

## Architecture Decisions

| Decision | Choice | Reason |
|---|---|---|
| Salary policy | Admin-only compensation mutation unless explicitly granted later | Current security contract treats salary and salary grade as sensitive. |
| Manager create behavior | Managers may create employee records but not set `salary_grade_id` or `base_salary` | Prevent compensation entry through create route after detail update was locked down. |
| Compensation changes | Dedicated auditable compensation change route/table | Salary changes need reason, before/after, actor, and approval evidence. |
| Payroll adjustments | Dedicated payroll adjustment records linked to payroll run/line | Avoid silent edits to `payroll_lines` and preserve review trace. |
| Payroll workflow | Keep existing status model, add guards and audit events | Lower blast radius than redesigning payroll. |
| Accounting | No GL formula changes | D1-D7 and accounting workflows are outside this HR governance track. |

## Compensation Policy Contract

### Visibility

Server-side salary/payroll visibility must be consistent:

| Surface | Admin | Manager | Staff |
|---|---|---|---|
| Employee list | no salary fields | no salary fields | no salary fields |
| Employee detail | salary fields visible | salary fields null/omitted | own record, salary fields null/omitted |
| Employee 360 profile | salary + payroll visible | profile visible, salary/payroll hidden | own profile, salary/payroll hidden |
| Payroll runs | visible | hidden/forbidden unless existing policy says otherwise | hidden/forbidden except own slip if already supported |

Sensitive fields include:

- `base_salary`
- `salary_grade_id`
- `salary_grade_name`
- `base_salary_min`
- `base_salary_max`
- payroll `gross_pay`, `net_pay`, deductions, taxable income, tax, SSO, PVF, and allowance/deduction details

### Mutation

- Only admin can set or change `salary_grade_id` and `base_salary`.
- Manager employee creation must ignore/reject salary fields unless a future permission explicitly allows it.
- All salary changes must require a non-empty reason and write before/after audit.
- Direct generic employee update must not change salary, salary grade, employee status, or resignation date.

## Data Model Contract

### Migration: `075_hr_payroll_compensation_governance.sql`

Create tables only if implementation needs new persistence. Prefer additive structures and keep existing payroll tables stable.

#### 1. `compensation_change_events`

Append-only compensation audit/change table.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | Default `gen_random_uuid()` |
| `employee_id` | UUID not null | FK `users(id)` |
| `actor_user_id` | UUID not null | FK `users(id)` |
| `change_type` | varchar(40) not null | `salary_grade`, `base_salary`, `initial_compensation`, `correction` |
| `before_json` | jsonb not null | Previous sensitive values |
| `after_json` | jsonb not null | New sensitive values |
| `reason` | text not null | Required |
| `created_at` | timestamptz | Default now |

Indexes:

- `idx_comp_change_employee_created` on `(employee_id, created_at DESC)`
- `idx_comp_change_actor_created` on `(actor_user_id, created_at DESC)`

#### 2. `payroll_adjustments`

Manual payroll adjustment records linked to a payroll line.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | Default `gen_random_uuid()` |
| `payroll_run_id` | UUID not null | FK `payroll_runs(id)` |
| `payroll_line_id` | UUID not null | FK `payroll_lines(id)` |
| `employee_id` | UUID not null | FK `users(id)` |
| `adjustment_type` | varchar(40) not null | `allowance`, `deduction`, `correction` |
| `amount` | numeric(12,2) not null | Must be positive |
| `reason` | text not null | Required |
| `created_by_user_id` | UUID not null | FK `users(id)` |
| `reviewed_by_user_id` | UUID nullable | FK `users(id)` |
| `status` | varchar(20) not null | `draft`, `approved`, `rejected`, `voided` |
| `review_note` | text nullable | Required on reject |
| `created_at` | timestamptz | Default now |
| `reviewed_at` | timestamptz nullable | Set on approve/reject |

Constraints:

- `adjustment_type IN ('allowance','deduction','correction')`
- `status IN ('draft','approved','rejected','voided')`
- `amount > 0`

Indexes:

- `idx_payroll_adjustments_run_status` on `(payroll_run_id, status)`
- `idx_payroll_adjustments_employee_created` on `(employee_id, created_at DESC)`

## API Surface

All routes must use `auth()`, `SessionUser`, role/ownership checks, parameterized SQL, and `apiSuccess`/`apiError`.

### Compensation

#### `PATCH /api/hr/employees/[id]/compensation`

Admin-only route for salary/salary-grade changes.

Body:

```ts
interface UpdateCompensationBody {
  salary_grade_id?: string | null;
  base_salary?: number | null;
  reason: string;
}
```

Rules:

- Admin only.
- Lock `users` row `FOR UPDATE`.
- Capture before/after for changed compensation fields only.
- Reject no-op updates.
- Insert both `compensation_change_events` and `hr_employee_audit_events` with `COMPENSATION_CHANGED`.
- Return explicit response shape without raw `users.*`.

#### Harden `POST /api/hr/employees`

- Manager can create employee identity/employment fields only.
- Admin can include salary fields.
- If manager submits `salary_grade_id` or `base_salary`, either reject with `403`/`400` or ignore with an explicit policy decision. Prefer reject for clarity.
- Add tests for admin vs manager create behavior.

### Payroll Runs

#### Harden `GET /api/hr/payroll-runs`

- Admin can view payroll runs and totals.
- Manager/staff must not receive sensitive totals unless an explicit existing policy grants access.
- Preserve existing scoped list behavior only if it does not leak payroll financial totals.

#### Harden `GET /api/hr/payroll-runs/[id]`

- Admin can see full run and payroll line details.
- Staff can access only own slip if current slip behavior already allows it, not the full run.
- Managers cannot see salary/payroll financial detail unless explicitly allowed.

#### Harden `PATCH /api/hr/payroll-runs/[id]`

Workflow actions must be auditable:

- `start_processing`
- `approve`
- `mark_paid`
- `void` or `cancel` only if already supported

Rules:

- Admin-only unless existing policy explicitly allows manager actions.
- Prevent self-approval if the approver is also the creator/preparer when those fields are available.
- Require reason/note for void/cancel/reopen.
- Insert `hr_employee_audit_events` or a run-level audit table event for every workflow transition.
- Do not change existing GL posting formula.

### Payroll Adjustments

#### `POST /api/hr/payroll-runs/[id]/adjustments`

Creates a draft adjustment for a payroll line.

Body:

```ts
interface CreatePayrollAdjustmentBody {
  payroll_line_id: string;
  adjustment_type: 'allowance' | 'deduction' | 'correction';
  amount: number;
  reason: string;
}
```

Rules:

- Admin only.
- Payroll run must be `draft` or `processing`; no adjustment after `approved` unless explicit reopen flow exists.
- Employee id must be derived from the payroll line, not request body.
- Insert adjustment record and audit event.

#### `PATCH /api/hr/payroll-runs/[id]/adjustments/[adjustmentId]`

Review adjustment.

Body:

```ts
type ReviewPayrollAdjustmentBody =
  | { action: 'approve'; review_note?: string | null }
  | { action: 'reject'; review_note: string };
```

Rules:

- Admin only.
- Lock adjustment row and related payroll line.
- On approve, apply allowance/deduction/correction to the line using existing calculation conventions.
- Store before/after payroll line values in audit payload.
- Prevent reviewer from approving their own adjustment when practical.

## UI Scope

### Employee 360 Compensation Panel

Enhance the Payroll/Employment area only where needed:

- Admin-only compensation edit modal.
- Required reason field.
- Show last compensation change event.
- Keep non-admin salary view hidden.
- Use existing i18n pattern, no hardcoded Thai suppression.

### Payroll Run Detail

Enhance payroll run detail page:

- Show workflow audit trail.
- Show payroll adjustments per line.
- Add admin-only adjustment create/review controls.
- Clear disabled/read-only states for approved/paid runs.
- Staff/manager must not see sensitive totals unless policy allows.

### Payroll Governance Page

Optional if it fits existing navigation:

- Admin-only list of compensation changes and payroll adjustments.
- Filters by employee, run, status, date range.
- Link back to employee profile and payroll run.

## Testing Strategy

Add behavior tests before or alongside implementation.

Minimum test files:

- `lib/hr/compensation-policy.test.ts`
  - admin can see compensation;
  - manager/staff cannot see salary-grade fields;
  - manager create with salary fields is rejected or stripped according to policy;
  - compensation update requires reason.

- `lib/hr/payroll-adjustments.test.ts`
  - allowance increases gross/net according to existing payroll conventions;
  - deduction reduces net according to existing payroll conventions;
  - rejected adjustment does not mutate payroll line;
  - self-review is rejected where actor ids are available.

- `lib/hr/payroll-workflow.test.ts`
  - invalid status transition rejected;
  - approve/paid transition writes audit payload;
  - paid payroll cannot accept new adjustment.

Recommended integration/route tests if the harness supports them:

- employee list/detail/profile salary masking response shape;
- manager employee create rejects salary fields;
- staff cannot read full payroll run.

Verification commands:

- `npm run qa:verify`
- `npm run agent:closeout`

## Implementation Tasks

- [ ] Add compensation/payroll domain helpers and tests.
- [ ] Add migration 075 if new tables are used.
- [ ] Add admin-only compensation update route.
- [ ] Harden employee create salary field behavior.
- [ ] Harden payroll run GET/PATCH authorization and response shapes.
- [ ] Add payroll adjustment routes.
- [ ] Add audit events for compensation changes, payroll workflow transitions, and payroll adjustments.
- [ ] Update Employee 360 compensation UI for admin-only edit with reason.
- [ ] Update payroll run detail UI for workflow audit and adjustments.
- [ ] Add i18n keys for new/touched UI copy.
- [ ] Update `docs/SCHEMA.md`, `_notes/02_Agent_Memory/current-state.md`, and `_notes/00_Project_Map/modules/HR.md`.
- [ ] Run `npm run qa:verify` and `npm run agent:closeout`.

## Acceptance Criteria

- No salary, salary-grade, or payroll financial detail leaks to staff or ordinary managers.
- Manager employee creation cannot set salary fields unless explicitly allowed and tested.
- Compensation changes are admin-only, reasoned, and auditable with before/after.
- Payroll status transitions are permission-checked and auditable.
- Payroll adjustments are explicit records, not silent line edits.
- Approved/paid payroll runs cannot be mutated outside an explicit audited path.
- New business logic has behavior tests and `npm run qa:verify` passes.
- No D1-D7, Sales, POS, WMS, AP, or GL side effects are introduced.

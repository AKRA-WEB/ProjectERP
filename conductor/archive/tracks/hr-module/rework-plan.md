# Rework Plan — hr-module

**QA Date:** 2026-05-13  
**Auditor:** Billy  
**Verdict:** Rework Required — 7 critical blockers, 7 should-fix items, 3 suggestions

---

## 🔴 Must Fix

- [x] **MF-1 · Migration 022 — FK to non-existent `accounts` table**  
  `migrations/022_hr_payroll.sql` references `accounts(id)` via FK. No `018_accounting.sql` exists. Fresh `npm run migrate` aborts at 022 with `ERROR: relation "accounts" does not exist`.  
  **Fix:** Remove the FK constraint; store `account_id UUID` as plain column with comment `-- references accounts(id) when accounting module deployed`. Add inline comment in migration explaining the deferred dependency.

- [x] **MF-2 · All 4 HR list APIs missing `buildWarehouseScopeClause`**  
  `app/api/hr/employees/route.ts`, `app/api/hr/attendance/route.ts`, `app/api/hr/leave-requests/route.ts`, `app/api/hr/payroll/route.ts` — none apply warehouse scoping. Staff-role users receive all data across all warehouses.  
  **Fix:** Import `buildWarehouseScopeClause` from `lib/authz.ts`; apply to each GET handler against the relevant warehouse-linked column.

- [x] **MF-3 · Payroll calculate + approve — no database transaction**  
  `app/api/hr/payroll/calculate/route.ts` and `app/api/hr/payroll/[id]/route.ts` write multiple tables via sequential `query()` calls. Partial failure leaves orphaned records.  
  **Fix:** Wrap all writes in `pool.connect()` / `BEGIN` / `COMMIT` / `ROLLBACK` / `release()` per CLAUDE.md pattern.

- [x] **MF-4 · `users.name` column does not exist — all employee API calls throw**  
  `app/api/hr/employees/route.ts` and `app/api/hr/employees/[id]/route.ts` SELECT `u.name`. The `users` table has `name_th` and `name_en` — no `name` column. Every employee request returns a PostgreSQL runtime error.  
  **Fix:** Replace all `u.name` with `u.name_th, u.name_en` in both route files and update TypeScript interfaces accordingly.

- [x] **MF-5 · OT weekend detection — UTC `Date.getDay()` misclassifies Saturdays as Fridays**  
  `lib/hr/payroll-calc.ts` — `new Date(record.work_date).getDay()` parses date strings as UTC midnight. In Asia/Bangkok (UTC+7), Saturday `'2025-06-07'` → UTC midnight → `.getDay()` returns 5 (Friday). Saturday OT pays 1.5× instead of 3×.  
  **Fix:** Parse with Bangkok offset: `new Date(record.work_date + 'T00:00:00+07:00').getDay()`. (Note: Implementation is now using SQL `EXTRACT(DOW)` which is UTC-safe).

- [x] **MF-6 · Income tax bracket loop missing early-exit condition**  
  `lib/hr/payroll-calc.ts` — The plan mandates `if (taxableAnnual <= bracket.from) break` as first statement in the bracket loop. It is absent. Loop always runs all 8 brackets regardless of income.  
  **Fix:** Add `if (taxableAnnual <= bracket.from) break;` as first line inside the for-loop in `calculateIncomeTax`.

- [x] **MF-7 · No pagination on any HR list endpoint or UI page**  
  All 4 HR list API routes return unbounded result sets with no `LIMIT`/`OFFSET`. All 4 HR list pages render all rows with no `<Pagination>` component. CLAUDE.md: "No unbounded queries" and "Pagination on all list endpoints."  
  **Fix:** Add `page` + `pageSize` query params to all 4 API routes; apply `LIMIT $n OFFSET $m`; return `{ data, total }`; render `<Pagination>` from `components/ui/index.ts` in each page.

---

## 🟡 Should Fix

- [x] **SF-1 · Currency not using `formatCurrency()`**  
  `app/(app)/hr/payroll/page.tsx` renders monetary values via inline `.toLocaleString()` or template literals. CLAUDE.md mandates `formatCurrency()` for all THB values.  
  **Fix:** Import `formatCurrency` from `lib/utils.ts`; replace all inline currency rendering.

- [x] **SF-2 · Dates not using `formatDate()`**  
  `app/(app)/hr/attendance/page.tsx`, `app/(app)/hr/leave-requests/page.tsx`, `app/(app)/hr/employees/[id]/page.tsx` use raw `.toLocaleDateString()` or string slicing.  
  **Fix:** Import `formatDate` from `lib/utils.ts`; replace all inline date rendering.

- [x] **SF-3 · Payroll settings PATCH not restricted to `admin`**  
  `app/api/hr/payroll/settings/route.ts` PATCH handler missing `assertRole(u, ['admin'])`. Managers can modify accounting account mappings.  
  **Fix:** Add `try { assertRole(u, ['admin']); } catch { return apiError('Forbidden', 403); }` to PATCH handler.

- [x] **SF-4 · Leave request self-approval not guarded**  
  `app/api/hr/leave-requests/[id]/route.ts` approve action does not check if approver === submitter.  
  **Fix:** After fetching leave request: `if (leaveRequest.employee_user_id === u.id) return apiError('Cannot approve own leave request', 403);`

- [x] **SF-5 · Missing DB indexes on HR query columns**  
  No indexes on `employees(department_id)`, `attendance_records(employee_id, work_date)`, `leave_requests(employee_id, status)`. Add via new additive migration `024_hr_indexes.sql`.

- [x] **SF-6 · SSO constants hardcoded in payroll-calc**  
  `lib/hr/payroll-calc.ts` — `15000` and `0.05` are inline magic numbers. Should live in `lib/constants.ts`.  
  **Fix:** Add `SSO_WAGE_CAP = 15000` and `SSO_RATE = 0.05` to `lib/constants.ts`; import in `payroll-calc.ts`.

- [x] **SF-7 · Payroll slip returns JSON — execution-summary claims PDF**  
  `app/api/hr/payroll/slip/[id]/route.ts` returns `apiSuccess(data)`. No PDF library in `package.json`. Confirm with Chen if print-HTML page is acceptable or if binary PDF is required.  
  **Status:** Implemented correctly in `app/api/hr/payroll-runs/[id]/slip/[employee_id]/route.tsx` using `@react-pdf/renderer`.

---

## 🔵 Suggestions

- [x] **S-1 · `payroll-calc.ts` does not validate records belong to same employee/period**  
  **Fix:** Added `validateAttendanceRecords` helper to `lib/hr/payroll-calc.ts`.

- [x] **S-2 · HR dashboard page has hardcoded zeroes — wire to real API counts**  
  **Fix:** Created `app/api/hr/stats/route.ts` and `app/app/hr/page.tsx` with dynamic KPI cards.

- [x] **S-3 · Employee list missing `?search=` param for bilingual name search**

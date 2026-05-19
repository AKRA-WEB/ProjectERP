---
updated: 2026-05-19
updated_by: Claude
---

# Project Current State — Anti-Context-Loss Briefing

> **ทุก Agent อ่านไฟล์นี้ก่อนเริ่มงานทุกครั้ง** หลัง pitfalls.md
> Gemini: อัปเดตส่วน "Active Work" + "DB Facts" หลังทุก track ที่เสร็จ

---

## Active Work (2026-05-19)

| Track | Status | Details |
|-------|--------|---------|
| `hr-ui-redesign` | **Active** | 7 tasks: sidebar+i18n → 13 stubs → Dashboard API+UI → Employees API+UI → Leave API+UI → Payroll API+UI |
| `view-transitions` | **Rework Required** | ViewTransition import fix — read `conductor/tracks/view-transitions/rework-plan.md` |

## Needs QA (Billy: `QA: <track>`)

| Track | Content |
|-------|---------|
| `po-gr-audit` | PO + GRN transaction integrity, status transitions |
| `product-stock-summary` | Product detail page stock overview |
| `wms-search-nav-fix` | Product search dropdown fix + nav 404 |
| `io-grn-500` | Batch INSERT stride fix in `/api/grn` |

---

## DB Schema — `users` Table (all columns, verified from migrations)

```
id               UUID PK
email            VARCHAR(255) UNIQUE
password_hash    VARCHAR(255)
name_th          VARCHAR(255)          ← USE THIS, not "name"
name_en          VARCHAR(255)
role             user_role enum
is_active        BOOLEAN
created_at       TIMESTAMPTZ
updated_at       TIMESTAMPTZ
employee_id      VARCHAR(50) UNIQUE    ← aliased as "employee_code" in API responses
position         VARCHAR(100)          ← free-text, no FK
hired_date       DATE
department_id    UUID → departments
position_id      UUID → positions
salary_grade_id  UUID → salary_grades
base_salary      NUMERIC(12,2)
employment_type  VARCHAR(20)           ← 'full_time' | 'part_time' | 'contract'
employee_status  VARCHAR(20)           ← 'active' | 'inactive' | 'probation'
work_schedule_id UUID → work_schedules
```

**CRITICAL:** `users.name` ❌ does not exist. Always use `name_th` or `name_en`.

## DB Schema — Key Tables Quick Reference

| Table | Key columns |
|-------|-------------|
| `departments` | id, code, name_th, name_en, parent_id, manager_id, is_active |
| `leave_requests` | id, employee_id, leave_type_id, start_date, end_date, status, **notes** (NOT reason), approved_by |
| `attendance_records` | id, user_id, clock_in, clock_out, ot_hours, status |
| `payroll_runs` | id, run_number, period_start, period_end, status, pay_date |
| `payroll_lines` | id, payroll_run_id, employee_id, base_salary, ot_amount, allowance_amount, sso_deduction, pvf_deduction, tax_deduction, net_pay |
| `stock_ledger` | id, product_id, warehouse_id, entry_type, qty_change, reference_id, created_by |
| `goods_receipt_notes` | id, grn_number, source_type, po_id, inbound_order_id, warehouse_id, status |
| `grn_line_items` | id, grn_id, product_id, qty_received, qty_accepted, qty_rejected, **unit_cost**, line_total |
| `leave_types` | id, code, name_th, name_en, default_days_per_year |

## Import Traps (verified from pitfalls.md)

```typescript
// ✅ CORRECT
import pool from '@/lib/db/client'          // default export
import { auth } from '@/lib/auth'            // or '@/auth' — check existing routes

// ❌ WRONG
import { pool } from '@/lib/db/client'       // named export — DOES NOT EXIST
import { ViewTransition } from 'react'       // experimental, breaks build
```

---

## API Routes — HR Module

| Method | Path | Returns |
|--------|------|---------|
| GET | `/api/hr/stats` | KPIs + attendanceFeed + pendingLeaveQueue + headcountByDept + upcoming |
| GET | `/api/hr/employees` | list with hire_date, branch_name, salary (gated) |
| GET | `/api/hr/employees/stats` | total, new_this_month, turnover_3m_pct, avg_tenure_years |
| GET | `/api/hr/leave-requests` | list + stats |
| GET | `/api/hr/leave-requests/stats` | pending, on_leave_today, total_days_this_month |
| GET | `/api/hr/leave-requests/calendar?month=YYYY-MM` | team + leaves + month_days |
| PATCH | `/api/hr/leave-requests/[id]` | action: 'approve' \| 'reject' |
| GET | `/api/hr/payroll-runs/[id]` | run + rows + summary |
| PATCH | `/api/hr/payroll-runs/[id]` | action: 'submit_review' \| 'approve' \| 'post_to_accounting' |
| GET | `/api/hr/attendance/today` | current user's today record only |

## API Routes — WMS Module

| Method | Path | Notes |
|--------|------|-------|
| GET/POST | `/api/grn` | GRN list + create. Supports IO + PO source. |
| GET/PATCH | `/api/grn/[id]` | detail + status transitions |
| POST | `/api/grn/[id]/receive` | mark received |
| POST | `/api/grn/[id]/qc` | QC accept/reject |
| POST | `/api/grn/[id]/stock` | stock ledger insert |
| GET | `/api/grn/receiving-queue` | dashboard data |
| GET/POST | `/api/inbound-orders` | IO list + create |
| GET/PATCH | `/api/inbound-orders/[id]` | detail |
| GET/POST | `/api/inventory` | stock balances |
| GET | `/api/inventory/reorder` | reorder point analysis |

---

## PayrollRunStatus Enum

```typescript
type PayrollRunStatus = 'draft' | 'processing' | 'approved' | 'paid' | 'void'
// Flow: draft → processing (submit_review PATCH) → approved → paid
// NOT: 'review' — use 'processing'
```

## LeaveRequest Fields

```typescript
// DB column: notes (not reason)
lr.notes  // ✅
lr.reason // ❌ does not exist
```

## date_of_birth

```
users table has NO date_of_birth column.
Upcoming events = work anniversaries from hired_date only.
```

## Sidebar Module Prefixes

When creating new module pages, add path prefix to `components/layout/Sidebar.tsx`:
- HR pages: already covered by `/app/hr` prefix
- New WMS pages: check `WMS_PREFIXES` array exists and add new prefix

---

## Last 5 Completed Tracks

| Track | Date | Key Changes |
|-------|------|-------------|
| `wms-search-nav-fix` | 2026-05-19 | Removed overflow-hidden from IO table wrapper; fixed breadcrumb home link |
| `io-grn-500` | 2026-05-19 | Fixed batch INSERT stride (8→10) in `/api/grn`; enum cast fix; relaxed XOR constraint |
| `po-gr-audit` | 2026-05-18 | Wrapped PO+GRN POST in transactions; added role check to QC; status side effects |
| `gr-first-workflow` | 2026-05-18 | Standalone GRN + GR→PO retrospective + PR→GR direct flows |
| `i18n-language-switch` | 2026-05-18 | Thai ↔ English toggle system-wide; `useT()` hook; `lib/i18n/` |

---

## Migration Numbers (latest: 036)

Next migration = `037_<name>.sql`
Latest: `036_grn_unit_cost_fix.sql`

---
*Update this file: append to "Last 5 Completed Tracks", update "Active Work", add new DB facts discovered*

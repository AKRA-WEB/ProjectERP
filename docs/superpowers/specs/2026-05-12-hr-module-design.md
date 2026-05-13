# HR Module Design

**Date:** 2026-05-12  
**Status:** Approved  
**Approach:** Option B — Phased MVP

---

## Overview

Full HR module for the ERP platform with 4 sub-systems:
1. Employee Profiles + Departments
2. Leave Management
3. Attendance (self clock-in/out)
4. Payroll (Full Thai) + Accounting JE integration

---

## Phase 1: Employee Profiles + Departments

### New Tables

```sql
-- departments
id UUID PK
code VARCHAR UNIQUE
name_th, name_en VARCHAR
parent_id UUID FK departments (nullable — org hierarchy)
manager_id UUID FK users (nullable)
created_at, updated_at TIMESTAMPTZ

-- positions
id UUID PK
code VARCHAR UNIQUE
name_th, name_en VARCHAR
department_id UUID FK departments
salary_grade_id UUID FK salary_grades (nullable)
created_at, updated_at TIMESTAMPTZ

-- salary_grades
id UUID PK
code VARCHAR UNIQUE
name_th, name_en VARCHAR
base_salary_min NUMERIC(12,2)
base_salary_max NUMERIC(12,2)
created_at, updated_at TIMESTAMPTZ

-- employee_documents
id UUID PK
employee_id UUID FK users
doc_type VARCHAR  -- id_card | passport | degree | contract | other
filename VARCHAR
storage_url VARCHAR
issued_date DATE (nullable)
expiry_date DATE (nullable)
created_at TIMESTAMPTZ
```

### ALTER users Table

```sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS
  department_id      UUID REFERENCES departments(id),
  position_id        UUID REFERENCES positions(id),
  salary_grade_id    UUID REFERENCES salary_grades(id),
  base_salary        NUMERIC(12,2),
  employment_type    VARCHAR(20) DEFAULT 'full_time',  -- full_time | part_time | contract
  employee_status    VARCHAR(20) DEFAULT 'active',     -- active | inactive | resigned
  resignation_date   DATE;
```

> Note: `employee_id`, `position` (text), `department` (text), `phone`, `hired_date` already exist from migration 015.  
> New columns use proper FK references. Old text columns retained for backward compatibility.

### Routes

| Path | Description |
|------|-------------|
| `GET /app/hr/employees` | List with search, filter by dept/status |
| `GET /app/hr/employees/new` | Create form |
| `GET /app/hr/employees/[id]` | Profile detail — tabs: Info / Leave / Attendance / Payroll |
| `GET /app/hr/departments` | Org chart + list |
| `GET /app/hr/departments/[id]` | Edit dept + members |

### API Routes

```
GET  POST  /api/hr/employees
GET  PATCH /api/hr/employees/[id]
GET  POST  /api/hr/departments
GET  PATCH /api/hr/departments/[id]
GET  POST  /api/hr/positions
GET  POST  /api/hr/salary-grades
```

---

## Phase 2: Leave Management

### New Tables

```sql
-- leave_types
id UUID PK
code VARCHAR UNIQUE
name_th, name_en VARCHAR
days_per_year INT
is_paid BOOLEAN DEFAULT TRUE
carry_over BOOLEAN DEFAULT FALSE
created_at, updated_at TIMESTAMPTZ

-- leave_balances
id UUID PK
employee_id UUID FK users
leave_type_id UUID FK leave_types
year INT
days_entitled INT
days_used NUMERIC(4,1) DEFAULT 0
-- days_remaining = days_entitled - days_used (computed in query)
UNIQUE (employee_id, leave_type_id, year)

-- leave_requests
id UUID PK
request_number VARCHAR UNIQUE  -- seq_lr: LR-YYYYMMDD-0001
employee_id UUID FK users
leave_type_id UUID FK leave_types
start_date DATE
end_date DATE
days_requested NUMERIC(4,1)
status VARCHAR(20)  -- draft | submitted | approved | rejected | cancelled
approved_by UUID FK users (nullable)
approved_at TIMESTAMPTZ (nullable)
notes TEXT (nullable)
reject_reason TEXT (nullable)
created_at, updated_at TIMESTAMPTZ
```

### Status Flow

```
draft → submitted → approved → (consumed from balance)
                  → rejected
submitted → cancelled (by employee before approval)
```

### API Routes

```
GET  POST  /api/hr/leave-types
GET  POST  /api/hr/leave-requests
GET  PATCH /api/hr/leave-requests/[id]   action: submit | approve | reject | cancel
GET        /api/hr/leave-balances        ?employee_id=&year=
```

---

## Phase 3: Attendance

### New Tables

```sql
-- work_schedules
id UUID PK
name_th, name_en VARCHAR
shift_start TIME
shift_end TIME
days_of_week INT[]  -- [1,2,3,4,5] = Mon-Fri
created_at, updated_at TIMESTAMPTZ

-- attendance_records
id UUID PK
employee_id UUID FK users
work_date DATE
clock_in TIMESTAMPTZ (nullable)
clock_out TIMESTAMPTZ (nullable)
status VARCHAR(20)  -- present | absent | late | half_day | holiday
ot_hours NUMERIC(5,2) DEFAULT 0  -- computed from clock_out - shift_end
note TEXT (nullable)
created_at, updated_at TIMESTAMPTZ
UNIQUE (employee_id, work_date)
```

### Self Clock-In Logic

- Employee hits `POST /api/hr/attendance/clock-in` → upsert record with `clock_in = NOW()`
- Employee hits `POST /api/hr/attendance/clock-out` → update `clock_out = NOW()`, compute `ot_hours`
- `GET /api/hr/attendance/today` → returns today's record for current user (for button state)
- Late if `clock_in > shift_start + 15 min grace`
- OT if `clock_out > shift_end`

### API Routes

```
GET  POST  /api/hr/attendance
POST       /api/hr/attendance/clock-in
POST       /api/hr/attendance/clock-out
GET        /api/hr/attendance/today
```

---

## Phase 4: Payroll + Accounting Integration

### New Tables

```sql
-- tax_brackets (seeded, not user-editable)
id SERIAL PK
income_from NUMERIC(15,2)
income_to   NUMERIC(15,2) (nullable = no upper bound)
rate        NUMERIC(5,4)   -- e.g. 0.05 = 5%

-- hr_payroll_accounts (config — set once by admin)
salary_expense_account_id     UUID FK chart_of_accounts
sso_expense_account_id        UUID FK chart_of_accounts
salary_payable_account_id     UUID FK chart_of_accounts
sso_payable_account_id        UUID FK chart_of_accounts
tax_payable_account_id        UUID FK chart_of_accounts

-- payroll_runs
id UUID PK
run_number VARCHAR UNIQUE  -- seq_pyr: PYR-YYYYMMDD-0001
period_month INT  -- 1-12
period_year  INT
status VARCHAR(20)  -- draft | processing | approved | paid | void
total_gross    NUMERIC(15,2)
total_net      NUMERIC(15,2)
total_sso_emp  NUMERIC(15,2)
total_sso_co   NUMERIC(15,2)
total_tax      NUMERIC(15,2)
approved_by    UUID FK users (nullable)
approved_at    TIMESTAMPTZ (nullable)
journal_entry_id UUID FK journal_entries (nullable)
created_by     UUID FK users
created_at, updated_at TIMESTAMPTZ

-- payroll_lines
id UUID PK
run_id UUID FK payroll_runs
employee_id UUID FK users
base_salary        NUMERIC(12,2)
allowances         JSONB  -- [{name_th, name_en, amount}]
ot_pay             NUMERIC(12,2)
absence_deduction  NUMERIC(12,2)
gross_pay          NUMERIC(12,2)
sso_employee       NUMERIC(10,2)
sso_employer       NUMERIC(10,2)
taxable_income     NUMERIC(12,2)  -- after deductions
income_tax         NUMERIC(10,2)
total_deductions   NUMERIC(12,2)
net_pay            NUMERIC(12,2)
slip_url           TEXT (nullable)
created_at         TIMESTAMPTZ
```

### Thai Payroll Calculation

```
GROSS PAY
  base_salary
  + sum(allowances)
  + ot_pay         (from attendance_records, OT hours × hourly_rate × multiplier)
  - absence_deduction
  = gross_pay

SSO (ประกันสังคม)
  sso_base       = MIN(gross_pay, 15,000)
  sso_employee   = sso_base × 5%   (max 750 THB)
  sso_employer   = sso_base × 5%   (max 750 THB)

INCOME TAX WITHHOLDING
  annual_gross        = gross_pay × 12
  expense_deduction   = MIN(annual_gross × 50%, 100,000)
  personal_exemption  = 60,000
  taxable_annual      = annual_gross - expense_deduction - personal_exemption
  annual_tax          = apply_tax_brackets(taxable_annual)
  monthly_tax         = annual_tax / 12

NET PAY
  net_pay = gross_pay - sso_employee - monthly_tax

OT RATES
  Mon-Fri after shift:  1.5× hourly_rate
  Weekend / holiday:    3.0× hourly_rate
  hourly_rate = base_salary / 26 / 8
```

### Tax Brackets (Thailand 2024)

| Annual Income (THB) | Rate |
|---|---|
| 0 – 150,000 | 0% |
| 150,001 – 300,000 | 5% |
| 300,001 – 500,000 | 10% |
| 500,001 – 750,000 | 15% |
| 750,001 – 1,000,000 | 20% |
| 1,000,001 – 2,000,000 | 25% |
| 2,000,001 – 5,000,000 | 30% |
| 5,000,001+ | 35% |

### Accounting Integration

On `PATCH /api/hr/payroll-runs/[id]` with `action: approve`:

1. Compute totals across all payroll_lines
2. Create Journal Entry in `journal_entries` table:

```
Dr. Salary Expense          gross_pay_total
Dr. SSO Expense (Employer)  sso_employer_total
    Cr. Salary Payable           net_pay_total
    Cr. SSO Payable              sso_employee_total + sso_employer_total
    Cr. Tax Payable (WHT)        income_tax_total
```

3. Link `payroll_runs.journal_entry_id` to new JE id

Account codes pulled from `hr_payroll_accounts` config table.

### PDF Slip

- Library: `@react-pdf/renderer` (server-side in API route)
- Route: `GET /api/hr/payroll-runs/[id]/slip/[employee_id]`
- Content: employee name, period, base salary, allowances itemized, OT, deductions itemized, SSO, income tax, net pay

---

## Permissions (add to migration)

```sql
('hr:employees:view',   'ดูพนักงาน',         'View Employees',       'hr', 200),
('hr:employees:create', 'เพิ่มพนักงาน',       'Create Employees',     'hr', 201),
('hr:employees:edit',   'แก้ไขพนักงาน',       'Edit Employees',       'hr', 202),
('hr:departments:view', 'ดูแผนก',             'View Departments',     'hr', 210),
('hr:departments:edit', 'แก้ไขแผนก',          'Edit Departments',     'hr', 211),
('hr:leave:view',       'ดูวันลา',            'View Leave',           'hr', 220),
('hr:leave:create',     'ขอลา',               'Request Leave',        'hr', 221),
('hr:leave:approve',    'อนุมัติวันลา',       'Approve Leave',        'hr', 222),
('hr:attendance:view',  'ดูการเข้างาน',       'View Attendance',      'hr', 230),
('hr:attendance:edit',  'แก้ไขการเข้างาน',    'Edit Attendance',      'hr', 231),
('hr:payroll:view',     'ดูเงินเดือน',        'View Payroll',         'hr', 240),
('hr:payroll:run',      'คำนวณเงินเดือน',     'Run Payroll',          'hr', 241),
('hr:payroll:approve',  'อนุมัติเงินเดือน',   'Approve Payroll',      'hr', 242)
```

## Sidebar Entry

```typescript
{
  label: 'ทรัพยากรบุคคล / HR',
  items: [
    { href: '/app/hr/employees',     label: 'พนักงาน / Employees',        icon: '👥', permission: 'hr:employees:view' },
    { href: '/app/hr/departments',   label: 'แผนก / Departments',         icon: '🏢', permission: 'hr:departments:view' },
    { href: '/app/hr/leave-requests',label: 'วันลา / Leave',              icon: '📅', permission: 'hr:leave:view' },
    { href: '/app/hr/attendance',    label: 'การเข้างาน / Attendance',    icon: '⏰', permission: 'hr:attendance:view' },
    { href: '/app/hr/payroll',       label: 'เงินเดือน / Payroll',        icon: '💰', permission: 'hr:payroll:view' },
  ],
},
```

---

## Migration Files

```
019_hr_departments_positions.sql   — Phase 1 tables + ALTER users
020_hr_leave.sql                   — Phase 2 tables + seq_lr
021_hr_attendance.sql              — Phase 3 tables
022_hr_payroll.sql                 — Phase 4 tables + seq_pyr + tax_brackets seed
023_hr_permissions.sql             — new permissions + HR role assignments
```

---

## Implementation Order

1. `019` migration → departments, positions, salary_grades, employee_documents, ALTER users
2. API + pages: employees, departments
3. `020` migration → leave tables
4. API + pages: leave-types, leave-requests, leave-balances
5. `021` migration → attendance tables
6. API + pages: attendance, clock-in/out
7. `022` migration → payroll tables + tax brackets
8. API + pages: payroll-runs + lines + approve + slip PDF
9. `023` migration → HR permissions seed
10. Sidebar update

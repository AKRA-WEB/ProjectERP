# HR Module Implementation Summary

This document summarizes the full implementation of the HR Module within the ERP system.

## Overview
The HR Module provides a comprehensive suite of tools for managing employees, leave, attendance, and payroll, fully integrated with the system's Accounting and RBAC modules.

## Key Features

### 1. Employee & Org Management
- **Extended User Profiles**: Added department, position, salary grade, and employment status.
- **Department Hierarchy**: Support for parent/child departments and assigned managers.
- **Master Data**: Dedicated management for Positions and Salary Grades.

### 2. Leave Management
- **Request Workflow**: Digital submission, approval, and rejection of leave requests.
- **Automated Balances**: Real-time tracking of entitled vs. used leave days per year.
- **Thai Leave Types**: Pre-seeded with standard types (Sick, Vacation, Personal, Maternity, Ordination).

### 3. Attendance Tracking
- **Interactive Clock-In**: Employee-facing UI for daily time recording.
- **Work Schedules**: Configurable shifts with automatic late detection (15-min grace).
- **OT Calculation**: Automatic computation of overtime hours based on clock-out times.

### 4. Thai Payroll System
- **Engine**: Handles base salary, OT multipliers (1.5x/3x), and absence deductions.
- **Compliance**: Automated Thai Social Security (SSO) with caps and progressive income tax withholding.
- **PDF Payslips**: Generated on-the-fly using `@react-pdf/renderer`.
- **Accounting Link**: Automatic creation of balanced Journal Entries (Dr Expense / Cr Payable) in the General Ledger upon payroll approval.

### 5. RBAC & Security
- **Granular Permissions**: 13 new permissions (e.g., `hr:payroll:run`, `hr:leave:approve`).
- **Role Integration**: Pre-configured access for System Admins, Managers, and Staff.

## Technical Details

### Users Table — HR Columns Added (verify in migrations before writing SQL)
```
employee_id      VARCHAR(50) UNIQUE  ← aliased as "employee_code" in API
position         VARCHAR(100)        ← free-text
hired_date       DATE
department_id    UUID → departments
position_id      UUID → positions
salary_grade_id  UUID → salary_grades
base_salary      NUMERIC(12,2)
employment_type  VARCHAR(20)         ← 'full_time'|'part_time'|'contract'
employee_status  VARCHAR(20)         ← 'active'|'inactive'|'probation'
work_schedule_id UUID → work_schedules
```

### Leave Request — Field Trap
```
leave_requests.notes    ✅  (not .reason — that column does not exist)
leave_requests.status   ✅  'submitted'|'approved'|'rejected'|'cancelled'
```

### Payroll Status Flow
```
draft → processing (action: submit_review) → approved → paid
NOT: 'review' — enum value is 'processing'
```

### API Routes
```
GET  /api/hr/stats                        KPIs + feeds
GET  /api/hr/employees                    list (hire_date, branch_name, salary gated)
GET  /api/hr/employees/stats              KPI numbers
GET  /api/hr/leave-requests               list
GET  /api/hr/leave-requests/stats         KPI numbers
GET  /api/hr/leave-requests/calendar      team calendar grid
PATCH /api/hr/leave-requests/[id]         action: approve|reject
GET  /api/hr/payroll-runs/[id]            detail + rows + summary
PATCH /api/hr/payroll-runs/[id]           action: submit_review|approve|post_to_accounting
```

### Important Files
- **Migrations**: `019_hr_departments.sql` → `024_hr_indexes.sql`
- **API**: `app/api/hr/`
- **UI**: `app/app/hr/`
- **Payroll logic**: `lib/hr/payroll-calc.ts`
- **Design reference**: `docs/design/hr-bundle/apps/`

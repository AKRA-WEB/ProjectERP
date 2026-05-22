---
module: HR
type: module-summary
status: Completed
updated: 2026-05-19
---

# HR — Human Resources

The HR module manages the entire employee lifecycle, from onboarding to payroll. It features a comprehensive dashboard with real-time attendance feeds, automated tenure calculation, a team leave calendar, and a multi-step payroll approval workflow.

## Dependencies
- [[Accounting]] — ส่งรายการจ่ายเงินเดือน (Payroll Entries) และภาษีหัก ณ ที่จ่าย
- [[Security]] — จัดการสิทธิ์การเข้าถึง (RBAC) ของพนักงานในระบบ
- [[Core]] — UI Components สำหรับจัดการข้อมูลพนักงาน

## Flow
```
Employee → Leave Request → Attendance → Payroll Run
```

## Key Components

### 1. HR Dashboard
- **Location:** `/app/app/hr`
- **Data Source:** `/api/hr/stats`
- **Features:** 4-card KPI strip (Total, Attendance, Pending Leave, Payroll), Real-time attendance table, Urgent leave queue, Headcount by Department bar chart, and Upcoming work anniversaries (7-day window).

### 2. Employee Management
- **Location:** `/app/app/hr/employees`
- **Data Source:** `/api/hr/employees`, `/api/hr/employees/stats`
- **Features:** Advanced filtering (Branch, Dept, Type, Status), Tenure calculation (Y/M format), and Role-based salary gating (Admin/Manager only).
- **Navigation:** Supports employee creation and detailed profiles (profile view redesign pending).

### 3. Leave Management
- **Location:** `/app/app/hr/leave-requests`
- **Data Source:** `/api/hr/leave-requests/calendar`, `/api/hr/leave-requests/stats`
- **Features:** CSS Grid-based Team Calendar with monthly navigation and leave type color coding. Side-by-side pending list and interactive detail card for quick approval/rejection.

### 4. Payroll System
- **Location:** `/app/app/hr/payroll/[id]`
- **Workflow:** 4-step stepper (`draft` → `processing` → `approved` → `paid`).
- **Features:** 5-card financial KPI strip (Gross, SSO, PVF, Tax, Net). Detail table with footer totals and searchable lines. Integrated with General Ledger for automated accounting entries upon payment.

## Key Tables
- `employees` · `departments`
- `leave_requests` · `attendance_records`
- `payroll_runs` · `payroll_run_lines`

## Business Rules
- `users` table: `name_en` + `name_th` — ไม่มี `name` column
- Payroll routes: `payroll-runs/` — ไม่ใช่ `payroll/`
- Leave approval ต้องการ manager role
- Attendance import รองรับ Excel

## API Architecture

| Route | Method | Description |
|-------|--------|-------------|
| `/api/hr/stats` | GET | Aggregated data for Dashboard feeds and KPIs |
| `/api/hr/employees` | GET | List with branch/tenure data and salary gating |
| `/api/hr/employees/stats` | GET | Global employee KPIs (Turnover, Avg Tenure) |
| `/api/hr/leave-requests/calendar` | GET | Monthly team leave grid data |
| `/api/hr/leave-requests/stats` | GET | Pending and upcoming leave counts |
| `/api/hr/payroll-runs/[id]` | GET/PATCH | Payroll detail and workflow actions |

## SQL Patterns Used
- **Wraparound Anniversaries:** Finding events across year-end boundaries using `TO_CHAR(MM-DD)`.
- **Timezone Formatting:** Using `AT TIME ZONE 'Asia/Bangkok'` for consistent clock-in/out display.
- **Conditional Gating:** Server-side role checks to nullify sensitive fields (`base_salary`).

## Engineering Standards
- **Component Pattern:** Local `Avatar` and `StatusBadge` for high-density information display.
- **Linting:** Strict type safety with specific interfaces for all SQL result sets (no `any`).
- **Performance:** Paginated lists and optimized counts using PostgreSQL `FILTER` clause.

## Tracks

```dataview
TABLE status, updated
FROM "conductor/tracks"
WHERE file.name = "plan" AND module = "HR"
SORT updated DESC
```

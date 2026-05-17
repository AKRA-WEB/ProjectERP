---
module: HR
type: module-summary
---

# HR — Human Resources

ระบบ HR ครบวงจร: พนักงาน, ลา, เวลางาน, เงินเดือน.

## Dependencies
- [[Accounting]] — ส่งรายการจ่ายเงินเดือน (Payroll Entries) และภาษีหัก ณ ที่จ่าย
- [[Security]] — จัดการสิทธิ์การเข้าถึง (RBAC) ของพนักงานในระบบ
- [[Core]] — UI Components สำหรับจัดการข้อมูลพนักงาน

## Flow
```
Employee → Leave Request → Attendance → Payroll Run
```

## Key Tables
- `employees` · `departments`
- `leave_requests` · `attendance_records`
- `payroll_runs` · `payroll_run_lines`

## Business Rules
- `users` table: `name_en` + `name_th` — ไม่มี `name` column
- Payroll routes: `payroll-runs/` — ไม่ใช่ `payroll/`
- Leave approval ต้องการ manager role
- Attendance import รองรับ Excel

## Tracks

```dataview
TABLE status, updated
FROM "conductor/tracks"
WHERE file.name = "plan" AND module = "HR"
SORT updated DESC
```

# HR Module UI Redesign Spec
**Date:** 2026-05-19  
**Source design:** `_notes/99_Assets/design/hr-bundle/`  
**Scope:** 4 redesigned pages + sidebar update + 13 stub routes + supporting APIs

---

## 1. Overview

Redesign 4 HR pages to match the `_notes/99_Assets/design/hr-bundle/` mockups:
- HR Dashboard (`/app/hr`)
- Employees (`/app/hr/employees`)
- Leave Requests (`/app/hr/leave-requests`)
- Payroll Run Detail (`/app/hr/payroll/[id]`)

Also: update sidebar HR nav to full design nav, add 13 stub pages for new routes.

Design reference file for each page:
- Dashboard → `apps/hr-dashboard.jsx`
- Employees → `apps/hr-employees.jsx`
- Leave → `apps/hr-leave.jsx`
- Payroll → `apps/hr-payroll.jsx`

---

## 2. HR Dashboard (`/app/hr`)

### 2a. API changes — `/api/hr/stats`

Extend existing GET to also return:

```ts
attendanceFeed: Array<{
  employee_id: string;
  name_th: string;
  position: string;
  department_name_th: string;
  clock_in: string | null;
  clock_out: string | null;
  status: 'present' | 'late' | 'on_leave' | 'absent';
  late_minutes: number;
  shift_label: string;
  leave_type_name_th: string | null;
}>;  // top 10, ordered by clock_in ASC NULLS LAST

pendingLeaveQueue: Array<{
  id: string;
  employee_name_th: string;
  employee_code: string;
  leave_type_name_th: string;
  start_date: string;
  end_date: string;
  days_requested: number;
  reason: string;
  created_at: string;
  is_urgent: boolean;
  approver_name_th: string;
}>;  // top 4 where status='submitted', ordered by created_at ASC

headcountByDept: Array<{
  department_id: string;
  name_th: string;
  name_en: string;
  count: number;
  color: string;  // stored in departments table or derive from palette
}>;

upcoming: Array<{
  employee_id: string;
  name_th: string;
  event_date: string;   // MM-DD format
  kind: 'bday' | 'anniv';
  label: string;
  sub: string;          // e.g. "อายุ 32 ปี" or "ครบ 5 ปี"
}>;  // next 7 days, from date_of_birth and hire_date
```

The `is_urgent` flag: leave request is urgent if `start_date` <= today + 1 day.
The `color` for departments: derive from a fixed palette map by dept index if not stored.

### 2b. UI — matches hr-dashboard.jsx

- **Page header:** "ภาพรวมบุคลากร / HR Dashboard" + date + "รายงานประจำเดือน" + "เพิ่มพนักงาน" buttons
- **KPI strip** (4 cards):
  - พนักงานทั้งหมด (total, sub: probation count + resigned this month)
  - เข้างานวันนี้ (present+late / total-onLeave, sub: ตรงเวลา N · สาย N)
  - คำขอลาที่ค้าง (pending count, sub: ต้องอนุมัติภายใน 24 ชม.)
  - เงินเดือนงวดนี้ (latest payroll net total, sub: N คน · จ่าย DD MMM)
- **Row 1:** 7-col attendance feed + 5-col leave queue
- **Row 2:** 7-col headcount bar chart by dept + 5-col upcoming events (7 days)

Avatar = colored circle with Thai initials (2 chars). Derive `hue`/`txt` from name hash same as employees page.

---

## 3. Employees (`/app/hr/employees`)

### 3a. API changes — `/api/hr/employees`

Add these fields to existing response:
- `hire_date` (already `start_date` in DB — expose as `hire_date`)
- `branch_name` (from branch/warehouse join)
- `employment_type` (already exists)
- `salary` (only returned when `u.role === 'admin' || u.role === 'manager'`, otherwise `null`)

Add new query params:
- `branch_id` — filter by branch
- `employment_type` — filter by 'full_time' | 'part_time'

New endpoint: `/api/hr/employees/stats` returning:
```ts
{
  total: number;
  new_this_month: number;
  probation_days_remaining: number | null;
  turnover_3m_pct: number;  // (resigned last 3 months / avg headcount) * 100
  avg_tenure_years: number;
  oldest_tenure_years: number;
}
```

### 3b. UI — matches hr-employees.jsx

- **KPI strip** (4 cards): total, new this month (probation days sub), turnover 3M, avg tenure
- **Filter bar:** search + dept select + branch select + status select + view toggle (table/card)
- **Table columns:** checkbox | code | name+position+avatar | dept (colored dot) | branch | hire date | tenure | type pill | status pill | salary (admin/manager only)
- Pagination unchanged

---

## 4. Leave Requests (`/app/hr/leave-requests`)

Keep existing path. Redesign the page layout.

### 4a. New API — `/api/hr/leave-requests/calendar`

GET `?month=2026-05` (YYYY-MM format)

Returns team calendar data:
```ts
{
  team: Array<{
    employee_id: string;
    name_th: string;
    department_name_en: string;
  }>;
  leaves: Array<{
    employee_id: string;
    from_day: number;   // day of month (1-31)
    to_day: number;
    type: string;
    color: string;      // derived from leave type
  }>;
  month_days: number;   // 28-31
  first_weekday: number; // 0=Sun, weekday of day 1
}
```

### 4b. API changes — `/api/hr/leave-requests`

Add leave KPI stats to response (or separate `/api/hr/leave-requests/stats`):
```ts
{
  pending: number;
  on_leave_today: number;
  total_days_this_month: number;
  quota_used_pct: number;
}
```

### 4c. UI — matches hr-leave.jsx

- **KPI strip** (4 cards): รออนุมัติ, ลาวันนี้, ลาทั้งเดือน, โควต้าใช้ไป
- **Body grid (4+8):**
  - Left (col-4): pending list with selected state (border-l-2 on selected)
  - Right (col-8):
    - Detail card for selected leave: employee header + 4-col grid (date range, days, remaining quota, approver) + reason + Approve/Reject buttons
    - Team calendar: month grid, per-employee rows, leave bars overlaid via absolute positioning

Action: Approve → PATCH `/api/hr/leave-requests/[id]` with `{ action: 'approve' }`, Reject → `{ action: 'reject' }`. Both re-fetch queue after success.

---

## 5. Payroll Run Detail (`/app/hr/payroll/[id]`)

The existing `/app/hr/payroll` list stays (no redesign). The redesign target is the `[id]` detail page.

### 5a. API changes — `/api/hr/payroll-runs/[id]`

Extend detail response to include per-employee breakdown:
```ts
rows: Array<{
  employee_id: string;
  employee_code: string;
  name_th: string;
  position: string;
  base_salary: number;
  ot_amount: number;
  allowance_amount: number;
  gross: number;
  sso_deduction: number;
  pvf_deduction: number;
  tax_deduction: number;
  net_pay: number;
}>;
summary: {
  total_gross: number;
  total_sso: number;
  total_pvf: number;
  total_tax: number;
  total_net: number;
  employee_count: number;
  paydate: string;
  cutoff_date: string;
};
```

### 5b. UI — matches hr-payroll.jsx

- **Page header:** period label + status pill + action buttons (Export SCB, Print Slips, Submit for Approval)
- **Workflow stepper:** 4 steps (ร่าง → ตรวจสอบ → อนุมัติ → จ่ายแล้ว), vertical connector lines, done/current/pending states
- **KPI strip** (5 cards): Gross, SSO, PVF, Tax, Net
- **Filter bar:** search + dept + branch + "only OT" checkbox
- **Table columns:** checkbox | code | employee+avatar | ฐานเดือน | OT | เบี้ยเลี้ยง | Gross | SSO | PVF | ภาษี | Net
- Footer row with totals
- Pagination

Status action button:
- `draft` → "ส่งให้ผู้จัดการตรวจสอบ"
- `review` → "ส่งให้ผู้บริหารอนุมัติ"
- `approved` → "ยืนยันการจ่ายเงิน"
- `paid` → disabled

---

## 6. Sidebar HR Nav Update

**File:** `components/layout/Sidebar.tsx`

Replace current minimal HR nav (6 items) with full design nav matching `HR_NAV` from `erp-shell.jsx`:

```
ภาพรวม:
  /app/hr                     — Dashboard
พนักงาน / Employees:
  /app/hr/employees           — รายชื่อพนักงาน
  /app/hr/org                 — โครงสร้างองค์กร [stub]
  /app/hr/onboarding          — พนักงานใหม่ [stub]
เวลาทำงาน / Time:
  /app/hr/attendance          — เวลาเข้าออกงาน (existing)
  /app/hr/shifts              — ตารางกะ [stub]
  /app/hr/overtime            — ล่วงเวลา [stub]
การลา / Leave:
  /app/hr/leave-requests      — คำขอลา (existing, redesigned)
  /app/hr/leave/calendar      — ปฏิทินทีม [stub]
  /app/hr/leave/quota         — โควต้าวันลา [stub]
เงินเดือน / Payroll:
  /app/hr/payroll             — รันเงินเดือน (existing list)
  /app/hr/payroll/slips       — สลิปเงินเดือน [stub]
  /app/hr/payroll/tax         — ภาษี & ประกันสังคม [stub]
พัฒนา / Development:
  /app/hr/performance         — ประเมินผล [stub]
  /app/hr/training            — ฝึกอบรม [stub]
สรรหา / Recruitment:
  /app/hr/jobs                — ตำแหน่งที่เปิดรับ [stub]
  /app/hr/candidates          — ผู้สมัคร [stub]
ข้อมูลหลัก / Master Data:
  /app/hr/positions           — ตำแหน่งงาน [stub]
  /app/hr/departments         — แผนก / สาขา (existing)
```

All new items use `permission: 'hr:employees:view'` (same as existing HR items) until proper permissions are defined.

Add translation keys to i18n for new labels.

---

## 7. Stub Pages (13 new routes)

Each stub: `'use client'` page with:
- Page title + English subtitle
- "กำลังพัฒนา / Coming soon" badge
- Back link to `/app/hr`

Routes:
1. `app/app/hr/org/page.tsx`
2. `app/app/hr/onboarding/page.tsx`
3. `app/app/hr/shifts/page.tsx`
4. `app/app/hr/overtime/page.tsx`
5. `app/app/hr/leave/calendar/page.tsx`
6. `app/app/hr/leave/quota/page.tsx`
7. `app/app/hr/payroll/slips/page.tsx`
8. `app/app/hr/payroll/tax/page.tsx`
9. `app/app/hr/performance/page.tsx`
10. `app/app/hr/training/page.tsx`
11. `app/app/hr/jobs/page.tsx`
12. `app/app/hr/candidates/page.tsx`
13. `app/app/hr/positions/page.tsx`

---

## 8. Implementation Order (Option A: page-by-page)

1. Sidebar HR nav update + i18n keys
2. Stub pages (13 files, quick)
3. Dashboard — API extend + UI redesign
4. Employees — API extend + UI redesign
5. Leave — new calendar API + UI redesign
6. Payroll detail — API extend + UI redesign

---

## 9. Out of Scope

- Mobile view (`hr-mobile.jsx`) — not implemented
- Real data for stub pages
- `/app/hr/payroll` list page UI (keep as-is)
- New permission entries
- Avatar upload / real photos

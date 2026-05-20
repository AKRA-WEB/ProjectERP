---
track: hr-ui-redesign
status: Completed
aliases: ["HR UI Redesign — Dashboard · Employees · Leave · Payroll"]
owner: puka, paku
module: HR
updated: 2026-05-20
---

# Track: hr-ui-redesign — HR UI Redesign

**Created:** 2026-05-19
**Status:** Completed
**Architect:** Chen

**Goal:** Redesign 4 HR pages (Dashboard, Employees, Leave Requests, Payroll Detail) to match `docs/design/hr-bundle/` mockups; update sidebar HR nav to full 8-group layout; add 13 stub pages for new routes; extend 4 API routes with new data.

**Architecture:** Page-by-page implementation. Each task is self-contained. API extensions and UI redesigns are paired per page. No new DB migrations — all data comes from existing tables. Design source files: `docs/design/hr-bundle/apps/hr-dashboard.jsx`, `hr-employees.jsx`, `hr-leave.jsx`, `hr-payroll.jsx`.

**Design Reference:** Read `docs/design/hr-bundle/apps/hr-*.jsx` files before implementing each task to understand exact layout. Mock data structure is in `docs/design/hr-bundle/apps/hr-mock-data.jsx`.

**Tech Stack:** Next.js 15 App Router · TypeScript strict · PostgreSQL (raw pg) · Tailwind CSS · `useT()` from `lib/i18n/index.tsx`

---

## Architecture Decisions

| Decision | Choice | Reason |
|---|---|---|
| Avatar | Colored circle, Thai 2-char initials, color from name hash | Matches design; no photo upload in scope |
| `date_of_birth` | Not in DB — upcoming events = work anniversaries only | Column doesn't exist in `users` table |
| Leave reason field | `notes` not `reason` | `LeaveRequest` type uses `notes` |
| Department colors | Derive from DEPT_COLORS fixed palette by index | No color column in departments table |
| Salary visibility | Only `admin` or `manager` roles see salary | Security requirement |
| Branch name | LEFT JOIN `user_warehouse_assignments` → `warehouses` | No direct `branch_id` on users |
| Leave calendar | CSS grid (`gridTemplateColumns: 160px repeat(N, 30px)`), absolute-positioned leave bars | Matches hr-leave.jsx pattern |
| Payroll status flow | `draft` → `processing` (submit_review) → `approved` → `paid` | `PayrollRunStatus` type constraint |

---

## Shared Patterns (read before implementing any task)

### Avatar Component Pattern
```tsx
const AVATAR_PALETTE = [
  { bg: '#fde68a', txt: '#92400e' }, { bg: '#bbf7d0', txt: '#14532d' },
  { bg: '#bfdbfe', txt: '#1e3a8a' }, { bg: '#fecaca', txt: '#7f1d1d' },
  { bg: '#e9d5ff', txt: '#581c87' }, { bg: '#fed7aa', txt: '#7c2d12' },
  { bg: '#cffafe', txt: '#164e63' }, { bg: '#fce7f3', txt: '#831843' },
];
function nameToColor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_PALETTE[h % AVATAR_PALETTE.length];
}
function nameToInitials(name: string) {
  const parts = name.trim().split(/\s+/);
  return parts.length >= 2 ? parts[0][0] + parts[1][0] : name.slice(0, 2);
}
```

### KPI Strip Pattern
```tsx
// Container: flex bg-white border border-stone-200 rounded-[10px] shadow-sm overflow-hidden
// Each card: flex-1 px-5 py-4 border-r border-stone-100 last:border-r-0
```

### DEPT_COLORS palette (derive by index mod 8)
```ts
const DEPT_COLORS = ['#6366f1','#f59e0b','#10b981','#ef4444','#8b5cf6','#06b6d4','#f97316','#ec4899'];
```

---

## Task 1: i18n Keys + Sidebar HR Nav Update

**Files:**
- Modify: `lib/i18n/en.json`
- Modify: `lib/i18n/th.json`
- Modify: `components/layout/Sidebar.tsx`

### Step 1: Add i18n keys to en.json

Add these keys inside `lib/i18n/en.json` under the existing HR keys (find `"page.departments"` and add after it):

```json
"nav.hr_employees": "Employees",
"nav.hr_org": "Org Chart",
"nav.hr_onboarding": "New Employees",
"nav.hr_time": "Time & Attendance",
"nav.hr_shifts": "Shift Schedules",
"nav.hr_overtime": "Overtime",
"nav.hr_leave": "Leave",
"nav.hr_leave_calendar": "Team Calendar",
"nav.hr_leave_quota": "Leave Quota",
"nav.hr_payroll": "Payroll",
"nav.hr_payroll_slips": "Pay Slips",
"nav.hr_payroll_tax": "Tax & SSO",
"nav.hr_development": "Development",
"nav.hr_performance": "Performance Reviews",
"nav.hr_training": "Training",
"nav.hr_recruitment": "Recruitment",
"nav.hr_jobs": "Open Positions",
"nav.hr_candidates": "Candidates",
"nav.hr_masterdata": "Master Data",
"nav.hr_positions": "Job Positions",
"nav.hr_departments": "Departments"
```

### Step 2: Add i18n keys to th.json

Add same keys to `lib/i18n/th.json` with Thai values:

```json
"nav.hr_employees": "รายชื่อพนักงาน",
"nav.hr_org": "โครงสร้างองค์กร",
"nav.hr_onboarding": "พนักงานใหม่",
"nav.hr_time": "เวลาทำงาน",
"nav.hr_shifts": "ตารางกะ",
"nav.hr_overtime": "ล่วงเวลา",
"nav.hr_leave": "การลา",
"nav.hr_leave_calendar": "ปฏิทินทีม",
"nav.hr_leave_quota": "โควต้าวันลา",
"nav.hr_payroll": "เงินเดือน",
"nav.hr_payroll_slips": "สลิปเงินเดือน",
"nav.hr_payroll_tax": "ภาษี & ประกันสังคม",
"nav.hr_development": "พัฒนา",
"nav.hr_performance": "ประเมินผล",
"nav.hr_training": "ฝึกอบรม",
"nav.hr_recruitment": "สรรหา",
"nav.hr_jobs": "ตำแหน่งที่เปิดรับ",
"nav.hr_candidates": "ผู้สมัคร",
"nav.hr_masterdata": "ข้อมูลหลัก",
"nav.hr_positions": "ตำแหน่งงาน",
"nav.hr_departments": "แผนก / สาขา"
```

### Step 3: Replace HR nav groups in Sidebar.tsx

In `components/layout/Sidebar.tsx`, find the HR module nav items array (the `module === 'hr'` section). Replace its groups with this exact structure:

```ts
{
  label: 'ภาพรวม',
  items: [
    { href: '/app/hr', label: t('page.hr_dashboard'), icon: 'LayoutDashboard', permission: 'hr:employees:view' },
  ]
},
{
  label: t('nav.hr_employees'),
  items: [
    { href: '/app/hr/employees', label: t('nav.hr_employees'), icon: 'Users', permission: 'hr:employees:view' },
    { href: '/app/hr/org', label: t('nav.hr_org'), icon: 'GitBranch', permission: 'hr:employees:view' },
    { href: '/app/hr/onboarding', label: t('nav.hr_onboarding'), icon: 'UserPlus', permission: 'hr:employees:view' },
  ]
},
{
  label: t('nav.hr_time'),
  items: [
    { href: '/app/hr/attendance', label: t('page.attendance'), icon: 'Clock', permission: 'hr:employees:view' },
    { href: '/app/hr/shifts', label: t('nav.hr_shifts'), icon: 'CalendarRange', permission: 'hr:employees:view' },
    { href: '/app/hr/overtime', label: t('nav.hr_overtime'), icon: 'Timer', permission: 'hr:employees:view' },
  ]
},
{
  label: t('nav.hr_leave'),
  items: [
    { href: '/app/hr/leave-requests', label: t('page.leave'), icon: 'CalendarCheck', permission: 'hr:employees:view' },
    { href: '/app/hr/leave/calendar', label: t('nav.hr_leave_calendar'), icon: 'CalendarDays', permission: 'hr:employees:view' },
    { href: '/app/hr/leave/quota', label: t('nav.hr_leave_quota'), icon: 'ListChecks', permission: 'hr:employees:view' },
  ]
},
{
  label: t('nav.hr_payroll'),
  items: [
    { href: '/app/hr/payroll', label: t('page.payroll'), icon: 'Banknote', permission: 'hr:employees:view' },
    { href: '/app/hr/payroll/slips', label: t('nav.hr_payroll_slips'), icon: 'FileText', permission: 'hr:employees:view' },
    { href: '/app/hr/payroll/tax', label: t('nav.hr_payroll_tax'), icon: 'Receipt', permission: 'hr:employees:view' },
  ]
},
{
  label: t('nav.hr_development'),
  items: [
    { href: '/app/hr/performance', label: t('nav.hr_performance'), icon: 'TrendingUp', permission: 'hr:employees:view' },
    { href: '/app/hr/training', label: t('nav.hr_training'), icon: 'BookOpen', permission: 'hr:employees:view' },
  ]
},
{
  label: t('nav.hr_recruitment'),
  items: [
    { href: '/app/hr/jobs', label: t('nav.hr_jobs'), icon: 'Briefcase', permission: 'hr:employees:view' },
    { href: '/app/hr/candidates', label: t('nav.hr_candidates'), icon: 'UserSearch', permission: 'hr:employees:view' },
  ]
},
{
  label: t('nav.hr_masterdata'),
  items: [
    { href: '/app/hr/positions', label: t('nav.hr_positions'), icon: 'Tag', permission: 'hr:employees:view' },
    { href: '/app/hr/departments', label: t('nav.hr_departments'), icon: 'Building2', permission: 'hr:employees:view' },
  ]
},
```

> **Note:** Check existing Sidebar.tsx to confirm icon names match the lucide-react icons used elsewhere. If `GitBranch`, `CalendarRange`, `Timer`, `CalendarCheck`, `CalendarDays`, `ListChecks`, `Banknote`, `Receipt`, `TrendingUp`, `BookOpen`, `Briefcase`, `UserSearch`, `Tag`, `Building2` are not already imported, add them to the lucide-react import.

- [x] Add i18n keys to en.json
- [x] Add i18n keys to th.json
- [x] Replace HR nav in Sidebar.tsx with 8-group structure
- [x] Verify `npx tsc --noEmit` passes
**Q1/Q2/Q3:** Q2: Multiple `replace` calls on the same file in one turn caused a race condition where the second edit used the old file state, effectively discarding the first edit. Fix: Apply edits sequentially across turns.

---

## Task 2: Stub Pages (13 new routes)

**Files to create:** (all `'use client'` pages)

Template for each stub:
```tsx
'use client';
import Link from 'next/link';

export default function PageName() {
  return (
    <div className="flex-1 p-8">
      <div className="max-w-xl mx-auto text-center mt-24 space-y-4">
        <h1 className="font-display text-2xl font-semibold text-stone-900">[Thai Title]</h1>
        <p className="text-stone-500">[English Subtitle]</p>
        <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
          กำลังพัฒนา / Coming soon
        </span>
        <div className="pt-4">
          <Link href="/app/hr" className="text-sm text-stone-500 hover:text-stone-900 underline">
            ← กลับหน้า HR Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
```

Create these 13 files:

- [x] `app/app/hr/org/page.tsx` — title: "โครงสร้างองค์กร", sub: "Organization Chart"
- [x] `app/app/hr/onboarding/page.tsx` — title: "พนักงานใหม่", sub: "Employee Onboarding"
- [x] `app/app/hr/shifts/page.tsx` — title: "ตารางกะ", sub: "Shift Schedules"
- [x] `app/app/hr/overtime/page.tsx` — title: "ล่วงเวลา", sub: "Overtime Management"
- [x] `app/app/hr/leave/calendar/page.tsx` — title: "ปฏิทินทีม", sub: "Team Leave Calendar"
- [x] `app/app/hr/leave/quota/page.tsx` — title: "โควต้าวันลา", sub: "Leave Quota Management"
- [x] `app/app/hr/payroll/slips/page.tsx` — title: "สลิปเงินเดือน", sub: "Pay Slips"
- [x] `app/app/hr/payroll/tax/page.tsx` — title: "ภาษี & ประกันสังคม", sub: "Tax & Social Security"
- [x] `app/app/hr/performance/page.tsx` — title: "ประเมินผล", sub: "Performance Reviews"
- [x] `app/app/hr/training/page.tsx` — title: "ฝึกอบรม", sub: "Training Management"
- [x] `app/app/hr/jobs/page.tsx` — title: "ตำแหน่งที่เปิดรับ", sub: "Open Job Positions"
- [x] `app/app/hr/candidates/page.tsx` — title: "ผู้สมัคร", sub: "Recruitment Candidates"
- [x] `app/app/hr/positions/page.tsx` — title: "ตำแหน่งงาน", sub: "Job Positions Master Data"

> **Warning:** `app/app/hr/payroll/slips/page.tsx` — Next.js dynamic route `[id]` exists at `app/app/hr/payroll/[id]/page.tsx`. The `slips` segment is a static catch, NOT a dynamic param — this is fine because `slips` is a literal string. Verify `app/app/hr/payroll/slips/` directory doesn't conflict.

- [x] Verify `npx tsc --noEmit` passes after all 13 files created
**Q1/Q2/Q3:** No new knowledge this task.

---

## Task 3: Extend /api/hr/stats

**File:** `app/api/hr/stats/route.ts`

Current route returns basic KPI numbers. Extend GET handler to also return 4 new arrays: `attendanceFeed`, `pendingLeaveQueue`, `headcountByDept`, `upcoming`.

Add after existing queries:

### attendanceFeed SQL
```sql
SELECT
  u.id AS employee_id,
  u.name AS name_th,
  u.position,
  COALESCE(d.name_th, u.department) AS department_name_th,
  TO_CHAR(ar.clock_in AT TIME ZONE 'Asia/Bangkok', 'HH24:MI') AS clock_in,
  TO_CHAR(ar.clock_out AT TIME ZONE 'Asia/Bangkok', 'HH24:MI') AS clock_out,
  CASE
    WHEN lr.id IS NOT NULL THEN 'on_leave'
    WHEN ar.id IS NULL THEN 'absent'
    WHEN ar.clock_in::time > '09:00:00' THEN 'late'
    ELSE 'present'
  END AS status,
  CASE
    WHEN ar.clock_in::time > '09:00:00'
    THEN EXTRACT(EPOCH FROM (ar.clock_in::time - '09:00:00'::time)) / 60
    ELSE 0
  END::int AS late_minutes,
  'กะเช้า 09:00-18:00' AS shift_label,
  lt.name_th AS leave_type_name_th
FROM users u
LEFT JOIN attendance_records ar
  ON ar.user_id = u.id AND DATE(ar.clock_in AT TIME ZONE 'Asia/Bangkok') = CURRENT_DATE
LEFT JOIN leave_requests lr
  ON lr.employee_id = u.id
  AND lr.status = 'approved'
  AND CURRENT_DATE BETWEEN lr.start_date AND lr.end_date
LEFT JOIN leave_types lt ON lt.id = lr.leave_type_id
LEFT JOIN departments d ON d.id = u.department_id
WHERE u.is_active = TRUE AND u.role NOT IN ('admin', 'superadmin')
ORDER BY ar.clock_in ASC NULLS LAST
LIMIT 10
```

### pendingLeaveQueue SQL
```sql
SELECT
  lr.id,
  u.name AS employee_name_th,
  u.employee_code,
  lt.name_th AS leave_type_name_th,
  lr.start_date::text,
  lr.end_date::text,
  (lr.end_date - lr.start_date + 1) AS days_requested,
  COALESCE(lr.notes, '') AS reason,
  lr.created_at::text,
  (lr.start_date <= CURRENT_DATE + 1) AS is_urgent,
  COALESCE(approver.name, '') AS approver_name_th
FROM leave_requests lr
JOIN users u ON u.id = lr.employee_id
JOIN leave_types lt ON lt.id = lr.leave_type_id
LEFT JOIN users approver ON approver.id = lr.approved_by
WHERE lr.status = 'submitted'
ORDER BY lr.created_at ASC
LIMIT 4
```

### headcountByDept SQL
```sql
SELECT
  d.id AS department_id,
  d.name_th,
  d.name_en,
  COUNT(u.id)::int AS count
FROM departments d
LEFT JOIN users u ON u.department_id = d.id AND u.is_active = TRUE
GROUP BY d.id, d.name_th, d.name_en
ORDER BY count DESC
```

Then in the TypeScript response, add colors by index:
```ts
const DEPT_COLORS = ['#6366f1','#f59e0b','#10b981','#ef4444','#8b5cf6','#06b6d4','#f97316','#ec4899'];
const headcountByDept = deptRows.map((d, i) => ({ ...d, color: DEPT_COLORS[i % DEPT_COLORS.length] }));
```

### upcoming SQL (work anniversaries from hired_date, next 7 days)
```sql
SELECT
  u.id AS employee_id,
  u.name AS name_th,
  TO_CHAR(u.hired_date, 'MM-DD') AS event_date,
  'anniv' AS kind,
  'ครบรอบทำงาน' AS label,
  'ครบ ' || (EXTRACT(YEAR FROM AGE(u.hired_date))::int + 1) || ' ปี' AS sub
FROM users u
WHERE u.is_active = TRUE
  AND u.hired_date IS NOT NULL
  AND (
    TO_CHAR(u.hired_date, 'MM-DD') BETWEEN TO_CHAR(CURRENT_DATE, 'MM-DD') AND TO_CHAR(CURRENT_DATE + 7, 'MM-DD')
    OR (
      TO_CHAR(CURRENT_DATE, 'MM-DD') > TO_CHAR(CURRENT_DATE + 7, 'MM-DD')
      AND (TO_CHAR(u.hired_date, 'MM-DD') >= TO_CHAR(CURRENT_DATE, 'MM-DD') OR TO_CHAR(u.hired_date, 'MM-DD') <= TO_CHAR(CURRENT_DATE + 7, 'MM-DD'))
    )
  )
ORDER BY TO_CHAR(u.hired_date, 'MM-DD') ASC
LIMIT 10
```

> **Note:** The year-end wraparound logic (Dec 31 → Jan 1) is handled by the OR clause. Test edge case in dev.

Return shape to add to existing `apiSuccess({...existing, attendanceFeed, pendingLeaveQueue, headcountByDept, upcoming })`.

- [x] Add `attendanceFeed` query and return field
- [x] Add `pendingLeaveQueue` query and return field
- [x] Add `headcountByDept` query with DEPT_COLORS mapping
- [x] Add `upcoming` query and return field
- [x] Verify `npx tsc --noEmit` passes
**Q1/Q2/Q3:** Q1: SQL pattern for work anniversaries with year-end wraparound (Dec 31 -> Jan 1) using `TO_CHAR(u.hired_date, 'MM-DD')` and `BETWEEN` with `OR` fallback. Added to `database_sql_rules.md`.

---

## Task 4: HR Dashboard UI Redesign

**File:** `app/app/hr/page.tsx`

Full redesign. Reference: `docs/design/hr-bundle/apps/hr-dashboard.jsx`

### Layout structure:
```
Page header (title + date + 2 action buttons)
KPI strip (4 cards)
Row 1: col-7 attendance feed table | col-5 pending leave queue cards
Row 2: col-7 headcount bar chart by dept | col-5 upcoming events list
```

### Page header:
```tsx
<div className="flex items-end justify-between gap-4">
  <div>
    <h1 className="font-display text-[26px] font-semibold tracking-tight text-stone-900">ภาพรวมบุคลากร <span className="text-stone-400 font-normal">/ HR Dashboard</span></h1>
    <p className="text-[13.5px] text-stone-500 mt-1">{formattedDate}</p>
  </div>
  <div className="flex gap-2">
    <button className="h-9 px-3.5 rounded-md text-[13px] font-medium text-stone-700 bg-white border border-stone-200 hover:bg-stone-50">รายงานประจำเดือน</button>
    <Link href="/app/hr/employees/new" className="h-9 px-3.5 rounded-md text-[13px] font-medium text-white bg-stone-900 hover:bg-stone-800 inline-flex items-center gap-1.5">+ เพิ่มพนักงาน</Link>
  </div>
</div>
```

### KPI strip (4 cards):
Data from existing stats fields + new arrays:
- พนักงานทั้งหมด: `stats.totalEmployees`, sub: `${stats.probationCount} ทดลองงาน · ${stats.resignedThisMonth ?? 0} ออกเดือนนี้`
- เข้างานวันนี้: `stats.presentToday` / `(stats.totalEmployees - stats.onLeaveToday)`, sub: `ตรงเวลา ${onTimeCount} · สาย ${lateCount}`
- คำขอลาที่ค้าง: `stats.pendingLeaveCount`, sub: `ต้องอนุมัติภายใน 24 ชม.`
- เงินเดือนงวดนี้: `stats.latestPayrollNet ? formatCurrency(stats.latestPayrollNet) : '—'`, sub: paydate if available

Count `onTimeCount` and `lateCount` from `attendanceFeed` (status === 'present' vs 'late').

### Attendance feed table (col-span-7):
```tsx
<div className="lg:col-span-7 bg-white border border-stone-200 rounded-[10px] shadow-sm overflow-hidden">
  <div className="px-5 py-4 border-b border-stone-100 flex items-center justify-between">
    <h2 className="font-semibold text-stone-900">การเข้างานวันนี้</h2>
    <Link href="/app/hr/attendance" className="text-[12.5px] text-stone-500 hover:text-stone-900">ดูทั้งหมด →</Link>
  </div>
  <table className="w-full text-left">
    <thead className="bg-stone-50 border-b border-stone-100">
      <tr className="text-[10.5px] font-semibold text-stone-500 uppercase tracking-wider">
        <th className="px-4 py-2.5">พนักงาน</th>
        <th className="px-4 py-2.5">แผนก</th>
        <th className="px-4 py-2.5">เข้างาน</th>
        <th className="px-4 py-2.5">ออกงาน</th>
        <th className="px-4 py-2.5">สถานะ</th>
      </tr>
    </thead>
    <tbody className="divide-y divide-stone-50">
      {stats.attendanceFeed?.map((emp) => (
        <tr key={emp.employee_id} className="hover:bg-stone-50/60">
          <td className="px-4 py-2.5">
            <div className="flex items-center gap-2">
              <Avatar name={emp.name_th} size={28} />
              <div><div className="text-[13px] font-medium text-stone-900">{emp.name_th}</div><div className="text-[10.5px] text-stone-400">{emp.position}</div></div>
            </div>
          </td>
          <td className="px-4 py-2.5 text-[12.5px] text-stone-600">{emp.department_name_th}</td>
          <td className="px-4 py-2.5 font-mono text-[12.5px] text-stone-700">{emp.clock_in ?? '—'}</td>
          <td className="px-4 py-2.5 font-mono text-[12.5px] text-stone-500">{emp.clock_out ?? '—'}</td>
          <td className="px-4 py-2.5"><StatusBadge status={emp.status} lateMinutes={emp.late_minutes} /></td>
        </tr>
      ))}
    </tbody>
  </table>
</div>
```

StatusBadge:
```tsx
const STATUS_BADGE: Record<string, string> = {
  present: 'bg-green-50 text-green-700 border border-green-200',
  late: 'bg-amber-50 text-amber-700 border border-amber-200',
  on_leave: 'bg-blue-50 text-blue-700 border border-blue-200',
  absent: 'bg-red-50 text-red-700 border border-red-200',
};
const STATUS_LABEL: Record<string, string> = {
  present: 'เข้างาน', late: 'สาย', on_leave: 'ลา', absent: 'ขาด',
};
function StatusBadge({ status, lateMinutes }: { status: string; lateMinutes: number }) {
  return (
    <span className={`px-2 py-0.5 rounded-full text-[10.5px] font-medium ${STATUS_BADGE[status] ?? ''}`}>
      {STATUS_LABEL[status] ?? status}{status === 'late' && lateMinutes > 0 ? ` ${lateMinutes}น.` : ''}
    </span>
  );
}
```

### Pending leave queue (col-span-5):
```tsx
<div className="lg:col-span-5 bg-white border border-stone-200 rounded-[10px] shadow-sm overflow-hidden">
  <div className="px-5 py-4 border-b border-stone-100 flex items-center justify-between">
    <h2 className="font-semibold text-stone-900">คำขอลารออนุมัติ</h2>
    <Link href="/app/hr/leave-requests" className="text-[12.5px] text-stone-500 hover:text-stone-900">ดูทั้งหมด →</Link>
  </div>
  <div className="divide-y divide-stone-100">
    {stats.pendingLeaveQueue?.map((req) => (
      <div key={req.id} className="px-5 py-3.5">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-medium text-[13px] text-stone-900">{req.employee_name_th}</span>
              {req.is_urgent && <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-red-500 text-white">เร่งด่วน</span>}
            </div>
            <div className="text-[11.5px] text-stone-500 mt-0.5">{req.leave_type_name_th} · {req.days_requested} วัน</div>
            <div className="text-[11px] text-stone-400">{req.start_date} – {req.end_date}</div>
          </div>
        </div>
      </div>
    ))}
  </div>
</div>
```

### Headcount bar chart (col-span-7):
Simple CSS bar chart — no library:
```tsx
<div className="lg:col-span-7 bg-white border border-stone-200 rounded-[10px] shadow-sm p-5">
  <h2 className="font-semibold text-stone-900 mb-4">จำนวนพนักงานตามแผนก</h2>
  <div className="space-y-2.5">
    {stats.headcountByDept?.map((d) => {
      const maxCount = Math.max(...(stats.headcountByDept?.map((x) => x.count) ?? [1]));
      const pct = maxCount > 0 ? (d.count / maxCount) * 100 : 0;
      return (
        <div key={d.department_id} className="flex items-center gap-3">
          <div className="w-32 text-[12.5px] text-stone-600 truncate text-right">{d.name_th}</div>
          <div className="flex-1 h-6 bg-stone-100 rounded-md overflow-hidden">
            <div className="h-full rounded-md transition-all" style={{ width: `${pct}%`, background: d.color }} />
          </div>
          <div className="w-8 text-[12.5px] font-mono text-stone-700 text-right">{d.count}</div>
        </div>
      );
    })}
  </div>
</div>
```

### Upcoming events (col-span-5):
```tsx
<div className="lg:col-span-5 bg-white border border-stone-200 rounded-[10px] shadow-sm p-5">
  <h2 className="font-semibold text-stone-900 mb-4">กิจกรรมที่กำลังจะมาถึง (7 วัน)</h2>
  <div className="space-y-3">
    {stats.upcoming?.length === 0 && <p className="text-[12.5px] text-stone-400">ไม่มีกิจกรรมในช่วง 7 วัน</p>}
    {stats.upcoming?.map((ev) => (
      <div key={`${ev.employee_id}-${ev.kind}`} className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-stone-50 border border-stone-200 grid place-items-center text-lg">🎂</div>
        <div>
          <div className="text-[13px] font-medium text-stone-900">{ev.name_th}</div>
          <div className="text-[11.5px] text-stone-500">{ev.label} · {ev.sub}</div>
        </div>
        <div className="ml-auto text-[11px] font-mono text-stone-400">{ev.event_date}</div>
      </div>
    ))}
  </div>
</div>
```

- [x] Replace `app/app/hr/page.tsx` with full redesign (fetch `/api/hr/stats`, render all 4 sections)
- [x] Avatar component defined in-file using AVATAR_PALETTE pattern
- [x] KPI strip shows 4 cards from stats data
- [x] Attendance feed table renders `attendanceFeed` array
- [x] Pending leave queue renders `pendingLeaveQueue` array
- [x] Headcount bar chart renders `headcountByDept` array
- [x] Upcoming events renders `upcoming` array
- [x] Verify `npx tsc --noEmit` passes
**Q1/Q2/Q3:** Q1: Simple CSS bar chart pattern (flex-1 container with a width-percentage inner div) for data visualization without heavy charting libraries.

---

## Task 5: Employees API Extend + UI Redesign

### 5a. Extend /api/hr/employees

**File:** `app/api/hr/employees/route.ts`

Add to the SELECT in the GET handler:
- `u.hired_date` (already `hired_date` in DB based on HrEmployee type — expose as `hire_date` in response)
- Branch name via LEFT JOIN:

```sql
LEFT JOIN user_warehouse_assignments uwa ON uwa.user_id = u.id AND uwa.is_active = TRUE
LEFT JOIN warehouses w ON w.id = uwa.warehouse_id
```

Add `w.name AS branch_name` to SELECT.

For salary: add conditional — only include in response if `u.role === 'admin' || u.role === 'manager'` (server-side, check `sessionUser.role`).

Add query param filters:
```ts
const branch_id = url.searchParams.get('branch_id');
const employment_type = url.searchParams.get('employment_type');
// Add WHERE clauses:
// if (branch_id) conditions.push(`uwa.warehouse_id = $${idx++}`), params.push(branch_id)
// if (employment_type) conditions.push(`u.employment_type = $${idx++}`), params.push(employment_type)
```

### 5b. Create /api/hr/employees/stats

**File:** `app/api/hr/employees/stats/route.ts` (new file)

```ts
import { auth } from '@/lib/auth';
import { apiError, apiSuccess } from '@/lib/api-response';
import { pool } from '@/lib/db';

export async function GET() {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);

  const { rows } = await pool.query(`
    SELECT
      COUNT(*) FILTER (WHERE is_active = TRUE)::int AS total,
      COUNT(*) FILTER (WHERE is_active = TRUE AND hired_date >= date_trunc('month', CURRENT_DATE))::int AS new_this_month,
      ROUND(
        COUNT(*) FILTER (WHERE is_active = FALSE AND updated_at >= CURRENT_DATE - 90)::numeric /
        NULLIF(COUNT(*) FILTER (WHERE is_active = TRUE), 0) * 100, 1
      ) AS turnover_3m_pct,
      ROUND(AVG(EXTRACT(EPOCH FROM AGE(hired_date)) / 86400 / 365)::numeric, 1) AS avg_tenure_years,
      ROUND(MAX(EXTRACT(EPOCH FROM AGE(hired_date)) / 86400 / 365)::numeric, 1) AS oldest_tenure_years
    FROM users
    WHERE role NOT IN ('admin', 'superadmin')
  `);

  // Probation: employees hired within last 120 days
  const { rows: probRows } = await pool.query(`
    SELECT MIN((120 - (CURRENT_DATE - hired_date::date))::int) AS probation_days_remaining
    FROM users
    WHERE is_active = TRUE AND hired_date >= CURRENT_DATE - 120
      AND role NOT IN ('admin', 'superadmin')
  `);

  return apiSuccess({
    ...rows[0],
    probation_days_remaining: probRows[0]?.probation_days_remaining ?? null,
  });
}
```

### 5c. Redesign /app/hr/employees/page.tsx

**File:** `app/app/hr/employees/page.tsx`

Reference: `docs/design/hr-bundle/apps/hr-employees.jsx`

Structure:
```
KPI strip (4 cards from /api/hr/employees/stats)
Filter bar: search input + dept select + branch select + status select + view toggle
Table: checkbox | code | name+position+avatar | dept (colored dot) | branch | hire date | tenure | type pill | status pill | salary (admin/manager only)
Pagination
```

KPI strip:
- พนักงานทั้งหมด: `stats.total`, sub: `ทดลองงาน ${stats.probation_days_remaining} วัน`
- พนักงานใหม่เดือนนี้: `stats.new_this_month`
- Turnover 3 เดือน: `${stats.turnover_3m_pct}%`
- อายุงานเฉลี่ย: `${stats.avg_tenure_years} ปี`

Table row — tenure calculation:
```ts
function calcTenure(hireDate: string): string {
  const years = Math.floor((Date.now() - new Date(hireDate).getTime()) / (365.25 * 24 * 3600 * 1000));
  return years >= 1 ? `${years} ปี` : `< 1 ปี`;
}
```

Dept colored dot:
```tsx
<div className="flex items-center gap-2">
  <span className="w-2 h-2 rounded-full" style={{ background: DEPT_COLORS[deptIndex % DEPT_COLORS.length] }} />
  <span>{emp.department}</span>
</div>
```

Where `deptIndex` = index of this dept name in the unique sorted list of all departments in the response.

Employment type pill:
- `full_time` → `bg-stone-900 text-white` label "ประจำ"
- `part_time` → `bg-stone-100 text-stone-700 border border-stone-200` label "พาร์ทไทม์"
- `contract` → `bg-amber-50 text-amber-800 border border-amber-200` label "สัญญาจ้าง"

Status pill:
- `active` → `bg-green-50 text-green-700 border border-green-200` label "ปกติ"
- `on_leave` → `bg-blue-50 text-blue-700 border border-blue-200` label "ลา"
- `probation` → `bg-amber-50 text-amber-700 border border-amber-200` label "ทดลองงาน"
- `inactive` → `bg-stone-100 text-stone-500` label "ไม่ใช้งาน"

Salary column: only render `<th>` and `<td>` cells when session role is `admin` or `manager`. Use `useSession()` to get role client-side. If no session role, default to hidden.

- [x] Extend employees GET: add hire_date, branch_name, salary gating, branch_id + employment_type filters
- [x] Create `/api/hr/employees/stats/route.ts`
- [x] Redesign `app/app/hr/employees/page.tsx` with KPI strip, filter bar, redesigned table
- [x] Verify `npx tsc --noEmit` passes
**Q1/Q2/Q3:** Q1: Local interface extension `interface ExtendedHrEmployee extends HrEmployee` pattern for page-specific API fields.

---

## Task 6: Leave Calendar API + Management Redesign

### 6a. Create /api/hr/leave-requests/calendar

**File:** `app/api/hr/leave-requests/calendar/route.ts` (new file)

```ts
import { auth } from '@/lib/auth';
import { apiError, apiSuccess } from '@/lib/api-response';
import { pool } from '@/lib/db';
import { NextRequest } from 'next/server';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);

  const month = req.nextUrl.searchParams.get('month') ?? new Date().toISOString().slice(0, 7);
  // month = 'YYYY-MM'
  const [year, mon] = month.split('-').map(Number);
  const monthStart = new Date(year, mon - 1, 1);
  const monthEnd = new Date(year, mon, 0); // last day of month

  const LEAVE_COLORS: Record<string, string> = {
    'ลาป่วย': '#ef4444', 'ลากิจ': '#f59e0b', 'ลาพักร้อน': '#10b981',
    'ลาคลอด': '#8b5cf6', 'ลาทหาร': '#06b6d4',
  };

  const { rows: teamRows } = await pool.query(`
    SELECT DISTINCT u.id AS employee_id, u.name AS name_th,
      COALESCE(d.name_en, u.department, 'HR') AS department_name_en
    FROM users u
    LEFT JOIN departments d ON d.id = u.department_id
    WHERE u.is_active = TRUE AND u.role NOT IN ('admin', 'superadmin')
    ORDER BY u.name ASC
    LIMIT 30
  `);

  const { rows: leaveRows } = await pool.query(`
    SELECT lr.employee_id,
      GREATEST(EXTRACT(DAY FROM lr.start_date)::int, 1) AS from_day,
      LEAST(EXTRACT(DAY FROM lr.end_date)::int, $3) AS to_day,
      lt.name_th AS type
    FROM leave_requests lr
    JOIN leave_types lt ON lt.id = lr.leave_type_id
    WHERE lr.status IN ('approved', 'submitted')
      AND lr.start_date <= $2 AND lr.end_date >= $1
  `, [monthStart, monthEnd, monthEnd.getDate()]);

  const leaves = leaveRows.map((l) => ({
    ...l,
    color: LEAVE_COLORS[l.type] ?? '#6366f1',
  }));

  return apiSuccess({
    team: teamRows,
    leaves,
    month_days: monthEnd.getDate(),
    first_weekday: monthStart.getDay(),
  });
}
```

### 6b. Create /api/hr/leave-requests/stats

**File:** `app/api/hr/leave-requests/stats/route.ts` (new file)

```ts
import { auth } from '@/lib/auth';
import { apiError, apiSuccess } from '@/lib/api-response';
import { pool } from '@/lib/db';

export async function GET() {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);

  const { rows } = await pool.query(`
    SELECT
      COUNT(*) FILTER (WHERE status = 'submitted')::int AS pending,
      COUNT(*) FILTER (
        WHERE status = 'approved' AND CURRENT_DATE BETWEEN start_date AND end_date
      )::int AS on_leave_today,
      SUM(end_date - start_date + 1) FILTER (
        WHERE status = 'approved' AND date_trunc('month', start_date) = date_trunc('month', CURRENT_DATE)
      )::int AS total_days_this_month
    FROM leave_requests
  `);

  // quota_used_pct: (total approved days this year / 10 standard days per employee * num employees) * 100
  // Simplified: return 0 until quota table exists
  return apiSuccess({ ...rows[0], quota_used_pct: 0 });
}
```

### 6c. Verify PATCH /api/hr/leave-requests/[id]

Check that `app/api/hr/leave-requests/[id]/route.ts` handles `{ action: 'approve' }` and `{ action: 'reject' }`. If not, add:
```ts
if (body.action === 'approve') {
  await pool.query(`UPDATE leave_requests SET status='approved', approved_by=$2, updated_at=NOW() WHERE id=$1`, [id, u.id]);
} else if (body.action === 'reject') {
  await pool.query(`UPDATE leave_requests SET status='rejected', approved_by=$2, updated_at=NOW() WHERE id=$1`, [id, u.id]);
}
```

### 6d. Redesign /app/hr/leave-requests/page.tsx

**File:** `app/app/hr/leave-requests/page.tsx`

Reference: `docs/design/hr-bundle/apps/hr-leave.jsx`

Structure:
```
KPI strip (4 cards from /api/hr/leave-requests/stats)
Body: grid-cols-12
  Left col-4: pending leave list (selected state with border-l-4 border-stone-900)
  Right col-8:
    Detail card (selected leave): employee header + 4-col info grid + reason + Approve/Reject buttons
    Team calendar: month header + grid with employee rows + leave bars
```

State:
```ts
const [selected, setSelected] = useState<string | null>(null);
const [calMonth, setCalMonth] = useState(() => new Date().toISOString().slice(0, 7));
```

Pending list item — selected state:
```tsx
<div
  key={req.id}
  onClick={() => setSelected(req.id)}
  className={`px-4 py-3.5 cursor-pointer border-l-4 transition-colors ${
    selected === req.id ? 'border-stone-900 bg-stone-50' : 'border-transparent hover:bg-stone-50/60'
  }`}
>
```

Detail card (when `selected !== null`):
```tsx
<div className="bg-white border border-stone-200 rounded-[10px] shadow-sm p-5">
  {/* Employee header row */}
  <div className="flex items-center gap-3 mb-4">
    <Avatar name={selectedReq.employee_name_th} size={40} />
    <div>
      <div className="font-semibold text-stone-900">{selectedReq.employee_name_th}</div>
      <div className="text-[12px] text-stone-500">{selectedReq.employee_code} · {selectedReq.leave_type_name_th}</div>
    </div>
    {selectedReq.is_urgent && <span className="ml-auto px-2 py-0.5 rounded bg-red-500 text-white text-[10px] font-bold">เร่งด่วน</span>}
  </div>
  {/* 4-col info grid */}
  <div className="grid grid-cols-4 gap-4 mb-4">
    <InfoCell label="วันที่เริ่ม" value={selectedReq.start_date} />
    <InfoCell label="วันที่สิ้นสุด" value={selectedReq.end_date} />
    <InfoCell label="จำนวนวัน" value={`${selectedReq.days_requested} วัน`} />
    <InfoCell label="ผู้อนุมัติ" value={selectedReq.approver_name_th || '—'} />
  </div>
  {/* Reason */}
  {selectedReq.reason && <p className="text-[13px] text-stone-600 bg-stone-50 rounded-lg p-3 mb-4">{selectedReq.reason}</p>}
  {/* Action buttons */}
  <div className="flex gap-2">
    <button onClick={() => handleApprove(selectedReq.id, 'approve')}
      className="flex-1 h-9 rounded-md text-[13px] font-medium text-white bg-stone-900 hover:bg-stone-800">
      อนุมัติ
    </button>
    <button onClick={() => handleApprove(selectedReq.id, 'reject')}
      className="flex-1 h-9 rounded-md text-[13px] font-medium text-stone-700 bg-white border border-stone-200 hover:bg-stone-50">
      ปฏิเสธ
    </button>
  </div>
</div>
```

`handleApprove`:
```ts
async function handleApprove(id: string, action: 'approve' | 'reject') {
  await fetch(`/api/hr/leave-requests/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action }),
  });
  // Re-fetch leave requests list
  fetchLeaves();
}
```

Team calendar:
```tsx
<div className="bg-white border border-stone-200 rounded-[10px] shadow-sm overflow-hidden">
  {/* Month header + prev/next nav */}
  <div className="px-5 py-3 border-b border-stone-100 flex items-center justify-between">
    <button onClick={() => setCalMonth(prevMonth(calMonth))}>‹</button>
    <span className="font-medium text-stone-900">{formatMonthLabel(calMonth)}</span>
    <button onClick={() => setCalMonth(nextMonth(calMonth))}>›</button>
  </div>
  {/* Grid */}
  <div className="overflow-x-auto">
    <div style={{ display: 'grid', gridTemplateColumns: `160px repeat(${cal.month_days}, 30px)` }}>
      {/* Day number header row */}
      <div className="h-8 bg-stone-50 border-b border-stone-200" />
      {Array.from({ length: cal.month_days }, (_, i) => (
        <div key={i} className="h-8 bg-stone-50 border-b border-l border-stone-200 text-[10px] text-stone-500 grid place-items-center">
          {i + 1}
        </div>
      ))}
      {/* Employee rows */}
      {cal.team.map((emp) => {
        const empLeaves = cal.leaves.filter((l) => l.employee_id === emp.employee_id);
        return (
          <React.Fragment key={emp.employee_id}>
            <div className="h-9 px-3 flex items-center border-b border-stone-100 text-[12px] text-stone-700 font-medium truncate">
              {emp.name_th}
            </div>
            <div className="relative" style={{ gridColumn: `2 / span ${cal.month_days}`, height: 36 }}>
              {empLeaves.map((lv, li) => (
                <div
                  key={li}
                  className="absolute top-1 h-6 rounded-md opacity-80 text-white text-[10px] flex items-center px-1.5 overflow-hidden"
                  style={{
                    left: `${(lv.from_day - 1) * 30}px`,
                    width: `${(lv.to_day - lv.from_day + 1) * 30 - 2}px`,
                    background: lv.color,
                  }}
                >
                  {lv.type}
                </div>
              ))}
            </div>
          </React.Fragment>
        );
      })}
    </div>
  </div>
</div>
```

Helper functions:
```ts
function prevMonth(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
}
function nextMonth(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;
}
function formatMonthLabel(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  const thMonths = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
  return `${thMonths[m - 1]} ${y + 543}`;
}
```

- [x] Create `/api/hr/leave-requests/calendar/route.ts`
- [x] Create `/api/hr/leave-requests/stats/route.ts`
- [x] Verify PATCH `/api/hr/leave-requests/[id]` handles `approve` and `reject` actions (add if missing)
- [x] Redesign `app/app/hr/leave-requests/page.tsx` — KPI strip + split layout + detail card + team calendar
- [x] Verify `npx tsc --noEmit` passes

---

## Task 7: Payroll API Extend + Detail Page Redesign

### 7a. Extend /api/hr/payroll-runs/[id]

**File:** `app/api/hr/payroll-runs/[id]/route.ts`

Check existing GET response. Extend to include `rows` (per-employee breakdown) and `summary`:

Add to GET handler after existing query:
```sql
SELECT
  pl.employee_id,
  u.employee_code,
  u.name AS name_th,
  u.position,
  pl.base_salary,
  COALESCE(pl.ot_amount, 0) AS ot_amount,
  COALESCE(pl.allowance_amount, 0) AS allowance_amount,
  (pl.base_salary + COALESCE(pl.ot_amount, 0) + COALESCE(pl.allowance_amount, 0)) AS gross,
  COALESCE(pl.sso_deduction, 0) AS sso_deduction,
  COALESCE(pl.pvf_deduction, 0) AS pvf_deduction,
  COALESCE(pl.tax_deduction, 0) AS tax_deduction,
  pl.net_pay
FROM payroll_lines pl
JOIN users u ON u.id = pl.employee_id
WHERE pl.payroll_run_id = $1
ORDER BY u.name ASC
```

> **Note:** Column names in `payroll_lines` may differ. Check the existing GET handler and `PayrollLine` type in `types/index.ts` to confirm actual column names. Map to the response shape above.

Add `summary` derived from aggregating the rows:
```ts
const summary = {
  total_gross: rows.reduce((s, r) => s + r.gross, 0),
  total_sso: rows.reduce((s, r) => s + r.sso_deduction, 0),
  total_pvf: rows.reduce((s, r) => s + r.pvf_deduction, 0),
  total_tax: rows.reduce((s, r) => s + r.tax_deduction, 0),
  total_net: rows.reduce((s, r) => s + r.net_pay, 0),
  employee_count: rows.length,
  paydate: run.pay_date ?? run.updated_at, // check actual column name
  cutoff_date: run.cutoff_date ?? null,
};
```

Add `submit_review` PATCH action to the PATCH handler:
```ts
if (body.action === 'submit_review') {
  await pool.query(`UPDATE payroll_runs SET status='processing', updated_at=NOW() WHERE id=$1`, [id]);
  return apiSuccess({ ok: true });
}
```

### 7b. Redesign /app/hr/payroll/[id]/page.tsx

**File:** `app/app/hr/payroll/[id]/page.tsx`

Reference: `docs/design/hr-bundle/apps/hr-payroll.jsx`

Structure:
```
Page header (period label + status pill + action buttons)
Workflow stepper (4 steps horizontal)
KPI strip (5 cards: Gross, SSO, PVF, Tax, Net)
Filter bar (search + dept select + branch select + OT checkbox)
Payroll table (with footer totals row)
Pagination
```

Workflow stepper:
```tsx
const STEPS = [
  { key: 'draft',      label: 'ร่าง',      sub: 'รวบรวมข้อมูล' },
  { key: 'processing', label: 'ตรวจสอบ',  sub: 'ตรวจรายการ' },
  { key: 'approved',   label: 'อนุมัติ',   sub: 'ผู้บริหารเซ็น' },
  { key: 'paid',       label: 'จ่ายแล้ว',  sub: 'โอนเงิน' },
];
const stepIdx = STEPS.findIndex((s) => s.key === run.status);

// Render:
<div className="bg-white border border-stone-200 rounded-[10px] shadow-sm p-5">
  <div className="grid grid-cols-4 gap-2">
    {STEPS.map((s, i) => {
      const done = i < stepIdx;
      const current = i === stepIdx;
      return (
        <div key={s.key} className="flex items-start gap-3">
          <div className="flex flex-col items-center">
            <div className={`w-8 h-8 rounded-full grid place-items-center text-[12px] font-bold border-2 ${
              done ? 'bg-stone-900 border-stone-900 text-white' :
              current ? 'bg-white border-stone-900 text-stone-900' :
              'bg-white border-stone-200 text-stone-400'
            }`}>
              {done ? '✓' : i + 1}
            </div>
            {i < STEPS.length - 1 && <div className={`w-px h-6 ${done ? 'bg-stone-900' : 'bg-stone-200'}`} />}
          </div>
          <div className="pb-4">
            <div className={`text-[13px] font-semibold ${current ? 'text-stone-900' : done ? 'text-stone-700' : 'text-stone-400'}`}>{s.label}</div>
            <div className="text-[11.5px] text-stone-400">{s.sub}</div>
          </div>
        </div>
      );
    })}
  </div>
</div>
```

Status pill colors:
- `draft` → `bg-stone-100 text-stone-700`
- `processing` → `bg-amber-50 text-amber-800 border border-amber-200`
- `approved` → `bg-green-50 text-green-700 border border-green-200`
- `paid` → `bg-emerald-50 text-emerald-700 border border-emerald-200`
- `void` → `bg-red-50 text-red-700 border border-red-200`

Action button label by status:
- `draft` → "ส่งให้ผู้จัดการตรวจสอบ" → calls PATCH with `{ action: 'submit_review' }`
- `processing` → "ส่งให้ผู้บริหารอนุมัติ" → calls PATCH with `{ action: 'approve' }`
- `approved` → "ยืนยันการจ่ายเงิน" → calls PATCH with `{ action: 'post_to_accounting' }` (existing action)
- `paid` / `void` → button disabled

KPI strip (5 cards):
```tsx
<div className="flex bg-white border border-stone-200 rounded-[10px] shadow-sm overflow-hidden">
  <KpiCard label="ยอดรวม (Gross)" value={formatCurrency(summary.total_gross)} sub={`${summary.employee_count} คน`} />
  <KpiCard label="ประกันสังคม (5%)" value={formatCurrency(summary.total_sso)} sub="หักจากพนักงาน" />
  <KpiCard label="กองทุนสำรองฯ (3%)" value={formatCurrency(summary.total_pvf)} sub="" />
  <KpiCard label="ภาษีหัก ณ ที่จ่าย" value={formatCurrency(summary.total_tax)} sub="ภ.ง.ด.1" />
  <KpiCard label="ยอดสุทธิ (Net)" value={formatCurrency(summary.total_net)} sub={`จ่าย ${summary.paydate ?? '—'}`} accent="text-emerald-700" />
</div>
```

Table with footer:
- Columns: checkbox | code | employee+avatar | ฐานเดือน | OT | เบี้ยเลี้ยง | Gross | SSO | PVF | ภาษี | Net
- OT/allowance cells: show `—` if 0
- SSO/PVF/Tax cells: prefix `−` 
- Net: `text-emerald-700 font-bold`
- Footer `<tfoot>`: sums for all numeric columns, `colSpan={3}` for first 3 columns

Client-side filter: search by `name_th` or `employee_code` (simple string includes), dept filter matches `position` or dept if available, OT checkbox = only rows where `ot_amount > 0`.

Pagination: show 12 per page. Display `แสดง 1 – N จาก M คน` footer text.

- [x] Extend GET `/api/hr/payroll-runs/[id]` to include `rows` and `summary` (check actual column names first)
- [x] Add `submit_review` PATCH action to `/api/hr/payroll-runs/[id]`
- [x] Redesign `app/app/hr/payroll/[id]/page.tsx` with stepper + KPI + table + footer
- [x] Verify `npx tsc --noEmit` passes

---

## Acceptance Criteria

- [x] Sidebar shows 8 HR nav groups with 20 items, all links render without 404 (stubs show coming-soon page)
- [x] 13 stub pages render at their routes with "กำลังพัฒนา" badge + back link
- [x] `/api/hr/stats` returns `attendanceFeed`, `pendingLeaveQueue`, `headcountByDept`, `upcoming` arrays
- [x] `/app/hr` dashboard shows 4-card KPI strip, attendance table, leave queue, bar chart, upcoming events
- [x] `/api/hr/employees` returns `hire_date`, `branch_name`; salary only for admin/manager
- [x] `/api/hr/employees/stats` returns 5 KPI fields
- [x] `/app/hr/employees` shows redesigned table with avatar, dept dot, tenure, type/status pills
- [x] `/api/hr/leave-requests/calendar` returns team + leaves + month metadata
- [x] `/api/hr/leave-requests/stats` returns 4 KPI fields
- [x] `/app/hr/leave-requests` shows KPI strip + split layout + detail card + team calendar grid
- [x] Calendar month navigation (‹ ›) works; leave bars render with correct colors and widths
- [x] Approve/Reject buttons trigger PATCH and re-fetch pending list
- [x] `/api/hr/payroll-runs/[id]` GET returns `rows` + `summary`; PATCH handles `submit_review`
- [x] `/app/hr/payroll/[id]` shows workflow stepper, 5-card KPI, payroll table with footer totals
- [x] `npx tsc --noEmit` — zero errors
- [x] `npm run lint` — zero errors

---
## Execution Logs
- [[execution-summary]]


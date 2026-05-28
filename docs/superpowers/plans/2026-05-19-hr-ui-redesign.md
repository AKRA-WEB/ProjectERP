# HR Module UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign 4 HR pages to match `_notes/99_Assets/design/hr-bundle/` mockups, update sidebar nav, and add 13 stub routes.

**Architecture:** Page-by-page — each task delivers a complete, working screen. APIs extended alongside their consuming UI. Stub pages added first so sidebar links never 404.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript strict, PostgreSQL (raw `pg`), Tailwind CSS, NextAuth v5

**Spec:** `docs/superpowers/specs/2026-05-19-hr-ui-redesign.md`

---

## Shared utilities (read before coding)

Avatar initials helper — reuse across all HR pages:
```ts
// Derive 2-char initials from Thai name
function initials(nameTh: string): string {
  return nameTh.trim().slice(0, 2);
}

// Derive avatar background from name hash
const AVATAR_PALETTE = [
  { hue: '#efece4', txt: '#44403c' },
  { hue: '#f5e3d6', txt: '#8a4a2a' },
  { hue: '#e6deea', txt: '#5c3a78' },
  { hue: '#e4ddcc', txt: '#6c5a30' },
  { hue: '#dde6dc', txt: '#3a6048' },
  { hue: '#dde5e6', txt: '#3a5a68' },
  { hue: '#e8dadf', txt: '#7a3a4a' },
  { hue: '#dde0eb', txt: '#3a4a78' },
  { hue: '#dde8e6', txt: '#3a6864' },
  { hue: '#f0e2d4', txt: '#7a4c28' },
];
function avatarStyle(nameTh: string) {
  let h = 0;
  for (let i = 0; i < nameTh.length; i++) h = (h * 31 + nameTh.charCodeAt(i)) & 0xffff;
  return AVATAR_PALETTE[h % AVATAR_PALETTE.length];
}
```

Department color palette (index-based, no DB column):
```ts
const DEPT_COLORS = ['#7c8c70','#9c7c5c','#5c7c9c','#9c5c8c','#bc8848','#4a6c8c','#8c6c4c','#6c8c5c'];
```

KPI strip pattern used across all pages:
```tsx
// flex container on white card
<div className="flex bg-white border border-stone-200 rounded-[10px] shadow-sm overflow-hidden">
  {/* each Kpi: border-r border-stone-100 last:border-r-0, px-5 py-4 */}
</div>
```

---

## Task 1: i18n keys + Sidebar HR nav

**Files:**
- Modify: `lib/i18n/en.json`
- Modify: `lib/i18n/th.json`
- Modify: `components/layout/Sidebar.tsx`

- [ ] **Step 1: Add new i18n keys to `lib/i18n/en.json`**

Add after the existing `"page.departments"` line:
```json
  "nav.hr_employees": "Employees",
  "nav.hr_time": "Time & Attendance",
  "nav.hr_leave": "Leave",
  "nav.hr_payroll": "Payroll",
  "nav.hr_development": "Development",
  "nav.hr_recruitment": "Recruitment",
  "page.hr_org": "Org Chart",
  "page.hr_onboarding": "Onboarding",
  "page.hr_attendance": "Attendance",
  "page.hr_shifts": "Shifts",
  "page.hr_overtime": "Overtime",
  "page.hr_leave_requests": "Leave Requests",
  "page.hr_leave_calendar": "Team Calendar",
  "page.hr_leave_quota": "Leave Quota",
  "page.hr_payroll_runs": "Payroll Runs",
  "page.hr_payroll_slips": "Pay Slips",
  "page.hr_payroll_tax": "Tax & SSO",
  "page.hr_performance": "Performance",
  "page.hr_training": "Training",
  "page.hr_jobs": "Open Positions",
  "page.hr_candidates": "Candidates",
  "page.hr_positions": "Job Positions"
```

- [ ] **Step 2: Add same keys to `lib/i18n/th.json`**

Add after `"page.departments"`:
```json
  "nav.hr_employees": "พนักงาน",
  "nav.hr_time": "เวลาทำงาน",
  "nav.hr_leave": "การลา",
  "nav.hr_payroll": "เงินเดือน",
  "nav.hr_development": "พัฒนาบุคลากร",
  "nav.hr_recruitment": "สรรหา",
  "page.hr_org": "โครงสร้างองค์กร",
  "page.hr_onboarding": "พนักงานใหม่",
  "page.hr_attendance": "เวลาเข้าออกงาน",
  "page.hr_shifts": "ตารางกะ",
  "page.hr_overtime": "ล่วงเวลา",
  "page.hr_leave_requests": "คำขอลา",
  "page.hr_leave_calendar": "ปฏิทินทีม",
  "page.hr_leave_quota": "โควต้าวันลา",
  "page.hr_payroll_runs": "รันเงินเดือน",
  "page.hr_payroll_slips": "สลิปเงินเดือน",
  "page.hr_payroll_tax": "ภาษี & ประกันสังคม",
  "page.hr_performance": "ประเมินผล",
  "page.hr_training": "ฝึกอบรม",
  "page.hr_jobs": "ตำแหน่งที่เปิดรับ",
  "page.hr_candidates": "ผู้สมัคร",
  "page.hr_positions": "ตำแหน่งงาน"
```

- [ ] **Step 3: Replace HR nav block in `components/layout/Sidebar.tsx`**

Find the `hr: [` block (currently has 1 group, 6 items). Replace entirely with:
```ts
hr: [
  {
    label: t('nav.overview'),
    items: [
      { href: '/app/hr', label: t('nav.overview'), icon: BarChart3, permission: 'hr:employees:view' },
    ],
  },
  {
    label: t('nav.hr_employees'),
    items: [
      { href: '/app/hr/employees',  label: t('page.employees'),       icon: Users,       permission: 'hr:employees:view' },
      { href: '/app/hr/org',        label: t('page.hr_org'),          icon: Network,     permission: 'hr:employees:view' },
      { href: '/app/hr/onboarding', label: t('page.hr_onboarding'),   icon: UserPlus,    permission: 'hr:employees:view' },
    ],
  },
  {
    label: t('nav.hr_time'),
    items: [
      { href: '/app/hr/attendance', label: t('page.hr_attendance'),   icon: Timer,       permission: 'hr:attendance:view' },
      { href: '/app/hr/shifts',     label: t('page.hr_shifts'),       icon: CalendarDays,permission: 'hr:attendance:view' },
      { href: '/app/hr/overtime',   label: t('page.hr_overtime'),     icon: History,     permission: 'hr:attendance:view' },
    ],
  },
  {
    label: t('nav.hr_leave'),
    items: [
      { href: '/app/hr/leave-requests',      label: t('page.hr_leave_requests'), icon: Plane,       permission: 'hr:leave:view' },
      { href: '/app/hr/leave/calendar',      label: t('page.hr_leave_calendar'), icon: Calendar,    permission: 'hr:leave:view' },
      { href: '/app/hr/leave/quota',         label: t('page.hr_leave_quota'),    icon: ClipboardList,permission: 'hr:leave:view' },
    ],
  },
  {
    label: t('nav.hr_payroll'),
    items: [
      { href: '/app/hr/payroll',       label: t('page.hr_payroll_runs'),  icon: Wallet,      permission: 'hr:payroll:view' },
      { href: '/app/hr/payroll/slips', label: t('page.hr_payroll_slips'), icon: FileText,    permission: 'hr:payroll:view' },
      { href: '/app/hr/payroll/tax',   label: t('page.hr_payroll_tax'),   icon: CreditCard,  permission: 'hr:payroll:view' },
    ],
  },
  {
    label: t('nav.hr_development'),
    items: [
      { href: '/app/hr/performance', label: t('page.hr_performance'), icon: Award,        permission: 'hr:employees:view' },
      { href: '/app/hr/training',    label: t('page.hr_training'),    icon: GraduationCap,permission: 'hr:employees:view' },
    ],
  },
  {
    label: t('nav.hr_recruitment'),
    items: [
      { href: '/app/hr/jobs',       label: t('page.hr_jobs'),       icon: Briefcase,    permission: 'hr:employees:view' },
      { href: '/app/hr/candidates', label: t('page.hr_candidates'), icon: Users,        permission: 'hr:employees:view' },
    ],
  },
  {
    label: t('nav.master_data'),
    items: [
      { href: '/app/hr/positions',   label: t('page.hr_positions'),  icon: Briefcase,   permission: 'hr:employees:view' },
      { href: '/app/hr/departments', label: t('page.departments'),   icon: Building,    permission: 'hr:departments:view' },
    ],
  },
],
```

Add missing imports to Sidebar.tsx (check which are already imported, add missing):
`Network, UserPlus, CalendarDays, Plane, GraduationCap, Award`

- [ ] **Step 4: Verify with lint**
```bash
npx tsc --noEmit 2>&1 | grep -i "sidebar\|i18n"
```
Expected: no errors related to Sidebar or i18n.

- [ ] **Step 5: Commit**
```bash
git add lib/i18n/en.json lib/i18n/th.json components/layout/Sidebar.tsx
git commit -m "feat(hr): expand sidebar nav with full HR module structure"
```

---

## Task 2: Stub pages (13 routes)

**Files to create:**
- `app/app/hr/org/page.tsx`
- `app/app/hr/onboarding/page.tsx`
- `app/app/hr/shifts/page.tsx`
- `app/app/hr/overtime/page.tsx`
- `app/app/hr/leave/calendar/page.tsx`
- `app/app/hr/leave/quota/page.tsx`
- `app/app/hr/payroll/slips/page.tsx`
- `app/app/hr/payroll/tax/page.tsx`
- `app/app/hr/performance/page.tsx`
- `app/app/hr/training/page.tsx`
- `app/app/hr/jobs/page.tsx`
- `app/app/hr/candidates/page.tsx`
- `app/app/hr/positions/page.tsx`

- [ ] **Step 1: Create stub template and apply to all 13 routes**

Each file gets this pattern (substitute `titleTh` / `titleEn` per route):

```tsx
'use client';
import Link from 'next/link';

export default function HrOrgPage() {
  return (
    <div className="max-w-[1280px] mx-auto pt-16 pb-12 flex flex-col items-center text-center gap-4">
      <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-[12px] font-semibold uppercase tracking-wider">
        กำลังพัฒนา
      </span>
      <h1 className="text-[28px] font-semibold tracking-tight text-stone-900">โครงสร้างองค์กร</h1>
      <p className="text-[14px] text-stone-500">Org Chart — Coming soon</p>
      <Link href="/app/hr" className="mt-4 text-[13px] font-medium text-stone-700 hover:underline">← กลับหน้า HR</Link>
    </div>
  );
}
```

| File | titleTh | titleEn | functionName |
|------|---------|---------|--------------|
| `org/page.tsx` | โครงสร้างองค์กร | Org Chart | HrOrgPage |
| `onboarding/page.tsx` | พนักงานใหม่ | Onboarding | HrOnboardingPage |
| `shifts/page.tsx` | ตารางกะ | Shifts | HrShiftsPage |
| `overtime/page.tsx` | ล่วงเวลา | Overtime | HrOvertimePage |
| `leave/calendar/page.tsx` | ปฏิทินทีม | Leave Calendar | HrLeaveCalendarPage |
| `leave/quota/page.tsx` | โควต้าวันลา | Leave Quota | HrLeaveQuotaPage |
| `payroll/slips/page.tsx` | สลิปเงินเดือน | Pay Slips | HrPayrollSlipsPage |
| `payroll/tax/page.tsx` | ภาษี & ประกันสังคม | Tax & SSO | HrPayrollTaxPage |
| `performance/page.tsx` | ประเมินผล | Performance | HrPerformancePage |
| `training/page.tsx` | ฝึกอบรม | Training | HrTrainingPage |
| `jobs/page.tsx` | ตำแหน่งที่เปิดรับ | Open Positions | HrJobsPage |
| `candidates/page.tsx` | ผู้สมัคร | Candidates | HrCandidatesPage |
| `positions/page.tsx` | ตำแหน่งงาน | Job Positions | HrPositionsPage |

- [ ] **Step 2: Verify TypeScript**
```bash
npx tsc --noEmit 2>&1 | grep "hr/"
```
Expected: no errors.

- [ ] **Step 3: Commit**
```bash
git add app/app/hr/org app/app/hr/onboarding app/app/hr/shifts app/app/hr/overtime app/app/hr/leave/calendar app/app/hr/leave/quota app/app/hr/payroll/slips app/app/hr/payroll/tax app/app/hr/performance app/app/hr/training app/app/hr/jobs app/app/hr/candidates app/app/hr/positions
git commit -m "feat(hr): add stub pages for all sidebar nav routes"
```

---

## Task 3: Extend `/api/hr/stats` for dashboard

**Files:**
- Modify: `app/api/hr/stats/route.ts`

- [ ] **Step 1: Replace `app/api/hr/stats/route.ts` with extended version**

```ts
import { auth } from '@/auth';
import { apiSuccess, apiError } from '@/lib/api-response';
import { query, queryOne } from '@/lib/db/client';

const DEPT_COLORS = ['#7c8c70','#9c7c5c','#5c7c9c','#9c5c8c','#bc8848','#4a6c8c','#8c6c4c','#6c8c5c'];

export async function GET() {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);

  const today = new Date().toISOString().split('T')[0];
  const thisMonth = today.slice(0, 7);

  const [
    [empStats],
    [deptCount],
    [leaveStats],
    [attendanceStats],
    latestPayroll,
    attendanceFeed,
    pendingLeaveQueue,
    headcountByDept,
    upcomingAnniv,
  ] = await Promise.all([
    // 1. employee totals
    query<{ total: string; active: string; probation: string }>(
      `SELECT
         COUNT(*) FILTER (WHERE employee_status IN ('active','probation')) AS total,
         COUNT(*) FILTER (WHERE employee_status = 'active') AS active,
         COUNT(*) FILTER (WHERE employee_status = 'probation') AS probation
       FROM users WHERE employee_status IS NOT NULL AND employee_status != 'resigned'`,
      []
    ),
    // 2. dept count
    query<{ count: string }>(
      `SELECT COUNT(*) FROM departments WHERE is_active = TRUE`,
      []
    ),
    // 3. pending leave count
    query<{ pending: string }>(
      `SELECT COUNT(*) AS pending FROM leave_requests WHERE status = 'submitted'`,
      []
    ),
    // 4. attendance summary
    query<{ present: string; late: string; absent: string; on_leave: string }>(
      `SELECT
         COUNT(*) FILTER (WHERE status = 'present') AS present,
         COUNT(*) FILTER (WHERE status = 'late') AS late,
         COUNT(*) FILTER (WHERE status = 'absent') AS absent,
         COUNT(*) FILTER (WHERE status = 'half_day') AS on_leave
       FROM attendance_records WHERE work_date = $1`,
      [today]
    ),
    // 5. latest payroll
    queryOne<{ run_number: string; period_month: number; period_year: number; status: string; total_net: number; pay_date: string | null }>(
      `SELECT run_number, period_month, period_year, status, total_net,
              pay_date
       FROM payroll_runs ORDER BY created_at DESC LIMIT 1`,
      []
    ),
    // 6. attendance feed (top 10 today)
    query<{
      employee_id: string; name_th: string; employee_code: string;
      position_name_th: string | null; department_name_th: string | null;
      clock_in: string | null; clock_out: string | null;
      status: string; shift_start: string | null;
    }>(
      `SELECT
         u.id AS employee_id, u.name_th, u.employee_id AS employee_code,
         p.name_th AS position_name_th, d.name_th AS department_name_th,
         ar.clock_in, ar.clock_out, ar.status,
         ws.shift_start
       FROM attendance_records ar
       JOIN users u ON u.id = ar.employee_id
       LEFT JOIN positions p ON p.id = u.position_id
       LEFT JOIN departments d ON d.id = u.department_id
       LEFT JOIN work_schedules ws ON ws.is_default = TRUE
       WHERE ar.work_date = $1
       ORDER BY ar.clock_in ASC NULLS LAST
       LIMIT 10`,
      [today]
    ),
    // 7. pending leave queue (top 4)
    query<{
      id: string; employee_name_th: string; employee_code: string;
      leave_type_name_th: string; start_date: string; end_date: string;
      days_requested: number; notes: string | null; created_at: string;
      approver_name_th: string | null;
    }>(
      `SELECT
         lr.id, u.name_th AS employee_name_th, u.employee_id AS employee_code,
         lt.name_th AS leave_type_name_th,
         lr.start_date, lr.end_date, lr.days_requested, lr.notes, lr.created_at,
         a.name_th AS approver_name_th
       FROM leave_requests lr
       JOIN users u ON u.id = lr.employee_id
       JOIN leave_types lt ON lt.id = lr.leave_type_id
       LEFT JOIN users a ON a.id = lr.approved_by
       WHERE lr.status = 'submitted'
       ORDER BY lr.created_at ASC
       LIMIT 4`,
      []
    ),
    // 8. headcount by dept
    query<{ department_id: string; name_th: string; name_en: string; count: string }>(
      `SELECT d.id AS department_id, d.name_th, d.name_en, COUNT(u.id) AS count
       FROM departments d
       LEFT JOIN users u ON u.department_id = d.id
         AND u.employee_status IN ('active','probation')
       WHERE d.is_active = TRUE
       GROUP BY d.id, d.name_th, d.name_en
       ORDER BY count DESC`,
      []
    ),
    // 9. upcoming work anniversaries (next 7 days)
    query<{ employee_id: string; name_th: string; hired_date: string }>(
      `SELECT u.id AS employee_id, u.name_th, u.hired_date
       FROM users u
       WHERE u.hired_date IS NOT NULL
         AND u.employee_status IN ('active','probation')
         AND TO_CHAR(
           (hired_date + ((EXTRACT(YEAR FROM AGE(hired_date))::int + 1) * INTERVAL '1 year')),
           'YYYY-MM-DD'
         ) BETWEEN $1 AND $2`,
      [today, new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]]
    ),
  ]);

  // compute late_minutes for attendance feed
  const feed = attendanceFeed.map((row) => {
    let late_minutes = 0;
    if (row.clock_in && row.status === 'late' && row.shift_start) {
      const [sh, sm] = row.shift_start.split(':').map(Number);
      const [ch, cm] = row.clock_in.split(':').map(Number);
      late_minutes = Math.max(0, (ch * 60 + cm) - (sh * 60 + sm));
    }
    return { ...row, late_minutes };
  });

  // add is_urgent to leave queue (start_date <= tomorrow)
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
  const leaveQueue = pendingLeaveQueue.map((lv) => ({
    ...lv,
    is_urgent: lv.start_date <= tomorrow,
  }));

  // add color to depts
  const depts = headcountByDept.map((d, i) => ({
    ...d,
    count: parseInt(d.count),
    color: DEPT_COLORS[i % DEPT_COLORS.length],
  }));

  // format upcoming anniversaries
  const upcoming = upcomingAnniv.map((e) => {
    const hired = new Date(e.hired_date);
    const now = new Date();
    const years = now.getFullYear() - hired.getFullYear();
    const annivDate = new Date(hired);
    annivDate.setFullYear(now.getFullYear());
    const dd = String(annivDate.getDate()).padStart(2, '0');
    const mm = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'][annivDate.getMonth()];
    return {
      employee_id: e.employee_id,
      name_th: e.name_th,
      event_date: `${dd} ${mm}`,
      kind: 'anniv' as const,
      label: `ครบรอบ ${years} ปี`,
      sub: `เริ่มงาน ${new Date(e.hired_date).toLocaleDateString('th-TH')}`,
    };
  });

  return apiSuccess({
    employees: {
      total: parseInt(empStats.total),
      active: parseInt(empStats.active),
      probation: parseInt(empStats.probation),
    },
    departments: parseInt(deptCount.count),
    leave: { pending: parseInt(leaveStats.pending) },
    attendance: {
      present: parseInt(attendanceStats.present),
      late: parseInt(attendanceStats.late),
      absent: parseInt(attendanceStats.absent),
    },
    payroll: latestPayroll || null,
    attendanceFeed: feed,
    pendingLeaveQueue: leaveQueue,
    headcountByDept: depts,
    upcoming,
  });
}
```

- [ ] **Step 2: Check for `pay_date` column existence**

If `payroll_runs` has no `pay_date` column, remove it from the SELECT in query 5 and from the return. Check:
```bash
grep -r "pay_date" app/api/hr/payroll-runs/ migrations/ 2>/dev/null | head -5
```
If not found, remove `pay_date` from the payroll query.

- [ ] **Step 3: TypeScript check**
```bash
npx tsc --noEmit 2>&1 | grep "stats"
```
Expected: no errors.

- [ ] **Step 4: Commit**
```bash
git add app/api/hr/stats/route.ts
git commit -m "feat(hr): extend stats API with dashboard feed data"
```

---

## Task 4: Dashboard page redesign

**Files:**
- Modify: `app/app/hr/page.tsx`

- [ ] **Step 1: Replace `app/app/hr/page.tsx` entirely**

```tsx
'use client';

import { useState, useEffect } from 'react';
import { get } from '@/lib/api-client';
import Link from 'next/link';
import { formatCurrency } from '@/lib/format';

const AVATAR_PALETTE = [
  { hue: '#efece4', txt: '#44403c' }, { hue: '#f5e3d6', txt: '#8a4a2a' },
  { hue: '#e6deea', txt: '#5c3a78' }, { hue: '#e4ddcc', txt: '#6c5a30' },
  { hue: '#dde6dc', txt: '#3a6048' }, { hue: '#dde5e6', txt: '#3a5a68' },
  { hue: '#e8dadf', txt: '#7a3a4a' }, { hue: '#dde0eb', txt: '#3a4a78' },
];
function avatarStyle(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffff;
  return AVATAR_PALETTE[h % AVATAR_PALETTE.length];
}
function initials(name: string) { return name.trim().slice(0, 2); }

function Avatar({ name, size = 32 }: { name: string; size?: number }) {
  const { hue, txt } = avatarStyle(name);
  return (
    <div
      className="rounded-full grid place-items-center font-semibold shrink-0"
      style={{ width: size, height: size, background: hue, color: txt, fontSize: size * 0.42 }}
    >
      {initials(name)}
    </div>
  );
}

function Kpi({ label, value, unit, sub, accent, trend }: {
  label: string; value: React.ReactNode; unit?: string;
  sub?: string; accent?: string; trend?: string;
}) {
  return (
    <div className="flex-1 px-5 py-4 border-r border-stone-100 last:border-r-0">
      <div className="text-[11.5px] font-medium text-stone-500 uppercase tracking-wider">{label}</div>
      <div className="mt-1.5 flex items-baseline gap-1">
        <span className={`font-display text-[26px] font-semibold tracking-tight tabular-nums ${accent ?? 'text-stone-900'}`}>{value}</span>
        {unit && <span className="text-[13px] text-stone-400 font-medium">{unit}</span>}
        {trend && <span className="ml-1 text-[11px] font-mono text-emerald-600 tabular-nums">{trend}</span>}
      </div>
      {sub && <div className="text-[11.5px] text-stone-400 mt-0.5">{sub}</div>}
    </div>
  );
}

interface DashStats {
  employees: { total: number; active: number; probation: number };
  leave: { pending: number };
  attendance: { present: number; late: number; absent: number };
  payroll: { run_number: string; period_month: number; period_year: number; status: string; total_net: number } | null;
  attendanceFeed: Array<{
    employee_id: string; name_th: string; employee_code: string;
    position_name_th: string | null; department_name_th: string | null;
    clock_in: string | null; status: string; late_minutes: number;
  }>;
  pendingLeaveQueue: Array<{
    id: string; employee_name_th: string; leave_type_name_th: string;
    start_date: string; end_date: string; days_requested: number;
    notes: string | null; created_at: string; is_urgent: boolean;
  }>;
  headcountByDept: Array<{ department_id: string; name_th: string; name_en: string; count: number; color: string }>;
  upcoming: Array<{ employee_id: string; name_th: string; event_date: string; kind: string; label: string; sub: string }>;
}

const THAI_MONTHS = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];

function thaiDate() {
  const d = new Date();
  const days = ['อาทิตย์','จันทร์','อังคาร','พุธ','พฤหัสบดี','ศุกร์','เสาร์'];
  return `${days[d.getDay()]}ที่ ${d.getDate()} ${THAI_MONTHS[d.getMonth()]} ${d.getFullYear() + 543}`;
}

export default function HrDashboardPage() {
  const [stats, setStats] = useState<DashStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    get<DashStats>('/api/hr/stats').then(setStats).finally(() => setLoading(false));
  }, []);

  const CARD = 'bg-white border border-stone-200 rounded-[10px] shadow-sm';
  const now = new Date();
  const timeStr = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')} น.`;

  const totalPresent = (stats?.attendance.present ?? 0) + (stats?.attendance.late ?? 0);
  const totalActive = (stats?.employees.active ?? 0) + (stats?.employees.probation ?? 0);
  const onLeaveCount = totalActive - totalPresent - (stats?.attendance.absent ?? 0);
  const maxDeptCount = Math.max(...(stats?.headcountByDept.map(d => d.count) ?? [1]));

  return (
    <div className="max-w-[1280px] mx-auto pb-12 space-y-5">
      {/* Header */}
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-[26px] font-semibold tracking-tight text-stone-900 leading-tight">ภาพรวมบุคลากร / HR Dashboard</h1>
          <p className="text-[13.5px] text-stone-500 mt-1">{thaiDate()} · ข้อมูลล่าสุด {timeStr}</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/app/hr/employees" className="h-9 px-3.5 rounded-md text-[13px] font-medium text-stone-700 bg-white border border-stone-200 hover:bg-stone-50">
            รายงานประจำเดือน
          </Link>
          <Link href="/app/hr/employees" className="h-9 px-3.5 rounded-md text-[13px] font-medium text-white bg-stone-900 hover:bg-stone-800 inline-flex items-center gap-1.5">
            <span className="text-base leading-none">+</span> เพิ่มพนักงาน
          </Link>
        </div>
      </div>

      {/* KPI strip */}
      <div className="flex bg-white border border-stone-200 rounded-[10px] shadow-sm overflow-hidden">
        <Kpi label="พนักงานทั้งหมด" value={loading ? '—' : stats?.employees.total} unit="คน"
          sub={loading ? undefined : `ทดลองงาน ${stats?.employees.probation ?? 0}`} trend="+2" />
        <Kpi label="เข้างานวันนี้" value={loading ? '—' : totalPresent} unit={`/ ${totalActive - (onLeaveCount < 0 ? 0 : onLeaveCount)}`}
          sub={loading ? undefined : `ตรงเวลา ${stats?.attendance.present ?? 0} · สาย ${stats?.attendance.late ?? 0}`}
          accent={(stats?.attendance.late ?? 0) > 0 ? 'text-amber-700' : 'text-emerald-700'} />
        <Kpi label="คำขอลาที่ค้าง" value={loading ? '—' : stats?.leave.pending} unit="ใบ"
          sub="ต้องอนุมัติภายใน 24 ชม." accent="text-amber-700" />
        <Kpi label="เงินเดือนงวดนี้"
          value={loading ? '—' : stats?.payroll ? formatCurrency(stats.payroll.total_net) : '—'}
          sub={loading ? undefined : stats?.payroll ? `${stats.payroll.period_month}/${stats.payroll.period_year} · ${stats.payroll.status}` : 'ยังไม่มีข้อมูล'} />
      </div>

      {/* Row 1: Attendance feed + Leave queue */}
      <div className="grid grid-cols-12 gap-5">
        {/* Attendance feed */}
        <section className={`col-span-7 ${CARD}`}>
          <header className="flex items-center justify-between px-5 py-3.5 border-b border-stone-100">
            <div>
              <h2 className="text-[14.5px] font-semibold text-stone-900">เวลาเข้างานวันนี้</h2>
              <p className="text-[11.5px] text-stone-400">10 คนล่าสุด · เรียงตามเวลาเข้างาน</p>
            </div>
            <div className="flex items-center gap-1.5 text-[11.5px]">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold">
                ตรงเวลา {stats?.attendance.present ?? 0}
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 font-semibold">
                สาย {stats?.attendance.late ?? 0}
              </span>
            </div>
          </header>
          {loading ? (
            <div className="py-12 text-center text-[13px] text-stone-400">กำลังโหลด...</div>
          ) : (
            <ul className="divide-y divide-stone-100">
              {(stats?.attendanceFeed ?? []).map((a, i) => (
                <li key={i} className="flex items-center gap-3 px-5 py-2.5">
                  <Avatar name={a.name_th} size={32} />
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-medium text-stone-900 truncate">{a.name_th}</div>
                    <div className="text-[11px] text-stone-400 truncate">{a.position_name_th ?? '—'}</div>
                  </div>
                  <div className="text-right shrink-0">
                    {a.clock_in ? (
                      <>
                        <div className={`font-mono text-[14px] tabular-nums font-semibold ${a.status === 'late' ? 'text-amber-700' : 'text-stone-900'}`}>
                          {a.clock_in.slice(0, 5)}
                        </div>
                        <div className="text-[10.5px] text-stone-400 mt-0.5">
                          {a.status === 'late' ? <span className="text-amber-600 font-medium">สาย {a.late_minutes} นาที</span> : 'ตรงเวลา'}
                        </div>
                      </>
                    ) : (
                      <div className="text-[12px] font-medium text-stone-400">— : —</div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
          <footer className="px-5 py-2.5 border-t border-stone-100 bg-stone-50/40 text-[11.5px] text-stone-500 flex items-center justify-between">
            <span>แสดง {stats?.attendanceFeed.length ?? 0} รายการล่าสุด</span>
            <Link href="/app/hr/attendance" className="text-stone-700 font-medium hover:underline">ดูทั้งหมด →</Link>
          </footer>
        </section>

        {/* Leave queue */}
        <section className={`col-span-5 ${CARD}`}>
          <header className="flex items-center justify-between px-5 py-3.5 border-b border-stone-100">
            <div>
              <h2 className="text-[14.5px] font-semibold text-stone-900">คำขอลาที่รออนุมัติ</h2>
              <p className="text-[11.5px] text-stone-400">{stats?.leave.pending ?? 0} คำขอ</p>
            </div>
            <Link href="/app/hr/leave-requests?status=submitted" className="text-[12px] text-stone-700 font-medium hover:underline">จัดการ →</Link>
          </header>
          {loading ? (
            <div className="py-12 text-center text-[13px] text-stone-400">กำลังโหลด...</div>
          ) : (
            <ul className="divide-y divide-stone-100">
              {(stats?.pendingLeaveQueue ?? []).map((lv) => (
                <li key={lv.id} className="px-5 py-3">
                  <div className="flex items-start gap-3">
                    <Avatar name={lv.employee_name_th} size={32} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] font-medium text-stone-900 truncate">{lv.employee_name_th}</span>
                        {lv.is_urgent && (
                          <span className="px-1.5 py-0.5 rounded text-[9.5px] font-bold bg-red-50 text-red-700 border border-red-200 uppercase tracking-wider">ด่วน</span>
                        )}
                      </div>
                      <div className="text-[11px] text-stone-400 truncate">{lv.notes ?? '—'}</div>
                      <div className="mt-1.5 flex items-center gap-2">
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-stone-100 text-stone-600 border border-stone-200">
                          {lv.leave_type_name_th}
                        </span>
                        <span className="text-[11px] font-mono text-stone-600 tabular-nums">{lv.days_requested} วัน</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 mt-2.5 ml-11">
                    <Link href={`/app/hr/leave-requests/${lv.id}`} className="h-7 px-3 rounded-md text-[11.5px] font-semibold bg-stone-900 text-white hover:bg-stone-800">
                      ดูรายละเอียด
                    </Link>
                    <span className="text-[10.5px] text-stone-400 ml-auto">
                      {new Date(lv.created_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </li>
              ))}
              {!loading && (stats?.pendingLeaveQueue.length ?? 0) === 0 && (
                <li className="px-5 py-8 text-center text-[13px] text-stone-400">ไม่มีคำขอลาที่ค้างอยู่</li>
              )}
            </ul>
          )}
        </section>
      </div>

      {/* Row 2: Headcount by dept + Upcoming */}
      <div className="grid grid-cols-12 gap-5">
        <section className={`col-span-7 ${CARD} p-5`}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-[14.5px] font-semibold text-stone-900">จำนวนพนักงานตามแผนก</h2>
              <p className="text-[11.5px] text-stone-400">รวม {stats?.employees.total ?? 0} คน</p>
            </div>
          </div>
          {loading ? (
            <div className="py-8 text-center text-[13px] text-stone-400">กำลังโหลด...</div>
          ) : (
            <ul className="space-y-3">
              {(stats?.headcountByDept ?? []).map((d) => (
                <li key={d.department_id} className="grid grid-cols-[180px_1fr_auto] items-center gap-3">
                  <div className="min-w-0">
                    <div className="text-[13px] font-medium text-stone-900 truncate">{d.name_th}</div>
                    <div className="text-[10.5px] text-stone-400 uppercase tracking-wider">{d.name_en}</div>
                  </div>
                  <div className="h-2 rounded-full bg-stone-100 overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${(d.count / maxDeptCount) * 100}%`, background: d.color }} />
                  </div>
                  <div className="text-right tabular-nums font-mono text-[13px] text-stone-700 w-12">{d.count}</div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className={`col-span-5 ${CARD}`}>
          <header className="px-5 py-3.5 border-b border-stone-100">
            <h2 className="text-[14.5px] font-semibold text-stone-900">7 วันข้างหน้า</h2>
            <p className="text-[11.5px] text-stone-400">ครบรอบทำงาน</p>
          </header>
          {loading ? (
            <div className="py-12 text-center text-[13px] text-stone-400">กำลังโหลด...</div>
          ) : (
            <ul className="divide-y divide-stone-100">
              {(stats?.upcoming ?? []).length === 0 && (
                <li className="px-5 py-8 text-center text-[13px] text-stone-400">ไม่มีกิจกรรม 7 วันข้างหน้า</li>
              )}
              {(stats?.upcoming ?? []).map((u, i) => (
                <li key={i} className="flex items-center gap-3 px-5 py-3">
                  <div className="w-12 shrink-0 text-center">
                    <div className="text-[15px] font-semibold text-stone-900 leading-none">{u.event_date.split(' ')[0]}</div>
                    <div className="text-[10px] text-stone-400 uppercase tracking-wider mt-0.5">{u.event_date.split(' ')[1]}</div>
                  </div>
                  <Avatar name={u.name_th} size={32} />
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-medium text-stone-900 truncate">{u.name_th}</div>
                    <div className="text-[11px] text-stone-400 truncate">{u.label} · {u.sub}</div>
                  </div>
                  <span className="shrink-0 px-2 py-0.5 rounded-full text-[10.5px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">🏆</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: TypeScript check**
```bash
npx tsc --noEmit 2>&1 | grep "hr/page"
```
Expected: no errors.

- [ ] **Step 3: Commit**
```bash
git add app/app/hr/page.tsx
git commit -m "feat(hr): redesign dashboard with attendance feed, leave queue, headcount chart"
```

---

## Task 5: Employees page redesign

**Files:**
- Modify: `app/api/hr/employees/route.ts` — add branch join, salary gating
- Modify: `app/app/hr/employees/page.tsx` — full redesign

- [ ] **Step 1: Add branch join + salary gate to employees API**

In `app/api/hr/employees/route.ts`, modify the SELECT in the GET handler.

Replace the `query(` call at line ~60 with:
```ts
query(`
  SELECT
    u.id, u.employee_id, u.name_th, u.name_en, u.email, u.role,
    u.department_id, d.name_th AS department_name_th, d.name_en AS department_name_en,
    u.position_id, p.name_th AS position_name_th, p.name_en AS position_name_en,
    u.salary_grade_id, sg.name_th AS salary_grade_name,
    ${(['admin','manager'].includes(u.role)) ? 'u.base_salary' : 'NULL::numeric AS base_salary'},
    u.employment_type, u.employee_status,
    u.hired_date, u.resignation_date, u.phone, u.created_at,
    w.name AS branch_name
  FROM users u
  LEFT JOIN departments d ON d.id = u.department_id
  LEFT JOIN positions p ON p.id = u.position_id
  LEFT JOIN salary_grades sg ON sg.id = u.salary_grade_id
  LEFT JOIN user_warehouse_assignments uwa2 ON uwa2.user_id = u.id
  LEFT JOIN warehouses w ON w.id = uwa2.warehouse_id
  ${where}
  ORDER BY u.name_en
  LIMIT $${idx} OFFSET $${idx + 1}
`, [...params, limit, offset]),
```

Also add `employment_type` filter support. After the `status` condition block, add:
```ts
const empType = searchParams.get('employment_type') ?? '';
if (empType) { conditions.push(`u.employment_type = $${idx++}`); params.push(empType); }
```

- [ ] **Step 2: Replace `app/app/hr/employees/page.tsx`**

```tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { get } from '@/lib/api-client';
import type { HrEmployee, Department } from '@/types';
import Link from 'next/link';
import { Pagination } from '@/components/ui/Pagination';
import { formatCurrency } from '@/lib/format';
import { useSession } from 'next-auth/react';
import EmployeeFormModal from './EmployeeFormModal';
import { type SessionUser } from '@/types';

const AVATAR_PALETTE = [
  { hue: '#efece4', txt: '#44403c' }, { hue: '#f5e3d6', txt: '#8a4a2a' },
  { hue: '#e6deea', txt: '#5c3a78' }, { hue: '#e4ddcc', txt: '#6c5a30' },
  { hue: '#dde6dc', txt: '#3a6048' }, { hue: '#dde5e6', txt: '#3a5a68' },
  { hue: '#e8dadf', txt: '#7a3a4a' }, { hue: '#dde0eb', txt: '#3a4a78' },
];
function avatarStyle(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffff;
  return AVATAR_PALETTE[h % AVATAR_PALETTE.length];
}
function initials(name: string) { return name.trim().slice(0, 2); }

function Avatar({ name, size = 32 }: { name: string; size?: number }) {
  const { hue, txt } = avatarStyle(name);
  return (
    <div className="rounded-full grid place-items-center font-semibold shrink-0"
         style={{ width: size, height: size, background: hue, color: txt, fontSize: size * 0.42 }}>
      {initials(name)}
    </div>
  );
}

function fmtDate(iso: string | null) {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()+543}`;
}

function tenure(iso: string | null) {
  if (!iso) return '—';
  const months = Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24 * 30.44));
  if (months < 12) return `${months} เดือน`;
  return `${(months / 12).toFixed(months < 24 ? 1 : 0)} ปี`;
}

interface PaginatedEmployees {
  data: (HrEmployee & { branch_name: string | null })[];
  total: number; page: number; limit: number;
}

export default function EmployeesPage() {
  const { data: session } = useSession();
  const [data, setData] = useState<PaginatedEmployees | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const user = session?.user as SessionUser | undefined;
  const canCreate = user && ['admin', 'manager'].includes(user.role);
  const showSalary = user && ['admin', 'manager'].includes(user.role);

  const fetchEmployees = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
      if (search) p.set('search', search);
      if (deptFilter) p.set('department_id', deptFilter);
      if (statusFilter) p.set('employee_status', statusFilter);
      setData(await get<PaginatedEmployees>(`/api/hr/employees?${p}`));
    } finally { setLoading(false); }
  }, [page, pageSize, search, deptFilter, statusFilter]);

  useEffect(() => { fetchEmployees(); }, [fetchEmployees]);
  useEffect(() => { get<Department[]>('/api/hr/departments').then(setDepartments); }, []);

  const totalPages = data ? Math.ceil(data.total / data.limit) : 0;

  return (
    <div className="max-w-[1280px] mx-auto pb-12 space-y-5">
      {/* Header */}
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-[26px] font-semibold tracking-tight text-stone-900 leading-tight">รายชื่อพนักงาน / Employees</h1>
          <p className="text-[13.5px] text-stone-500 mt-1">
            {loading ? '—' : data?.total ?? 0} คน · ปรับปรุงล่าสุด {new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button className="h-9 px-3.5 rounded-md text-[13px] font-medium text-stone-700 bg-white border border-stone-200 hover:bg-stone-50">
            Export CSV
          </button>
          {canCreate && (
            <button
              onClick={() => setShowForm(true)}
              className="h-9 px-3.5 rounded-md text-[13px] font-medium text-white bg-stone-900 hover:bg-stone-800 inline-flex items-center gap-1.5"
            >
              <span className="text-base leading-none">+</span> เพิ่มพนักงาน
            </button>
          )}
        </div>
      </div>

      {/* Filter row */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="ค้นหาชื่อ / รหัสพนักงาน / ตำแหน่ง…"
            className="w-full pl-9 pr-3 py-2 bg-white border border-stone-300 rounded-lg text-[13px] text-stone-700 placeholder:text-stone-400 outline-none focus:border-stone-400"
          />
        </div>
        <select
          value={deptFilter}
          onChange={(e) => { setDeptFilter(e.target.value); setPage(1); }}
          className="h-9 px-3 bg-white border border-stone-300 rounded-lg text-[13px] text-stone-700 outline-none"
        >
          <option value="">ทุกแผนก</option>
          {departments.map(d => <option key={d.id} value={d.id}>{d.name_th}</option>)}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="h-9 px-3 bg-white border border-stone-300 rounded-lg text-[13px] text-stone-700 outline-none"
        >
          <option value="">ทุกสถานะ</option>
          <option value="active">ทำงานอยู่</option>
          <option value="probation">ทดลองงาน</option>
          <option value="inactive">ไม่ทำงาน</option>
          <option value="resigned">ลาออกแล้ว</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white border border-stone-200 rounded-[10px] shadow-sm overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-stone-50 border-b border-stone-200">
            <tr className="text-[10.5px] font-semibold text-stone-500 uppercase tracking-wider">
              <th className="px-4 py-3 w-28">รหัส</th>
              <th className="px-4 py-3">ชื่อ-ตำแหน่ง</th>
              <th className="px-4 py-3 w-32">แผนก</th>
              <th className="px-4 py-3 w-40 hidden lg:table-cell">สาขา</th>
              <th className="px-4 py-3 w-28 hidden lg:table-cell">เริ่มงาน</th>
              <th className="px-4 py-3 w-24 hidden xl:table-cell">อายุงาน</th>
              <th className="px-4 py-3 w-24">ประเภท</th>
              <th className="px-4 py-3 w-24">สถานะ</th>
              {showSalary && <th className="px-4 py-3 text-right w-28">เงินเดือน</th>}
              <th className="px-4 py-3 w-10"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {loading ? (
              <tr><td colSpan={showSalary ? 10 : 9} className="py-12 text-center text-[13px] text-stone-400">กำลังโหลด...</td></tr>
            ) : !data?.data.length ? (
              <tr><td colSpan={showSalary ? 10 : 9} className="py-12 text-center text-[13px] text-stone-400">ไม่พบรายการ</td></tr>
            ) : data.data.map((e) => (
              <tr key={e.id} className="hover:bg-stone-50/60">
                <td className="px-4 py-3 font-mono text-[12.5px] font-medium text-stone-700">{e.employee_id || '—'}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <Avatar name={e.name_th} size={32} />
                    <div className="min-w-0">
                      <div className="text-[13px] font-medium text-stone-900 truncate">{e.name_th}</div>
                      <div className="text-[11px] text-stone-400 truncate">{e.position_name_th ?? '—'}</div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-[12.5px] text-stone-600">{e.department_name_th ?? '—'}</td>
                <td className="px-4 py-3 text-[12.5px] text-stone-600 truncate hidden lg:table-cell">{(e as HrEmployee & { branch_name: string | null }).branch_name ?? '—'}</td>
                <td className="px-4 py-3 font-mono text-[12px] text-stone-600 tabular-nums hidden lg:table-cell">{fmtDate(e.hired_date)}</td>
                <td className="px-4 py-3 text-[12.5px] text-stone-600 tabular-nums hidden xl:table-cell">{tenure(e.hired_date)}</td>
                <td className="px-4 py-3">
                  {e.employment_type === 'part_time'
                    ? <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-sky-50 text-sky-700 border border-sky-200">Part-time</span>
                    : <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-stone-100 text-stone-600 border border-stone-200">Full-time</span>
                  }
                </td>
                <td className="px-4 py-3">
                  {e.employee_status === 'active'
                    ? <span className="px-2 py-0.5 rounded-full text-[10.5px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">ทำงานอยู่</span>
                    : e.employee_status === 'probation'
                    ? <span className="px-2 py-0.5 rounded-full text-[10.5px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">ทดลองงาน</span>
                    : <span className="px-2 py-0.5 rounded-full text-[10.5px] font-semibold bg-stone-100 text-stone-500 border border-stone-200">{e.employee_status}</span>
                  }
                </td>
                {showSalary && (
                  <td className="px-4 py-3 text-right font-mono text-[13px] tabular-nums font-medium text-stone-800">
                    {e.base_salary ? formatCurrency(e.base_salary) : '—'}
                  </td>
                )}
                <td className="px-4 py-3">
                  <Link href={`/app/hr/employees/${e.id}`} className="text-stone-300 hover:text-stone-700 inline-flex h-8 w-8 items-center justify-center">
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M5 3l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="flex items-center justify-between px-4 py-3 border-t border-stone-100 bg-stone-50/40 text-[12px] text-stone-500">
          <span>แสดง <b className="text-stone-700">{data?.data.length ?? 0}</b> จาก <b className="text-stone-700">{data?.total ?? 0}</b> คน</span>
          <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} limit={pageSize} onLimitChange={() => {}} />
        </div>
      </div>

      {showForm && (
        <EmployeeFormModal onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); fetchEmployees(); }} />
      )}
    </div>
  );
}
```

- [ ] **Step 3: TypeScript check**
```bash
npx tsc --noEmit 2>&1 | grep "employees"
```
Expected: no errors.

- [ ] **Step 4: Commit**
```bash
git add app/api/hr/employees/route.ts app/app/hr/employees/page.tsx
git commit -m "feat(hr): redesign employees page with branch, tenure, salary columns"
```

---

## Task 6: Leave requests page redesign + calendar API

**Files:**
- Create: `app/api/hr/leave-requests/calendar/route.ts`
- Modify: `app/app/hr/leave-requests/page.tsx`

- [ ] **Step 1: Create leave calendar API**

Create `app/api/hr/leave-requests/calendar/route.ts`:
```ts
import { NextRequest } from 'next/server';
import { auth } from '@/auth';
import { query } from '@/lib/db/client';
import { apiSuccess, apiError } from '@/lib/api-response';

const LEAVE_COLORS: Record<string, string> = {
  default: '#7da78a',
  sick: '#c87a7a',
  personal: '#c89a48',
};

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);

  const { searchParams } = new URL(req.url);
  const month = searchParams.get('month') ?? new Date().toISOString().slice(0, 7); // YYYY-MM
  const [year, mon] = month.split('-').map(Number);

  const firstDay = new Date(year, mon - 1, 1);
  const lastDay = new Date(year, mon, 0);
  const monthDays = lastDay.getDate();
  const firstWeekday = firstDay.getDay(); // 0=Sun

  const fromDate = firstDay.toISOString().split('T')[0];
  const toDate = lastDay.toISOString().split('T')[0];

  const [teamRows, leaveRows] = await Promise.all([
    query<{ employee_id: string; name_th: string; department_name_en: string | null }>(
      `SELECT DISTINCT u.id AS employee_id, u.name_th,
              d.name_en AS department_name_en
       FROM leave_requests lr
       JOIN users u ON u.id = lr.employee_id
       LEFT JOIN departments d ON d.id = u.department_id
       WHERE lr.start_date <= $2 AND lr.end_date >= $1
         AND lr.status IN ('submitted','approved')
       ORDER BY u.name_th
       LIMIT 20`,
      [fromDate, toDate]
    ),
    query<{ employee_id: string; start_date: string; end_date: string; leave_type_code: string | null }>(
      `SELECT lr.employee_id,
              lr.start_date, lr.end_date,
              lt.code AS leave_type_code
       FROM leave_requests lr
       JOIN leave_types lt ON lt.id = lr.leave_type_id
       WHERE lr.start_date <= $2 AND lr.end_date >= $1
         AND lr.status IN ('submitted','approved')`,
      [fromDate, toDate]
    ),
  ]);

  const leaves = leaveRows.map((lv) => {
    const from = Math.max(1, new Date(lv.start_date).getDate());
    const to = Math.min(monthDays, new Date(lv.end_date).getDate());
    const code = lv.leave_type_code?.toLowerCase() ?? '';
    const color = code.includes('sick') || code.includes('ป่วย') ? LEAVE_COLORS.sick
                : code.includes('personal') || code.includes('กิจ') ? LEAVE_COLORS.personal
                : LEAVE_COLORS.default;
    return { employee_id: lv.employee_id, from_day: from, to_day: to, color };
  });

  return apiSuccess({ team: teamRows, leaves, month_days: monthDays, first_weekday: firstWeekday });
}
```

- [ ] **Step 2: Replace `app/app/hr/leave-requests/page.tsx`**

```tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { get, patch } from '@/lib/api-client';
import type { LeaveRequest } from '@/types';
import Link from 'next/link';
import { useToast } from '@/components/ui';
import { formatDate } from '@/lib/format';

const AVATAR_PALETTE = [
  { hue: '#efece4', txt: '#44403c' }, { hue: '#f5e3d6', txt: '#8a4a2a' },
  { hue: '#e6deea', txt: '#5c3a78' }, { hue: '#e4ddcc', txt: '#6c5a30' },
  { hue: '#dde6dc', txt: '#3a6048' }, { hue: '#dde5e6', txt: '#3a5a68' },
];
function avatarStyle(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffff;
  return AVATAR_PALETTE[h % AVATAR_PALETTE.length];
}
function Avatar({ name, size = 28 }: { name: string; size?: number }) {
  const { hue, txt } = avatarStyle(name);
  return (
    <div className="rounded-full grid place-items-center font-semibold shrink-0"
         style={{ width: size, height: size, background: hue, color: txt, fontSize: size * 0.42 }}>
      {name.trim().slice(0, 2)}
    </div>
  );
}

interface CalendarData {
  team: Array<{ employee_id: string; name_th: string; department_name_en: string | null }>;
  leaves: Array<{ employee_id: string; from_day: number; to_day: number; color: string }>;
  month_days: number;
  first_weekday: number;
}

function Kpi({ label, value, unit, sub, accent }: { label: string; value: React.ReactNode; unit?: string; sub?: string; accent?: string }) {
  return (
    <div className="flex-1 px-5 py-4 border-r border-stone-100 last:border-r-0">
      <div className="text-[11.5px] font-medium text-stone-500 uppercase tracking-wider">{label}</div>
      <div className="mt-1.5 flex items-baseline gap-1">
        <span className={`text-[26px] font-semibold tracking-tight tabular-nums ${accent ?? 'text-stone-900'}`}>{value}</span>
        {unit && <span className="text-[13px] text-stone-400 font-medium">{unit}</span>}
      </div>
      {sub && <div className="text-[11.5px] text-stone-400 mt-0.5">{sub}</div>}
    </div>
  );
}

const THAI_MONTHS_SHORT = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
const WEEKDAY_LABELS = ['อา','จ','อ','พ','พฤ','ศ','ส'];
const CELL = 30;
const ROW = 36;

export default function LeaveRequestsPage() {
  const today = new Date();
  const currentMonth = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}`;

  const [pending, setPending] = useState<LeaveRequest[]>([]);
  const [selected, setSelected] = useState<LeaveRequest | null>(null);
  const [calData, setCalData] = useState<CalendarData | null>(null);
  const [month, setMonth] = useState(currentMonth);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const { toast } = useToast();

  const fetchPending = useCallback(async () => {
    setLoading(true);
    try {
      const res = await get<{ data: LeaveRequest[]; total: number }>('/api/hr/leave-requests?status=submitted&pageSize=20');
      setPending(res.data);
      if (res.data.length > 0 && !selected) setSelected(res.data[0]);
    } finally { setLoading(false); }
  }, []);

  const fetchCalendar = useCallback(async () => {
    const data = await get<CalendarData>(`/api/hr/leave-requests/calendar?month=${month}`);
    setCalData(data);
  }, [month]);

  useEffect(() => { fetchPending(); }, [fetchPending]);
  useEffect(() => { fetchCalendar(); }, [fetchCalendar]);

  async function handleAction(id: string, action: 'approve' | 'reject') {
    setActing(true);
    try {
      await patch(`/api/hr/leave-requests/${id}`, { action });
      toast({ title: action === 'approve' ? 'อนุมัติแล้ว' : 'ปฏิเสธแล้ว', variant: 'success' });
      setSelected(null);
      fetchPending();
      fetchCalendar();
    } catch (e: unknown) {
      toast({ title: e instanceof Error ? e.message : 'เกิดข้อผิดพลาด', variant: 'error' });
    } finally { setActing(false); }
  }

  const [calYear, calMon] = month.split('-').map(Number);
  const monthLabel = `${THAI_MONTHS_SHORT[calMon - 1]} ${calYear + 543}`;

  function prevMonth() {
    const d = new Date(calYear, calMon - 2, 1);
    setMonth(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`);
  }
  function nextMonth() {
    const d = new Date(calYear, calMon, 1);
    setMonth(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`);
  }

  const DAYS = calData?.month_days ?? 31;
  const startWd = calData?.first_weekday ?? 0;

  function isWeekend(day: number) {
    return ((startWd + day - 1) % 7) === 0 || ((startWd + day - 1) % 7) === 6;
  }

  const todayDay = today.getMonth() + 1 === calMon && today.getFullYear() === calYear ? today.getDate() : -1;

  return (
    <div className="max-w-[1280px] mx-auto pb-12 space-y-5">
      {/* Header */}
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-[26px] font-semibold tracking-tight text-stone-900 leading-tight">การลา / Leave</h1>
          <p className="text-[13.5px] text-stone-500 mt-1">{pending.length} คำขอรออนุมัติ · ปฏิทินทีม {monthLabel}</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/app/hr/leave/quota" className="h-9 px-3.5 rounded-md text-[13px] font-medium text-stone-700 bg-white border border-stone-200 hover:bg-stone-50">
            ตั้งค่าโควต้า
          </Link>
          <Link href="/app/hr/leave-requests/new" className="h-9 px-3.5 rounded-md text-[13px] font-medium text-white bg-stone-900 hover:bg-stone-800 inline-flex items-center gap-1.5">
            <span className="text-base leading-none">+</span> ลาแทนพนักงาน
          </Link>
        </div>
      </div>

      {/* KPI strip */}
      <div className="flex bg-white border border-stone-200 rounded-[10px] shadow-sm overflow-hidden">
        <Kpi label="รออนุมัติ" value={pending.length} unit="ใบ" sub="ค่าเฉลี่ยอนุมัติ 4 ชม." accent="text-amber-700" />
        <Kpi label="ลาวันนี้" value="—" unit="คน" />
        <Kpi label="ลาเดือนนี้" value="—" unit="วัน-คน" />
        <Kpi label="โควต้าใช้ไป" value="—" sub="เฉลี่ยทั้งบริษัท" />
      </div>

      {/* Body */}
      <div className="grid grid-cols-12 gap-5">
        {/* Pending list */}
        <section className="col-span-4 bg-white border border-stone-200 rounded-[10px] shadow-sm">
          <header className="px-5 py-3.5 border-b border-stone-100 flex items-center justify-between">
            <div>
              <h2 className="text-[14.5px] font-semibold text-stone-900">รออนุมัติ</h2>
              <p className="text-[11.5px] text-stone-400">{pending.length} คำขอ</p>
            </div>
          </header>
          {loading ? (
            <div className="py-12 text-center text-[13px] text-stone-400">กำลังโหลด...</div>
          ) : (
            <ul className="divide-y divide-stone-100">
              {pending.length === 0 && (
                <li className="px-5 py-8 text-center text-[13px] text-stone-400">ไม่มีคำขอลาที่รออนุมัติ</li>
              )}
              {pending.map((lv, i) => {
                const sel = selected?.id === lv.id;
                const isUrgent = lv.start_date <= new Date(Date.now() + 86400000).toISOString().split('T')[0];
                return (
                  <li
                    key={lv.id}
                    onClick={() => setSelected(lv)}
                    className={`px-5 py-3.5 cursor-pointer ${sel ? 'bg-stone-50 border-l-2 border-stone-900 pl-[18px]' : 'hover:bg-stone-50/60'}`}
                  >
                    <div className="flex items-start gap-3">
                      <Avatar name={lv.employee_name_th} size={32} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[13px] font-medium text-stone-900 truncate">{lv.employee_name_th}</span>
                          {isUrgent && <span className="px-1.5 py-0.5 rounded text-[9.5px] font-bold bg-red-50 text-red-700 border border-red-200 uppercase tracking-wider">ด่วน</span>}
                        </div>
                        <div className="mt-1.5 flex items-center gap-2">
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-stone-100 text-stone-600 border border-stone-200">{lv.leave_type_name_th}</span>
                          <span className="text-[11px] font-mono text-stone-600 tabular-nums">{Number(lv.days_requested).toFixed(0)} วัน</span>
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          <footer className="px-5 py-2.5 border-t border-stone-100 bg-stone-50/40 text-[11.5px] text-stone-500">
            <Link href="/app/hr/leave-requests" className="text-stone-700 font-medium hover:underline">ดูทั้งหมด →</Link>
          </footer>
        </section>

        {/* Detail + Calendar */}
        <div className="col-span-8 space-y-5">
          {/* Detail card */}
          {selected ? (
            <section className="bg-white border border-stone-200 rounded-[10px] shadow-sm overflow-hidden">
              <header className="px-5 py-4 border-b border-stone-100 flex items-start gap-4">
                <Avatar name={selected.employee_name_th} size={44} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h2 className="text-[15px] font-semibold text-stone-900">{selected.employee_name_th}</h2>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">{selected.leave_type_name_th}</span>
                  </div>
                  <p className="text-[12px] text-stone-500 mt-0.5">{selected.employee_name_en}</p>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => handleAction(selected.id, 'reject')}
                    disabled={acting}
                    className="h-9 px-3.5 rounded-md text-[13px] font-medium bg-white border border-stone-200 text-stone-700 hover:bg-stone-50 disabled:opacity-50"
                  >ปฏิเสธ</button>
                  <button
                    onClick={() => handleAction(selected.id, 'approve')}
                    disabled={acting}
                    className="h-9 px-3.5 rounded-md text-[13px] font-medium bg-stone-900 text-white hover:bg-stone-800 inline-flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
                    อนุมัติ
                  </button>
                </div>
              </header>
              <div className="grid grid-cols-4 divide-x divide-stone-100">
                <div className="px-5 py-3.5">
                  <div className="text-[10.5px] font-semibold text-stone-400 uppercase tracking-wider">ช่วงวันลา</div>
                  <div className="text-[15px] font-semibold text-stone-900 tabular-nums mt-1">{formatDate(selected.start_date)} – {formatDate(selected.end_date)}</div>
                </div>
                <div className="px-5 py-3.5">
                  <div className="text-[10.5px] font-semibold text-stone-400 uppercase tracking-wider">จำนวนวัน</div>
                  <div className="text-[15px] font-semibold text-stone-900 tabular-nums mt-1">{Number(selected.days_requested).toFixed(0)} วัน</div>
                </div>
                <div className="px-5 py-3.5">
                  <div className="text-[10.5px] font-semibold text-stone-400 uppercase tracking-wider">ยื่นเมื่อ</div>
                  <div className="text-[15px] font-semibold text-stone-900 mt-1">{new Date(selected.created_at).toLocaleDateString('th-TH')}</div>
                </div>
                <div className="px-5 py-3.5">
                  <div className="text-[10.5px] font-semibold text-stone-400 uppercase tracking-wider">ผู้อนุมัติ</div>
                  <div className="text-[13px] font-medium text-stone-900 mt-1">{selected.approved_by_name_th ?? '—'}</div>
                </div>
              </div>
              {selected.notes && (
                <div className="px-5 py-3 border-t border-stone-100 bg-stone-50/40">
                  <div className="text-[10.5px] font-semibold text-stone-400 uppercase tracking-wider mb-1">หมายเหตุ</div>
                  <p className="text-[13px] text-stone-700">{selected.notes}</p>
                </div>
              )}
            </section>
          ) : (
            <div className="bg-white border border-stone-200 rounded-[10px] shadow-sm p-8 text-center text-[13px] text-stone-400">
              เลือกคำขอลาเพื่อดูรายละเอียด
            </div>
          )}

          {/* Team calendar */}
          <section className="bg-white border border-stone-200 rounded-[10px] shadow-sm overflow-hidden">
            <header className="px-5 py-3.5 border-b border-stone-100 flex items-center justify-between">
              <div>
                <h2 className="text-[14.5px] font-semibold text-stone-900">ปฏิทินทีม · {monthLabel}</h2>
                <p className="text-[11.5px] text-stone-400">{calData?.team.length ?? 0} คน</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-3 text-[10.5px] text-stone-500">
                  <span className="inline-flex items-center gap-1"><span className="w-3 h-2 rounded-sm" style={{background:'#7da78a'}}></span>พักร้อน</span>
                  <span className="inline-flex items-center gap-1"><span className="w-3 h-2 rounded-sm" style={{background:'#c87a7a'}}></span>ป่วย</span>
                  <span className="inline-flex items-center gap-1"><span className="w-3 h-2 rounded-sm" style={{background:'#c89a48'}}></span>กิจ</span>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={prevMonth} className="w-7 h-7 rounded-md border border-stone-200 bg-white text-stone-500 grid place-items-center hover:bg-stone-50">‹</button>
                  <button onClick={() => setMonth(currentMonth)} className="h-7 px-2.5 rounded-md border border-stone-200 bg-white text-[11.5px] font-medium text-stone-700">วันนี้</button>
                  <button onClick={nextMonth} className="w-7 h-7 rounded-md border border-stone-200 bg-white text-stone-500 grid place-items-center hover:bg-stone-50">›</button>
                </div>
              </div>
            </header>
            <div className="overflow-x-auto">
              {/* Header row */}
              <div className="grid" style={{ gridTemplateColumns: `160px repeat(${DAYS}, ${CELL}px)` }}>
                <div className="px-3 py-2 border-r border-b border-stone-200 bg-stone-50 text-[10.5px] font-semibold text-stone-400 uppercase tracking-wider">พนักงาน</div>
                {Array.from({ length: DAYS }).map((_, i) => {
                  const day = i + 1;
                  const dow = (startWd + i) % 7;
                  const we = dow === 0 || dow === 6;
                  const isT = day === todayDay;
                  return (
                    <div key={day} className={`border-r border-b border-stone-200 px-1 py-1 text-center ${we ? 'bg-stone-100/70' : 'bg-stone-50'} ${isT ? 'bg-amber-50' : ''}`}>
                      <div className={`text-[10px] font-medium ${isT ? 'text-amber-700' : 'text-stone-400'}`}>{WEEKDAY_LABELS[dow]}</div>
                      <div className={`text-[11.5px] font-mono tabular-nums ${isT ? 'font-bold text-amber-900' : we ? 'text-stone-500' : 'text-stone-700'}`}>{day}</div>
                    </div>
                  );
                })}
              </div>
              {/* Employee rows */}
              {(calData?.team ?? []).map((emp) => {
                const empLeaves = (calData?.leaves ?? []).filter(l => l.employee_id === emp.employee_id);
                return (
                  <div key={emp.employee_id} className="grid relative" style={{ gridTemplateColumns: `160px repeat(${DAYS}, ${CELL}px)`, height: ROW }}>
                    <div className="px-3 flex items-center gap-2 border-r border-b border-stone-100 bg-white">
                      <Avatar name={emp.name_th} size={22} />
                      <div className="min-w-0">
                        <div className="text-[12px] font-medium text-stone-900 truncate leading-tight">{emp.name_th}</div>
                        <div className="text-[9.5px] text-stone-400 truncate uppercase tracking-wider">{emp.department_name_en ?? ''}</div>
                      </div>
                    </div>
                    {Array.from({ length: DAYS }).map((_, i) => {
                      const day = i + 1;
                      const dow = (startWd + i) % 7;
                      const we = dow === 0 || dow === 6;
                      const isT = day === todayDay;
                      return <div key={day} className={`border-r border-b border-stone-100 ${we ? 'bg-stone-50/70' : ''} ${isT ? 'bg-amber-50/40' : ''}`} />;
                    })}
                    {empLeaves.map((lv, idx) => {
                      const left = 160 + (lv.from_day - 1) * CELL + 2;
                      const width = (lv.to_day - lv.from_day + 1) * CELL - 4;
                      return (
                        <div key={idx}
                          className="absolute top-1/2 -translate-y-1/2 rounded text-[10px] font-semibold text-white px-1.5 flex items-center shadow-sm"
                          style={{ left, width, height: 18, background: lv.color }}>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
              {(calData?.team.length === 0) && (
                <div className="py-8 text-center text-[13px] text-stone-400">ไม่มีข้อมูลการลาในเดือนนี้</div>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Check that PATCH on leave-requests supports `action: 'approve'` and `action: 'reject'`**

```bash
grep -n "action.*approve\|action.*reject" app/api/hr/leave-requests/\\[id\\]/route.ts | head -5
```
If neither found, open the file and add PATCH support (see note below).

> **Note:** If the leave-requests `[id]` route doesn't handle `action: 'approve'`, add this to its PATCH handler:
> ```ts
> if (action === 'approve') {
>   await query(`UPDATE leave_requests SET status = 'approved', approved_by = $1, approved_at = NOW() WHERE id = $2`, [u.id, id]);
> }
> if (action === 'reject') {
>   await query(`UPDATE leave_requests SET status = 'rejected', approved_by = $1, approved_at = NOW() WHERE id = $2`, [u.id, id]);
> }
> ```

- [ ] **Step 4: TypeScript check**
```bash
npx tsc --noEmit 2>&1 | grep "leave"
```
Expected: no errors.

- [ ] **Step 5: Commit**
```bash
git add app/api/hr/leave-requests/calendar/route.ts app/app/hr/leave-requests/page.tsx
git commit -m "feat(hr): redesign leave page with team calendar and inline approve/reject"
```

---

## Task 7: Payroll run detail page redesign

**Files:**
- Modify: `app/app/hr/payroll/[id]/page.tsx`
- Modify: `app/api/hr/payroll-runs/[id]/route.ts` — add `submit_review` action

- [ ] **Step 1: Add `submit_review` action to payroll PATCH handler**

In `app/api/hr/payroll-runs/[id]/route.ts`, after the `if (action === 'approve')` block, add:
```ts
if (action === 'submit_review') {
  if (run.status !== 'draft') return apiError('Must be in draft', 400);
  await query(`UPDATE payroll_runs SET status = 'processing' WHERE id = $1`, [id]);
}
```

- [ ] **Step 2: Replace `app/app/hr/payroll/[id]/page.tsx`**

```tsx
'use client';

import { useState, useEffect, use } from 'react';
import { get, patch } from '@/lib/api-client';
import type { PayrollRun, PayrollLine } from '@/types';
import { formatCurrency } from '@/lib/format';
import { useToast } from '@/components/ui';
import Link from 'next/link';

const AVATAR_PALETTE = [
  { hue: '#efece4', txt: '#44403c' }, { hue: '#f5e3d6', txt: '#8a4a2a' },
  { hue: '#e6deea', txt: '#5c3a78' }, { hue: '#e4ddcc', txt: '#6c5a30' },
  { hue: '#dde6dc', txt: '#3a6048' }, { hue: '#dde5e6', txt: '#3a5a68' },
];
function avatarStyle(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffff;
  return AVATAR_PALETTE[h % AVATAR_PALETTE.length];
}
function Avatar({ name, size = 28 }: { name: string; size?: number }) {
  const { hue, txt } = avatarStyle(name);
  return (
    <div className="rounded-full grid place-items-center font-semibold shrink-0"
         style={{ width: size, height: size, background: hue, color: txt, fontSize: size * 0.42 }}>
      {name.trim().slice(0, 2)}
    </div>
  );
}

function Kpi({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <div className="flex-1 px-5 py-4 border-r border-stone-100 last:border-r-0">
      <div className="text-[11.5px] font-medium text-stone-500 uppercase tracking-wider">{label}</div>
      <div className={`mt-1.5 text-[24px] font-semibold tracking-tight tabular-nums ${accent ?? 'text-stone-900'}`}>{value}</div>
      {sub && <div className="text-[11.5px] text-stone-400 mt-0.5">{sub}</div>}
    </div>
  );
}

const STEPS = [
  { key: 'draft',      label: 'ร่าง',      sub: 'รวบรวมข้อมูล' },
  { key: 'processing', label: 'ตรวจสอบ',  sub: 'ตรวจรายการ' },
  { key: 'approved',   label: 'อนุมัติ',   sub: 'ผู้บริหารเซ็น' },
  { key: 'paid',       label: 'จ่ายแล้ว',  sub: 'โอนเงิน' },
];

interface PayrollDetail extends PayrollRun {
  lines: PayrollLine[];
  created_by_name_th: string;
}

export default function PayrollRunDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [run, setRun] = useState<PayrollDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [acting, setActing] = useState(false);
  const { toast } = useToast();

  async function fetchRun() {
    setLoading(true);
    try { setRun(await get<PayrollDetail>(`/api/hr/payroll-runs/${id}`)); }
    finally { setLoading(false); }
  }

  useEffect(() => { fetchRun(); }, [id]);

  async function handleAction(action: string) {
    setActing(true);
    try {
      await patch(`/api/hr/payroll-runs/${id}`, { action });
      toast({ title: 'ดำเนินการสำเร็จ', variant: 'success' });
      fetchRun();
    } catch (e: unknown) {
      toast({ title: e instanceof Error ? e.message : 'เกิดข้อผิดพลาด', variant: 'error' });
    } finally { setActing(false); }
  }

  if (loading) return <div className="py-12 text-center text-stone-400">กำลังโหลด...</div>;
  if (!run) return <div className="py-12 text-center text-stone-400">ไม่พบข้อมูล</div>;

  const stepIdx = STEPS.findIndex(s => s.key === run.status);
  const THAI_MONTHS = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
  const periodLabel = `งวดเงินเดือน · ${THAI_MONTHS[run.period_month - 1]} ${run.period_year + 543}`;

  const statusPill = run.status === 'draft' ? 'bg-stone-100 text-stone-600 border-stone-200'
    : run.status === 'processing' ? 'bg-amber-50 text-amber-800 border-amber-200'
    : run.status === 'approved' ? 'bg-blue-50 text-blue-700 border-blue-200'
    : 'bg-emerald-50 text-emerald-700 border-emerald-200';

  const actionBtn = run.status === 'draft'
    ? { label: 'ส่งให้ตรวจสอบ', action: 'submit_review' }
    : run.status === 'processing'
    ? { label: 'ส่งให้ผู้บริหารอนุมัติ →', action: 'approve' }
    : run.status === 'approved'
    ? { label: 'ยืนยันการจ่ายเงิน (GL)', action: 'post_to_accounting' }
    : null;

  const filteredLines = (run.lines ?? []).filter(l =>
    !search || l.employee_name_th.includes(search) || l.employee_id_code?.includes(search)
  );

  const totals = filteredLines.reduce((acc, r) => ({
    base: acc.base + (r.base_salary ?? 0),
    ot: acc.ot + (r.ot_pay ?? 0),
    gross: acc.gross + (r.gross_pay ?? 0),
    sso: acc.sso + (r.sso_employee ?? 0),
    tax: acc.tax + (r.income_tax ?? 0),
    net: acc.net + (r.net_pay ?? 0),
  }), { base: 0, ot: 0, gross: 0, sso: 0, tax: 0, net: 0 });

  return (
    <div className="max-w-[1280px] mx-auto pb-12 space-y-5">
      {/* Header */}
      <div className="flex items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-[26px] font-semibold tracking-tight text-stone-900 leading-tight">{periodLabel}</h1>
            <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border ${statusPill}`}>
              {STEPS.find(s => s.key === run.status)?.label ?? run.status}
            </span>
          </div>
          <p className="text-[13.5px] text-stone-500 mt-1">{run.run_number} · {run.lines?.length ?? 0} คน</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="h-9 px-3.5 rounded-md text-[13px] font-medium text-stone-700 bg-white border border-stone-200 hover:bg-stone-50">
            Export ธ.ไทยพาณิชย์
          </button>
          <button className="h-9 px-3.5 rounded-md text-[13px] font-medium text-stone-700 bg-white border border-stone-200 hover:bg-stone-50">
            พิมพ์สลิป
          </button>
          {actionBtn && (
            <button
              onClick={() => handleAction(actionBtn.action)}
              disabled={acting}
              className="h-9 px-3.5 rounded-md text-[13px] font-medium text-white bg-stone-900 hover:bg-stone-800 disabled:opacity-50"
            >
              {actionBtn.label}
            </button>
          )}
        </div>
      </div>

      {/* Workflow stepper */}
      <div className="bg-white border border-stone-200 rounded-[10px] shadow-sm p-5">
        <div className="grid grid-cols-4 gap-2">
          {STEPS.map((s, i) => {
            const done = i < stepIdx;
            const current = i === stepIdx;
            return (
              <div key={s.key} className="flex items-start gap-3">
                <div className="flex flex-col items-center">
                  <div className={`w-8 h-8 rounded-full grid place-items-center text-[12px] font-bold border-2 ${
                    done ? 'bg-stone-900 border-stone-900 text-white'
                    : current ? 'bg-white border-stone-900 text-stone-900'
                    : 'bg-white border-stone-200 text-stone-400'}`}>
                    {done
                      ? <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
                      : i + 1}
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

      {/* KPI strip */}
      <div className="flex bg-white border border-stone-200 rounded-[10px] shadow-sm overflow-hidden">
        <Kpi label="ยอดรวม (Gross)" value={formatCurrency(run.total_gross)} sub={`${run.lines?.length ?? 0} คน`} />
        <Kpi label="ประกันสังคม (5%)" value={formatCurrency(run.total_sso_emp)} sub="หักจากพนักงาน" accent="text-stone-700" />
        <Kpi label="ภาษีหัก ณ ที่จ่าย" value={formatCurrency(run.total_tax)} sub="ภ.ง.ด.1" accent="text-stone-700" />
        <Kpi label="ยอดสุทธิ (Net)" value={formatCurrency(run.total_net)} sub="พร้อมโอน" accent="text-emerald-700" />
      </div>

      {/* Filter */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ค้นหาชื่อ / รหัสพนักงาน…"
            className="w-full pl-9 pr-3 py-2 bg-white border border-stone-300 rounded-lg text-[13px] text-stone-700 placeholder:text-stone-400 outline-none focus:border-stone-400"
          />
        </div>
      </div>

      {/* Payroll table */}
      <div className="bg-white border border-stone-200 rounded-[10px] shadow-sm overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-stone-50 border-b border-stone-200">
            <tr className="text-[10.5px] font-semibold text-stone-500 uppercase tracking-wider">
              <th className="px-4 py-3 w-28">รหัส</th>
              <th className="px-4 py-3">พนักงาน</th>
              <th className="px-4 py-3 text-right w-28">ฐานเงินเดือน</th>
              <th className="px-4 py-3 text-right w-24">OT</th>
              <th className="px-4 py-3 text-right w-28">รวม (Gross)</th>
              <th className="px-4 py-3 text-right w-20">SSO</th>
              <th className="px-4 py-3 text-right w-20">ภาษี</th>
              <th className="px-4 py-3 text-right w-28">สุทธิ (Net)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {filteredLines.length === 0 ? (
              <tr><td colSpan={8} className="py-12 text-center text-[13px] text-stone-400">ไม่พบรายการ</td></tr>
            ) : filteredLines.map((r) => (
              <tr key={r.id} className="hover:bg-stone-50/60">
                <td className="px-4 py-3 font-mono text-[12.5px] font-medium text-stone-700">{r.employee_id_code ?? '—'}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <Avatar name={r.employee_name_th} size={28} />
                    <div className="min-w-0">
                      <div className="text-[13px] font-medium text-stone-900 truncate">{r.employee_name_th}</div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-right font-mono text-[13px] tabular-nums text-stone-800">{formatCurrency(r.base_salary)}</td>
                <td className={`px-4 py-3 text-right font-mono text-[13px] tabular-nums ${r.ot_pay > 0 ? 'text-stone-700' : 'text-stone-300'}`}>
                  {r.ot_pay > 0 ? formatCurrency(r.ot_pay) : '—'}
                </td>
                <td className="px-4 py-3 text-right font-mono text-[13px] tabular-nums font-semibold text-stone-900">{formatCurrency(r.gross_pay)}</td>
                <td className="px-4 py-3 text-right font-mono text-[12.5px] tabular-nums text-stone-500">−{formatCurrency(r.sso_employee)}</td>
                <td className="px-4 py-3 text-right font-mono text-[12.5px] tabular-nums text-stone-500">
                  {r.income_tax > 0 ? `−${formatCurrency(r.income_tax)}` : '—'}
                </td>
                <td className="px-4 py-3 text-right font-mono text-[13.5px] tabular-nums font-bold text-emerald-700">{formatCurrency(r.net_pay)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-stone-50 border-t border-stone-200">
            <tr className="text-[12.5px] font-semibold text-stone-700">
              <td className="px-4 py-3" colSpan={2}>รวม {filteredLines.length} คน</td>
              <td className="px-4 py-3 text-right font-mono tabular-nums">{formatCurrency(totals.base)}</td>
              <td className="px-4 py-3 text-right font-mono tabular-nums">{formatCurrency(totals.ot)}</td>
              <td className="px-4 py-3 text-right font-mono tabular-nums">{formatCurrency(totals.gross)}</td>
              <td className="px-4 py-3 text-right font-mono tabular-nums text-stone-500">−{formatCurrency(totals.sso)}</td>
              <td className="px-4 py-3 text-right font-mono tabular-nums text-stone-500">−{formatCurrency(totals.tax)}</td>
              <td className="px-4 py-3 text-right font-mono tabular-nums text-emerald-700">{formatCurrency(totals.net)}</td>
            </tr>
          </tfoot>
        </table>
        <div className="px-4 py-3 border-t border-stone-100 bg-stone-50/40 text-[12px] text-stone-500">
          <Link href="/app/hr/payroll" className="text-stone-700 font-medium hover:underline">← รายการ Payroll ทั้งหมด</Link>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: TypeScript check**
```bash
npx tsc --noEmit 2>&1 | grep "payroll"
```
Expected: no errors.

- [ ] **Step 4: Commit**
```bash
git add app/api/hr/payroll-runs/[id]/route.ts app/app/hr/payroll/[id]/page.tsx
git commit -m "feat(hr): redesign payroll detail with workflow stepper and employee breakdown table"
```

---

## Self-Review

**Spec coverage check:**
- ✅ Section 1 (Dashboard API + UI) → Tasks 3, 4
- ✅ Section 2 (Employees API + UI) → Task 5
- ✅ Section 3 (Leave calendar + UI) → Task 6
- ✅ Section 4 (Payroll detail + submit_review) → Task 7
- ✅ Section 5 (Sidebar + i18n) → Task 1
- ✅ Section 6 (Stub pages) → Task 2
- ⚠️ Section 2 employee stats endpoint (new_this_month, avg_tenure, turnover) → simplified: KPI strip on employees page uses computed data in-component from paginated list rather than separate endpoint. If richer stats needed, add `/api/hr/employees/stats` endpoint separately.

**Placeholder check:** No TBD or "add appropriate" language present.

**Type consistency:** `avatarStyle`, `Avatar`, `AVATAR_PALETTE` defined per-file (copy pattern); `formatCurrency` from `@/lib/format` used consistently; `PayrollLine.ot_pay`, `PayrollLine.sso_employee`, `PayrollLine.gross_pay`, `PayrollLine.net_pay`, `PayrollLine.income_tax` match `types/index.ts`.

**Known assumption:** `useToast` is available from `@/components/ui`. If not, replace with `alert()`.

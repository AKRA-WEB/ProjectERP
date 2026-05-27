---
track: perf-tier2-materialized-views
title: "Performance Tier 2 — HR Stats Materialized View + Composite Indexes"
status: Verified
created: 2026-05-27
updated: 2026-05-27
spec: docs/superpowers/specs/2026-05-27-performance-optimization-design.md
dependency: perf-tier1-connection-query must be Verified first
---

# Performance Tier 2 — Materialized Views + HR Composite Indexes

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.
> **Do not start until `perf-tier1-connection-query` is Verified.**

**Goal:** Replace 5 of the 9 parallel queries in `/api/hr/stats` with a single materialized view read, and add composite indexes for HR attendance and leave tables.

**Architecture:** PostgreSQL materialized view `hr_stats_snapshot` (single row) stores slow-changing employee aggregates. A new `POST /api/admin/snapshots/refresh` endpoint refreshes it. Vercel Cron Job triggers nightly refresh at 01:00 UTC. Existing real-time queries (today's attendance, pending leave queue) remain unchanged.

**Tech Stack:** Next.js 15 · PostgreSQL on Supabase · Vercel Cron Jobs · `pg` Pool

**No test suite.** QA gate = `npm run qa:verify` (ESLint + `tsc --noEmit`) — must be 0 errors before marking done.

---

## Architectural Gates

1. **Transaction Boundary:** `REFRESH MATERIALIZED VIEW CONCURRENTLY` runs outside transaction (PostgreSQL requirement).
2. **Doc Number:** Not applicable.
3. **Child Table Inserts:** Not applicable.
4. **Side Effects:** Refresh endpoint must be called after payroll approve and employee status changes to keep mat view fresh.
5. **Response Shape:** `/api/hr/stats` response shape is **identical** — same field names, same types. Mat view just changes the source.

---

## Files

| Action | Path |
|--------|------|
| Create | `migrations/069_hr_stats_snapshot.sql` |
| Create | `app/api/admin/snapshots/refresh/route.ts` |
| Create | `vercel.json` |
| Modify | `app/api/hr/stats/route.ts` |
| Modify | `app/api/hr/payroll-runs/[id]/route.ts` |

---

## Task 1 — Create Migration (`migrations/069_hr_stats_snapshot.sql`)

- [ ] **Step 1: Create migration file**

  Create `migrations/069_hr_stats_snapshot.sql`:
  ```sql
  BEGIN;

  -- Materialized view: slow-changing HR aggregates (refresh nightly + on status change)
  CREATE MATERIALIZED VIEW IF NOT EXISTS hr_stats_snapshot AS
  SELECT
    COUNT(*)                                                                       AS total_employees,
    COUNT(*) FILTER (WHERE employee_status = 'active')                             AS active_employees,
    COUNT(*) FILTER (WHERE hired_date >= CURRENT_DATE - 120)                       AS probation_count,
    COUNT(*) FILTER (WHERE resignation_date >= date_trunc('month', CURRENT_DATE))  AS resigned_this_month,
    (
      SELECT json_agg(row_to_json(d))
      FROM (
        SELECT d.id, d.name_th, d.name_en, COUNT(u.id)::int AS count
        FROM departments d
        LEFT JOIN users u ON u.department_id = d.id AND u.is_active = TRUE
        GROUP BY d.id, d.name_th, d.name_en
        ORDER BY count DESC
      ) d
    ) AS dept_headcount,
    (
      SELECT row_to_json(pr)
      FROM (
        SELECT run_number, period_month, period_year, status, total_net
        FROM payroll_runs ORDER BY created_at DESC LIMIT 1
      ) pr
    ) AS latest_payroll
  FROM users
  WHERE role NOT IN ('admin', 'superadmin');

  -- Required for REFRESH MATERIALIZED VIEW CONCURRENTLY (single-row view)
  CREATE UNIQUE INDEX IF NOT EXISTS hr_stats_snapshot_unique ON hr_stats_snapshot ((1));

  -- Composite indexes for HR real-time queries
  CREATE INDEX IF NOT EXISTS idx_attendance_date_employee
    ON attendance_records(work_date DESC, employee_id);

  CREATE INDEX IF NOT EXISTS idx_leave_status_created
    ON leave_requests(status, created_at ASC);

  CREATE INDEX IF NOT EXISTS idx_leave_employee_dates
    ON leave_requests(employee_id, start_date, end_date)
    WHERE status = 'approved';

  COMMIT;
  ```

- [ ] **Step 2: Run migration**

  ```bash
  npm run migrate
  ```

  Expected: `Applied: 069_hr_stats_snapshot.sql`. No errors.

  If you get `ERROR: REFRESH MATERIALIZED VIEW CONCURRENTLY cannot run inside a transaction` — this is from the unique index creation during `CREATE MATERIALIZED VIEW`, not from the COMMIT. The UNIQUE INDEX line is fine inside BEGIN/COMMIT; the error would only occur if you tried `REFRESH ... CONCURRENTLY` inside a transaction. This migration does not refresh.

---

## Task 2 — Create Refresh Endpoint (`app/api/admin/snapshots/refresh/route.ts`)

- [ ] **Step 1: Create the file**

  Create `app/api/admin/snapshots/refresh/route.ts`:
  ```typescript
  import { NextRequest } from 'next/server';
  import { auth } from '@/auth';
  import { query } from '@/lib/db/client';
  import { apiSuccess, apiError } from '@/lib/api-response';
  import { assertRole } from '@/lib/authz';
  import type { SessionUser } from '@/types';

  const ALLOWED_TARGETS = ['hr_stats'] as const;
  type SnapshotTarget = typeof ALLOWED_TARGETS[number];

  const VIEW_MAP: Record<SnapshotTarget, string> = {
    hr_stats: 'hr_stats_snapshot',
  };

  export async function POST(req: NextRequest) {
    const session = await auth();
    if (!session) return apiError('Unauthorized', 401);
    const u = session.user as unknown as SessionUser;
    try { assertRole(u, ['admin']); } catch { return apiError('Forbidden', 403); }

    const { searchParams } = new URL(req.url);
    const target = searchParams.get('target') as SnapshotTarget | null;

    if (!target || !ALLOWED_TARGETS.includes(target)) {
      return apiError(`Invalid target. Allowed: ${ALLOWED_TARGETS.join(', ')}`, 400);
    }

    const viewName = VIEW_MAP[target];
    await query(`REFRESH MATERIALIZED VIEW CONCURRENTLY ${viewName}`, []);

    return apiSuccess({ refreshed: viewName, at: new Date().toISOString() });
  }
  ```

- [ ] **Step 2: Run qa:verify**

  ```bash
  npm run qa:verify
  ```

  Expected: 0 errors.

---

## Task 3 — Update HR Stats Route (`app/api/hr/stats/route.ts`)

- [ ] **Step 1: Read current file**

  Open `app/api/hr/stats/route.ts`. The current `Promise.all` block fires 9 queries. We keep the 4 real-time queries and replace the 5 slow-changing ones with a single mat view read.

- [ ] **Step 2: Add snapshot type interface at top of file (after existing interfaces)**

  After the last existing interface declaration, add:
  ```typescript
  interface HrStatsSnapshot {
    total_employees: string;
    active_employees: string;
    probation_count: string;
    resigned_this_month: string;
    dept_headcount: Array<{ id: string; name_th: string; name_en: string; count: number }> | null;
    latest_payroll: { run_number: string; period_month: number; period_year: number; status: string; total_net: string } | null;
  }
  ```

- [ ] **Step 3: Replace the Promise.all block**

  Find the existing `const [ empStats, deptStats, leaveStats, ... ] = await Promise.all([...])` block and replace it with:

  ```typescript
  const [
    snapshot,
    attendanceStats,
    pendingLeaveCount,
    attendanceFeed,
    pendingLeaveQueue,
    upcomingEvents
  ] = await Promise.all([
    // 1. Slow-changing stats from materialized view (refreshed nightly)
    queryOne<HrStatsSnapshot>(`SELECT * FROM hr_stats_snapshot`, []),

    // 2. Today's attendance (real-time — changes per clock-in/out)
    queryOne<{ present: string; late: string; absent: string; on_leave: string }>(
      `SELECT
         COUNT(*) FILTER (WHERE status = 'present') AS present,
         COUNT(*) FILTER (WHERE status = 'late') AS late,
         COUNT(*) FILTER (WHERE status = 'absent') AS absent,
         (SELECT COUNT(*) FROM leave_requests lr
          WHERE lr.status = 'approved' AND CURRENT_DATE BETWEEN lr.start_date AND lr.end_date) AS on_leave
       FROM attendance_records
       WHERE work_date = CURRENT_DATE`,
      []
    ),

    // 3. Total pending leave count (real-time — drives badge number, not capped)
    queryOne<{ pending: string }>(
      `SELECT COUNT(*) AS pending FROM leave_requests WHERE status = 'submitted'`,
      []
    ),

    // 4. Attendance feed (real-time — top 10 for dashboard)
    query<AttendanceFeedRow>(
      `SELECT
        u.id AS employee_id,
        u.name_th,
        u.position,
        COALESCE(d.name_th, u.department) AS department_name_th,
        TO_CHAR(ar.clock_in AT TIME ZONE 'Asia/Bangkok', 'HH24:MI') AS clock_in,
        TO_CHAR(ar.clock_out AT TIME ZONE 'Asia/Bangkok', 'HH24:MI') AS clock_out,
        CASE
          WHEN lr.id IS NOT NULL THEN 'on_leave'
          WHEN ar.id IS NULL THEN 'absent'
          WHEN ar.status = 'late' THEN 'late'
          ELSE 'present'
        END AS status,
        CASE
          WHEN ar.status = 'late'
          THEN EXTRACT(EPOCH FROM (ar.clock_in::time - COALESCE(ws.shift_start, '08:00:00')::time)) / 60
          ELSE 0
        END::int AS late_minutes,
        COALESCE(ws.name_th, 'กะมาตรฐาน 08:00-17:00') AS shift_label,
        lt.name_th AS leave_type_name_th
      FROM users u
      LEFT JOIN work_schedules ws ON ws.id = u.work_schedule_id
      LEFT JOIN attendance_records ar
        ON ar.employee_id = u.id AND ar.work_date = CURRENT_DATE
      LEFT JOIN leave_requests lr
        ON lr.employee_id = u.id
        AND lr.status = 'approved'
        AND CURRENT_DATE BETWEEN lr.start_date AND lr.end_date
      LEFT JOIN leave_types lt ON lt.id = lr.leave_type_id
      LEFT JOIN departments d ON d.id = u.department_id
      WHERE u.is_active = TRUE AND u.role NOT IN ('admin', 'superadmin')
      ORDER BY ar.clock_in ASC NULLS LAST
      LIMIT 10`,
      []
    ),

    // 5. Pending leave queue (real-time — 4 rows for dashboard widget)
    query<PendingLeaveRow>(
      `SELECT
        lr.id,
        u.name_th AS employee_name_th,
        u.employee_id AS employee_code,
        lt.name_th AS leave_type_name_th,
        lr.start_date::text,
        lr.end_date::text,
        lr.days_requested,
        COALESCE(lr.notes, '') AS reason,
        lr.created_at::text,
        (lr.start_date <= CURRENT_DATE + 1) AS is_urgent,
        COALESCE(approver.name_th, '') AS approver_name_th
      FROM leave_requests lr
      JOIN users u ON u.id = lr.employee_id
      JOIN leave_types lt ON lt.id = lr.leave_type_id
      LEFT JOIN users approver ON approver.id = lr.approved_by
      WHERE lr.status = 'submitted'
      ORDER BY lr.created_at ASC
      LIMIT 4`,
      []
    ),

    // 6. Upcoming anniversary events
    query<UpcomingEventRow>(
      `SELECT
        u.id AS employee_id,
        u.name_th,
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
      LIMIT 10`,
      []
    )
  ]);
  ```

- [ ] **Step 4: Update the return block**

  Replace the existing `return apiSuccess({...})` block with:
  ```typescript
  const headcountByDept = (snapshot?.dept_headcount ?? []).map((d, i: number) => ({
    ...d,
    color: DEPT_COLORS[i % DEPT_COLORS.length]
  }));

  return apiSuccess({
    totalEmployees: parseInt(snapshot?.total_employees || '0'),
    activeEmployees: parseInt(snapshot?.active_employees || '0'),
    probationCount: parseInt(snapshot?.probation_count || '0'),
    probationDaysRemaining: null,
    resignedThisMonth: parseInt(snapshot?.resigned_this_month || '0'),
    presentToday: parseInt(attendanceStats?.present || '0'),
    lateCount: parseInt(attendanceStats?.late || '0'),
    absentCount: parseInt(attendanceStats?.absent || '0'),
    onLeaveToday: parseInt(attendanceStats?.on_leave || '0'),
    pendingLeaveCount: parseInt(pendingLeaveCount?.pending || '0'),
    latestPayrollNet: snapshot?.latest_payroll ? parseFloat(snapshot.latest_payroll.total_net) : null,
    latestPayrollDate: snapshot?.latest_payroll
      ? `${snapshot.latest_payroll.period_month}/${snapshot.latest_payroll.period_year}`
      : null,
    employees: {
      total: parseInt(snapshot?.total_employees || '0'),
      active: parseInt(snapshot?.active_employees || '0'),
    },
    departments: headcountByDept.length,
    leave: { pending: parseInt(pendingLeaveCount?.pending || '0') },
    attendance: {
      present: parseInt(attendanceStats?.present || '0'),
      late: parseInt(attendanceStats?.late || '0'),
      absent: parseInt(attendanceStats?.absent || '0'),
    },
    payroll: snapshot?.latest_payroll ?? null,
    attendanceFeed,
    pendingLeaveQueue,
    headcountByDept,
    upcoming: upcomingEvents,
  });
  ```

- [ ] **Step 5: Remove unused variables**

  Delete the `DEPT_COLORS` array from the top of the GET handler — it is now referenced in the return block above. **Keep it.** It was already declared at line 52 and is still used in `headcountByDept`. Do not delete it.

  Remove any references to the old variables that no longer exist: `empStats`, `deptStats`, `leaveStats`, `latestPayroll`, `deptHeadcount`. If the file has no other references to them, they are gone with the `Promise.all` replacement.

- [ ] **Step 6: Run qa:verify**

  ```bash
  npm run qa:verify
  ```

  Expected: 0 errors. If `'empStats' is declared but never used` appears, the old variable was not fully removed. Search the file for `empStats` and delete remaining references.

---

## Task 4 — Trigger Refresh After Payroll Approve (`app/api/hr/payroll-runs/[id]/route.ts`)

- [ ] **Step 1: Locate the `approve` action block**

  In `app/api/hr/payroll-runs/[id]/route.ts`, find the `if (action === 'approve')` block (around line 58). It ends with:
  ```typescript
    } finally {
      client.release();
    }
  }
  ```

- [ ] **Step 2: Add refresh call after the approve transaction completes**

  After the `finally { client.release(); }` block inside `if (action === 'approve')`, add:
  ```typescript
  // Refresh materialized view — payroll latest_payroll field is now stale
  await query(`REFRESH MATERIALIZED VIEW CONCURRENTLY hr_stats_snapshot`, []).catch(() => {
    // Non-fatal: view will be refreshed by nightly cron if this fails
  });
  ```

  The `.catch()` swallows errors — a failed refresh must never fail the approve action itself.

- [ ] **Step 3: Run qa:verify**

  ```bash
  npm run qa:verify
  ```

  Expected: 0 errors.

---

## Task 5 — Create Vercel Cron Job (`vercel.json`)

- [ ] **Step 1: Create vercel.json**

  Create `vercel.json` in the project root:
  ```json
  {
    "crons": [
      {
        "path": "/api/admin/snapshots/refresh?target=hr_stats",
        "schedule": "0 1 * * *"
      }
    ]
  }
  ```

  `0 1 * * *` = 01:00 UTC daily (08:00 Bangkok time, before work day starts).

  **Note:** Vercel Cron Jobs call the endpoint without authentication headers. The refresh endpoint uses `assertRole(u, ['admin'])` which will reject unauthenticated cron calls. To support cron, add a cron secret check:

  Update `app/api/admin/snapshots/refresh/route.ts` — replace the auth block:
  ```typescript
  export async function POST(req: NextRequest) {
    // Allow Vercel Cron calls via secret header
    const cronSecret = req.headers.get('authorization');
    const isCron = cronSecret === `Bearer ${process.env.CRON_SECRET}`;

    if (!isCron) {
      const session = await auth();
      if (!session) return apiError('Unauthorized', 401);
      const u = session.user as unknown as SessionUser;
      try { assertRole(u, ['admin']); } catch { return apiError('Forbidden', 403); }
    }

    // ... rest of handler unchanged
  ```

  Add `CRON_SECRET=<random-string>` to `.env` and Vercel environment variables.  
  In Vercel dashboard: Settings → Environment Variables → add `CRON_SECRET`.  
  In `vercel.json` header config is automatic — Vercel sends `Authorization: Bearer <CRON_SECRET>` to cron paths.

- [ ] **Step 2: Run qa:verify**

  ```bash
  npm run qa:verify
  ```

  Expected: 0 errors.

- [ ] **Step 3: Commit all changes**

  ```bash
  git add migrations/069_hr_stats_snapshot.sql \
          app/api/admin/snapshots/refresh/route.ts \
          app/api/hr/stats/route.ts \
          app/api/hr/payroll-runs/[id]/route.ts \
          vercel.json
  git commit -m "perf(tier2): add hr_stats materialized view, refresh endpoint, Vercel cron, composite indexes"
  ```

---

## QA Checklist

- [ ] `npm run qa:verify` → 0 errors
- [ ] `migrations/069_hr_stats_snapshot.sql` applied successfully
- [ ] `hr_stats_snapshot` view exists and returns 1 row: `SELECT * FROM hr_stats_snapshot;`
- [ ] `POST /api/admin/snapshots/refresh?target=hr_stats` returns 200 (as admin)
- [ ] `GET /api/hr/stats` returns identical response shape as before (all fields present)
- [ ] `vercel.json` exists with cron entry
- [ ] `CRON_SECRET` env var set in `.env` and Vercel dashboard
- [ ] No `console.log` / `// TODO` in modified files

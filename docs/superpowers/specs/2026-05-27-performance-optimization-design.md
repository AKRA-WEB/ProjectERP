---
title: "Performance Optimization — Vercel + Supabase + Query Fixes"
date: 2026-05-27
status: Approved
author: Claude (Architect)
tracks:
  - perf-tier1-connection-query
  - perf-tier2-materialized-views
  - perf-tier3-frontend-bundle
---

# Performance Optimization Design

## Context

BUYMORE ERP runs on Next.js 15 App Router deployed to **Vercel Serverless** with **PostgreSQL on Supabase**. Three categories of lag identified:

1. `pg.Pool` on Vercel serverless creates a new pool per function instance — with `max: 3`, concurrent requests exhaust Supabase's direct connection limit.
2. `inventory-valuation` FIFO mode runs a LATERAL subquery against `stock_ledger` once per row in `stock_balances` — N+1 at the database engine level.
3. HR dashboard stats (`/api/hr/stats`) fires 9 parallel DB queries on every page load, most returning slowly-changing aggregates.

Note: Most API routes already use `Promise.all` correctly. Async waterfalls are not the primary issue.

---

## Tier 1 — Connection Layer + FIFO Query Fix

### 1.1 Supabase Transaction Pooler

**Problem:** `lib/db/client.ts` connects on port 5432 (direct). Each Vercel function instance creates its own `pg.Pool`. At `max: 3`, 20 concurrent users = 60 open connections — hits Supabase free-tier limit (60) and Pro limit degrades past ~100.

**Fix — `lib/db/client.ts`:**

```typescript
const pool = new Pool({
  connectionString: process.env.DATABASE_URL, // must point to port 6543
  max: 1,                     // 1 per function instance is sufficient
  idleTimeoutMillis: 0,       // Vercel kills the container; let PgBouncer manage idle
  connectionTimeoutMillis: 5000,
  ssl: { rejectUnauthorized: false },
});
```

**Fix — `.env` / Vercel environment variable:**

```
DATABASE_URL=postgresql://<user>:<pass>@<project>.supabase.co:6543/postgres?pgbouncer=true
```

`?pgbouncer=true` disables prepared statements — required for Transaction mode pooler. Without it, `pg` sends `PREPARE` statements that PgBouncer cannot route correctly across connections.

**Supabase dashboard:** Project Settings → Database → Connection Pooling → Mode: **Transaction** → port 6543.

**Impact:** Connection count drops from `N_instances × 3` to `N_instances × 1`. PgBouncer handles the actual connection reuse. Eliminates connection exhaustion under load.

---

### 1.2 FIFO LATERAL N+1 Fix

**Problem:** `app/api/reports/inventory-valuation/route.ts` FIFO mode:

```sql
-- Current: runs once PER ROW in stock_balances
JOIN LATERAL (
  SELECT unit_cost
  FROM stock_ledger
  WHERE product_id = sb.product_id
    AND warehouse_id = sb.warehouse_id
    AND entry_type = 'grn_receipt'
  ORDER BY created_at DESC
  LIMIT 1
) sl_fifo ON TRUE
```

500 active SKUs × warehouses = potentially 2,000+ stock_ledger subqueries per report load.

**Fix — replace LATERAL with CTE:**

```sql
WITH latest_grn_cost AS (
  SELECT DISTINCT ON (product_id, warehouse_id)
    product_id,
    warehouse_id,
    unit_cost
  FROM stock_ledger
  WHERE entry_type = 'grn_receipt'
  ORDER BY product_id, warehouse_id, created_at DESC
)
SELECT
  ...
  COALESCE(lc.unit_cost, COALESCE(NULLIF(p.moving_avg_cost, 0), p.unit_cost)) AS unit_cost,
  ...
FROM stock_balances sb
JOIN products p ON p.id = sb.product_id
JOIN warehouses w ON w.id = sb.warehouse_id
JOIN units_of_measure u ON u.id = p.uom_id
LEFT JOIN product_categories c ON c.id = p.category_id
LEFT JOIN latest_grn_cost lc
  ON lc.product_id = sb.product_id
 AND lc.warehouse_id = sb.warehouse_id
WHERE ...
```

CTE executes once; result is hash-joined — O(N) not O(N²).

---

### 1.3 Supporting Index for DISTINCT ON

```sql
-- migrations/068_perf_indexes.sql
BEGIN;

-- Supports latest_grn_cost CTE: DISTINCT ON (product_id, warehouse_id) ORDER BY created_at DESC
CREATE INDEX IF NOT EXISTS idx_ledger_cost_lookup
  ON stock_ledger(product_id, warehouse_id, created_at DESC)
  WHERE entry_type = 'grn_receipt';

COMMIT;
```

---

## Tier 2 — Materialized Views + HR Composite Indexes

### 2.1 HR Stats Materialized View

**Problem:** `/api/hr/stats` fires 9 parallel queries on every HR dashboard load. Employee counts, dept headcount, and latest payroll are slow-changing — recalculating them per request is wasteful.

**Strategy:** Split into static (mat view) + dynamic (real-time):

| Data | Strategy | Refresh trigger |
|------|----------|-----------------|
| Employee counts (total/active/probation) | `hr_stats_snapshot` mat view | Nightly + on hire/resign |
| Dept headcount JSON | `hr_stats_snapshot` mat view | Nightly |
| Latest payroll summary | `hr_stats_snapshot` mat view | After payroll run approved |
| Today's attendance stats | Real-time query | — (changes per minute) |
| Pending leave queue | Real-time query | — (4 rows, lightweight) |
| Today's attendance feed | Real-time query | — |

**Migration (`069_hr_stats_snapshot.sql`):**

```sql
BEGIN;

CREATE MATERIALIZED VIEW hr_stats_snapshot AS
SELECT
  COUNT(*)                                                                        AS total_employees,
  COUNT(*) FILTER (WHERE employee_status = 'active')                              AS active_employees,
  COUNT(*) FILTER (WHERE hired_date >= CURRENT_DATE - 120)                        AS probation_count,
  COUNT(*) FILTER (WHERE resignation_date >= date_trunc('month', CURRENT_DATE))   AS resigned_this_month,
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

-- Single-row view — unique index required for CONCURRENTLY refresh
CREATE UNIQUE INDEX ON hr_stats_snapshot ((1));

COMMIT;
```

**Refresh endpoint:** `POST /api/admin/snapshots/refresh` — accepts `?target=hr_stats`  
Auth: `assertRole(u, ['admin'])` only.

```typescript
await query(`REFRESH MATERIALIZED VIEW CONCURRENTLY hr_stats_snapshot`, []);
return apiSuccess({ refreshed: 'hr_stats_snapshot' });
```

**Trigger points:**
- Nightly via **Vercel Cron Job** in `vercel.json`: `{ "crons": [{ "path": "/api/admin/snapshots/refresh?target=hr_stats", "schedule": "0 1 * * *" }] }` (01:00 UTC daily)
- After `PATCH /api/hr/employees/[id]` (hire/resign/status change)
- After `PATCH /api/hr/payroll-runs/[id]` action `approve`

**Updated `/api/hr/stats` GET:** Replace 5 of the 9 queries with single mat view read:

```typescript
const [snapshot, attendanceStats, attendanceFeed, pendingLeaveQueue, upcomingEvents] = await Promise.all([
  queryOne(`SELECT * FROM hr_stats_snapshot`, []),
  // ... remaining 4 real-time queries unchanged
]);
```

---

### 2.2 HR Composite Indexes

```sql
-- in migration 069 (append after mat view)

-- attendance_records: queried by work_date = CURRENT_DATE on every hr/stats load
CREATE INDEX IF NOT EXISTS idx_attendance_date_employee
  ON attendance_records(work_date DESC, employee_id);

-- leave_requests: status filter + date sort (pending queue)
CREATE INDEX IF NOT EXISTS idx_leave_status_created
  ON leave_requests(status, created_at ASC);

-- leave_requests: date range overlap check (on_leave today count)
CREATE INDEX IF NOT EXISTS idx_leave_employee_dates
  ON leave_requests(employee_id, start_date, end_date)
  WHERE status = 'approved';
```

---

## Tier 3 — Frontend Bundle Audit

### 3.1 Bundle Analysis (prerequisite step)

Before touching any import, run bundle analyzer to identify actual problem chunks:

```bash
npm install --save-dev @next/bundle-analyzer
# next.config.ts: wrap export with withBundleAnalyzer({ enabled: process.env.ANALYZE === 'true' })
ANALYZE=true npm run build
```

**Target:** any client chunk > 100 KB unexplained by business logic.

### 3.2 `next/dynamic` Candidates

Apply only to components confirmed heavy by analyzer. Likely candidates:

| Component area | Rationale |
|---------------|-----------|
| Analytics SVG dashboards (SKU cut, S-curve) | Custom SVG + data computation |
| Geo tracking map (`/field-sales`) | Map rendering |
| Large modals with embedded tables | Not visible on initial render |

Pattern:
```typescript
const HeavyComponent = dynamic(() => import('@/components/HeavyComponent'), {
  ssr: false,
  loading: () => <div className="h-64 animate-pulse bg-stone-100 rounded-lg" />,
});
```

### 3.3 Barrel Import (`components/ui/index.ts`)

Next.js 15 + SWC handles tree-shaking on barrel files adequately. **Do not refactor until bundle analyzer confirms it as a problem.** Premature barrel splitting creates more churn than savings.

---

## Implementation Tracks

| # | Track slug | Scope | Migration(s) |
|---|-----------|-------|-------------|
| 1 | `perf-tier1-connection-query` | Pool config + FIFO CTE fix + index | `068_perf_indexes.sql` |
| 2 | `perf-tier2-materialized-views` | HR stats mat view + composite indexes | `069_hr_stats_snapshot.sql` |
| 3 | `perf-tier3-frontend-bundle` | Bundle analyzer + selective dynamic imports | none |

Execute sequentially. Measure response time on `/api/hr/stats` and `/api/reports/inventory-valuation?method=fifo` before and after Tier 1 to decide whether Tier 2 and 3 are worth the investment.

---

## Success Criteria

| Metric | Baseline (expected) | Target |
|--------|-------------------|--------|
| Supabase active connections under 20 concurrent users | ~60 (3 × 20) | < 20 (1 × 20, pooled) |
| `GET /api/reports/inventory-valuation?method=fifo` (500 SKUs) | ~800–2000ms | < 200ms |
| `GET /api/hr/stats` (cold) | ~300–600ms | < 100ms (mat view read) |
| Vercel function timeout errors under load | occasional | zero |

---

## Constraints

- `REFRESH MATERIALIZED VIEW CONCURRENTLY` requires the unique index — do not omit it.
- Transaction pooler (port 6543) does not support PostgreSQL prepared statements — `?pgbouncer=true` in DATABASE_URL is mandatory.
- Tier 3 dynamic imports: only apply after bundle analyzer confirms > 50 KB savings per component. Do not apply speculatively.
- Migration 068 and 069 must be new files — never edit applied migrations.

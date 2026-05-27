---
track:perf-tier1-connection-query
title: "Performance Tier 1 — Supabase Transaction Pooler + FIFO CTE Fix"
status: Verified
created: 2026-05-27
updated: 2026-05-27
spec: docs/superpowers/specs/2026-05-27-performance-optimization-design.md
---

# Performance Tier 1 — Connection Layer + FIFO Query Fix

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Eliminate connection exhaustion on Vercel Serverless and remove N+1 LATERAL subquery in FIFO inventory valuation.

**Architecture:** Two independent code changes — (1) pool config + env var pointing to Supabase Transaction Pooler port 6543, (2) replace LATERAL subquery with CTE + covering index in `migrations/068_perf_indexes.sql`.

**Tech Stack:** Next.js 15 · `pg` Pool · PostgreSQL on Supabase · Vercel Serverless

**No test suite.** QA gate = `npm run qa:verify` (ESLint + `tsc --noEmit`) — must be 0 errors before marking done.

---

## Architectural Gates

1. **Transaction Boundary:** No multi-table writes in this track.
2. **Doc Number:** Not applicable.
3. **Child Table Inserts:** Not applicable.
4. **Side Effects:** None — pool config is infrastructure-only; CTE is read-only query change.
5. **Response Shape:** No API response shape changes — same `ValuationRow[]` output.

---

## Files

| Action | Path |
|--------|------|
| Modify | `lib/db/client.ts` |
| Modify | `app/api/reports/inventory-valuation/route.ts` |
| Create | `migrations/068_perf_indexes.sql` |
| Env change | `.env` (local) + Vercel environment variable |

---

## Task 1 — Update Pool Config (`lib/db/client.ts`)

**Files:**
- Modify: `lib/db/client.ts`

- [ ] **Step 1: Read current file**

  Open `lib/db/client.ts`. Current content:
  ```typescript
  import { Pool } from 'pg';

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 3,
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 5000,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  });
  ```

- [ ] **Step 2: Replace pool config**

  Replace the entire file with:
  ```typescript
  import { Pool } from 'pg';

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 1,
    idleTimeoutMillis: 0,
    connectionTimeoutMillis: 5000,
    ssl: { rejectUnauthorized: false },
  });

  export default pool;

  export async function query<T = unknown>(text: string, params?: unknown[]): Promise<T[]> {
    const result = await pool.query(text, params);
    return result.rows as T[];
  }

  export async function queryOne<T = unknown>(text: string, params?: unknown[]): Promise<T | null> {
    const result = await pool.query(text, params);
    return (result.rows[0] as T) ?? null;
  }
  ```

  **Why:** `max: 1` — each Vercel function instance needs only 1 connection; PgBouncer handles reuse. `idleTimeoutMillis: 0` — Vercel kills the container anyway; let PgBouncer manage idle. `ssl: { rejectUnauthorized: false }` always-on — Supabase requires SSL in all environments.

- [ ] **Step 3: Update DATABASE_URL in `.env`**

  In `.env`, change the DATABASE_URL to use **port 6543** with `?pgbouncer=true`:
  ```
  DATABASE_URL=postgresql://<user>:<password>@<project-ref>.supabase.co:6543/postgres?pgbouncer=true
  ```

  Find the Transaction Pooler connection string in: **Supabase Dashboard → Project Settings → Database → Connection Pooling → Mode: Transaction → Connection string**.

  `?pgbouncer=true` disables `pg` prepared statements. Transaction mode pooler cannot route `PREPARE`/`EXECUTE` across connections — omitting this causes `ERROR: prepared statement "..." already exists`.

- [ ] **Step 4: Verify Supabase dashboard has Transaction mode enabled**

  Supabase Dashboard → Project Settings → Database → Connection Pooling:
  - Mode: **Transaction**
  - Pool Size: 15 (default is fine)
  - Port: 6543 ✓

- [ ] **Step 5: Run qa:verify**

  ```bash
  npm run qa:verify
  ```

  Expected: 0 errors. If TypeScript errors appear, they are pre-existing — do not fix unrelated issues.

---

## Task 2 — Add Covering Index (`migrations/068_perf_indexes.sql`)

**Files:**
- Create: `migrations/068_perf_indexes.sql`

- [ ] **Step 1: Create migration file**

  Create `migrations/068_perf_indexes.sql`:
  ```sql
  BEGIN;

  -- Supports CTE: DISTINCT ON (product_id, warehouse_id) ORDER BY created_at DESC
  -- Used by inventory-valuation FIFO mode to find latest grn_receipt cost per SKU/warehouse
  CREATE INDEX IF NOT EXISTS idx_ledger_cost_lookup
    ON stock_ledger(product_id, warehouse_id, created_at DESC)
    WHERE entry_type = 'grn_receipt';

  COMMIT;
  ```

- [ ] **Step 2: Run migration**

  ```bash
  npm run migrate
  ```

  Expected output: `Applied: 068_perf_indexes.sql` (or similar success message). No errors.

---

## Task 3 — Fix FIFO LATERAL N+1 (`app/api/reports/inventory-valuation/route.ts`)

**Files:**
- Modify: `app/api/reports/inventory-valuation/route.ts` lines 64–104

- [ ] **Step 1: Locate the LATERAL join section**

  Find lines 64–104 in `app/api/reports/inventory-valuation/route.ts`:
  ```typescript
  const costExpr = method === 'fifo'
    ? 'COALESCE(sl_fifo.unit_cost, COALESCE(NULLIF(p.moving_avg_cost, 0), p.unit_cost))'
    : 'COALESCE(NULLIF(p.moving_avg_cost, 0), p.unit_cost)';

  const joinExpr = method === 'fifo'
    ? `JOIN LATERAL (
         SELECT unit_cost
         FROM stock_ledger
         WHERE product_id = sb.product_id
           AND warehouse_id = sb.warehouse_id
           AND entry_type = 'grn_receipt'
         ORDER BY created_at DESC
         LIMIT 1
       ) sl_fifo ON TRUE`
    : '';

  const queryStr = `
    SELECT
       ...
       ${costExpr}                               AS unit_cost,
       ...
       ROUND(sb.qty_on_hand * ${costExpr}, 2)    AS total_value
     FROM stock_balances sb
     ...
     ${joinExpr}
     ${where}
     ORDER BY w.code, c.name_th NULLS LAST, p.sku`;
  ```

- [ ] **Step 2: Replace with CTE approach**

  Replace lines 64–104 with:
  ```typescript
  const cteExpr = method === 'fifo'
    ? `WITH latest_grn_cost AS (
         SELECT DISTINCT ON (product_id, warehouse_id)
           product_id, warehouse_id, unit_cost
         FROM stock_ledger
         WHERE entry_type = 'grn_receipt'
         ORDER BY product_id, warehouse_id, created_at DESC
       )`
    : '';

  const fifoJoin = method === 'fifo'
    ? `LEFT JOIN latest_grn_cost lc
         ON lc.product_id = sb.product_id
        AND lc.warehouse_id = sb.warehouse_id`
    : '';

  const costExpr = method === 'fifo'
    ? 'COALESCE(lc.unit_cost, COALESCE(NULLIF(p.moving_avg_cost, 0), p.unit_cost))'
    : 'COALESCE(NULLIF(p.moving_avg_cost, 0), p.unit_cost)';

  const queryStr = `
    ${cteExpr}
    SELECT
       w.id                                      AS warehouse_id,
       w.code                                    AS warehouse_code,
       w.name_th                                 AS warehouse_name,
       c.name_th                                 AS category_name,
       p.id                                      AS product_id,
       p.sku,
       p.name_th                                 AS product_name_th,
       p.name_en                                 AS product_name_en,
       ${costExpr}                               AS unit_cost,
       p.moving_avg_cost                         AS moving_avg_cost,
       p.unit_cost                               AS legacy_unit_cost,
       u.code                                    AS uom_code,
       sb.qty_on_hand,
       sb.qty_available,
       ROUND(sb.qty_on_hand * ${costExpr}, 2)    AS total_value
     FROM stock_balances sb
     JOIN products p             ON p.id  = sb.product_id
     JOIN warehouses w           ON w.id  = sb.warehouse_id
     JOIN units_of_measure u     ON u.id  = p.uom_id
     LEFT JOIN product_categories c ON c.id = p.category_id
     ${fifoJoin}
     ${where}
     ORDER BY w.code, c.name_th NULLS LAST, p.sku`;
  ```

  **Why:** CTE executes once, result hash-joined — O(N) not O(N²). The covering index `idx_ledger_cost_lookup` created in Task 2 makes the DISTINCT ON fast.

  **Note:** When `method !== 'fifo'`, `cteExpr = ''` so queryStr starts with whitespace — harmless, PostgreSQL ignores leading whitespace.

- [ ] **Step 3: Run qa:verify**

  ```bash
  npm run qa:verify
  ```

  Expected: 0 errors, 0 warnings.

- [ ] **Step 4: Manual smoke test**

  ```bash
  npm run dev
  ```

  Navigate to `/inventory/ledger` or the inventory valuation report page. Switch method to FIFO. Confirm page loads without 500 error and returns data.

- [ ] **Step 5: Commit**

  ```bash
  git add lib/db/client.ts migrations/068_perf_indexes.sql app/api/reports/inventory-valuation/route.ts
  git commit -m "perf(tier1): switch to Supabase Transaction Pooler, fix FIFO LATERAL N+1 with CTE"
  ```

---

## QA Checklist

- [ ] `npm run qa:verify` → 0 errors
- [ ] `migrations/068_perf_indexes.sql` applied successfully
- [ ] `lib/db/client.ts` has `max: 1`, `idleTimeoutMillis: 0`
- [ ] DATABASE_URL in `.env` uses port 6543 with `?pgbouncer=true`
- [ ] `joinExpr` variable removed from `inventory-valuation/route.ts` — no references remain
- [ ] FIFO valuation report loads without error
- [ ] No `console.log` / `// TODO` left in modified files

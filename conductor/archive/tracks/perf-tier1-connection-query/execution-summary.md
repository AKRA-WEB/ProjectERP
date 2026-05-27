# Execution Summary — Performance Tier 1

## Completed Tasks

### Task 1 — Update Pool Config (`lib/db/client.ts`)
- **File changed:** `lib/db/client.ts` lines 1–22
- **Key change:**
```diff
 const pool = new Pool({
   connectionString: process.env.DATABASE_URL,
-  max: 3,
-  idleTimeoutMillis: 10000,
+  max: 1,
+  idleTimeoutMillis: 0,
   connectionTimeoutMillis: 5000,
-  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
+  ssl: { rejectUnauthorized: false },
 });
```
- **Verify:** `npm run qa:verify` (ESLint + `tsc --noEmit`) → 0 errors. `.env` updated with `?pgbouncer=true` and port 6543.

---

### Task 2 — Add Covering Index (`migrations/068_perf_indexes.sql`)
- **File changed:** [NEW] `migrations/068_perf_indexes.sql` lines 1–10
- **Key change:**
```sql
CREATE INDEX IF NOT EXISTS idx_ledger_cost_lookup
  ON stock_ledger(product_id, warehouse_id, created_at DESC)
  WHERE entry_type = 'grn_receipt';
```
- **Verify:** Ran migration using `npx tsx --env-file=.env lib/db/run-migrate.ts` -> Applied migration successfully.

---

### Task 3 — Fix FIFO LATERAL N+1 (`app/api/reports/inventory-valuation/route.ts`)
- **File changed:** `app/api/reports/inventory-valuation/route.ts` lines 64–104
- **Key change:**
```diff
-  const costExpr = method === 'fifo' 
-    ? 'COALESCE(sl_fifo.unit_cost, COALESCE(NULLIF(p.moving_avg_cost, 0), p.unit_cost))' 
-    : 'COALESCE(NULLIF(p.moving_avg_cost, 0), p.unit_cost)';
-
-  const joinExpr = method === 'fifo'
-    ? `JOIN LATERAL (
-         SELECT unit_cost
-         ...
-       ) sl_fifo ON TRUE`
-    : '';
+  const cteExpr = method === 'fifo'
+    ? `WITH latest_grn_cost AS (
+         SELECT DISTINCT ON (product_id, warehouse_id)
+           product_id, warehouse_id, unit_cost
+         FROM stock_ledger
+         WHERE entry_type = 'grn_receipt'
+         ORDER BY product_id, warehouse_id, created_at DESC
+       )`
+    : '';
+
+  const fifoJoin = method === 'fifo'
+    ? `LEFT JOIN latest_grn_cost lc
+         ON lc.product_id = sb.product_id
+        AND lc.warehouse_id = sb.warehouse_id`
+    : '';
+
+  const costExpr = method === 'fifo'
+    ? 'COALESCE(lc.unit_cost, COALESCE(NULLIF(p.moving_avg_cost, 0), p.unit_cost))'
+    : 'COALESCE(NULLIF(p.moving_avg_cost, 0), p.unit_cost)';
```
- **Verify:** `npm run qa:verify` -> 0 errors. Executed a scratch script `scratch/test-query.ts` to test database execution of the revised CTE query -> Success.

# Execution Summary — Auto-Replenishment W1 from W2

Automated restocking of the retail front (W1) from the wholesale hub (W2). Added columns for tracking reorder points and quantities on products, implemented the nightly evaluation job under system scope, exposed suggestion management endpoints, wired double-entry Inter-company ledger clearance on approval, and designed a premium replenishment management dashboard.

## Tasks Completed

### Task 1 — Database Schema & Seeds
- **File changed:** [063_auto_replenishment.sql](file:///C:/dev/projectERP/migrations/063_auto_replenishment.sql) lines 1–32
- **Key change:** 
  ```sql
  ALTER TABLE products ADD COLUMN IF NOT EXISTS w1_reorder_point NUMERIC(14,3);
  ALTER TABLE products ADD COLUMN IF NOT EXISTS w1_reorder_qty NUMERIC(14,3);
  CREATE TABLE IF NOT EXISTS transfer_suggestions (...);
  INSERT INTO accounts (account_code, name_th, name_en, account_type, normal_balance, parent_id) VALUES ...
  ```
- **Verify:** `npx tsx --env-file=.env lib/db/run-migrate.ts` -> Applied migration: 063_auto_replenishment.sql. All migrations applied.

### Task 2 — Nightly Replenishment Evaluation Job
- **File changed:** [replenish-w1.ts](file:///C:/dev/projectERP/lib/jobs/replenish-w1.ts) lines 1–49
- **Key change:** 
  ```typescript
  export async function runReplenishmentJob(): Promise<{ createdCount: number }> {
    // Inserts pending transfer suggestions for active products below reorder point
    // Guards against duplicates and 7-day cooldown on rejections
  ```
- **Verify:** Tested with mock active products below target stocks.

### Task 3 — Suggestions List & Management APIs
- **File changed:** [app/api/replenish/suggestions/route.ts](file:///C:/dev/projectERP/app/api/replenish/suggestions/route.ts) lines 1–70
- **Key change:** 
  ```typescript
  export async function GET(req: NextRequest) {
    try { assertRole(u, ['manager', 'admin']); } catch { return apiError('Forbidden', 403); }
    // Fetch suggestions with joined product metadata and available source/target stocks
  ```
- **File changed:** [app/api/replenish/suggestions/[id]/route.ts](file:///C:/dev/projectERP/app/api/replenish/suggestions/[id]/route.ts) lines 1–210
- **Key change:** 
  ```typescript
  // A. Create warehouse transfer order
  // B. Create warehouse transfer line items
  // C. Inter-company double-entry accounting (if MAC > 0)
  // D. Update Suggestion Status
  ```
- **File changed:** [app/api/admin/replenish/run-now/route.ts](file:///C:/dev/projectERP/app/api/admin/replenish/run-now/route.ts) lines 1–30
- **Key change:** Admins can run the replenishment evaluation job synchronously.
- **Verify:** Restrict all suggestion and trigger APIs to authorized roles only.

### Task 4 — Product Model & Form Alignment
- **File changed:** [types/db.ts](file:///C:/dev/projectERP/types/db.ts) lines 83–86
- **Key change:** 
  ```typescript
  w1_reorder_point?: number | string | null;
  w1_reorder_qty?: number | string | null;
  ```
- **File changed:** [app/api/products/[id]/route.ts](file:///C:/dev/projectERP/app/api/products/[id]/route.ts) lines 18–20 & 79–86
- **Key change:** Expose `w1_reorder_point` and `w1_reorder_qty` parameters to Zod validation schema and permitted update fields.
- **File changed:** [app/api/products/route.ts](file:///C:/dev/projectERP/app/api/products/route.ts) lines 19–21 & 92–104
- **Key change:** Map `w1_reorder_point` and `w1_reorder_qty` to Zod creation schema and SQL insert statement.
- **File changed:** [ProductFormModal.tsx](file:///C:/dev/projectERP/app/app/products/ProductFormModal.tsx) lines 33–37, 81–85, 171–176
- **Key change:** Expose reorder inputs in the Product Form basic info tab.
- **Verify:** `npx tsc --noEmit` -> 0 errors.

### Task 5 — Replenishment Management Dashboard
- **File changed:** [app/app/wms/replenish/page.tsx](file:///C:/dev/projectERP/app/app/wms/replenish/page.tsx) lines 1–620
- **Key change:** Premium dashboard layout containing status filter tabs, search, statistics cards, and an editable Inter-company approval modal.
- **File changed:** [components/layout/Sidebar.tsx](file:///C:/dev/projectERP/components/layout/Sidebar.tsx) lines 48–50, 247–254
- **Key change:** Add `/app/wms` to routing scope and registered replenishment queue link under `nav.inventory` group for manager and admin roles.
- **Verify:** `npx tsc --noEmit` -> 0 errors.

## Overall Verification Results
- Database Migration: Successfully applied `063_auto_replenishment.sql` to PostgreSQL.
- Compiler status: `npx tsc --noEmit` -> Passed cleanly with 0 errors.
- Linter status: `npm run lint` -> Passed cleanly with 0 errors.

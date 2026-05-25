# Execution Summary — Moving Average Cost (Track #18)

## Overview
Replaced the legacy single-cost basis with an automated Moving Average Cost (MAC) engine calculated in real time. We extended the products table with a `moving_avg_cost` column, added an insert-only stock ledger DB trigger to dynamically compute the blended cost per base unit on GRN stock-in events (preventing race conditions via strict row locks), implemented a comprehensive and idempotent backfill script, updated the API reporting layer, and added comparison columns on the user interface.

---

## Detailed Task Accomplishments

### Task 1 — Database Layer & Migration
- **File changed:** [058_moving_average_cost.sql](file:///C:/Users/AKRA-Panich-Front/OneDrive/02-2%20-%20AKRA/projectERP/migrations/058_moving_average_cost.sql)
- **Key change:** 
  ```sql
  ALTER TABLE products ADD COLUMN IF NOT EXISTS moving_avg_cost NUMERIC(14,4) NOT NULL DEFAULT 0;
  ```
  Installed `recalculate_mac()` trigger on `stock_ledger` AFTER INSERT (only on `'grn_receipt'`) to automatically update the MAC based on global quantity:
  ```sql
  new_mac := ((qty_before * old_mac) + (NEW.qty_change * NEW.unit_cost)) / qty_after;
  ```
  Integrated a robust sequential PL/pgSQL function `backfill_mac()` to reconstruct MAC for all products from full receipt history.
- **Verify:** Successful migration run → `Applied migration: 058_moving_average_cost.sql`

### Task 2 — Backend API realignments
- **File changed:** [route.ts](file:///C:/Users/AKRA-Panich-Front/OneDrive/02-2%20-%20AKRA/projectERP/app/api/reports/inventory-valuation/route.ts) lines 8-90
  - **Key change:** Added `moving_avg_cost` and `legacy_unit_cost` into the SQL SELECT statement. Configured `costExpr` to resolve using the newly added `moving_avg_cost` column, falling back to the legacy `unit_cost` when necessary:
    ```typescript
    const costExpr = method === 'fifo' 
      ? 'COALESCE(sl_fifo.unit_cost, COALESCE(NULLIF(p.moving_avg_cost, 0), p.unit_cost))' 
      : 'COALESCE(NULLIF(p.moving_avg_cost, 0), p.unit_cost)';
    ```
- **File changed:** [route.ts](file:///C:/Users/AKRA-Panich-Front/OneDrive/02-2%20-%20AKRA/projectERP/app/api/admin/mac/recalc/route.ts) [NEW]
  - **Key change:** Created a new endpoint `GET /api/admin/mac/recalc` which allows admins to trigger either global MAC recalculations or target a single product:
    ```typescript
    await client.query('SELECT backfill_mac()');
    ```
- **Verify:** `npx tsc --noEmit` & linter → 0 errors.

### Task 3 — Frontend UI Realignment
- **File changed:** [page.tsx](file:///C:/Users/AKRA-Panich-Front/OneDrive/02-2%20-%20AKRA/projectERP/app/app/inventory/valuation/page.tsx) lines 8-190
  - **Key change:** Integrated additional comparison headers and columns to compare `moving_avg_cost` and `legacy_unit_cost` on the table grid:
    ```tsx
    <th className="px-4 py-2.5 text-right font-medium text-stone-500">ต้นทุนเฉลี่ย (MAC)</th>
    <th className="px-4 py-2.5 text-right font-medium text-stone-500">ต้นทุนล่าสุด</th>
    ...
    <td className="px-4 py-2.5 text-right tabular-nums text-emerald-700 font-medium">{formatCurrency(row.moving_avg_cost)}</td>
    <td className="px-4 py-2.5 text-right tabular-nums text-stone-400 text-[12px]">{formatCurrency(row.legacy_unit_cost)}</td>
    ```
- **File changed:** [page.tsx](file:///C:/Users/AKRA-Panich-Front/OneDrive/02-2%20-%20AKRA/projectERP/app/app/products/%5Bid%5D/page.tsx) lines 21-125
  - **Key change:** Included `moving_avg_cost` in the product metadata interface and displayed the Moving Average Cost alongside the latest static cost:
    ```tsx
    <p className={LABEL_CLS}>ต้นทุนเฉลี่ย (MAC)</p>
    <p className="text-[14px] text-emerald-700 font-bold tabular-nums">{formatCurrency(product.moving_avg_cost ?? 0)}</p>
    ```
- **Verify:** `npm run qa:verify` (next lint && tsc --noEmit) → 0 errors, clean pass!

---

## Validation & Proof of Correctness
1. **Trigger Calculation:** Inserting a new `stock_ledger` row under type `'grn_receipt'` dynamically runs `recalculate_mac()`. It locks the row inside the transaction via `FOR UPDATE` to protect integrity.
2. **Backfill Success:** Verified global backfill successfully synced all active product `moving_avg_cost` metrics in one call without any manual calculation drift.
3. **Robustness:** 100% typescript compliance and 0 ESLint warnings.

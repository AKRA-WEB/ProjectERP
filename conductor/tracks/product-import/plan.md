---
track: product-import
status: Completed
owner: paku+puka
module: inventory
updated: 2026-05-17
---

# Product Import — Implementation Plan

## Overview

Add Excel (.xlsx) product import to the Inventory module. Expand the `products` table to match all 23 columns from the real POS export file (`data/imports/export_product_all_17_05_2026.xlsx`, 4,762 rows). Support upsert by SKU so re-imports are idempotent. Seed initial stock into `stock_ledger` for new products with qty > 0.

---

## Excel File Schema Reference

File: `data/imports/export_product_all_17_05_2026.xlsx` (1 sheet, 4,762 data rows)

| Col | Header | Type | Notes |
|-----|--------|------|-------|
| 0 | Product code | string | SKU, upsert key |
| 1 | Product name | string (Thai) | required |
| 2 | Product subname | string \| null | 947 rows populated |
| 3 | Category | string (Thai) | flat text, e.g. "แป้ง-ลัง" |
| 4 | Quantity | float | current stock (can be negative) |
| 5 | Unit | string (Thai UOM) | e.g. "ลัง", "กก." |
| 6 | Product detail | string | description, mostly empty |
| 7 | Cost | number | unit cost |
| 8 | Price | number | selling price |
| 9 | Notify when product less than | number | reorder_point |
| 10 | Discount type (1=Amount, 2=%) | 1\|2 | |
| 11 | Discount | number | discount value |
| 12 | Barcode type (1=Product code, 2=Custom code) | 1\|2 | |
| 13 | Custom barcode id | string \| null | EAN, e.g. "8859405406045" |
| 14 | Hide product in ecommerce | boolean | |
| 15 | URL Product image | string \| null | 1,066 rows have URL |
| 16 | s/n | null | all null, skip |
| 17 | imei1 | null | all null, skip |
| 18 | imei2 | null | all null, skip |
| 19 | Non vat | boolean | 1,893 rows true |
| 20 | Unlimited stock | boolean | all false |
| 21 | Hide product in e-menu | boolean | |
| 22 | Product Location | string \| null | bin location e.g. "W2-1F-1-1" |

---

## Gap Analysis — Current vs Required

Current `products` table (migration 003) is missing:

| New Column | Type | Default | Source Col |
|-----------|------|---------|------------|
| `name_sub` | VARCHAR(500) | NULL | 2 |
| `selling_price` | NUMERIC(15,2) | 0 | 8 |
| `discount_type` | SMALLINT | 1 | 10 |
| `discount_value` | NUMERIC(15,2) | 0 | 11 |
| `is_non_vat` | BOOLEAN | FALSE | 19 |
| `is_unlimited_stock` | BOOLEAN | FALSE | 20 |
| `hide_in_ecommerce` | BOOLEAN | FALSE | 14 |
| `hide_in_emenu` | BOOLEAN | FALSE | 21 |
| `image_url` | TEXT | NULL | 15 |
| `default_location` | VARCHAR(50) | NULL | 22 |

`ledger_entry_type` enum (migration 001) is missing value `'initial_import'`.

---

## Phase 1 — Migration (migrations/032_product_import_fields.sql)

### SQL

```sql
-- Add missing product fields
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS name_sub           VARCHAR(500),
  ADD COLUMN IF NOT EXISTS selling_price      NUMERIC(15,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_type      SMALLINT      NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS discount_value     NUMERIC(15,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_non_vat         BOOLEAN       NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_unlimited_stock BOOLEAN       NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS hide_in_ecommerce  BOOLEAN       NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS hide_in_emenu      BOOLEAN       NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS image_url          TEXT,
  ADD COLUMN IF NOT EXISTS default_location   VARCHAR(50);

-- Add initial_import to ledger enum (must run outside transaction in Postgres)
ALTER TYPE ledger_entry_type ADD VALUE IF NOT EXISTS 'initial_import';
```

> **Note:** `ALTER TYPE ... ADD VALUE` cannot run inside a transaction block. The migration runner must commit the ALTER TABLE first, then run the enum alter in a separate step, or use a DO block with `ALTER TYPE` outside BEGIN/COMMIT. Verify how `lib/db/migrate.ts` handles this — may need to split into two migration files (032a / 032b).

### Acceptance Criteria
- `npm run migrate` succeeds on existing DB
- `\d products` shows all 10 new columns with correct types and defaults
- `\dT+ ledger_entry_type` includes `'initial_import'`
- Existing rows: `selling_price = 0`, `is_non_vat = false`, etc.

---

## Phase 2 — Backend API (app/api/products/import/route.ts)

### 2.1 Endpoint Contract

```
POST /api/products/import
Content-Type: multipart/form-data
Field: file (.xlsx)
Auth: session required, roles: manager | admin

Response 200:
{
  inserted: number,
  updated: number,
  failed: number,
  errors: Array<{ row: number; sku: string; reason: string }>
}

Response 400: { error: "No file uploaded" }
Response 401: { error: "Unauthorized" }
Response 403: { error: "Forbidden" }
Response 500: { error: string }
```

### 2.2 Processing Logic

**Auth:**
```typescript
const session = await auth();
if (!session) return apiError('Unauthorized', 401);
const u = session.user as unknown as SessionUser;
try { assertRole(u, ['manager', 'admin']); } catch { return apiError('Forbidden', 403); }
```

**Parse xlsx** using `xlsx` npm package (already installed — confirmed in import-vendors track):
```typescript
const arrayBuffer = await file.arrayBuffer();
const wb = XLSX.read(arrayBuffer, { type: 'buffer' });
const ws = wb.Sheets[wb.SheetNames[0]];
const rows: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
const dataRows = rows.slice(1); // skip header
```

**Per-row processing (inside single pg transaction):**

1. **Validate:**
   - Skip (add to errors) if col 0 (SKU) is null/empty
   - Skip if col 1 (name) is null/empty

2. **Category upsert** (col 3):
   ```sql
   INSERT INTO product_categories (code, name_th, name_en)
   VALUES ($slugify(col3), $col3, $col3)
   ON CONFLICT (code) DO UPDATE SET name_th = EXCLUDED.name_th
   RETURNING id
   ```
   `slugify`: lowercase, replace `[^a-z0-9ก-๙]` with `-`, dedupe dashes

3. **UOM upsert** (col 5):
   ```sql
   INSERT INTO units_of_measure (code, name_th, name_en)
   VALUES ($col5, $col5, $col5)
   ON CONFLICT (code) DO NOTHING;
   SELECT id FROM units_of_measure WHERE code = $col5;
   ```

4. **Barcode logic:**
   - `col12 === 2 && col13 non-empty` → `barcode = col13`
   - else → `barcode = NULL`

5. **Product upsert:**
   ```sql
   INSERT INTO products (
     sku, name_th, name_sub, name_en, description_th,
     category_id, uom_id,
     unit_cost, selling_price,
     reorder_point, discount_type, discount_value,
     is_non_vat, is_unlimited_stock,
     hide_in_ecommerce, hide_in_emenu,
     image_url, default_location, barcode,
     is_active, created_by
   ) VALUES ($1..$22)
   ON CONFLICT (sku) DO UPDATE SET
     name_th = EXCLUDED.name_th,
     name_sub = EXCLUDED.name_sub,
     name_en = EXCLUDED.name_en,
     description_th = EXCLUDED.description_th,
     category_id = EXCLUDED.category_id,
     uom_id = EXCLUDED.uom_id,
     unit_cost = EXCLUDED.unit_cost,
     selling_price = EXCLUDED.selling_price,
     reorder_point = EXCLUDED.reorder_point,
     discount_type = EXCLUDED.discount_type,
     discount_value = EXCLUDED.discount_value,
     is_non_vat = EXCLUDED.is_non_vat,
     is_unlimited_stock = EXCLUDED.is_unlimited_stock,
     hide_in_ecommerce = EXCLUDED.hide_in_ecommerce,
     hide_in_emenu = EXCLUDED.hide_in_emenu,
     image_url = EXCLUDED.image_url,
     default_location = EXCLUDED.default_location,
     barcode = EXCLUDED.barcode,
     updated_at = NOW()
   RETURNING id, (xmax::text::int > 0) AS was_updated
   ```
   `xmax > 0` = row existed (updated). `xmax = 0` = new row (inserted).

6. **name_en:** Set `= name_th` (no English in file)

7. **Stock ledger for NEW products** (`was_updated = false` AND `col4 > 0`):
   - Lookup first warehouse in user's scope:
     ```sql
     SELECT id FROM warehouses
     WHERE is_active = true
     ORDER BY created_at ASC LIMIT 1
     ```
   - Get current `qty_on_hand` for that warehouse+product (should be 0 for new product):
     ```sql
     SELECT COALESCE(qty_on_hand, 0) FROM stock_balances
     WHERE warehouse_id = $wh AND product_id = $pid
     ```
   - Insert to stock_ledger:
     ```sql
     INSERT INTO stock_ledger
       (warehouse_id, product_id, entry_type, reference_type,
        qty_change, qty_after, unit_cost, notes, created_by)
     VALUES
       ($wh, $pid, 'initial_import', 'product_import',
        $col4, $col4, $col7, 'นำเข้าสต็อกเริ่มต้น', $userId)
     ```
   - `sync_stock_balances()` trigger fires automatically after INSERT

**Transaction scope:** Wrap ALL rows in ONE `BEGIN/COMMIT`. On unhandled throw → `ROLLBACK`, return 500 with message.

**Category/UOM caching:** Build Maps `categoryCache: Map<slug, UUID>` and `uomCache: Map<code, UUID>` before the loop to avoid repeated SELECTs for same values.

### 2.3 File
`app/api/products/import/route.ts`

### 2.4 Acceptance Criteria
- POST valid xlsx → `{ inserted: N, updated: M, failed: 0, errors: [] }`
- Re-import same file → `{ inserted: 0, updated: 4762, failed: 0 }`
- Row with empty SKU → in `errors[]`, not crash
- Row with empty name → in `errors[]`, not crash
- New category text → row in `product_categories`
- New UOM text → row in `units_of_measure`
- New product with qty > 0 → 1 row in `stock_ledger` with `entry_type='initial_import'`
- New product with qty ≤ 0 → no stock_ledger row
- Re-imported product → no second stock_ledger row
- Viewer role → 403
- Unauthenticated → 401
- col12=2 + non-empty col13 → product.barcode = col13 value
- col12=1 → product.barcode = NULL

---

## Phase 3 — Frontend UI

### 3.1 Files to modify/create

| File | Change |
|------|--------|
| `lib/api-client.ts` | Add `importProducts(file: File)` |
| `components/inventory/ProductImportModal.tsx` | New modal component |
| `app/(app)/inventory/page.tsx` | Wire import button + modal |

### 3.2 api-client.ts addition

```typescript
export async function importProducts(file: File): Promise<{
  inserted: number;
  updated: number;
  failed: number;
  errors: Array<{ row: number; sku: string; reason: string }>;
}> {
  const fd = new FormData();
  fd.append('file', file);
  const res = await fetch('/api/products/import', { method: 'POST', body: fd });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: 'Upload failed' }));
    throw new Error(body.error ?? 'Upload failed');
  }
  return res.json();
}
```

### 3.3 ProductImportModal component

State machine: `'idle' | 'uploading' | 'result' | 'error'`

**idle:**
- `<input type="file" accept=".xlsx">` (hidden, ref-triggered)
- Display: file name or "ยังไม่ได้เลือกไฟล์"
- "เลือกไฟล์" button (triggers input click)
- "นำเข้า" primary button — disabled until file selected

**uploading:**
- Spinner + "กำลังนำเข้าข้อมูล..." text
- Cancel not available (import is transactional)

**result:**
- 3 summary cards (green/inserted, blue/updated, red/failed)
- If `errors.length > 0`: table showing Row#, SKU, Reason
- "ปิด" button → calls `onSuccess()` to refresh parent list

**error:**
- Error message text
- "ลองใหม่" button → back to idle

### 3.4 Inventory page wiring

Find current products/inventory list page. Add button:
```tsx
<Button variant="outline" onClick={() => setShowImport(true)}>
  นำเข้าสินค้า (Excel)
</Button>
```
Mount `<ProductImportModal open={showImport} onSuccess={() => { setShowImport(false); refetch(); }} />`

---

## Task List

| # | Owner | File | Task |
|---|-------|------|------|
| 1 | paku | migrations/032_product_import_fields.sql | [x] ALTER TABLE products + ALTER TYPE ledger_entry_type |
| 2 | paku | app/api/products/import/route.ts | [x] POST import endpoint (parse xlsx, upsert, stock ledger) |
| 3 | puka | lib/api-client.ts | [x] Add importProducts() function |
| 4 | puka | components/inventory/ProductImportModal.tsx | [x] Import modal (idle/uploading/result states) |
| 5 | puka | app/(app)/inventory/page.tsx | [x] Wire "นำเข้าสินค้า" button + modal |

## Out of Scope
- s/n, imei1, imei2 columns (all null in real data — skip entirely)
- Ecommerce / e-menu feature implementation (columns stored, not UI-surfaced)
- Product image hosting (store URL only — display as `<img>` if present in product detail)
- Batch size pagination for very large files (4,762 rows fits in one transaction)

## QA Checklist
- [ ] `npm run migrate` succeeds with new 032 file
- [ ] `npx tsc --noEmit` passes after all files written
- [ ] POST /api/products/import with xlsx → `{ inserted, updated, failed, errors }`
- [ ] Re-import same file → `inserted: 0`, `updated: 4762`
- [ ] Row empty SKU → in errors[], import continues
- [ ] Row empty name_th → in errors[], import continues
- [ ] Viewer role → 403
- [ ] Unauthenticated → 401
- [ ] col12=2 + col13 present → barcode = col13
- [ ] col12=1 → barcode = NULL
- [ ] New product qty > 0 → 1 stock_ledger row, entry_type='initial_import'
- [ ] New product qty ≤ 0 → no stock_ledger row
- [ ] Re-imported product → no extra stock_ledger row
- [ ] New category → product_categories row created
- [ ] New UOM → units_of_measure row created
- [ ] File input accepts .xlsx only
- [ ] Upload progress: spinner shown, button disabled
- [ ] Result: summary cards + error table
- [ ] Modal close → product list refreshes

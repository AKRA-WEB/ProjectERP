# Product Import — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Excel (.xlsx) product import to the Inventory/Products page that upserts 4,762 real SKUs, expands the `products` table with 10 missing fields from the POS export schema, and seeds initial stock into `stock_ledger` for new products with qty > 0.

**Architecture:** Migration 032a adds 10 columns to `products`; migration 032b adds `initial_import` to the `ledger_entry_type` enum (separate file because `ALTER TYPE ADD VALUE` cannot run inside a BEGIN/COMMIT transaction block in PostgreSQL < 12). A new POST `/api/products/import` route parses the xlsx, upserts rows in one pg transaction, and returns a summary. The frontend modal attaches to the existing Products page.

**Tech Stack:** Next.js 15 App Router · TypeScript strict · PostgreSQL raw `pg` (pool from `lib/db/client.ts`) · `xlsx` npm package (already installed) · Tailwind CSS · React 19

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `migrations/032a_product_import_fields.sql` | ALTER TABLE products — 10 new columns |
| Create | `migrations/032b_ledger_entry_initial_import.sql` | ALTER TYPE ledger_entry_type ADD VALUE |
| Create | `app/api/products/import/route.ts` | POST import endpoint — parse xlsx, upsert, stock ledger |
| Modify | `lib/api-client.ts` | Add `importProducts(file)` using raw fetch (not JSON helper) |
| Create | `components/inventory/ProductImportModal.tsx` | Upload modal: idle → uploading → result states |
| Modify | `app/app/products/page.tsx` | Wire "นำเข้าสินค้า" button + modal |

---

## Task 1: Migration 032a — ALTER TABLE products

**Files:**
- Create: `migrations/032a_product_import_fields.sql`

- [ ] **Step 1: Create migration file**

```sql
-- migrations/032a_product_import_fields.sql
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
```

- [ ] **Step 2: Run migration**

```bash
npm run migrate
```

Expected output contains: `Applied migration: 032a_product_import_fields`

- [ ] **Step 3: Verify columns exist**

Connect to DB and run:
```sql
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'products'
AND column_name IN ('name_sub','selling_price','discount_type','discount_value',
                    'is_non_vat','is_unlimited_stock','hide_in_ecommerce',
                    'hide_in_emenu','image_url','default_location')
ORDER BY column_name;
```

Expected: 10 rows returned.

- [ ] **Step 4: Commit**

```bash
git add migrations/032a_product_import_fields.sql
git commit -m "feat: add product import fields to products table (migration 032a)"
```

---

## Task 2: Migration 032b — ledger_entry_type enum

**Files:**
- Create: `migrations/032b_ledger_entry_initial_import.sql`

> **Why separate file:** The migration runner in `lib/db/migrate.ts` wraps each `.sql` file in `BEGIN`/`COMMIT`. `ALTER TYPE ... ADD VALUE` cannot run inside a transaction block in PostgreSQL < 12. Keeping it separate means only this file needs special handling if the DB version is old.

- [ ] **Step 1: Create migration file**

```sql
-- migrations/032b_ledger_entry_initial_import.sql
ALTER TYPE ledger_entry_type ADD VALUE IF NOT EXISTS 'initial_import';
```

- [ ] **Step 2: Run migration**

```bash
npm run migrate
```

Expected output contains: `Applied migration: 032b_ledger_entry_initial_import`

If error `"ALTER TYPE ... ADD VALUE cannot run inside a transaction block"`: The DB is PostgreSQL < 12. Fix: connect directly and run the ALTER TYPE outside a transaction, then manually insert the migration version:
```sql
ALTER TYPE ledger_entry_type ADD VALUE IF NOT EXISTS 'initial_import';
INSERT INTO schema_migrations (version) VALUES ('032b_ledger_entry_initial_import');
```

- [ ] **Step 3: Verify enum value**

```sql
SELECT enumlabel FROM pg_enum
WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'ledger_entry_type')
ORDER BY enumsortorder;
```

Expected: includes `initial_import`.

- [ ] **Step 4: Commit**

```bash
git add migrations/032b_ledger_entry_initial_import.sql
git commit -m "feat: add initial_import to ledger_entry_type enum (migration 032b)"
```

---

## Task 3: POST /api/products/import route

**Files:**
- Create: `app/api/products/import/route.ts`

- [ ] **Step 1: Create the route file**

```typescript
// app/api/products/import/route.ts
import { auth } from '@/auth';
import { apiSuccess, apiError } from '@/lib/api-response';
import { assertRole } from '@/lib/authz';
import pool from '@/lib/db/client';
import type { SessionUser } from '@/lib/authz';
import * as XLSX from 'xlsx';

interface FailedRow {
  row: number;
  sku: string;
  reason: string;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^฀-๿a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);
}

function toFloat(val: unknown, fallback = 0): number {
  const n = Number(val);
  return isNaN(n) ? fallback : n;
}

function toBool(val: unknown, fallback = false): boolean {
  if (val === true || val === 'true' || val === 1) return true;
  if (val === false || val === 'false' || val === 0) return false;
  return fallback;
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;
  try { assertRole(u, ['manager', 'admin']); } catch { return apiError('Forbidden', 403); }

  const formData = await req.formData().catch(() => null);
  if (!formData) return apiError('Invalid form data', 400);
  const file = formData.get('file') as File | null;
  if (!file) return apiError('No file uploaded', 400);

  const arrayBuffer = await file.arrayBuffer();
  const wb = XLSX.read(Buffer.from(arrayBuffer), { type: 'buffer' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const allRows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null });
  const dataRows = allRows.slice(1) as unknown[][];

  // Resolve first available warehouse for stock seeding
  const client = await pool.connect();
  let firstWarehouseId: string | null = null;
  try {
    const whRow = await client.query<{ id: string }>(
      'SELECT id FROM warehouses WHERE is_active = true ORDER BY created_at ASC LIMIT 1'
    );
    firstWarehouseId = whRow.rows[0]?.id ?? null;
  } finally {
    client.release();
  }

  let inserted = 0;
  let updated = 0;
  const errors: FailedRow[] = [];

  // Pre-populate caches to avoid duplicate SELECTs inside loop
  const categoryCache = new Map<string, string>(); // slug → UUID
  const uomCache = new Map<string, string>();       // code → UUID

  const txClient = await pool.connect();
  try {
    await txClient.query('BEGIN');

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      const rowNum = i + 2; // 1-based + header
      const sku = String(row[0] ?? '').trim();
      const nameTh = String(row[1] ?? '').trim();

      if (!sku) { errors.push({ row: rowNum, sku: '', reason: 'Missing Product code (col A)' }); continue; }
      if (!nameTh) { errors.push({ row: rowNum, sku, reason: 'Missing Product name (col B)' }); continue; }

      try {
        // -- Category upsert --
        const catText = String(row[3] ?? 'ไม่ระบุหมวด').trim();
        const catSlug = slugify(catText) || 'other';
        let catId = categoryCache.get(catSlug);
        if (!catId) {
          const catRes = await txClient.query<{ id: string }>(
            `INSERT INTO product_categories (code, name_th, name_en)
             VALUES ($1, $2, $2)
             ON CONFLICT (code) DO UPDATE SET name_th = EXCLUDED.name_th
             RETURNING id`,
            [catSlug, catText]
          );
          catId = catRes.rows[0].id;
          categoryCache.set(catSlug, catId);
        }

        // -- UOM upsert --
        const uomCode = String(row[5] ?? 'หน่วย').trim() || 'หน่วย';
        let uomId = uomCache.get(uomCode);
        if (!uomId) {
          await txClient.query(
            `INSERT INTO units_of_measure (code, name_th, name_en)
             VALUES ($1, $2, $2)
             ON CONFLICT (code) DO NOTHING`,
            [uomCode, uomCode]
          );
          const uomRes = await txClient.query<{ id: string }>(
            'SELECT id FROM units_of_measure WHERE code = $1',
            [uomCode]
          );
          uomId = uomRes.rows[0].id;
          uomCache.set(uomCode, uomId);
        }

        // -- Barcode logic --
        const barcodeType = Number(row[12]);
        const customBarcode = String(row[13] ?? '').trim();
        const barcode = (barcodeType === 2 && customBarcode) ? customBarcode : null;

        // -- Product upsert --
        const prodRes = await txClient.query<{ id: string; was_updated: boolean }>(
          `INSERT INTO products (
             sku, name_th, name_sub, name_en, description_th,
             category_id, uom_id,
             unit_cost, selling_price,
             reorder_point, discount_type, discount_value,
             is_non_vat, is_unlimited_stock,
             hide_in_ecommerce, hide_in_emenu,
             image_url, default_location, barcode,
             is_active, created_by
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,true,$20)
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
           RETURNING id, (xmax::text::int > 0) AS was_updated`,
          [
            sku,
            nameTh,
            String(row[2] ?? '').trim() || null,   // name_sub
            nameTh,                                  // name_en = name_th
            String(row[6] ?? '').trim() || null,    // description_th
            catId,
            uomId,
            toFloat(row[7]),                         // unit_cost
            toFloat(row[8]),                         // selling_price
            Math.max(0, Math.round(toFloat(row[9]))), // reorder_point
            [1, 2].includes(Number(row[10])) ? Number(row[10]) : 1, // discount_type
            toFloat(row[11]),                        // discount_value
            toBool(row[19]),                         // is_non_vat
            toBool(row[20]),                         // is_unlimited_stock
            toBool(row[14]),                         // hide_in_ecommerce
            toBool(row[21]),                         // hide_in_emenu
            String(row[15] ?? '').trim() || null,   // image_url
            String(row[22] ?? '').trim() || null,   // default_location
            barcode,
            u.id,                                    // created_by
          ]
        );

        const { id: productId, was_updated: wasUpdated } = prodRes.rows[0];

        if (wasUpdated) {
          updated++;
        } else {
          inserted++;
          // Seed initial stock only for NEW products with qty > 0
          const qty = toFloat(row[4]);
          if (qty > 0 && firstWarehouseId) {
            const currentQty = await txClient.query<{ qty: string }>(
              `SELECT COALESCE(qty_on_hand, 0) AS qty FROM stock_balances
               WHERE warehouse_id = $1 AND product_id = $2`,
              [firstWarehouseId, productId]
            );
            const qtyBefore = toFloat(currentQty.rows[0]?.qty);
            await txClient.query(
              `INSERT INTO stock_ledger
                 (warehouse_id, product_id, entry_type, reference_type,
                  qty_change, qty_after, unit_cost, notes, created_by)
               VALUES ($1,$2,'initial_import','product_import',$3,$4,$5,$6,$7)`,
              [
                firstWarehouseId,
                productId,
                qty,
                qtyBefore + qty,
                toFloat(row[7]),
                'นำเข้าสต็อกเริ่มต้น',
                u.id,
              ]
            );
          }
        }
      } catch (rowErr: unknown) {
        const pgErr = rowErr as { code?: string; detail?: string; message?: string };
        const reason = pgErr.code === '23505'
          ? `Unique constraint violation: ${pgErr.detail ?? pgErr.message}`
          : (pgErr.message ?? 'Unknown error');
        errors.push({ row: rowNum, sku, reason });
      }
    }

    await txClient.query('COMMIT');
  } catch (err) {
    await txClient.query('ROLLBACK');
    throw err;
  } finally {
    txClient.release();
  }

  return apiSuccess({ inserted, updated, failed: errors.length, errors });
}
```

- [ ] **Step 2: Run TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors in `app/api/products/import/route.ts`.

- [ ] **Step 3: Commit**

```bash
git add app/api/products/import/route.ts
git commit -m "feat: add POST /api/products/import endpoint with xlsx upsert and stock seeding"
```

---

## Task 4: Add importProducts to api-client.ts

**Files:**
- Modify: `lib/api-client.ts`

> **Why raw fetch:** The existing `request()` helper in api-client.ts hardcodes `Content-Type: application/json`. Multipart FormData requires the browser to set its own boundary header — manually setting Content-Type breaks it.

- [ ] **Step 1: Add ImportResult type and importProducts function**

Add to the end of `lib/api-client.ts`:

```typescript
export interface ImportResult {
  inserted: number;
  updated: number;
  failed: number;
  errors: Array<{ row: number; sku: string; reason: string }>;
}

export async function importProducts(file: File): Promise<ImportResult> {
  const fd = new FormData();
  fd.append('file', file);
  const res = await fetch('/api/products/import', { method: 'POST', body: fd });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: 'Upload failed' }));
    throw new ApiError(res.status, body.error ?? 'Upload failed');
  }
  const body: { data: ImportResult } = await res.json();
  return body.data;
}
```

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add lib/api-client.ts
git commit -m "feat: add importProducts() to api-client for multipart xlsx upload"
```

---

## Task 5: ProductImportModal component

**Files:**
- Create: `components/inventory/ProductImportModal.tsx`

- [ ] **Step 1: Create the modal component**

```typescript
// components/inventory/ProductImportModal.tsx
'use client';

import { useRef, useState } from 'react';
import { importProducts, ImportResult } from '@/lib/api-client';

interface Props {
  open: boolean;
  onSuccess: () => void;
  onClose: () => void;
}

type State = 'idle' | 'uploading' | 'result';

export default function ProductImportModal({ open, onSuccess, onClose }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [state, setState] = useState<State>('idle');
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  async function handleUpload() {
    if (!file) return;
    setState('uploading');
    setError(null);
    try {
      const res = await importProducts(file);
      setResult(res);
      setState('result');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'เกิดข้อผิดพลาด';
      setError(msg);
      setState('idle');
    }
  }

  function handleClose() {
    setFile(null);
    setState('idle');
    setResult(null);
    setError(null);
    if (fileRef.current) fileRef.current.value = '';
    if (state === 'result') onSuccess();
    else onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-[12px] shadow-xl w-full max-w-lg">

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-stone-100">
          <h2 className="text-[15px] font-semibold text-stone-900">นำเข้าสินค้า (Excel)</h2>
          <button
            onClick={handleClose}
            className="w-7 h-7 flex items-center justify-center rounded-full text-stone-400 hover:bg-stone-100 hover:text-stone-600 transition-colors"
          >
            ✕
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">

          {/* Idle / upload form */}
          {state !== 'result' && (
            <>
              <p className="text-[13px] text-stone-500">
                เลือกไฟล์ Excel (.xlsx) จากระบบ POS เพื่อนำเข้าข้อมูลสินค้า รหัส SKU ใช้เป็น key — ถ้าสินค้ามีอยู่แล้วจะอัพเดทข้อมูล
              </p>

              <div className="flex items-center gap-3">
                <input
                  ref={fileRef}
                  type="file"
                  accept=".xlsx"
                  className="hidden"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={state === 'uploading'}
                  className="h-8 px-3 rounded-[7px] border border-stone-300 text-[13px] text-stone-700 hover:bg-stone-50 transition-colors disabled:opacity-50"
                >
                  เลือกไฟล์
                </button>
                <span className="text-[13px] text-stone-500 truncate max-w-[220px]">
                  {file ? file.name : 'ยังไม่ได้เลือกไฟล์'}
                </span>
              </div>

              {error && (
                <p className="text-[13px] text-red-600 bg-red-50 border border-red-100 rounded-[7px] px-3 py-2">
                  {error}
                </p>
              )}
            </>
          )}

          {/* Result summary */}
          {state === 'result' && result && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="text-center p-3 rounded-[8px] bg-emerald-50 border border-emerald-100">
                  <div className="text-[22px] font-bold text-emerald-700">{result.inserted.toLocaleString('th-TH')}</div>
                  <div className="text-[12px] text-emerald-600 mt-0.5">นำเข้าใหม่</div>
                </div>
                <div className="text-center p-3 rounded-[8px] bg-blue-50 border border-blue-100">
                  <div className="text-[22px] font-bold text-blue-700">{result.updated.toLocaleString('th-TH')}</div>
                  <div className="text-[12px] text-blue-600 mt-0.5">อัพเดท</div>
                </div>
                <div className="text-center p-3 rounded-[8px] bg-red-50 border border-red-100">
                  <div className="text-[22px] font-bold text-red-700">{result.failed.toLocaleString('th-TH')}</div>
                  <div className="text-[12px] text-red-600 mt-0.5">ล้มเหลว</div>
                </div>
              </div>

              {result.errors.length > 0 && (
                <div className="max-h-48 overflow-y-auto border border-red-100 rounded-[8px]">
                  <table className="w-full text-[12px]">
                    <thead className="bg-red-50 sticky top-0">
                      <tr>
                        <th className="text-left px-3 py-2 text-red-700 font-medium">Row</th>
                        <th className="text-left px-3 py-2 text-red-700 font-medium">SKU</th>
                        <th className="text-left px-3 py-2 text-red-700 font-medium">เหตุผล</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.errors.map((e, idx) => (
                        <tr key={idx} className="border-t border-red-50">
                          <td className="px-3 py-1.5 text-stone-500">{e.row}</td>
                          <td className="px-3 py-1.5 font-mono text-stone-700">{e.sku || '—'}</td>
                          <td className="px-3 py-1.5 text-stone-600">{e.reason}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Uploading spinner */}
          {state === 'uploading' && (
            <div className="flex items-center gap-3 py-4">
              <div className="w-4 h-4 border-2 border-stone-300 border-t-stone-700 rounded-full animate-spin" />
              <span className="text-[13px] text-stone-500">กำลังนำเข้าข้อมูล... ({file?.name})</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-5 pb-5">
          {state !== 'result' && (
            <button
              onClick={handleClose}
              disabled={state === 'uploading'}
              className="h-8 px-4 rounded-[7px] border border-stone-200 text-[13px] text-stone-600 hover:bg-stone-50 transition-colors disabled:opacity-50"
            >
              ยกเลิก
            </button>
          )}
          {state !== 'result' && (
            <button
              onClick={handleUpload}
              disabled={!file || state === 'uploading'}
              className="h-8 px-4 rounded-[7px] bg-stone-950 text-white text-[13px] font-medium hover:bg-stone-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              นำเข้า
            </button>
          )}
          {state === 'result' && (
            <button
              onClick={handleClose}
              className="h-8 px-4 rounded-[7px] bg-stone-950 text-white text-[13px] font-medium hover:bg-stone-800 transition-colors"
            >
              ปิด
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors in `components/inventory/ProductImportModal.tsx`.

- [ ] **Step 3: Commit**

```bash
git add components/inventory/ProductImportModal.tsx
git commit -m "feat: add ProductImportModal component (idle/uploading/result states)"
```

---

## Task 6: Wire Import button into Products page

**Files:**
- Modify: `app/app/products/page.tsx`

The current page at line 58–65 has a single `+ เพิ่มสินค้า` button inside `<div className="flex items-center gap-2">`. Add the import modal state and button alongside it.

- [ ] **Step 1: Add import to the existing Products page**

In `app/app/products/page.tsx`:

1. Add import at the top (alongside existing imports):
```typescript
import ProductImportModal from '@/components/inventory/ProductImportModal';
```

2. Add state alongside existing `showForm` state (around line 18–19):
```typescript
const [showImport, setShowImport] = useState(false);
```

3. Replace the button row (lines 58–65) with:
```tsx
<div className="flex items-center gap-2">
  <button
    onClick={() => setShowImport(true)}
    className="inline-flex items-center gap-1.5 h-8 px-3 rounded-[7px] border border-stone-200 text-stone-700 text-[13px] font-medium hover:bg-stone-50 transition-colors"
  >
    นำเข้าสินค้า (Excel)
  </button>
  <button
    onClick={openNew}
    className="inline-flex items-center gap-1.5 h-8 px-3 rounded-[7px] bg-stone-950 text-white text-[13px] font-medium shadow-sm hover:bg-stone-800 transition-colors"
  >
    + เพิ่มสินค้า
  </button>
</div>
```

4. Add modal at the end of the return, before the closing `</DirectionalTransition>`:
```tsx
<ProductImportModal
  open={showImport}
  onClose={() => setShowImport(false)}
  onSuccess={() => { setShowImport(false); fetchProducts(); }}
/>
```

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Lint check**

```bash
npm run lint
```

Expected: no new errors.

- [ ] **Step 4: Start dev server and test manually**

```bash
npm run dev
```

Manual test checklist:
1. Navigate to `/products` — "นำเข้าสินค้า (Excel)" button visible
2. Click button — modal opens
3. Click "นำเข้า" without file selected — button remains disabled
4. Select `data/imports/export_product_all_17_05_2026.xlsx`
5. Click "นำเข้า" — spinner shows, button disabled
6. On completion: result cards show inserted/updated/failed counts
7. Click "ปิด" — modal closes, product list refreshes with new total
8. Re-import same file — result should show `inserted: 0`, `updated: 4762` (idempotent)

- [ ] **Step 5: Commit**

```bash
git add app/app/products/page.tsx
git commit -m "feat: wire ProductImportModal into Products page with import button"
```

---

## Self-Review Checklist

**Spec coverage:**
- [x] Migration 032 (split 032a + 032b) — Task 1 + 2
- [x] 10 missing columns added to products — Task 1
- [x] `initial_import` ledger entry type — Task 2
- [x] POST /api/products/import endpoint — Task 3
- [x] Auth: manager|admin only, 401/403 — Task 3
- [x] Category auto-upsert by slugified name — Task 3
- [x] UOM auto-upsert — Task 3
- [x] Barcode logic (col12=2 + col13) — Task 3
- [x] Product upsert ON CONFLICT (sku) — Task 3
- [x] xmax trick to detect insert vs update — Task 3
- [x] Stock ledger for new products with qty > 0 — Task 3
- [x] Error rows collected, import continues — Task 3
- [x] `importProducts(file)` in api-client.ts — Task 4
- [x] ImportResult type exported — Task 4
- [x] ProductImportModal — idle/uploading/result states — Task 5
- [x] File input .xlsx only — Task 5
- [x] Error table in result state — Task 5
- [x] onSuccess triggers fetchProducts — Task 6
- [x] "นำเข้าสินค้า" button on products page — Task 6

**Known constraint:** Migration runner wraps each file in `BEGIN/COMMIT`. `ALTER TYPE ADD VALUE` is in its own file (032b) to isolate any PostgreSQL < 12 compatibility issues. See Task 2 fallback instructions.

**Type consistency:**
- `ImportResult` defined in Task 4, used in Task 5 — consistent
- `importProducts` signature `(file: File) => Promise<ImportResult>` — consistent across Tasks 4 and 5
- `FailedRow` interface defined locally in route.ts only — not exported (not needed by frontend — frontend uses `ImportResult.errors` array)

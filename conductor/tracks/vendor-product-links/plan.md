---
track: vendor-product-links
status: Verified
aliases: ["Vendor-Product Links — Data Completeness"]
owner: paku, puka
module: Vendors
updated: 2026-05-13
---

# Vendor-Product Links — Data Completeness

**What already exists (no work needed):**
- `vendor_products` table: fully defined with `vendor_id`, `product_id`, `vendor_sku`, `unit_price`, `lead_days`, `is_preferred`
- `POST /api/vendors/[id]/products` — upsert vendor catalog entry
- `DELETE /api/vendors/[id]/products?product_id=` — remove entry
- `GET /api/vendors/[id]` — returns vendor + full catalog via `json_agg`
- `/app/vendors/[id]/page.tsx` — vendor detail with AddCatalogModal, remove button — all working

**Gaps this track closes:**
1. No `GET /api/products/[id]/vendors` — product cannot list its suppliers
2. No product detail page — no UI to see/manage a product's suppliers
3. PO creation uses `p.unit_cost` — ignores vendor-negotiated `vendor_products.unit_price`

---

## Tasks

### Task 1 — API: GET /api/products/[id]/vendors

- [x] Create `app/api/products/[id]/vendors/route.ts`:

```typescript
import { auth } from '@/auth';
import { apiSuccess, apiError } from '@/lib/api-response';
import { query } from '@/lib/db/client';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);

  const { id } = await params;
  const rows = await query(
    `SELECT vp.id, vp.vendor_id, vp.vendor_sku, vp.unit_price, vp.lead_days,
            vp.is_preferred, vp.updated_at,
            v.code AS vendor_code, v.name_th AS vendor_name_th, v.name_en AS vendor_name_en,
            v.payment_terms_days
     FROM vendor_products vp
     JOIN vendors v ON v.id = vp.vendor_id
     WHERE vp.product_id = $1
     ORDER BY vp.is_preferred DESC, v.code`,
    [id]
  );
  return apiSuccess(rows);
}
```

- [x] Run `npm run lint` → no errors
- [x] Commit: `feat(products): GET /api/products/[id]/vendors — list suppliers for a product`

---

### Task 2 — Product Detail Page with Suppliers Tab

- [x] Create `app/app/products/[id]/page.tsx`:

```typescript
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { get, patch } from '@/lib/api-client';
import { formatCurrency, formatDate } from '@/lib/format';
import Link from 'next/link';

interface ProductDetail {
  id: string;
  sku: string;
  name_th: string;
  name_en: string;
  description: string | null;
  unit_cost: number;
  reorder_point: number;
  max_stock: number;
  is_active: boolean;
  created_at: string;
  category_name: string | null;
  uom_code: string;
}

interface VendorLink {
  id: string;
  vendor_id: string;
  vendor_code: string;
  vendor_name_th: string;
  vendor_name_en: string;
  vendor_sku: string | null;
  unit_price: number;
  lead_days: number;
  is_preferred: boolean;
  payment_terms_days: number;
  updated_at: string;
}

const CARD = 'bg-white border border-stone-200 rounded-[10px] shadow-[0_1px_0_rgba(15,23,42,.03),0_1px_2px_rgba(15,23,42,.04)]';
const FIELD_CLS = 'bg-white border border-stone-200 rounded-[7px] px-3 py-[7px] text-[13px] text-stone-900 outline-none transition-all focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/20 disabled:opacity-50 disabled:bg-stone-50 w-full';
const LABEL_CLS = 'text-[12px] font-medium text-stone-600 mb-1.5 block';

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [vendors, setVendors] = useState<VendorLink[]>([]);
  const [tab, setTab] = useState<'info' | 'suppliers'>('info');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [p, v] = await Promise.all([
      get<ProductDetail>(`/api/products/${id}`),
      get<VendorLink[]>(`/api/products/${id}/vendors`),
    ]);
    setProduct(p);
    setVendors(v);
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  if (loading || !product) return <div className="p-8 text-stone-400 text-sm">กำลังโหลด…</div>;

  return (
    <div className="max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-[12px] text-stone-400 mb-1">
            <Link href="/app/products" className="hover:text-stone-700">สินค้า</Link>
            <span>/</span>
            <span className="text-stone-600">{product.sku}</span>
          </div>
          <h1 className="text-2xl font-bold text-stone-900">{product.name_th}</h1>
          {product.name_en && <p className="text-sm text-stone-500 mt-0.5">{product.name_en}</p>}
        </div>
        <div className="flex items-center gap-2">
          <span className={`px-2.5 py-1 rounded-full text-[11.5px] font-medium border ${product.is_active ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-stone-100 text-stone-500 border-stone-200'}`}>
            {product.is_active ? 'ใช้งาน' : 'ปิดใช้'}
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-0 border-b border-stone-200">
        {(['info', 'suppliers'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-[13px] font-medium border-b-2 transition-colors ${tab === t ? 'border-emerald-500 text-emerald-700' : 'border-transparent text-stone-500 hover:text-stone-700'}`}
          >
            {t === 'info' ? 'ข้อมูลสินค้า' : `ผู้จำหน่าย (${vendors.length})`}
          </button>
        ))}
      </div>

      {tab === 'info' && (
        <div className={`${CARD} p-6 grid grid-cols-2 gap-x-8 gap-y-4`}>
          <div>
            <p className={LABEL_CLS}>รหัสสินค้า / SKU</p>
            <p className="text-[14px] text-stone-900 font-mono">{product.sku}</p>
          </div>
          <div>
            <p className={LABEL_CLS}>หน่วยนับ</p>
            <p className="text-[14px] text-stone-900">{product.uom_code}</p>
          </div>
          <div>
            <p className={LABEL_CLS}>ต้นทุน / หน่วย</p>
            <p className="text-[14px] text-stone-900 font-medium">{formatCurrency(product.unit_cost)}</p>
          </div>
          <div>
            <p className={LABEL_CLS}>หมวดหมู่</p>
            <p className="text-[14px] text-stone-900">{product.category_name ?? '—'}</p>
          </div>
          <div>
            <p className={LABEL_CLS}>จุด Reorder</p>
            <p className="text-[14px] text-stone-900">{product.reorder_point}</p>
          </div>
          <div>
            <p className={LABEL_CLS}>สต็อกสูงสุด</p>
            <p className="text-[14px] text-stone-900">{product.max_stock}</p>
          </div>
          {product.description && (
            <div className="col-span-2">
              <p className={LABEL_CLS}>คำอธิบาย</p>
              <p className="text-[13px] text-stone-700">{product.description}</p>
            </div>
          )}
          <div className="col-span-2 pt-2 border-t border-stone-100">
            <p className="text-[11px] text-stone-400">สร้างเมื่อ {formatDate(product.created_at)}</p>
          </div>
        </div>
      )}

      {tab === 'suppliers' && (
        <div className={CARD}>
          {vendors.length === 0 ? (
            <div className="p-8 text-center text-sm text-stone-400">
              ยังไม่มีผู้จำหน่ายที่เชื่อมกับสินค้านี้
              <p className="mt-1 text-[12px]">เพิ่มได้จากหน้า <Link href="/app/vendors" className="text-emerald-600 hover:underline">ผู้จำหน่าย</Link></p>
            </div>
          ) : (
            <table className="w-full text-[13px]">
              <thead className="border-b border-stone-200 bg-stone-50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-stone-600">ผู้จำหน่าย</th>
                  <th className="px-4 py-3 text-left font-medium text-stone-600">รหัสสินค้าผู้ขาย</th>
                  <th className="px-4 py-3 text-right font-medium text-stone-600">ราคา/หน่วย</th>
                  <th className="px-4 py-3 text-right font-medium text-stone-600">Lead Days</th>
                  <th className="px-4 py-3 text-center font-medium text-stone-600">หลัก</th>
                  <th className="px-4 py-3 text-left font-medium text-stone-600">อัปเดต</th>
                </tr>
              </thead>
              <tbody>
                {vendors.map((v) => (
                  <tr key={v.id} className="border-b border-stone-100 hover:bg-stone-50/50">
                    <td className="px-4 py-3">
                      <Link href={`/app/vendors/${v.vendor_id}`} className="font-medium text-emerald-700 hover:underline">
                        {v.vendor_code}
                      </Link>
                      <p className="text-[12px] text-stone-500">{v.vendor_name_th}</p>
                    </td>
                    <td className="px-4 py-3 text-stone-600 font-mono text-[12px]">{v.vendor_sku ?? '—'}</td>
                    <td className="px-4 py-3 text-right font-medium text-stone-900">{formatCurrency(v.unit_price)}</td>
                    <td className="px-4 py-3 text-right text-stone-600">{v.lead_days} วัน</td>
                    <td className="px-4 py-3 text-center">
                      {v.is_preferred && (
                        <span className="px-2 py-[2px] rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-medium">หลัก</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-[12px] text-stone-400">{formatDate(v.updated_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
```

- [x] In `app/app/products/page.tsx` — find the product row render and wrap SKU/name in a link to `/app/products/${p.id}` so users can navigate to detail page
- [x] Run `npm run lint` → no errors
- [x] Start `npm run dev`, open `/app/products`, click a product → detail page loads with Info tab and Suppliers tab
- [x] Commit: `feat(products): product detail page with suppliers tab`

---

### Task 3 — PO Creation: Vendor-Aware Price Prefill

**Goal:** When a vendor is selected on the PO create form and a product is added, prefill `unit_price` from `vendor_products.unit_price` for that vendor (fall back to `unit_cost` if no link exists).

- [x] In `app/app/purchase-orders/new/page.tsx`:

  **Step 1 — Add state for vendor catalog:**
  After the existing `const [productResults, setProductResults]` line, add:
  ```typescript
  const [vendorCatalog, setVendorCatalog] = useState<Record<string, number>>({});
  ```
  This is a map of `product_id → unit_price` from vendor_products for the selected vendor.

  **Step 2 — Fetch catalog when vendor changes:**
  Add a `useEffect` watching `form.vendor_id`:
  ```typescript
  useEffect(() => {
    if (!form.vendor_id) { setVendorCatalog({}); return; }
    get<{ product_id: string; unit_price: number }[]>(`/api/vendors/${form.vendor_id}/catalog`)
      .then((rows) => {
        const map: Record<string, number> = {};
        rows.forEach((r) => { map[r.product_id] = r.unit_price; });
        setVendorCatalog(map);
      })
      .catch(() => setVendorCatalog({}));
  }, [form.vendor_id]);
  ```

  **Step 3 — New API endpoint `GET /api/vendors/[id]/catalog`:**
  Create `app/api/vendors/[id]/catalog/route.ts`:
  ```typescript
  import { auth } from '@/auth';
  import { apiSuccess, apiError } from '@/lib/api-response';
  import { query } from '@/lib/db/client';

  export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
    const session = await auth();
    if (!session?.user) return apiError('Unauthorized', 401);

    const { id } = await params;
    const rows = await query(
      `SELECT product_id, unit_price, lead_days, is_preferred, vendor_sku
       FROM vendor_products WHERE vendor_id = $1`,
      [id]
    );
    return apiSuccess(rows);
  }
  ```

  **Step 4 — Use catalog price in `addProduct`:**
  Replace the existing `addProduct` function body:
  ```typescript
  function addProduct(p: Product) {
    const vendorPrice = vendorCatalog[p.id];
    const unit_price = vendorPrice !== undefined ? vendorPrice : (Number(p.unit_cost) || 0);
    setLines((prev) => [...prev, { product_id: p.id, product_label: `${p.sku} — ${p.name_th}`, qty_ordered: 1, unit_price }]);
    setProductSearch('');
    setProductResults([]);
  }
  ```

  **Step 5 — Also update PR-prefilled lines to use vendor price when vendor already selected:**
  In the `useEffect` for `prId`, the lines are set from PR data. These prefill before a vendor is typically chosen so no change needed — vendor catalog effect will not retroactively change existing lines, which is correct (user may have already edited prices).

- [x] Run `npm run lint` → no errors
- [x] Test: create a PO, select a vendor that has catalog entries, add a product that is in their catalog → `unit_price` field should prefill with the vendor's price, not `unit_cost`
- [x] Test: add a product NOT in vendor's catalog → falls back to `unit_cost`
- [x] Test: change vendor → catalog clears, next product add uses new vendor's prices
- [x] Commit: `feat(pos): PO creation prefills unit_price from vendor catalog`

---

### Task 4 — Update conductor/index.md and Commit

- [x] Add entry to `conductor/index.md`:
  ```
  | [Vendor-Product Links (data completeness)](./tracks/vendor-product-links/plan.md) | Completed | 2026-05-13 | 2026-05-13 |
  ```
- [x] Commit: `chore: conductor — vendor-product-links track`

---
## Execution Logs
- [[execution-summary]]


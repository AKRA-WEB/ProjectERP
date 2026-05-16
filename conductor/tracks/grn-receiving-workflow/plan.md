---
track: grn-receiving-workflow
status: Completed
owner: puka
module: WMS
updated: 2026-05-14
---

# GRN Receiving Workflow — Staff Work Card

## Analysis

**User's actual store workflow vs current system:**

| Step | User's workflow | Current system |
|---|---|---|
| 1 | จัดซื้อสั่งสินค้าจาก Vendor | PR → PO (already matches) |
| 2 | Admin เปิดคำสั่งซื้อ: Vendor + คลัง + รายการสินค้า + จำนวน | PO และ GRN ต้องสร้างแยกกัน 2 ขั้น — mismatch |
| 3 | ขนส่งมาส่ง | — (no tracking) |
| 4 | พนักงานกรอก: วันส่ง, รายการ, จำนวน, โลเคชั่น, ผู้รับ | quantities entered at GRN creation — too early |
| 5 | พนักงาน "รับลงสินค้า" | receive route (no quantity entry) |
| 6 | หัวหน้าตรวจ + "ยืนยันรับสินค้า" | QC → stock (2 steps, too complex) |
| SPLIT | 10 รายการ ส่งมาแค่ 5 → แยกการ์ดงานออก | not supported |

**Root problem:** Current GRN requires quantities at creation time (staff must know everything before delivery arrives). User wants GRN created as a template when PO is placed, quantities filled when truck arrives.

**Status remapping:**
- `draft` = รอสินค้าจัดส่ง ✓ (GRN template created, waiting for truck)
- `received` = รับลงสินค้า / รอตรวจสอบ ✓ (staff filled quantities, waiting for supervisor)
- `stocked` = ยืนยันการรับสินค้า ✓ (supervisor confirmed, stock updated)
- QC path (`qc_passed`/`qc_failed`) remains in DB but unused by this workflow (backward compat)

---

## What already exists (no change needed)

- `storage_location` on `grn_line_items` (migration 013) ✓
- `received_by UUID` on `goods_receipt_notes` ✓
- `received_date DATE` on `goods_receipt_notes` ✓
- `/api/grn/[id]/stock` — stocks GRN to inventory ✓ (will be called by new confirm endpoint)

---

## Migration 027 — GRN Work Card Fields

New fields needed:
```sql
-- goods_receipt_notes:
-- receiver_name: free-text name from delivery note (different from received_by which is system user)
-- split_from_grn_id: points to parent GRN this was split from (NULL = original)

-- grn_line_items:
-- qty_expected: PO line qty at time of GRN creation (reference for supervisor comparison)
-- qty_received constraint change: allow 0 (template GRNs start with 0)
```

---

## Tasks

### Task 1 — Migration 027

- [x] Create `migrations/027_grn_receiving_workflow.sql`:

```sql
-- Add receiver_name and split tracking to GRN header
ALTER TABLE goods_receipt_notes
  ADD COLUMN IF NOT EXISTS receiver_name   VARCHAR(255),
  ADD COLUMN IF NOT EXISTS split_from_grn_id UUID REFERENCES goods_receipt_notes(id);

-- Add expected quantity to GRN lines (PO qty at time of template creation)
ALTER TABLE grn_line_items
  ADD COLUMN IF NOT EXISTS qty_expected NUMERIC(15,4);

-- Allow qty_received = 0 (template GRNs start with 0; staff fills later)
-- Drop the existing > 0 check constraint
DO $$ BEGIN
  ALTER TABLE grn_line_items DROP CONSTRAINT grn_line_items_qty_received_check;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

-- Replace with >= 0 constraint
ALTER TABLE grn_line_items
  ADD CONSTRAINT grn_line_items_qty_received_nonneg CHECK (qty_received >= 0);

-- Make received_date nullable (staff fills when delivery actually arrives)
ALTER TABLE goods_receipt_notes
  ALTER COLUMN received_date DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_grn_split ON goods_receipt_notes(split_from_grn_id) WHERE split_from_grn_id IS NOT NULL;
```

- [x] Run `npm run migrate`
- [x] Verify: `\d goods_receipt_notes` shows `receiver_name`, `split_from_grn_id`
- [x] Verify: `\d grn_line_items` shows `qty_expected`, constraint `qty_received_nonneg`
- [x] Commit: `feat(grn): migration 027 — work card fields, allow zero qty, split tracking`

---

### Task 2 — API: สร้างคำสั่งซื้อ + การ์ดงาน (Combined PO + GRN template in one call)

Admin fills ONE form: Vendor + Warehouse + product lines. API atomically creates:
1. Purchase Order (PO)
2. GRN work card template (qty_received=0, ready for staff)
3. Upserts `vendor_products` — records that each product is supplied by this vendor with the given unit_price

- [x] Create `app/api/receiving/order/route.ts`:

```typescript
import { auth } from '@/auth';
import { apiSuccess, apiError, apiValidationError } from '@/lib/api-response';
import { assertRole } from '@/lib/authz';
import { queryOne } from '@/lib/db/client';
import pool from '@/lib/db/client';
import { z } from 'zod';
import { VAT_RATE } from '@/lib/constants';
import type { SessionUser } from '@/lib/authz';

const lineSchema = z.object({
  product_id: z.string().uuid(),
  qty_ordered: z.number().positive(),
  unit_price: z.number().nonnegative(),
});

const schema = z.object({
  vendor_id:   z.string().uuid(),
  warehouse_id: z.string().uuid(),
  expected_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  notes:       z.string().optional(),
  lines:       z.array(lineSchema).min(1),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;
  try { assertRole(u, ['manager', 'admin']); } catch { return apiError('Forbidden', 403); }

  const body = await req.json().catch(() => null);
  if (!body) return apiError('Invalid JSON', 400);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return apiValidationError(parsed.error);

  const vendor = await queryOne('SELECT id FROM vendors WHERE id = $1 AND is_active = TRUE', [parsed.data.vendor_id]);
  if (!vendor) return apiError('Vendor not found', 404);

  const subtotal = parsed.data.lines.reduce((s, l) => s + l.qty_ordered * l.unit_price, 0);
  const vat      = Math.round(subtotal * VAT_RATE * 100) / 100;
  const total    = Math.round((subtotal + vat) * 100) / 100;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Create PO
    const poRes = await client.query<{ id: string; po_number: string }>(
      `INSERT INTO purchase_orders
         (vendor_id, warehouse_id, expected_date, payment_terms_days, notes,
          subtotal, vat_amount, total_amount, status, created_by)
       VALUES ($1,$2,$3,30,$4,$5,$6,$7,'sent',$8)
       RETURNING id, po_number`,
      [
        parsed.data.vendor_id, parsed.data.warehouse_id,
        parsed.data.expected_date ?? null, parsed.data.notes ?? null,
        subtotal, vat, total, u.id,
      ]
    );
    const poId = poRes.rows[0].id;

    // 2. Create PO lines + collect po_line ids for GRN
    const poLineIds: { poLineId: string; productId: string; qty: number }[] = [];
    for (let i = 0; i < parsed.data.lines.length; i++) {
      const l = parsed.data.lines[i];
      const poLine = await client.query<{ id: string }>(
        `INSERT INTO po_line_items (po_id, product_id, qty_ordered, unit_price, line_number)
         VALUES ($1,$2,$3,$4,$5)
         RETURNING id`,
        [poId, l.product_id, l.qty_ordered, l.unit_price, i + 1]
      );
      poLineIds.push({ poLineId: poLine.rows[0].id, productId: l.product_id, qty: l.qty_ordered });
    }

    // 3. Upsert vendor_products — record which vendor supplies each product
    for (const l of parsed.data.lines) {
      await client.query(
        `INSERT INTO vendor_products (vendor_id, product_id, unit_price)
         VALUES ($1,$2,$3)
         ON CONFLICT (vendor_id, product_id) DO UPDATE SET
           unit_price = EXCLUDED.unit_price,
           updated_at = NOW()`,
        [parsed.data.vendor_id, l.product_id, l.unit_price]
      );
    }

    // 4. Create GRN work card template (qty_received = 0 per line)
    const grnRes = await client.query<{ id: string; grn_number: string }>(
      `INSERT INTO goods_receipt_notes (po_id, warehouse_id, received_by, notes, status)
       VALUES ($1,$2,$3,$4,'draft')
       RETURNING id, grn_number`,
      [poId, parsed.data.warehouse_id, u.id, parsed.data.notes ?? null]
    );
    const grnId = grnRes.rows[0].id;

    for (let i = 0; i < poLineIds.length; i++) {
      const pl = poLineIds[i];
      await client.query(
        `INSERT INTO grn_line_items
           (grn_id, po_line_item_id, product_id, qty_received, qty_expected, line_number)
         VALUES ($1,$2,$3,0,$4,$5)`,
        [grnId, pl.poLineId, pl.productId, pl.qty, i + 1]
      );
    }

    await client.query('COMMIT');
    return apiSuccess({
      po_id: poId,
      po_number: poRes.rows[0].po_number,
      grn_id: grnId,
      grn_number: grnRes.rows[0].grn_number,
    }, 201);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    return apiError('Failed to create receiving order', 500);
  } finally {
    client.release();
  }
}
```

- [x] Run `npm run lint` → no errors
- [x] Commit: `feat(receiving): POST /api/receiving/order — create PO + GRN template + upsert vendor_products`

---

### Task 2B — UI: สร้างคำสั่งซื้อ (Admin "Open Work Card" form)

- [x] Create `app/app/receiving/new/page.tsx`:

```typescript
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { get, post } from '@/lib/api-client';
import { formatCurrency } from '@/lib/format';
import { VAT_RATE } from '@/lib/constants';
import type { PaginatedResponse, Product, Warehouse } from '@/types';

interface Vendor { id: string; code: string; name_th: string; }
interface OrderLine {
  product_id: string;
  product_label: string;
  qty_ordered: number;
  unit_price: number;
}

const CARD = 'bg-white border border-stone-200 rounded-[10px] shadow-[0_1px_0_rgba(15,23,42,.03),0_1px_2px_rgba(15,23,42,.04)]';
const FIELD_CLS = 'bg-white border border-stone-200 rounded-[7px] px-3 py-[7px] text-[13px] text-stone-900 outline-none transition-all focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/20 disabled:opacity-50 disabled:bg-stone-50 w-full';
const LABEL_CLS = 'text-[12px] font-medium text-stone-600 mb-1.5 block';
const BTN_PRIMARY = 'h-9 px-4 rounded-[8px] text-[13px] font-medium bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-40 inline-flex items-center gap-1.5 transition-colors';

export default function NewReceivingOrderPage() {
  const router = useRouter();
  const [vendors, setVendors]       = useState<Vendor[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [vendorId, setVendorId]     = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [expectedDate, setExpectedDate] = useState('');
  const [notes, setNotes]           = useState('');
  const [lines, setLines]           = useState<OrderLine[]>([]);
  const [search, setSearch]         = useState('');
  const [results, setResults]       = useState<Product[]>([]);
  const [saving, setSaving]         = useState(false);
  const [error, setError]           = useState('');

  useEffect(() => {
    get<PaginatedResponse<Vendor>>('/api/vendors?limit=500').then((r) =>
      setVendors(r.data)
    );
    get<Warehouse[]>('/api/admin/warehouses').then((d) =>
      setWarehouses(d.filter((w) => w.is_active))
    );
  }, []);

  async function searchProducts(q: string) {
    setSearch(q);
    if (!q) { setResults([]); return; }
    const res = await get<PaginatedResponse<Product>>(`/api/products?search=${encodeURIComponent(q)}&limit=10`);
    setResults(res.data ?? []);
  }

  function addLine(p: Product) {
    // If vendor already has a price for this product (from vendor_products), auto-fill
    setLines((prev) => [...prev, {
      product_id: p.id,
      product_label: `${p.sku} — ${p.name_th}`,
      qty_ordered: 1,
      unit_price: Number(p.unit_cost) || 0,
    }]);
    setSearch('');
    setResults([]);
  }

  function updateLine(i: number, key: 'qty_ordered' | 'unit_price', val: number) {
    setLines((prev) => prev.map((l, idx) => idx === i ? { ...l, [key]: val } : l));
  }

  function removeLine(i: number) {
    setLines((prev) => prev.filter((_, idx) => idx !== i));
  }

  const subtotal = lines.reduce((s, l) => s + l.qty_ordered * l.unit_price, 0);
  const vat      = subtotal * VAT_RATE;
  const total    = subtotal + vat;

  async function handleSubmit() {
    if (!vendorId)    { setError('กรุณาเลือกผู้จำหน่าย'); return; }
    if (!warehouseId) { setError('กรุณาเลือกคลังสินค้า'); return; }
    if (lines.length === 0) { setError('กรุณาเพิ่มรายการสินค้า'); return; }
    setError('');
    setSaving(true);
    try {
      const result = await post<{ po_id: string; grn_id: string; grn_number: string }>(
        '/api/receiving/order',
        {
          vendor_id: vendorId,
          warehouse_id: warehouseId,
          expected_date: expectedDate || undefined,
          notes: notes || undefined,
          lines: lines.map((l) => ({
            product_id: l.product_id,
            qty_ordered: l.qty_ordered,
            unit_price: l.unit_price,
          })),
        }
      );
      // Navigate to the GRN work card (staff will fill when delivery arrives)
      router.push(`/app/grn/${result.grn_id}`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'เกิดข้อผิดพลาด');
      setSaving(false);
    }
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">เปิดคำสั่งซื้อ</h1>
          <p className="text-sm text-stone-500 mt-0.5">สร้างคำสั่งซื้อ + การ์ดงานรับสินค้า ในขั้นตอนเดียว</p>
        </div>
        <button onClick={() => router.back()} className="text-sm text-stone-400 hover:text-stone-700">← ย้อนกลับ</button>
      </div>

      {error && (
        <div className="p-3 rounded-[8px] bg-red-50 border border-red-200 text-sm text-red-700">{error}</div>
      )}

      {/* Header fields */}
      <div className={`${CARD} p-6 grid grid-cols-2 gap-4`}>
        <div>
          <label className={LABEL_CLS}>ผู้จำหน่าย / Vendor *</label>
          <select value={vendorId} onChange={(e) => setVendorId(e.target.value)} className={FIELD_CLS}>
            <option value="">-- เลือกผู้จำหน่าย --</option>
            {vendors.map((v) => (
              <option key={v.id} value={v.id}>{v.code} — {v.name_th}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={LABEL_CLS}>คลังสินค้า *</label>
          <select value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} className={FIELD_CLS}>
            <option value="">-- เลือกคลัง --</option>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>{w.code} — {w.name_th}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={LABEL_CLS}>วันที่คาดว่าจะส่ง</label>
          <input type="date" value={expectedDate} onChange={(e) => setExpectedDate(e.target.value)} className={FIELD_CLS} />
        </div>
        <div>
          <label className={LABEL_CLS}>หมายเหตุ</label>
          <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="หมายเหตุเพิ่มเติม" className={FIELD_CLS} />
        </div>
      </div>

      {/* Product search */}
      <div className={`${CARD} p-6`}>
        <h2 className="text-[14px] font-semibold text-stone-800 mb-3">รายการสินค้า</h2>

        {/* Search box */}
        <div className="relative mb-4">
          <input
            type="text"
            value={search}
            onChange={(e) => searchProducts(e.target.value)}
            placeholder="ค้นหาสินค้า (SKU / ชื่อ)..."
            className={FIELD_CLS}
          />
          {results.length > 0 && (
            <div className="absolute z-10 top-full left-0 right-0 bg-white border border-stone-200 rounded-[8px] shadow-lg mt-1 max-h-52 overflow-y-auto">
              {results.map((p) => (
                <button
                  key={p.id}
                  onClick={() => addLine(p)}
                  className="w-full text-left px-4 py-2.5 text-[13px] hover:bg-stone-50 flex items-center gap-3"
                >
                  <span className="font-mono text-stone-500 text-[12px] w-24 shrink-0">{p.sku}</span>
                  <span className="text-stone-900">{p.name_th}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {lines.length === 0 ? (
          <p className="text-sm text-stone-400 text-center py-4">ยังไม่มีรายการสินค้า</p>
        ) : (
          <table className="w-full text-[13px] mb-4">
            <thead className="border-b border-stone-200">
              <tr>
                <th className="pb-2 text-left font-medium text-stone-600">สินค้า</th>
                <th className="pb-2 text-right font-medium text-stone-600 w-28">จำนวน</th>
                <th className="pb-2 text-right font-medium text-stone-600 w-32">ราคา/หน่วย (฿)</th>
                <th className="pb-2 text-right font-medium text-stone-600 w-28">รวม</th>
                <th className="pb-2 w-8"></th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l, i) => (
                <tr key={i} className="border-b border-stone-100">
                  <td className="py-2 pr-3 text-stone-800">{l.product_label}</td>
                  <td className="py-2 pr-2">
                    <input
                      type="number" min="1" value={l.qty_ordered}
                      onChange={(e) => updateLine(i, 'qty_ordered', Number(e.target.value) || 1)}
                      className="w-full border border-stone-200 rounded-[6px] px-2 py-1 text-[13px] text-right outline-none focus:border-emerald-400 tabular-nums"
                    />
                  </td>
                  <td className="py-2 pr-2">
                    <input
                      type="number" min="0" step="0.01" value={l.unit_price}
                      onChange={(e) => updateLine(i, 'unit_price', Number(e.target.value) || 0)}
                      className="w-full border border-stone-200 rounded-[6px] px-2 py-1 text-[13px] text-right outline-none focus:border-emerald-400 tabular-nums"
                    />
                  </td>
                  <td className="py-2 text-right tabular-nums text-stone-700 font-medium">
                    {formatCurrency(l.qty_ordered * l.unit_price)}
                  </td>
                  <td className="py-2 text-center">
                    <button onClick={() => removeLine(i)} className="text-stone-300 hover:text-red-500 text-[16px] leading-none">×</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Totals */}
        {lines.length > 0 && (
          <div className="flex justify-end">
            <div className="w-56 space-y-1 text-[13px]">
              <div className="flex justify-between text-stone-600"><span>ราคาก่อน VAT</span><span className="tabular-nums">{formatCurrency(subtotal)}</span></div>
              <div className="flex justify-between text-stone-600"><span>VAT 7%</span><span className="tabular-nums">{formatCurrency(vat)}</span></div>
              <div className="flex justify-between font-semibold text-stone-900 border-t border-stone-200 pt-1 mt-1"><span>รวมทั้งสิ้น</span><span className="tabular-nums">{formatCurrency(total)}</span></div>
            </div>
          </div>
        )}
      </div>

      {/* Submit */}
      <div className="flex justify-end">
        <button onClick={handleSubmit} disabled={saving} className={BTN_PRIMARY}>
          {saving ? 'กำลังสร้าง…' : 'สร้างคำสั่งซื้อ + การ์ดงาน'}
        </button>
      </div>
    </div>
  );
}
```

- [x] Run `npm run lint` → no errors
- [x] Start `npm run dev`, open `/app/receiving/new`
- [x] Test: select vendor, select warehouse, add 3 products, set prices → submit
- [x] Verify: redirects to GRN work card (status=draft), check DB: PO created with status=`sent`, GRN lines have qty_received=0 and qty_expected filled, `vendor_products` has upserted records for each product+vendor
- [x] Commit: `feat(receiving): new receiving order form — vendor + warehouse + lines → PO + GRN template`

---

### Task 2C — Sidebar Link for "เปิดคำสั่งซื้อ"

- [x] In `components/layout/Sidebar.tsx`, inside the `จัดซื้อ / Procurement` nav group (where PR/PO links are), add:

```typescript
{ href: '/app/receiving/new', label: 'เปิดคำสั่งซื้อ', icon: PackagePlus, permission: 'grn:create' },
```

Check if `PackagePlus` is imported from lucide-react: `grep "PackagePlus" components/layout/Sidebar.tsx`. If not, add to the import line.

- [x] Verify sidebar shows new link
- [x] Commit: `feat(receiving): sidebar link — เปิดคำสั่งซื้อ`

---

### Task 3 — Modify Receive Route: Accept Line Quantities + Auto-Split

Replace `app/api/grn/[id]/receive/route.ts` entirely:

```typescript
import { auth } from '@/auth';
import { apiSuccess, apiError, apiValidationError } from '@/lib/api-response';
import { query, queryOne } from '@/lib/db/client';
import pool from '@/lib/db/client';
import { z } from 'zod';
import type { SessionUser } from '@/lib/authz';

const lineSchema = z.object({
  id: z.string().uuid(),
  qty_received: z.number().nonnegative(),
  storage_location: z.string().max(100).optional(),
});

const schema = z.object({
  delivery_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  receiver_name: z.string().max(255).optional(),
  lines: z.array(lineSchema).min(1),
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;

  const { id } = await params;
  const grn = await queryOne<{ status: string; po_id: string; warehouse_id: string; split_from_grn_id: string | null }>(
    'SELECT status, po_id, warehouse_id, split_from_grn_id FROM goods_receipt_notes WHERE id = $1',
    [id]
  );
  if (!grn) return apiError('GRN not found', 404);
  if (grn.status !== 'draft') return apiError('Only draft GRNs can be received', 409);

  const body = await req.json().catch(() => null);
  if (!body) return apiError('Invalid JSON', 400);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return apiValidationError(parsed.error);

  // Fetch all lines for this GRN
  const grnLines = await query<{
    id: string;
    product_id: string;
    po_line_item_id: string;
    qty_expected: number | null;
    line_number: number;
  }>(
    `SELECT id, product_id, po_line_item_id, qty_expected, line_number
     FROM grn_line_items WHERE grn_id = $1`,
    [id]
  );

  const lineMap = new Map(grnLines.map((l) => [l.id, l]));
  const receivedMap = new Map(parsed.data.lines.map((l) => [l.id, l]));

  // Validate all submitted line IDs belong to this GRN
  for (const line of parsed.data.lines) {
    if (!lineMap.has(line.id)) return apiError(`Line ${line.id} not in this GRN`, 422);
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Update received quantities + storage_location on all submitted lines
    for (const line of parsed.data.lines) {
      await client.query(
        `UPDATE grn_line_items
         SET qty_received = $1,
             qty_accepted = $1,
             storage_location = COALESCE($2, storage_location)
         WHERE id = $3 AND grn_id = $4`,
        [line.qty_received, line.storage_location ?? null, line.id, id]
      );
    }

    // Update GRN header
    await client.query(
      `UPDATE goods_receipt_notes
       SET status = 'received',
           received_date = $1,
           receiver_name = $2,
           received_by = $3,
           updated_at = NOW()
       WHERE id = $4`,
      [parsed.data.delivery_date, parsed.data.receiver_name ?? null, u.id, id]
    );

    // Auto-split: find lines where qty_received < qty_expected
    const splitLines: typeof grnLines = [];
    for (const grnLine of grnLines) {
      const submitted = receivedMap.get(grnLine.id);
      const qtyReceived = submitted ? submitted.qty_received : 0;
      const qtyExpected = Number(grnLine.qty_expected ?? 0);
      const remaining = qtyExpected - qtyReceived;
      if (remaining > 0) {
        splitLines.push({ ...grnLine, qty_expected: remaining });
      }
    }

    let splitGrnId: string | null = null;
    if (splitLines.length > 0) {
      // Create split GRN (same PO, same warehouse, draft status)
      const splitGrn = await client.query<{ id: string; grn_number: string }>(
        `INSERT INTO goods_receipt_notes
           (po_id, warehouse_id, received_by, split_from_grn_id, notes, status)
         VALUES ($1, $2, $3, $4, $5, 'draft')
         RETURNING id, grn_number`,
        [
          grn.po_id,
          grn.warehouse_id,
          u.id,
          id, // this GRN is the parent
          `รอรับสินค้าที่เหลือ (แยกจาก ${id})`,
        ]
      );
      splitGrnId = splitGrn.rows[0].id;

      for (let i = 0; i < splitLines.length; i++) {
        const sl = splitLines[i];
        await client.query(
          `INSERT INTO grn_line_items
             (grn_id, po_line_item_id, product_id, qty_received, qty_expected, line_number)
           VALUES ($1, $2, $3, 0, $4, $5)`,
          [splitGrnId, sl.po_line_item_id, sl.product_id, sl.qty_expected, i + 1]
        );
      }
    }

    await client.query('COMMIT');
    return apiSuccess({ id, status: 'received', split_grn_id: splitGrnId });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    return apiError('Failed to receive GRN', 500);
  } finally {
    client.release();
  }
}
```

- [x] Run `npm run lint` → no errors
- [x] Commit: `feat(grn): receive route — accept line quantities, delivery date, receiver name, auto-split partial deliveries`

---

### Task 4 — New API: Supervisor Confirm (Skip QC → Stock)

- [x] Create `app/api/grn/[id]/confirm/route.ts`:

```typescript
import { auth } from '@/auth';
import { apiSuccess, apiError } from '@/lib/api-response';
import { assertRole } from '@/lib/authz';
import { query, queryOne } from '@/lib/db/client';
import pool from '@/lib/db/client';
import type { SessionUser } from '@/lib/authz';

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;
  try { assertRole(u, ['manager', 'admin']); } catch { return apiError('Forbidden', 403); }

  const { id } = await params;
  const grn = await queryOne<{ status: string; po_id: string; warehouse_id: string }>(
    'SELECT status, po_id, warehouse_id FROM goods_receipt_notes WHERE id = $1',
    [id]
  );
  if (!grn) return apiError('GRN not found', 404);
  if (grn.status !== 'received') return apiError('Only received GRNs can be confirmed', 409);

  // Set qty_accepted = qty_received for all lines that haven't been QC'd
  await query(
    `UPDATE grn_line_items
     SET qty_accepted = qty_received
     WHERE grn_id = $1 AND qty_accepted IS NULL`,
    [id]
  );

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const lines = await client.query<{
      id: string;
      product_id: string;
      po_line_item_id: string;
      qty_accepted: number;
      lot_number: string | null;
      serial_number: string | null;
      expiry_date: string | null;
      storage_location: string | null;
      transaction_uom_id: string | null;
      base_qty: number | null;
    }>(
      `SELECT id, product_id, po_line_item_id, qty_accepted,
              lot_number, serial_number, expiry_date, storage_location,
              transaction_uom_id, base_qty
       FROM grn_line_items
       WHERE grn_id = $1 AND qty_accepted > 0`,
      [id]
    );

    for (const line of lines.rows) {
      const effectiveQty = line.base_qty ?? line.qty_accepted;

      // Stock ledger INSERT
      await client.query(
        `INSERT INTO stock_ledger
           (warehouse_id, product_id, lot_id, entry_type, qty_change, reference_id, reference_type, notes)
         VALUES ($1, $2, $3, 'grn_receipt', $4, $5, 'grn', $6)`,
        [
          grn.warehouse_id,
          line.product_id,
          null,
          effectiveQty,
          id,
          `GRN ${id} confirmed by supervisor`,
        ]
      );

      // Update PO line qty_received
      if (line.po_line_item_id) {
        await client.query(
          `UPDATE po_line_items
           SET qty_received = COALESCE(qty_received, 0) + $1
           WHERE id = $2`,
          [effectiveQty, line.po_line_item_id]
        );
      }
    }

    // Update PO status (fully or partially received)
    const poLines = await client.query<{ qty_ordered: number; qty_received: number }>(
      `SELECT qty_ordered, COALESCE(qty_received, 0) AS qty_received
       FROM po_line_items WHERE po_id = $1`,
      [grn.po_id]
    );
    const allFull = poLines.rows.every((l) => Number(l.qty_received) >= Number(l.qty_ordered));
    const anyReceived = poLines.rows.some((l) => Number(l.qty_received) > 0);
    const poStatus = allFull ? 'fully_received' : anyReceived ? 'partially_received' : undefined;
    if (poStatus) {
      await client.query(
        `UPDATE purchase_orders SET status = $1 WHERE id = $2`,
        [poStatus, grn.po_id]
      );
    }

    // Update GRN status
    await client.query(
      `UPDATE goods_receipt_notes
       SET status = 'stocked', stocked_by = $1, stocked_at = NOW(), updated_at = NOW()
       WHERE id = $2`,
      [u.id, id]
    );

    await client.query('COMMIT');
    return apiSuccess({ id, status: 'stocked' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    return apiError('Failed to confirm GRN', 500);
  } finally {
    client.release();
  }
}
```

- [x] Run `npm run lint` → no errors
- [x] Commit: `feat(grn): POST /api/grn/[id]/confirm — supervisor confirms receipt, stocks inventory, skips QC`

---

### Task 5 — PO Detail Page: "สร้างการ์ดงาน" Button

File: `app/app/purchase-orders/[id]/page.tsx`

- [x] Read the PO detail page and locate the action buttons section (near `po.status === 'sent'` or `partially_received` guards)

- [x] Add "สร้างการ์ดงาน รับสินค้า" button visible when `po.status` is `sent`, `partially_received`:

```tsx
{(['sent', 'partially_received'] as const).includes(po.status as 'sent' | 'partially_received') && (
  <button
    onClick={handleCreateWorkCard}
    disabled={acting}
    className="h-9 px-4 rounded-[8px] text-[13px] font-medium bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-40 inline-flex items-center gap-1.5 transition-colors"
  >
    สร้างการ์ดงาน รับสินค้า
  </button>
)}
```

- [ ] Add `handleCreateWorkCard` function:

```typescript
async function handleCreateWorkCard() {
  setActing(true);
  setError('');
  try {
    const result = await post<{ id: string; grn_number: string }>('/api/grn/template', {
      po_id: po.id,
      warehouse_id: po.warehouse_id,
    });
    router.push(`/app/grn/${result.id}`);
  } catch (e: unknown) {
    setError(e instanceof Error ? e.message : 'เกิดข้อผิดพลาด');
    setActing(false);
  }
}
- [x] Add `handleCreateWorkCard` function:
...
- [x] Ensure `po.warehouse_id` is available in the PO detail GET response. If not, add to the SELECT in `app/api/purchase-orders/[id]/route.ts`.

- [x] Run `npm run lint` → no errors
- [x] Test: open a PO in `sent` status → button appears → click → redirects to new GRN with `draft` status showing all PO lines with qty=0
- [x] Commit: `feat(grn): PO detail — สร้างการ์ดงาน button creates GRN template`


---

### Task 6 — GRN Detail Page: Staff Work Card + Supervisor Confirm

File: `app/app/grn/[id]/page.tsx`

**6A — Extend interfaces:**

```typescript
interface GRNLine {
  id: string;
  line_number: number;
  sku: string;
  name_th: string;
  qty_received: number;
  qty_expected: number | null;   // ADD
  qty_accepted: number | null;
  qty_rejected: number | null;
  uom_code: string;
  lot_number: string | null;
  storage_location: string | null;
  qc_status: string | null;
  qc_notes: string | null;
}

interface GRNDetail {
  id: string;
  grn_number: string;
  status: GrnStatus;
  po_number: string | null;
  io_number: string | null;
  inbound_order_id: string | null;
  warehouse_id: string;         // ADD
  warehouse_code: string;
  warehouse_name: string;
  received_by_name: string;
  received_date: string | null; // CHANGE: allow null (template GRN)
  receiver_name: string | null; // ADD
  split_from_grn_id: string | null; // ADD
  lines: GRNLine[];
}
```

**6B — Add work card state (staff fills when status=draft):**

```typescript
const [workCard, setWorkCard] = useState({
  delivery_date: new Date().toISOString().split('T')[0],
  receiver_name: '',
  lines: [] as { id: string; qty_received: number; storage_location: string }[],
});
```

After GRN loads (in fetchGRN), initialize workCard lines:
```typescript
setWorkCard((wc) => ({
  ...wc,
  lines: data.lines.map((l) => ({
    id: l.id,
    qty_received: 0,
    storage_location: l.storage_location ?? '',
  })),
}));
```

**6C — Staff Work Card section (shown when status === 'draft'):**

```tsx
{grn.status === 'draft' && (
  <div className={`${CARD} p-6`}>
    <h2 className="text-[15px] font-semibold text-stone-800 mb-4">กรอกข้อมูลการรับสินค้า</h2>

    <div className="grid grid-cols-2 gap-4 mb-5">
      <div>
        <label className={LABEL_CLS}>วันที่ขนส่งส่งสินค้า</label>
        <input
          type="date"
          value={workCard.delivery_date}
          onChange={(e) => setWorkCard((wc) => ({ ...wc, delivery_date: e.target.value }))}
          className={FIELD_CLS}
        />
      </div>
      <div>
        <label className={LABEL_CLS}>ชื่อผู้รับสินค้า</label>
        <input
          type="text"
          placeholder="ระบุชื่อผู้รับ"
          value={workCard.receiver_name}
          onChange={(e) => setWorkCard((wc) => ({ ...wc, receiver_name: e.target.value }))}
          className={FIELD_CLS}
        />
      </div>
    </div>

    <table className="w-full text-[13px] mb-4">
      <thead className="border-b border-stone-200 bg-stone-50">
        <tr>
          <th className="px-3 py-2.5 text-left font-medium text-stone-600">สินค้า</th>
          <th className="px-3 py-2.5 text-right font-medium text-stone-600">ที่สั่ง / คาดว่าจะรับ</th>
          <th className="px-3 py-2.5 text-right font-medium text-stone-600 w-32">จำนวนที่รับได้จริง</th>
          <th className="px-3 py-2.5 text-left font-medium text-stone-600 w-40">โลเคชั่น</th>
        </tr>
      </thead>
      <tbody>
        {grn.lines.map((line, i) => {
          const wl = workCard.lines[i] ?? { id: line.id, qty_received: 0, storage_location: '' };
          return (
            <tr key={line.id} className="border-b border-stone-100">
              <td className="px-3 py-2.5">
                <span className="font-mono text-[12px] text-stone-600">{line.sku}</span>
                <p className="text-stone-800">{line.name_th}</p>
              </td>
              <td className="px-3 py-2.5 text-right text-stone-500 tabular-nums">
                {line.qty_expected != null ? `${Number(line.qty_expected).toFixed(0)} ${line.uom_code}` : '—'}
              </td>
              <td className="px-3 py-2.5">
                <input
                  type="number"
                  min="0"
                  value={wl.qty_received}
                  onChange={(e) => setWorkCard((wc) => ({
                    ...wc,
                    lines: wc.lines.map((l, idx) => idx === i ? { ...l, qty_received: Number(e.target.value) || 0 } : l),
                  }))}
                  className="w-full bg-white border border-stone-200 rounded-[6px] px-2 py-1.5 text-[13px] text-right outline-none focus:border-emerald-400 tabular-nums"
                />
              </td>
              <td className="px-3 py-2.5">
                <input
                  type="text"
                  placeholder="A-01-02"
                  value={wl.storage_location}
                  onChange={(e) => setWorkCard((wc) => ({
                    ...wc,
                    lines: wc.lines.map((l, idx) => idx === i ? { ...l, storage_location: e.target.value } : l),
                  }))}
                  className="w-full bg-white border border-stone-200 rounded-[6px] px-2 py-1.5 text-[13px] outline-none focus:border-emerald-400"
                />
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>

    <button
      onClick={handleReceive}
      disabled={acting || !workCard.delivery_date}
      className="h-9 px-4 rounded-[8px] text-[13px] font-medium bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-40 inline-flex items-center gap-1.5 transition-colors"
    >
      {acting ? 'กำลังบันทึก…' : 'รับลงสินค้า'}
    </button>
  </div>
)}
```

**6D — `handleReceive` function:**

```typescript
async function handleReceive() {
  if (!workCard.delivery_date) { setError('กรุณาระบุวันที่รับสินค้า'); return; }
  setActing(true);
  setError('');
  try {
    const result = await post<{ id: string; status: string; split_grn_id: string | null }>(
      `/api/grn/${id}/receive`,
      {
        delivery_date: workCard.delivery_date,
        receiver_name: workCard.receiver_name || undefined,
        lines: workCard.lines.map((l) => ({
          id: l.id,
          qty_received: l.qty_received,
          storage_location: l.storage_location || undefined,
        })),
      }
    );
    if (result.split_grn_id) {
      // Notify about split
      alert(`รับสินค้าเรียบร้อย สินค้าที่เหลือถูกแยกไปการ์ดงานใหม่ ${result.split_grn_id}`);
    }
    await fetchGRN();
  } catch (e: unknown) {
    setError(e instanceof Error ? e.message : 'เกิดข้อผิดพลาด');
  } finally {
    setActing(false);
  }
}
```

**6E — Supervisor confirm button (shown when status === 'received' and role is manager/admin):**

```tsx
{grn.status === 'received' && (session?.user as { role?: string })?.role !== 'staff' && (
  <button
    onClick={handleConfirm}
    disabled={acting}
    className="h-9 px-4 rounded-[8px] text-[13px] font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 inline-flex items-center gap-1.5 transition-colors"
  >
    {acting ? 'กำลังยืนยัน…' : 'ยืนยันรับสินค้า'}
  </button>
)}
```

**6F — `handleConfirm` function:**

```typescript
async function handleConfirm() {
  setActing(true);
  setError('');
  try {
    await post(`/api/grn/${id}/confirm`, {});
    await fetchGRN();
  } catch (e: unknown) {
    setError(e instanceof Error ? e.message : 'เกิดข้อผิดพลาด');
  } finally {
    setActing(false);
  }
}
```

**6G — Split GRN indicator (shown when grn.split_from_grn_id is set):**

```tsx
{grn.split_from_grn_id && (
  <div className="p-3 bg-amber-50 border border-amber-200 rounded-[8px] text-[13px] text-amber-800">
    การ์ดงานนี้แยกจากการรับสินค้าก่อนหน้า —{' '}
    <Link href={`/app/grn/${grn.split_from_grn_id}`} className="underline">ดู GRN ต้นทาง</Link>
  </div>
)}
```

- [x] Run `npm run lint` → no errors
- [x] Test full flow:
  1. Go to a sent PO → click "สร้างการ์ดงาน" → GRN created with all lines, qty=0, status=draft
  2. Open GRN → fill delivery_date, receiver_name, qty for SOME lines, locations → "รับลงสินค้า"
  3. Verify original GRN status = `received`, split GRN created for remaining items with status = `draft`
  4. As manager/admin: open received GRN → "ยืนยันรับสินค้า" → status = `stocked`, check stock_balances updated
- [x] Commit: `feat(grn): work card UI — staff fill form, receive action, supervisor confirm`

---

### Task 7 — GRN List: Thai Status Labels + Split Indicator

File: `app/app/grn/page.tsx`

- [x] Update status label rendering. Find where GRN status is displayed and replace with:

```typescript
const STATUS_LABEL: Record<string, string> = {
  draft:      'รอสินค้าจัดส่ง',
  received:   'รับลงสินค้า (รอตรวจสอบ)',
  qc_passed:  'QC ผ่าน',
  qc_failed:  'QC ไม่ผ่าน',
  stocked:    'ยืนยันการรับสินค้า',
  verified:   'ตรวจสอบแล้ว',
};
```

- [x] Update GRN list GET API (`app/api/grn/route.ts`) to also return `split_from_grn_id` in the SELECT query. Add to the SELECT:
  ```sql
  g.split_from_grn_id,
  ```

- [x] In the GRN list table, show a "แยก" badge when `split_from_grn_id` is set:
  ```tsx
  {row.split_from_grn_id && (
    <span className="ml-1.5 px-1.5 py-[1px] text-[10px] rounded-[4px] bg-amber-50 border border-amber-200 text-amber-700">แยก</span>
  )}
  ```

- [x] Run `npm run lint` → no errors
- [x] Verify: GRN list shows Thai status labels, split GRNs show amber badge
- [x] Commit: `feat(grn): list page — Thai status labels + split GRN badge`

---

### Task 8 — Update conductor/index.md

- [x] Mark this track Completed in `conductor/index.md`
- [x] Commit: `chore: conductor — grn-receiving-workflow track completed`

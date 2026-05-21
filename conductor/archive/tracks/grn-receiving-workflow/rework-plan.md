# Rework Plan — GRN Receiving Workflow
**Track:** grn-receiving-workflow
**Source:** Billy QA + User-Reported Issues (3)
**Date:** 2026-05-14
**Ready for:** Gemini CLI

---

## Issue Summary

Three user-reported enhancement requests integrated into rework plan:

| ID | Source | Severity | Issue |
|----|--------|----------|-------|
| G-001 | User-Reported | Should Fix | No visual feedback when received qty exceeds expected; staff assume over-receiving is blocked |
| G-002 | User-Reported | Should Fix | Receiving warehouse fixed at GRN creation time; no way to change on work card |
| G-003 | User-Reported | Must Fix | No product search in work card; cannot add bonus/extra items not on original PO |

---

## Must Fix

### [x] G-003: Product search + extra line support

**Files:** `app/api/grn/[id]/receive/route.ts` + `app/app/grn/[id]/page.tsx`

**Problem:** Work card at `page.tsx:243–282` only renders pre-loaded `grn.lines`. No mechanism to add products that arrive as bonus/extras not on the original PO. API `lineSchema` accepts only `id` (UUID of an existing `grn_line_items` row) — impossible to submit new products.

#### API changes — `app/api/grn/[id]/receive/route.ts`

1. Add `extraLineSchema` and `extra_lines` field to `schema` (also add `warehouse_id` here — used by G-002):

```typescript
const extraLineSchema = z.object({
  product_id: z.string().uuid(),
  qty_received: z.number().positive(),
  storage_location: z.string().max(100).optional(),
});

const schema = z.object({
  delivery_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  receiver_name: z.string().max(255).optional(),
  warehouse_id: z.string().uuid().optional(),        // G-002
  lines: z.array(lineSchema).min(1),
  extra_lines: z.array(extraLineSchema).optional(),  // G-003
});
```

2. Inside the transaction, after updating existing lines and before building `splitLines`, insert extra lines:

```typescript
const nextLineNumber = grnLines.length + 1;
if (parsed.data.extra_lines?.length) {
  for (let i = 0; i < parsed.data.extra_lines.length; i++) {
    const el = parsed.data.extra_lines[i];
    await client.query(
      `INSERT INTO grn_line_items
         (grn_id, product_id, qty_received, qty_accepted, qty_expected,
          storage_location, line_number)
       VALUES ($1, $2, $3, $3, NULL, $4, $5)`,
      [id, el.product_id, el.qty_received, el.storage_location ?? null, nextLineNumber + i]
    );
  }
}
```

`po_line_item_id` is NULL (no PO association). `qty_expected` is NULL (not ordered). Extra lines do NOT trigger auto-split (they have no `qty_expected` to compare against).

#### UI changes — `app/app/grn/[id]/page.tsx`

1. Add interfaces:

```typescript
interface ExtraLine {
  product_id: string;
  sku: string;
  name_th: string;
  qty_received: number;
  storage_location: string;
}

interface ProductSearchResult {
  id: string;
  sku: string;
  name_th: string;
}
```

2. Add state (near existing `workCard` state at line 71):

```typescript
const [extraLines, setExtraLines] = useState<ExtraLine[]>([]);
const [productSearch, setProductSearch] = useState('');
const [searchResults, setSearchResults] = useState<ProductSearchResult[]>([]);
const [searching, setSearching] = useState(false);
```

3. Add search handler with 300ms debounce:

```typescript
useEffect(() => {
  if (!productSearch.trim()) { setSearchResults([]); return; }
  const t = setTimeout(async () => {
    setSearching(true);
    try {
      const res = await get<{ items: ProductSearchResult[] }>(
        `/api/products?search=${encodeURIComponent(productSearch)}&limit=10`
      );
      setSearchResults(res.items ?? []);
    } finally {
      setSearching(false);
    }
  }, 300);
  return () => clearTimeout(t);
}, [productSearch]);
```

4. Add helper to add product from search result:

```typescript
function addExtraLine(p: ProductSearchResult) {
  setExtraLines((prev) => [...prev, {
    product_id: p.id, sku: p.sku, name_th: p.name_th,
    qty_received: 1, storage_location: '',
  }]);
  setProductSearch('');
  setSearchResults([]);
}
```

5. In the work card section (`page.tsx` inside `grn.status === 'draft'` block), after the existing lines table and before the "รับลงสินค้า" button, add the extra-lines UI:

```tsx
{/* Extra / bonus items search */}
<div className="mt-4 mb-2">
  <p className={`${LABEL_CLS}`}>เพิ่มสินค้าแถม / สินค้าที่ไม่ได้สั่ง</p>
  <div className="relative">
    <input
      type="text"
      placeholder="ค้นหาสินค้าด้วยชื่อหรือ SKU..."
      value={productSearch}
      onChange={(e) => setProductSearch(e.target.value)}
      className={FIELD_CLS}
    />
    {searchResults.length > 0 && (
      <ul className="absolute z-10 left-0 right-0 top-full mt-1 bg-white border border-stone-200 rounded-[7px] shadow-md text-[13px] max-h-48 overflow-y-auto">
        {searchResults.map((p) => (
          <li
            key={p.id}
            onClick={() => addExtraLine(p)}
            className="px-3 py-2 cursor-pointer hover:bg-emerald-50 flex items-center gap-2"
          >
            <span className="font-mono text-stone-400 text-[11px]">{p.sku}</span>
            <span>{p.name_th}</span>
          </li>
        ))}
      </ul>
    )}
    {searching && (
      <span className="absolute right-3 top-2 text-[11px] text-stone-400">กำลังค้นหา…</span>
    )}
  </div>
</div>

{extraLines.length > 0 && (
  <table className="w-full text-[13px] mb-4 border-t border-dashed border-amber-200 mt-2">
    <thead className="bg-amber-50">
      <tr>
        <th className="px-3 py-2 text-left font-medium text-amber-700">สินค้าเพิ่มเติม (ไม่ได้สั่ง)</th>
        <th className="px-3 py-2 text-right font-medium text-stone-600 w-32">จำนวนที่รับ</th>
        <th className="px-3 py-2 text-left font-medium text-stone-600 w-40">โลเคชั่น</th>
        <th className="w-10"></th>
      </tr>
    </thead>
    <tbody>
      {extraLines.map((el, i) => (
        <tr key={i} className="border-b border-stone-100">
          <td className="px-3 py-2">
            <span className="font-mono text-[12px] text-stone-600">{el.sku}</span>
            <p className="text-stone-800">{el.name_th}</p>
          </td>
          <td className="px-3 py-2">
            <input
              type="number" min="0.01" step="any"
              value={el.qty_received}
              onChange={(e) => setExtraLines((prev) =>
                prev.map((l, idx) => idx === i ? { ...l, qty_received: Number(e.target.value) || 0 } : l)
              )}
              className="w-full bg-white border border-stone-200 rounded-[6px] px-2 py-1.5 text-[13px] text-right outline-none focus:border-emerald-400"
            />
          </td>
          <td className="px-3 py-2">
            <input
              type="text" placeholder="A-01-02"
              value={el.storage_location}
              onChange={(e) => setExtraLines((prev) =>
                prev.map((l, idx) => idx === i ? { ...l, storage_location: e.target.value } : l)
              )}
              className="w-full bg-white border border-stone-200 rounded-[6px] px-2 py-1.5 text-[13px] outline-none focus:border-emerald-400"
            />
          </td>
          <td className="px-3 py-2 text-center">
            <button
              onClick={() => setExtraLines((prev) => prev.filter((_, idx) => idx !== i))}
              className="text-red-400 hover:text-red-600 text-[15px]"
            >×</button>
          </td>
        </tr>
      ))}
    </tbody>
  </table>
)}
```

6. Include `extra_lines` in `handleReceive` POST body:

```typescript
extra_lines: extraLines.length > 0
  ? extraLines.map((l) => ({
      product_id: l.product_id,
      qty_received: l.qty_received,
      storage_location: l.storage_location || undefined,
    }))
  : undefined,
```

---

## Should Fix

### [x] G-001: Visual feedback for over-receiving

**File:** `app/app/grn/[id]/page.tsx`

**Problem:** Work card qty input at line 255–265 has `min="0"` but no `max` and no visual indicator when `qty_received > qty_expected`. Staff see the column header "ที่สั่ง / คาดว่าจะรับ" and assume the input is capped. Over-receiving IS allowed by the API (Zod schema has no upper bound) but the UI gives no confirmation.

**Fix:** Below the qty `<input>` inside the `<td>` at line 254–265, add an amber warning line:

```tsx
{wl.qty_received > 0 && line.qty_expected != null && wl.qty_received > line.qty_expected && (
  <p className="text-[11px] text-amber-600 text-right mt-0.5 tabular-nums">
    เกินที่สั่ง +{(wl.qty_received - Number(line.qty_expected)).toFixed(0)} {line.uom_code}
  </p>
)}
```

No API changes required.

---

### [x] G-002: Receiving warehouse selector on work card

**Files:** `app/api/grn/[id]/receive/route.ts` + `app/app/grn/[id]/page.tsx`

**Problem:** `grn.warehouse_id` is set at GRN creation time (copied from PO). The receive route hardcodes it: the split GRN at `route.ts:108` always uses `grn.warehouse_id`. No warehouse selector in the work card. If the actual delivery arrives at a different dock, staff cannot redirect it.

#### API changes — `app/api/grn/[id]/receive/route.ts`

The `warehouse_id` field is already added to `schema` under G-003. Add validation and usage:

1. After `schema.safeParse`, validate the new warehouse if provided:

```typescript
const effectiveWarehouseId = parsed.data.warehouse_id ?? grn.warehouse_id;
if (parsed.data.warehouse_id) {
  const wh = await queryOne<{ id: string }>(
    `SELECT id FROM warehouses WHERE id = $1 AND is_active = true`,
    [parsed.data.warehouse_id]
  );
  if (!wh) return apiError('Warehouse not found', 404);
}
```

2. In the `UPDATE goods_receipt_notes` inside the transaction, add `warehouse_id = $5`:

```typescript
await client.query(
  `UPDATE goods_receipt_notes
   SET status = 'received',
       received_date = $1,
       receiver_name = $2,
       received_by = $3,
       warehouse_id = $4,
       updated_at = NOW()
   WHERE id = $5`,
  [parsed.data.delivery_date, parsed.data.receiver_name ?? null, u.id, effectiveWarehouseId, id]
);
```

3. In split GRN INSERT at line 103–114, replace `grn.warehouse_id` with `effectiveWarehouseId`:

```typescript
[grn.po_id, effectiveWarehouseId, u.id, id, `รอรับสินค้าที่เหลือ (แยกจาก ${id})`]
```

#### UI changes — `app/app/grn/[id]/page.tsx`

1. Add warehouse interface and state:

```typescript
interface Warehouse { id: string; code: string; name_th: string; }
const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
```

Add `warehouse_id` to `workCard` state:

```typescript
const [workCard, setWorkCard] = useState({
  delivery_date: new Date().toISOString().split('T')[0],
  receiver_name: '',
  warehouse_id: '',   // initialized below after grn loads
  lines: [] as { id: string; qty_received: number; storage_location: string }[],
});
```

2. Fetch warehouses on mount alongside `fetchGRN`. Use the `/api/admin/warehouses` route if accessible, otherwise add a lightweight `GET /api/warehouses` route that returns `id, code, name_th` for active warehouses (no auth role restriction — same as products list).

   **Check first:** if `GET /api/admin/warehouses` already exists and does not require `assertRole('admin')`, use it directly. If it requires admin, create `app/api/warehouses/route.ts`:

   ```typescript
   import { auth } from '@/auth';
   import { apiSuccess, apiError } from '@/lib/api-response';
   import { query } from '@/lib/db/client';

   export async function GET() {
     const session = await auth();
     if (!session?.user) return apiError('Unauthorized', 401);
     const rows = await query<{ id: string; code: string; name_th: string }>(
       `SELECT id, code, name_th FROM warehouses WHERE is_active = true ORDER BY code`,
       []
     );
     return apiSuccess(rows);
   }
   ```

3. In `fetchGRN`, initialize `workCard.warehouse_id` from `data.warehouse_id`:

```typescript
setWorkCard((wc) => ({
  ...wc,
  warehouse_id: data.warehouse_id,
  receiver_name: data.receiver_name ?? '',
  lines: data.lines.map((l) => ({
    id: l.id,
    qty_received: l.status === 'draft' ? 0 : l.qty_received,
    storage_location: l.storage_location ?? '',
  })),
}));
```

4. Fetch warehouses separately (parallel with `fetchGRN` or in `useEffect`):

```typescript
useEffect(() => {
  get<Warehouse[]>('/api/warehouses').then(setWarehouses).catch(() => {});
}, []);
```

5. Add warehouse selector to work card grid (change from `grid-cols-2` to `grid-cols-3`, or add as a third field):

```tsx
<div>
  <label className={LABEL_CLS}>คลังรับสินค้า / Receiving Warehouse</label>
  <select
    value={workCard.warehouse_id}
    onChange={(e) => setWorkCard((wc) => ({ ...wc, warehouse_id: e.target.value }))}
    className={FIELD_CLS}
  >
    {warehouses.map((w) => (
      <option key={w.id} value={w.id}>{w.code} — {w.name_th}</option>
    ))}
  </select>
</div>
```

6. Include in `handleReceive` POST body:

```typescript
warehouse_id: workCard.warehouse_id !== grn.warehouse_id
  ? workCard.warehouse_id
  : undefined,
```

---

## QA Checklist for Billy (post-rework)

1. **G-001 warning:** Open GRN work card → enter qty > `qty_expected` → amber "เกินที่สั่ง +N uom" label appears below input
2. **G-001 submit:** Submit with over-receiving qty → API returns 200, GRN status → `received`, no error
3. **G-002 selector:** Warehouse dropdown appears in work card form for draft GRN
4. **G-002 change:** Change warehouse → submit → `goods_receipt_notes.warehouse_id` updated in DB to new value
5. **G-002 split:** Trigger a partial receive (qty < expected) → split GRN created → split GRN uses the new `warehouse_id`, not original
6. **G-003 search:** Product search input visible in work card draft section
7. **G-003 results:** Type a product name → dropdown appears with matching products from `/api/products?search=...`
8. **G-003 add line:** Click result → row added to extra lines table with qty=1, editable qty + storage_location
9. **G-003 remove:** Click × → extra line removed from table
10. **G-003 submit:** Submit with extra lines → `grn_line_items` rows inserted with `po_line_item_id = NULL`, `qty_expected = NULL`, `qty_received = submitted_qty`
11. **G-003 display:** After receiving, extra lines visible in GRN lines table with `—` in คาดหวัง (expected) column

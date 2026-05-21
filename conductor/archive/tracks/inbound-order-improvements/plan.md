---
track: inbound-order-improvements
status: Verified
aliases: ["Inbound Order Improvements"]
owner: paku, puka
module: WMS
updated: 2026-05-14
---

# Inbound Order Improvements

**Goal:** Three UX improvements to the Inbound Order module: product search (replaces unusable 500-item dropdown), warehouse change on IO detail, and post-receipt unit cost editing.

**Scope:** 2 pages · 1 API route (new PATCH) · no migration required

---

## Context

| File | Current Problem |
|------|----------------|
| `app/app/inbound-orders/new/page.tsx` | Fetches all 500 products into a `<select>` — unusable at scale |
| `app/app/inbound-orders/[id]/page.tsx` | Warehouse is read-only after creation; unit_cost read-only after stocking |
| `app/api/inbound-orders/[id]/route.ts` | No PATCH handler — warehouse + cost updates have nowhere to go |

---

## Task 1 — Product Search in New IO Form

**File:** `app/app/inbound-orders/new/page.tsx`

**Current:** Line 37 fetches all products on mount: `get<{ data: Product[] }>('/api/products?limit=500')`. Lines table renders a native `<select>` for product selection (lines 138-145). With 500 products this dropdown is unusable.

**Fix:**

1. Remove the `products` state and the `get('/api/products?limit=500')` fetch entirely.

2. Add per-line search state. Extend `IOLine` interface:
```typescript
interface IOLine {
  product_id: string;
  qty_ordered: number;
  unit_cost: number;
  notes: string;
  product_label: string;
  // new:
  search: string;
  search_results: { id: string; sku: string; name_th: string; unit_cost: number }[];
  searching: boolean;
}
```

3. Update `addLine` to include new fields:
```typescript
function addLine() {
  setLines([...lines, {
    product_id: '', qty_ordered: 1, unit_cost: 0, notes: '',
    product_label: '', search: '', search_results: [], searching: false,
  }]);
}
```

4. Add a per-line search handler (debounce 300ms):
```typescript
async function searchProducts(i: number, q: string) {
  setLines((prev) => prev.map((l, idx) => idx === i ? { ...l, search: q, searching: !!q.trim() } : l));
  if (!q.trim()) {
    setLines((prev) => prev.map((l, idx) => idx === i ? { ...l, search_results: [], searching: false } : l));
    return;
  }
  const timerId = setTimeout(async () => {
    try {
      const res = await get<{ data: { id: string; sku: string; name_th: string; unit_cost: number }[] }>(
        `/api/products?search=${encodeURIComponent(q)}&limit=10`
      );
      setLines((prev) =>
        prev.map((l, idx) => idx === i ? { ...l, search_results: res.data, searching: false } : l)
      );
    } catch {
      setLines((prev) => prev.map((l, idx) => idx === i ? { ...l, searching: false } : l));
    }
  }, 300);
  return () => clearTimeout(timerId);
}
```

**Note:** Use a `useRef` map for timer IDs per line to avoid stale closure issues, or use a simpler `setTimeout` approach inside a `useEffect` keyed on the search string. The simplest correct implementation: store one debounce timer per line index in a `Map<number, ReturnType<typeof setTimeout>>`.

5. Add `selectProduct` helper:
```typescript
function selectProduct(i: number, p: { id: string; sku: string; name_th: string; unit_cost: number }) {
  setLines((prev) => prev.map((l, idx) =>
    idx === i
      ? { ...l, product_id: p.id, product_label: `${p.sku} — ${p.name_th}`, unit_cost: p.unit_cost,
          search: '', search_results: [], searching: false }
      : l
  ));
}
```

6. Replace the `<select>` in the table (lines 138-145) with:
```tsx
<td className="p-2 min-w-[220px]">
  {l.product_label ? (
    <div className="flex items-center gap-2">
      <span className="text-[13px]">{l.product_label}</span>
      <button
        onClick={() => setLines((prev) => prev.map((ln, idx) =>
          idx === i ? { ...ln, product_id: '', product_label: '', unit_cost: 0, search: '' } : ln
        ))}
        className="text-stone-400 hover:text-red-500 text-[15px] leading-none"
      >×</button>
    </div>
  ) : (
    <div className="relative">
      <input
        type="text"
        placeholder="พิมพ์ชื่อหรือ SKU..."
        value={l.search}
        onChange={(e) => searchProducts(i, e.target.value)}
        className="w-full rounded border border-stone-200 px-2 py-1 text-[13px] outline-none focus:border-emerald-400"
      />
      {l.searching && (
        <span className="absolute right-2 top-1.5 text-[11px] text-stone-400">ค้นหา…</span>
      )}
      {l.search_results.length > 0 && (
        <ul className="absolute z-20 left-0 right-0 top-full mt-0.5 bg-white border border-stone-200 rounded-[6px] shadow-md text-[13px] max-h-48 overflow-y-auto">
          {l.search_results.map((p) => (
            <li
              key={p.id}
              onMouseDown={() => selectProduct(i, p)}
              className="px-3 py-2 cursor-pointer hover:bg-emerald-50 flex gap-2 items-baseline"
            >
              <span className="font-mono text-[11px] text-stone-400">{p.sku}</span>
              <span>{p.name_th}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )}
</td>
```

**Note:** Use `onMouseDown` (not `onClick`) on the list items so the selection fires before the input's `onBlur` closes the dropdown.

---

## Task 2 — Receiving Warehouse Change on IO Detail

**Files:** `app/api/inbound-orders/[id]/route.ts` + `app/app/inbound-orders/[id]/page.tsx`

**Context:** `inbound_orders.warehouse_id` is set at creation. If the delivery redirects to a different dock, managers need to change it before GRN creation. Change is only meaningful when `status = 'open'` (no GRN created yet). Once receiving starts (`status = 'receiving'`), the GRN-level warehouse selector (from grn-receiving-workflow G-002) handles per-delivery routing.

### API — `app/api/inbound-orders/[id]/route.ts`

Add PATCH handler (this file currently has only GET):

```typescript
import { assertRole } from '@/lib/authz';
import { z } from 'zod';
import pool from '@/lib/db/client';

const patchSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('change_warehouse'),
    warehouse_id: z.string().uuid(),
  }),
  z.object({
    action: z.literal('update_costs'),
    lines: z.array(z.object({
      id: z.string().uuid(),
      unit_cost: z.number().nonnegative(),
    })).min(1),
  }),
]);

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;

  const { id } = await params;
  const body = await req.json().catch(() => null);
  if (!body) return apiError('Invalid JSON', 400);

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return apiValidationError(parsed.error);

  if (parsed.data.action === 'change_warehouse') {
    try { assertRole(u, ['manager', 'admin']); } catch { return apiError('Forbidden', 403); }

    const io = await queryOne<{ status: string }>(
      'SELECT status FROM inbound_orders WHERE id = $1',
      [id]
    );
    if (!io) return apiError('Inbound Order not found', 404);
    if (io.status !== 'open') return apiError('Warehouse can only be changed when IO is open', 409);

    const wh = await queryOne<{ id: string }>(
      'SELECT id FROM warehouses WHERE id = $1 AND is_active = true',
      [parsed.data.warehouse_id]
    );
    if (!wh) return apiError('Warehouse not found', 404);

    await query(
      'UPDATE inbound_orders SET warehouse_id = $1, updated_at = NOW() WHERE id = $2',
      [parsed.data.warehouse_id, id]
    );
    return apiSuccess({ id, warehouse_id: parsed.data.warehouse_id });
  }

  if (parsed.data.action === 'update_costs') {
    try { assertRole(u, ['manager', 'admin']); } catch { return apiError('Forbidden', 403); }

    const io = await queryOne<{ status: string }>(
      'SELECT status FROM inbound_orders WHERE id = $1',
      [id]
    );
    if (!io) return apiError('Inbound Order not found', 404);
    if (io.status === 'closed') return apiError('Cannot update costs on a closed IO', 409);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      for (const line of parsed.data.lines) {
        // Validate line belongs to this IO
        const iol = await client.query<{ product_id: string }>(
          'SELECT product_id FROM inbound_order_lines WHERE id = $1 AND io_id = $2',
          [line.id, id]
        );
        if (!iol.rows[0]) continue;

        await client.query(
          'UPDATE inbound_order_lines SET unit_cost = $1 WHERE id = $2',
          [line.unit_cost, line.id]
        );

        // Update product master unit_cost to reflect actual purchase price
        await client.query(
          'UPDATE products SET unit_cost = $1, updated_at = NOW() WHERE id = $2',
          [line.unit_cost, iol.rows[0].product_id]
        );
      }

      await client.query('COMMIT');
      return apiSuccess({ id, updated: parsed.data.lines.length });
    } catch (err) {
      await client.query('ROLLBACK');
      console.error(err);
      return apiError('Failed to update costs', 500);
    } finally {
      client.release();
    }
  }

  return apiError('Unknown action', 400);
}
```

**Required imports** to add at top of `[id]/route.ts`:
```typescript
import { auth } from '@/auth';
import { apiSuccess, apiError, apiValidationError } from '@/lib/api-response';
import { assertRole } from '@/lib/authz';
import { query, queryOne } from '@/lib/db/client';
import pool from '@/lib/db/client';
import { z } from 'zod';
import type { SessionUser } from '@/lib/authz';
```

### UI — `app/app/inbound-orders/[id]/page.tsx`

1. Add warehouse state and fetch:
```typescript
const [warehouses, setWarehouses] = useState<{ id: string; code: string; name_th: string }[]>([]);

useEffect(() => {
  get<{ id: string; code: string; name_th: string }[]>('/api/admin/warehouses')
    .then(setWarehouses)
    .catch(() => {});
}, []);
```

**Check:** If `/api/admin/warehouses` requires admin role, create a public `GET /api/warehouses` instead (same as grn-receiving-workflow G-002 — they can share the same new endpoint).

2. Add `handleChangeWarehouse` function:
```typescript
async function handleChangeWarehouse(warehouseId: string) {
  setError('');
  setSaving(true);
  try {
    await patch(`/api/inbound-orders/${id}`, { action: 'change_warehouse', warehouse_id: warehouseId });
    await fetchIO();
  } catch (e: unknown) {
    setError(e instanceof Error ? e.message : 'เกิดข้อผิดพลาด');
  } finally {
    setSaving(false);
  }
}
```

**Note:** Import `patch` from `@/lib/api-client`.

3. In the summary info cards section (currently a static `.map` at lines 82-94), replace the `คลังสินค้า` card with a conditional: show `<select>` when `io.status === 'open'`, plain text otherwise:

```tsx
<div key="คลังสินค้า" className="rounded-lg bg-white border border-gray-100 p-4">
  <p className="text-xs text-gray-400 mb-1">คลังสินค้า</p>
  {io.status === 'open' && warehouses.length > 0 ? (
    <select
      value={io.warehouse_id}
      onChange={(e) => handleChangeWarehouse(e.target.value)}
      disabled={saving}
      className="text-sm font-medium border border-stone-200 rounded-[6px] px-2 py-1 outline-none focus:border-emerald-400 w-full disabled:opacity-50"
    >
      {warehouses.map((w) => (
        <option key={w.id} value={w.id}>{w.code} — {w.name_th}</option>
      ))}
    </select>
  ) : (
    <p className="text-sm font-medium">{io.warehouse_code} — {io.warehouse_name}</p>
  )}
</div>
```

**Important:** The `[{ label, value }].map(...)` pattern in the current code renders all 4 cards in a single `.map`. Refactor this block to render `คลังสินค้า` card separately, keeping the other 3 in the map, OR break all 4 into explicit JSX cards. Do not break the existing layout.

---

## Task 3 — Post-Receipt Unit Cost Editing

**File:** `app/app/inbound-orders/[id]/page.tsx`

**Context:** After GRN is stocked and IO reaches `verified` status (before `closed`), managers review the vendor invoice and record actual per-unit prices. The API endpoint (`update_costs` action) is implemented in Task 2.

1. Add state for editable costs:
```typescript
const [editingCosts, setEditingCosts] = useState(false);
const [costEdits, setCostEdits] = useState<Record<string, string>>({});
const [savingCosts, setSavingCosts] = useState(false);
```

2. When entering edit mode, initialize `costEdits` from current line costs:
```typescript
function startEditCosts() {
  const init: Record<string, string> = {};
  io?.lines.forEach((l) => { init[l.id] = String(l.unit_cost); });
  setCostEdits(init);
  setEditingCosts(true);
}
```

3. Add `handleSaveCosts`:
```typescript
async function handleSaveCosts() {
  setSavingCosts(true);
  setError('');
  try {
    await patch(`/api/inbound-orders/${id}`, {
      action: 'update_costs',
      lines: Object.entries(costEdits).map(([lineId, cost]) => ({
        id: lineId,
        unit_cost: parseFloat(cost) || 0,
      })),
    });
    setEditingCosts(false);
    await fetchIO();
  } catch (e: unknown) {
    setError(e instanceof Error ? e.message : 'เกิดข้อผิดพลาด');
  } finally {
    setSavingCosts(false);
  }
}
```

4. In the lines table, add `ทุนต่อหน่วย` column behavior:
   - When `editingCosts === false`: render `formatCurrency(l.unit_cost)` as before
   - When `editingCosts === true`: render `<input type="number" ...>` for each line

   Replace the `<td className="p-3 text-right font-mono">{formatCurrency(l.unit_cost)}</td>` with:
   ```tsx
   <td className="p-3 text-right">
     {editingCosts ? (
       <input
         type="number"
         min="0"
         step="0.01"
         value={costEdits[l.id] ?? l.unit_cost}
         onChange={(e) => setCostEdits((prev) => ({ ...prev, [l.id]: e.target.value }))}
         className="w-28 text-right border border-stone-200 rounded-[6px] px-2 py-1 text-[13px] outline-none focus:border-emerald-400 font-mono"
       />
     ) : (
       <span className="font-mono text-[13px]">{formatCurrency(l.unit_cost)}</span>
     )}
   </td>
   ```

5. Add edit cost controls above or below the lines table, visible only when `io.status !== 'closed'` and user is manager/admin:

   Check role the same way the existing code does: `const isManager = session?.user && ['manager', 'admin'].includes((session.user as { role?: string }).role ?? '');`

   ```tsx
   {/* Cost edit controls — show when IO not closed and user is manager/admin */}
   {isManager && io.status !== 'closed' && (
     <div className="p-4 border-t flex items-center justify-between">
       <p className="text-[13px] text-stone-500">
         {io.status === 'verified'
           ? 'ระบุราคาทุนจริงตามใบแจ้งหนี้ผู้จำหน่าย'
           : 'อัปเดตราคาทุนได้เมื่อยืนยันสินค้าแล้ว'}
       </p>
       {editingCosts ? (
         <div className="flex gap-2">
           <button
             onClick={() => setEditingCosts(false)}
             className="h-8 px-3 rounded-[7px] text-[13px] text-stone-600 border border-stone-200 hover:bg-stone-50"
           >ยกเลิก</button>
           <button
             onClick={handleSaveCosts}
             disabled={savingCosts}
             className="h-8 px-3 rounded-[7px] text-[13px] font-medium bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-40"
           >{savingCosts ? 'กำลังบันทึก…' : 'บันทึกราคาทุน'}</button>
         </div>
       ) : (
         <button
           onClick={startEditCosts}
           className="h-8 px-3 rounded-[7px] text-[13px] font-medium border border-stone-200 text-stone-700 hover:bg-stone-50"
         >แก้ไขราคาทุน</button>
       )}
     </div>
   )}
   ```

   Place this block inside the lines table card `<div>`, after `</table>` and before the closing `</div>`.

6. Import `useSession` is already present at line 9. Add `patch` to the import from `@/lib/api-client`:
   ```typescript
   import { get, post, patch } from '@/lib/api-client';
   ```

---

## Checklist

- [x] **Task 1:** Product search in new IO form
  - [x] Static `products` state + bulk fetch removed
  - [x] Per-line search state added to `IOLine` interface
  - [x] Debounced search calls `/api/products?search=...&limit=10`
  - [x] Dropdown uses `onMouseDown` (not `onClick`) to prevent premature blur-close
  - [x] After selection: product locked, shows chip with × to clear
  - [x] Submit still sends correct `product_id` per line

- [x] **Task 2:** Warehouse change on IO detail
  - [x] PATCH handler added to `app/api/inbound-orders/[id]/route.ts`
  - [x] `change_warehouse` action: assertRole manager/admin, status check (`open` only), warehouse existence check
  - [x] `update_costs` action: assertRole manager/admin, status check (not `closed`), validates line belongs to IO
  - [x] IO detail: warehouse card shows `<select>` when `status === 'open'`
  - [x] Changing warehouse calls `patch(...)` and refreshes IO data

- [x] **Task 3:** Post-receipt cost editing
  - [x] `editingCosts` state, `costEdits` record per line id
  - [x] "แก้ไขราคาทุน" button visible for manager/admin on non-closed IOs
  - [x] Lines table switches to `<input type="number">` when editing
  - [x] Save calls `patch({ action: 'update_costs', lines: [...] })`
  - [x] API updates `inbound_order_lines.unit_cost` + `products.unit_cost` for each line
  - [x] After save: `editingCosts = false`, IO data refreshed

---
## Execution Logs
- [[execution-summary]]


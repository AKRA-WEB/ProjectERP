---
track: uom-phase2-form-selectors
status: Completed
owner: puka
module: Inventory
updated: 2026-05-14
---

# UoM Phase 2 — Transaction Form Selectors

**Goal:** Add UoM selectors to PO, SO, and Transfer create forms. DB columns (`transaction_uom_id`, `transaction_qty`, `base_qty`) and triggers already exist from migration 026. This track is UI + API wiring only — no new migrations.

**Scope:** PO create, SO create, Transfer create. GRN lines auto-inherit UoM from PO lines (handled separately if needed).

---

## How it works (end-to-end)

1. User adds product line, selects UoM from dropdown (e.g. CTN)
2. UI shows conversion preview: "5 CTN = 240 PCS"
3. Form sends: `qty_ordered = 5`, `transaction_uom_id = <CTN uuid>`, `transaction_qty = 5`
4. API stores all three fields in the line row
5. DB trigger `fn_fill_line_base_qty` fires: sets `base_qty = 240`
6. Legacy `qty_ordered` stays 5 — `line_total = 5 × unit_price` (correct)
7. GRN stocking already uses `base_qty ?? qty_accepted` — stock impact is 240 PCS

**UoM dropdown appears only when product has entries in `product_uom` table.** If no UoMs registered for a product, no selector shown — behaves exactly as before.

---

## API Reference

Existing endpoint to fetch product UoMs (already implemented):
```
GET /api/products/:id/uom
Returns: ProductUom[] with { uom_id, uom_code, uom_name_th, uom_type, factor, base_uom_code, is_base_unit }
```

---

## Tasks

### Task 1 — PO API: accept transaction_uom_id + transaction_qty

File: `app/api/purchase-orders/route.ts`

- [x] **Step 1 — Extend lineSchema** (add two optional fields after `unit_price`):

```typescript
const lineSchema = z.object({
  product_id: z.string().uuid(),
  pr_line_item_id: z.string().uuid().optional(),
  qty_ordered: z.number().positive(),
  unit_price: z.number().nonnegative(),
  transaction_uom_id: z.string().uuid().optional(),
  transaction_qty: z.number().positive().optional(),
});
```

- [x] **Step 2 — Update the bulk line INSERT** (currently uses 4 params per line; extend to 6):

Replace the lines INSERT block (starting at `const lineValues = parsed.data.lines`) with:

```typescript
const lineValues = parsed.data.lines
  .map((_, i) => `($1, $${i * 6 + 2}, $${i * 6 + 3}, $${i * 6 + 4}, $${i * 6 + 5}, $${i * 6 + 6}, $${i * 6 + 7}, ${i + 1})`)
  .join(', ');
const lineParams: unknown[] = [po.id];
for (const l of parsed.data.lines) {
  lineParams.push(
    l.product_id,
    l.pr_line_item_id ?? null,
    l.qty_ordered,
    l.unit_price,
    l.transaction_uom_id ?? null,
    l.transaction_qty ?? null,
  );
}
await query(
  `INSERT INTO po_line_items (po_id, product_id, pr_line_item_id, qty_ordered, unit_price, transaction_uom_id, transaction_qty, line_number)
   VALUES ${lineValues}`,
  lineParams
);
```

- [x] Run `npm run lint` → no errors
- [x] Commit: `feat(uom): PO API — accept transaction_uom_id + transaction_qty on lines`

---

### Task 2 — SO API: accept transaction_uom_id + transaction_qty

File: `app/api/sales-orders/route.ts`

- [x] **Step 1 — Extend SO lineSchema:**

Find the existing SO line schema and add:
```typescript
transaction_uom_id: z.string().uuid().optional(),
transaction_qty: z.number().positive().optional(),
```

- [x] **Step 2 — Update SO line INSERT:**

Locate the `INSERT INTO so_line_items` query. Add `transaction_uom_id`, `transaction_qty` columns.

The existing SO line INSERT likely iterates per line. Add the two fields alongside existing fields:
```typescript
// In the loop that builds so_line_items INSERT:
// Add transaction_uom_id and transaction_qty params, pass null if not provided
// Column list: (...existing..., transaction_uom_id, transaction_qty)
// Values: (...existing..., $N, $M)
```

Read the exact INSERT in `app/api/sales-orders/route.ts` before modifying to match its pattern exactly.

- [x] Run `npm run lint` → no errors
- [x] Commit: `feat(uom): SO API — accept transaction_uom_id + transaction_qty on lines`

---

### Task 3 — Transfers API: accept transaction_uom_id + transaction_qty

File: `app/api/transfers/route.ts`

Current lineSchema:
```typescript
const lineSchema = z.object({
  product_id: z.string().uuid(),
  lot_id: z.string().uuid().optional(),
  qty: z.number().positive(),
});
```

- [x] **Step 1 — Extend Transfer lineSchema:**

```typescript
const lineSchema = z.object({
  product_id: z.string().uuid(),
  lot_id: z.string().uuid().optional(),
  qty: z.number().positive(),
  transaction_uom_id: z.string().uuid().optional(),
  transaction_qty: z.number().positive().optional(),
});
```

- [x] **Step 2 — Update warehouse_transfer_lines INSERT:**

Locate the INSERT into `warehouse_transfer_lines`. Add:
```
transaction_uom_id = $N  (NULL if not provided)
transaction_qty    = $M  (NULL if not provided)
```

- [x] Run `npm run lint` → no errors
- [x] Commit: `feat(uom): Transfers API — accept transaction_uom_id + transaction_qty on lines`

---

### Task 4 — PO Create Form: UoM Selector

File: `app/app/purchase-orders/new/page.tsx`

- [x] **Step 1 — Extend POLine interface** to hold UoM data:

```typescript
interface POLine {
  product_id: string;
  product_label: string;
  pr_line_item_id?: string;
  qty_ordered: number;
  unit_price: number;
  transaction_uom_id?: string;
  transaction_qty?: number;
  // display helpers
  uom_options: { id: string; code: string; name_th: string; factor: number | null; base_uom_code: string | null }[];
}
```

- [x] **Step 2 — Add ProductUom interface** (local, not imported):

```typescript
interface ProductUom {
  uom_id: string;
  uom_code: string;
  uom_name_th: string;
  is_base_unit: boolean;
  factor: number | null;
  base_uom_code: string | null;
}
```

- [x] **Step 3 — Fetch UoMs when product is added:**

Replace `addProduct` function:
```typescript
async function addProduct(p: Product) {
  const vendorPrice = vendorCatalog[p.id];
  const unit_price = vendorPrice !== undefined ? vendorPrice : (Number(p.unit_cost) || 0);

  let uomOptions: POLine['uom_options'] = [];
  try {
    const uoms = await get<ProductUom[]>(`/api/products/${p.id}/uom`);
    uomOptions = uoms.map((u) => ({ id: u.uom_id, code: u.uom_code, name_th: u.uom_name_th, factor: u.factor ?? null, base_uom_code: u.base_uom_code ?? null }));
  } catch {
    // no UoMs registered — base unit only, no selector shown
  }

  setLines((prev) => [...prev, {
    product_id: p.id,
    product_label: `${p.sku} — ${p.name_th}`,
    qty_ordered: 1,
    unit_price,
    uom_options: uomOptions,
  }]);
  setProductSearch('');
  setProductResults([]);
}
```

- [x] **Step 4 — Add UoM selector helper function:**

```typescript
function setLineUom(i: number, uomId: string) {
  setLines((prev) => prev.map((l, idx) => {
    if (idx !== i) return l;
    const opt = l.uom_options.find((o) => o.id === uomId);
    return { ...l, transaction_uom_id: opt ? uomId : undefined, transaction_qty: l.qty_ordered };
  }));
}
```

- [x] **Step 5 — Update line render in JSX** to show UoM selector and conversion preview after the qty input:

```tsx
{/* UoM selector — only shown when product has multiple UoMs */}
{line.uom_options.length > 1 && (
  <div className="mt-1.5 flex items-center gap-2">
    <select
      value={line.transaction_uom_id ?? ''}
      onChange={(e) => setLineUom(i, e.target.value)}
      className="bg-white border border-stone-200 rounded-[6px] px-2 py-1 text-[12px] text-stone-800 outline-none focus:border-emerald-400"
    >
      <option value="">หน่วยฐาน</option>
      {line.uom_options.filter((o) => !o.base_uom_code === false || o.factor != null).map((o) => (
        <option key={o.id} value={o.id}>{o.code} — {o.name_th}</option>
      ))}
    </select>
    {line.transaction_uom_id && (() => {
      const opt = line.uom_options.find((o) => o.id === line.transaction_uom_id);
      if (opt?.factor) {
        return (
          <span className="text-[11px] text-stone-400">
            = {Math.floor(line.qty_ordered * opt.factor)} {opt.base_uom_code}
          </span>
        );
      }
      return null;
    })()}
  </div>
)}
```

- [x] **Step 6 — Update `updateLine` to sync transaction_qty with qty_ordered:**

```typescript
function updateLine(i: number, key: keyof Omit<POLine, 'uom_options'>, val: number) {
  setLines((prev) => prev.map((l, idx) => {
    if (idx !== i) return l;
    const updated = { ...l, [key]: val };
    // keep transaction_qty in sync with qty_ordered when UoM is selected
    if (key === 'qty_ordered' && l.transaction_uom_id) updated.transaction_qty = val;
    return updated;
  }));
}
```

- [x] **Step 7 — Pass UoM fields to POST body:**

In `handleSubmit`, update the lines map:
```typescript
lines: lines.map((l) => ({
  product_id: l.product_id,
  pr_line_item_id: l.pr_line_item_id,
  qty_ordered: l.qty_ordered,
  unit_price: l.unit_price,
  ...(l.transaction_uom_id ? { transaction_uom_id: l.transaction_uom_id, transaction_qty: l.transaction_qty ?? l.qty_ordered } : {}),
})),
```

- [x] Run `npm run lint` → no errors
- [ ] Test: create PO, add a product that has UoMs (e.g. a product with CTN registered). UoM dropdown appears. Select CTN, enter qty 5 → preview shows "= 240 PCS". Submit → PO created. Check DB: `SELECT transaction_uom_id, transaction_qty, base_qty FROM po_line_items ORDER BY created_at DESC LIMIT 1;` → should show CTN id, 5, 240.
- [ ] Test: add a product with no UoMs registered → no dropdown, behaves as before.
- [x] Commit: `feat(uom): PO create form — UoM selector with conversion preview`

---

### Task 5 — SO Create Form: UoM Selector

File: `app/app/sales-orders/new/page.tsx`

The SO form uses a different pattern (product dropdown select instead of search). Apply the same UoM selector pattern:

- [x] **Step 1** — When product is selected in `updateLine`, fetch UoMs and store on the line state (add `uom_options` to SO line interface, same structure as POLine)
- [x] **Step 2 — Add UoM selector in the SO line render (same JSX block as Task 4 Step 5)**
- [x] **Step 3 — Pass `transaction_uom_id` + `transaction_qty` in SO POST body when selected**
- [x] Run `npm run lint` → no errors
- [ ] Test: create SO, select product with UoMs → UoM dropdown appears → select → preview shows → submit → DB has base_qty filled
- [x] Commit: `feat(uom): SO create form — UoM selector with conversion preview`

---

### Task 6 — Transfer Create Form: UoM Selector

File: `app/app/transfers/new/page.tsx`

Current `TransferLine`: `{ product_id, product_label, lot_id?, qty }`. Stock results show `uom_code`.

- [x] **Step 1 — Extend TransferLine interface:**

```typescript
interface TransferLine {
  product_id: string;
  product_label: string;
  lot_id?: string;
  qty: number;
  transaction_uom_id?: string;
  transaction_qty?: number;
  uom_options: { id: string; code: string; name_th: string; factor: number | null; base_uom_code: string | null }[];
}
```

- [x] **Step 2 — Fetch UoMs in `addLine`:**

Replace `addLine` function:
```typescript
async function addLine(item: StockResult) {
  let uomOptions: TransferLine['uom_options'] = [];
  try {
    const uoms = await get<{ uom_id: string; uom_code: string; uom_name_th: string; factor: number | null; base_uom_code: string | null }[]>(`/api/products/${item.product_id}/uom`);
    uomOptions = uoms.map((u) => ({ id: u.uom_id, code: u.uom_code, name_th: u.uom_name_th, factor: u.factor ?? null, base_uom_code: u.base_uom_code ?? null }));
  } catch { /* base unit only */ }

  setLines((prev) => [...prev, {
    product_id: item.product_id,
    product_label: `${item.sku} — ${item.name_th} (พร้อมโอน: ${item.qty_available})`,
    qty: 1,
    uom_options: uomOptions,
  }]);
  setStockSearch('');
  setStockResults([]);
}
```

- [x] **Step 3 — Add UoM selector to transfer line render** (same JSX pattern as Task 4 Step 5, using `qty` instead of `qty_ordered`)

- [x] **Step 4 — Pass UoM fields in POST body:**

```typescript
lines: lines.map((l) => ({
  product_id: l.product_id,
  lot_id: l.lot_id,
  qty: l.qty,
  ...(l.transaction_uom_id ? { transaction_uom_id: l.transaction_uom_id, transaction_qty: l.transaction_qty ?? l.qty } : {}),
})),
```

- [x] Run `npm run lint` → no errors
- [ ] Test: create transfer, add product with UoMs → dropdown appears → select → preview → submit
- [x] Commit: `feat(uom): Transfer create form — UoM selector with conversion preview`

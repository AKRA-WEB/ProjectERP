---
track: io-product-search
status: Completed
owner: puka
module: WMS
updated: 2026-05-10
---

# Track: IO Product Search + Remove Unit Cost

**Goal:** Two targeted changes to the Inbound Order creation form:
1. Replace the static product `<select>` dropdown (which attempts to load 500 of 4761 products) with a per-line search-as-you-type that calls the products API.
2. Remove the `unit_cost` (ราคาทุน) input column — it has no business value at the IO stage and the API already defaults it to `0`.

---

## Current State

**File:** `app/app/inbound-orders/new/page.tsx`

- Line 37: loads 500 products upfront → `get<{ data: Product[] }>('/api/products?limit=500')`
- Lines 138–145: renders a `<select>` with all 500 products per line — unusable with 4761 products
- Lines 130–132 and 155–162: "ราคาทุน" column header + number input per line
- `IOLine` interface (line 9–15): has `unit_cost: number` field
- `updateLine` handler (line 54): auto-fills `unit_cost` from product's `unit_cost`

**File:** `app/api/inbound-orders/route.ts`

- `lineSchema` (line 9–14): `unit_cost: z.number().nonnegative().default(0)` — already optional with default, **no API change needed**

---

## Task 1 — Replace Product Dropdown with Inline Search

**File:** `app/app/inbound-orders/new/page.tsx`

### 1a. Remove the products bulk-load

Delete line 37:
```typescript
// DELETE this line:
get<{ data: Product[] }>('/api/products?limit=500').then((res) => setProducts(res.data));
```

Also delete the `products` state (line 22) and its import is already via `type { Warehouse, Product }` — keep the type import since `Product` is used in the inline component.

### 1b. Add `ProductSearch` inline component

Add this component **above** `NewInboundOrderPage` (or as a named function within the file):

```tsx
interface ProductSearchProps {
  value: string;        // current display text (SKU — name)
  onSelect: (id: string, label: string) => void;
  onClear: () => void;
}

function ProductSearch({ value, onSelect, onClear }: ProductSearchProps) {
  const [query, setQuery] = useState(value);
  const [results, setResults] = useState<Product[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Sync external value changes (e.g. when line is cleared)
  useEffect(() => { setQuery(value); }, [value]);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Debounced search
  useEffect(() => {
    if (query.length < 2) { setResults([]); setOpen(false); return; }
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await get<{ data: Product[] }>(
          `/api/products?search=${encodeURIComponent(query)}&limit=20`
        );
        setResults(res.data);
        setOpen(res.data.length > 0);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  return (
    <div ref={containerRef} className="relative">
      <div className="flex items-center gap-1">
        <input
          type="text"
          className="w-full rounded border px-2 py-1 text-sm"
          placeholder="พิมพ์ชื่อหรือ SKU..."
          value={query}
          onChange={(e) => { setQuery(e.target.value); }}
          onFocus={() => { if (results.length > 0) setOpen(true); }}
        />
        {value && (
          <button
            type="button"
            onClick={() => { setQuery(''); setResults([]); setOpen(false); onClear(); }}
            className="text-gray-400 hover:text-gray-600 text-xs px-1"
            aria-label="ล้าง"
          >
            ✕
          </button>
        )}
      </div>
      {open && (
        <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-52 overflow-y-auto">
          {loading && (
            <p className="px-3 py-2 text-xs text-gray-400">กำลังค้นหา...</p>
          )}
          {!loading && results.map((p) => (
            <button
              key={p.id}
              type="button"
              className="w-full text-left px-3 py-2 hover:bg-gray-50 text-sm border-b last:border-0"
              onClick={() => {
                const label = `${p.sku} — ${p.name_th}`;
                setQuery(label);
                setOpen(false);
                onSelect(p.id, label);
              }}
            >
              <span className="font-mono text-xs text-gray-500 mr-2">{p.sku}</span>
              {p.name_th}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
```

**Imports to add at the top of the file:**
```typescript
import { useState, useEffect, useRef } from 'react';
```
(add `useRef` to the existing import)

### 1c. Update `IOLine` interface — remove `unit_cost`, keep `product_label`

```typescript
interface IOLine {
  product_id: string;
  product_label: string;   // display text in the search box
  qty_ordered: number;
  notes: string;
  // unit_cost removed
}
```

### 1d. Update `addLine` — remove `unit_cost`

```typescript
function addLine() {
  setLines([...lines, { product_id: '', product_label: '', qty_ordered: 1, notes: '' }]);
}
```

### 1e. Update `updateLine` — remove `unit_cost` auto-fill

```typescript
function updateLine(i: number, key: keyof IOLine, val: any) {
  const newLines = [...lines];
  newLines[i] = { ...newLines[i], [key]: val };
  setLines(newLines);
}
```

Add a separate handler for product selection (used by `ProductSearch.onSelect`):
```typescript
function selectProduct(i: number, id: string, label: string) {
  const newLines = [...lines];
  newLines[i] = { ...newLines[i], product_id: id, product_label: label };
  setLines(newLines);
}

function clearProduct(i: number) {
  const newLines = [...lines];
  newLines[i] = { ...newLines[i], product_id: '', product_label: '' };
  setLines(newLines);
}
```

### 1f. Remove `products` state

```typescript
// DELETE:
const [products, setProducts] = useState<Product[]>([]);
```

---

## Task 2 — Remove Unit Cost Column from Table

**File:** `app/app/inbound-orders/new/page.tsx`

### 2a. Remove column header

```tsx
// BEFORE:
<th className="text-right p-3 font-medium text-gray-600 w-24">จำนวน</th>
<th className="text-right p-3 font-medium text-gray-600 w-32">ราคาทุน</th>
<th className="w-12"></th>

// AFTER:
<th className="text-right p-3 font-medium text-gray-600 w-32">จำนวน</th>
<th className="w-12"></th>
```

### 2b. Remove `unit_cost` input cell and replace product `<select>` with `ProductSearch`

```tsx
// BEFORE (each row):
<td className="p-2">
  <select ...>
    <option value="">เลือกสินค้า...</option>
    {products.map((p) => <option key={p.id} value={p.id}>{p.sku} — {p.name_th}</option>)}
  </select>
</td>
<td className="p-2">
  <input type="number" ... qty_ordered ... />
</td>
<td className="p-2">
  <input type="number" ... unit_cost ... />
</td>
<td className="p-2 text-center">
  <button onClick={() => removeLine(i)}>✕</button>
</td>

// AFTER:
<td className="p-2">
  <ProductSearch
    value={l.product_label}
    onSelect={(id, label) => selectProduct(i, id, label)}
    onClear={() => clearProduct(i)}
  />
</td>
<td className="p-2">
  <input
    type="number"
    className="w-full text-right rounded border px-2 py-1"
    value={l.qty_ordered}
    min="0.001"
    step="any"
    onChange={(e) => updateLine(i, 'qty_ordered', parseFloat(e.target.value) || 0)}
  />
</td>
<td className="p-2 text-center">
  <button onClick={() => removeLine(i)} className="text-red-500 hover:text-red-700 text-lg">✕</button>
</td>
```

### 2c. Remove `unit_cost` from the POST body

```typescript
// BEFORE:
lines: lines.map((l) => ({
  product_id: l.product_id,
  qty_ordered: l.qty_ordered,
  unit_cost: l.unit_cost,
  notes: l.notes || undefined,
})),

// AFTER:
lines: lines.map((l) => ({
  product_id: l.product_id,
  qty_ordered: l.qty_ordered,
  notes: l.notes || undefined,
})),
```

The API's `unit_cost` field has `.default(0)` so omitting it is safe.

---

## Task 3 — No API Changes Required

`app/api/inbound-orders/route.ts`:
- `unit_cost: z.number().nonnegative().default(0)` already handles missing value
- No schema changes needed

`inbound_order_lines.unit_cost` column in DB:
- Stays as-is (will store 0 for all new IO lines)
- No migration needed

---

## Verification Checklist

- [ ] Navigate to `/app/inbound-orders/new`
- [ ] Page loads without fetching 500 products upfront (check Network tab — no bulk products request)
- [ ] Click "+ เพิ่มรายการ" → new row appears with search input (no dropdown)
- [ ] Type "SKU" or product name in search box → results appear after 300ms debounce
- [ ] Select a product → product name/SKU appears in the row; results close
- [ ] Clear button (✕) resets the product selection for that line
- [ ] No "ราคาทุน" column visible in the table
- [ ] Submit with valid data → IO created successfully, redirects to IO detail
- [ ] `npm run build` passes — no TypeScript errors

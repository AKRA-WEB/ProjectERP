# Track: GR Staff Workflow

**Goal:** Build a focused goods-receipt workflow for warehouse staff. When a vendor delivers goods, staff can see what is expected, record quantities received, assign a storage location per line, view existing stock levels inline, and confirm the receiver's name.

---

## Gap Analysis (current vs. required)

| Requirement | Current State | Gap |
|---|---|---|
| View the receiving list | GRN list shows past GRNs only | No "pending deliveries" queue showing what's expected to arrive |
| Record received quantity | Supported in `new/page.tsx` | ✅ Exists — minor UX improvements needed |
| Storage location | Warehouse-level only | ❌ No per-line bin/location field in `grn_line_items` |
| Existing stock quantity | Not shown during receipt | ❌ `stock_balances` not joined when loading GRN form |
| Receiver's name | Auto-set from session `received_by` | ❌ Not shown clearly; no override for managers logging on behalf of staff |

---

## Task 1 — Database Migration: Add Storage Location

**File:** `migrations/013_grn_storage_location.sql`

Add a free-text `storage_location` column to `grn_line_items`. This represents the bin, shelf, or zone where the item is physically placed (e.g., "A-1-3", "Zone B Shelf 2").

```sql
ALTER TABLE grn_line_items
  ADD COLUMN IF NOT EXISTS storage_location VARCHAR(100);

COMMENT ON COLUMN grn_line_items.storage_location
  IS 'Bin/shelf/zone within the warehouse where this item was placed on receipt';
```

- [x] Create `migrations/013_grn_storage_location.sql` with the `ALTER TABLE` above
- [x] Run `npm run migrate` to apply

---

## Task 2 — New API: Receiving Queue

**File:** `app/api/grn/receiving-queue/route.ts`

Returns a list of Purchase Orders in `sent` or `partially_received` status, with their line items and expected receipt details. This is the "what to receive today" feed for staff.

```typescript
// GET /api/grn/receiving-queue
// Auth: any role. Warehouse-scoped for staff/manager.
// Returns: POs pending receipt, ordered by po.created_at DESC

// Query:
SELECT
  po.id,
  po.po_number,
  po.status,
  po.expected_delivery,   -- DATE field on purchase_orders (may be NULL)
  v.name_th AS vendor_name,
  w.id AS warehouse_id,
  w.code AS warehouse_code,
  w.name_th AS warehouse_name,
  COUNT(li.id) AS total_lines,
  SUM(li.qty_ordered - li.qty_received) AS total_qty_remaining
FROM purchase_orders po
JOIN vendors v ON v.id = po.vendor_id
JOIN warehouses w ON w.id = po.warehouse_id
JOIN po_line_items li ON li.po_id = po.id
WHERE po.status IN ('sent', 'partially_received')
  AND li.qty_ordered > li.qty_received   -- only POs with items still pending
  [+ warehouse scope clause]
GROUP BY po.id, v.name_th, w.id, w.code, w.name_th
ORDER BY po.created_at DESC
LIMIT 50
```

> **Note on `expected_delivery`:** Check if the column exists on `purchase_orders` by reading `migrations/005_pr_po.sql`. If it doesn't exist, add it in `migrations/013_grn_storage_location.sql`:
> ```sql
> ALTER TABLE purchase_orders
>   ADD COLUMN IF NOT EXISTS expected_delivery DATE;
> ```

- [x] Check `migrations/005_pr_po.sql` for `expected_delivery` column — add to migration if missing
- [x] Create `app/api/grn/receiving-queue/route.ts` with GET handler
- [x] Apply `buildWarehouseScopeClause` for staff/manager restriction

---

## Task 3 — Enhance PO Detail API: Include Current Stock

**File:** `app/api/purchase-orders/[id]/route.ts`

When the GRN creation form loads a PO, it currently returns lines without current stock. Add `qty_on_hand` and `qty_available` from `stock_balances` to each line item so staff can see existing inventory while entering received quantities.

In the existing GET handler for `/api/purchase-orders/:id`, modify the `po_line_items` query to LEFT JOIN `stock_balances`:

```sql
SELECT
  li.id, li.product_id, li.qty_ordered, li.qty_received,
  p.sku, p.name_th, p.name_en, p.is_lot_tracked, p.is_serial_tracked,
  COALESCE(sb.qty_on_hand, 0)   AS qty_on_hand,
  COALESCE(sb.qty_available, 0) AS qty_available
FROM po_line_items li
JOIN products p ON p.id = li.product_id
LEFT JOIN stock_balances sb
  ON sb.product_id = li.product_id
  AND sb.warehouse_id = $warehouse_id_from_po
WHERE li.po_id = $1
ORDER BY li.line_number
```

> The warehouse comes from `purchase_orders.warehouse_id` — already fetched in the PO header query.

- [x] Read `app/api/purchase-orders/[id]/route.ts` to find the lines query
- [x] Add LEFT JOIN to `stock_balances` using the PO's `warehouse_id`
- [x] Return `qty_on_hand` and `qty_available` on each line object

---

## Task 4 — Enhance GRN Create API: Accept Storage Location

**File:** `app/api/grn/route.ts`

Update `lineSchema` to accept the optional `storage_location` field, and insert it into `grn_line_items`.

```typescript
// In lineSchema:
storage_location: z.string().max(100).optional(),

// In the INSERT into grn_line_items:
// Add storage_location to column list and params
INSERT INTO grn_line_items
  (grn_id, po_line_item_id, product_id, qty_received,
   lot_number, serial_number, expiry_date, storage_location, line_number)
VALUES ...
```

- [x] Add `storage_location: z.string().max(100).optional()` to `lineSchema`
- [x] Add `storage_location` to the INSERT column list and parameterized values
- [x] Verify the multi-row INSERT parameter indexing remains correct

---

## Task 5 — Enhance GRN Detail API: Return Storage Location

**File:** `app/api/grn/[id]/route.ts`

The lines query already returns all `grn_line_items` columns via `li.*`. Since `storage_location` is a new column on that table, it will be returned automatically once the migration runs. No query change needed.

- [x] Verify `li.*` covers the new `storage_location` column — no change needed if query uses `li.*`

---

## Task 6 — New Page: Receiving Queue (Pending Deliveries)

**File:** `app/app/grn/receiving-queue/page.tsx`

A dedicated view for staff. Shows incoming deliveries (POs pending receipt) with a "Receive" button that links to the GRN creation form pre-filled with the PO.

```
┌─────────────────────────────────────────────────────┐
│  รายการรอรับสินค้า / Pending Deliveries             │
│  [warehouse filter]                                  │
├───────────┬──────────────┬────────────┬─────────────┤
│ เลข PO   │ Vendor       │ คลัง       │ สถานะ  │ Actions │
├───────────┼──────────────┼────────────┼─────────────┤
│ PO-001    │ ABC Supply   │ WH-01      │ ส่งแล้ว │ [รับสินค้า] │
│ PO-002    │ XYZ Co.      │ WH-01      │ รับบางส่วน │ [รับเพิ่ม] │
└───────────┴──────────────┴────────────┴─────────────┘
```

Each row:
- Shows `po_number`, `vendor_name`, `warehouse_code`, `status` badge, `total_qty_remaining`
- "รับสินค้า / Receive" button → links to `/app/grn/new?po_id={po.id}`

Page structure:
```tsx
'use client';
// fetch from GET /api/grn/receiving-queue
// warehouse filter select (fetched from /api/admin/warehouses)
// table of pending POs
// Each row has a Link to /app/grn/new?po_id={po.id}
```

- [x] Create `app/app/grn/receiving-queue/page.tsx`
- [x] Fetch from `/api/grn/receiving-queue`
- [x] Add warehouse filter (reuses same pattern as other list pages)
- [x] Link each row to `/app/grn/new?po_id={id}`
- [x] Show empty state: "ไม่มีรายการรอรับ / No pending deliveries"

---

## Task 7 — Enhance GRN New Form: Stock Display + Location + Receiver

**File:** `app/app/grn/new/page.tsx`

Three additions to the existing form:

### 7a. Show current stock per line
The PO detail API now returns `qty_on_hand` and `qty_available`. Update `GRNLine` interface and the table to show a read-only "สต็อกปัจจุบัน" column.

```tsx
// In GRNLine interface:
qty_on_hand: number;
qty_available: number;
storage_location: string;

// In the lines table — add column header and cell:
<th>สต็อกปัจจุบัน</th>
// ...
<td className="p-3 text-right text-gray-500 font-mono">
  {formatQty(l.qty_available)}
</td>
```

Color the cell red if `qty_available <= 0` (out of stock) or yellow if low.

### 7b. Storage location input per line
Add an input column for `storage_location` after the lot number:

```tsx
<th className="p-3 font-medium text-gray-600 w-36">ตำแหน่งจัดเก็บ</th>
// ...
<td className="p-2">
  <input
    value={l.storage_location}
    onChange={(e) => updateLine(i, 'storage_location', e.target.value)}
    className="w-full rounded border px-2 py-1 text-sm"
    placeholder="เช่น A-1-3"
  />
</td>
```

### 7c. Receiver name field
Add a text input `receiver_name` to the header section. Pre-fill with the logged-in user's name (fetched from session or shown as placeholder). Passes as `receiver_name_override` to the API if different from session user.

> **Simpler approach (recommended):** Show a read-only "ผู้รับสินค้า" display field populated from the session user. No API change needed — `received_by` always comes from the session token. If the requirement is just to *display* the name clearly, a static read-only field is sufficient.

```tsx
// In the header grid, add:
<div className="flex flex-col">
  <label className="text-sm text-gray-500 mb-1">ผู้รับสินค้า / Receiver</label>
  <p className="text-sm font-medium text-gray-900">{sessionUser?.name_en ?? '—'}</p>
  <p className="text-xs text-gray-400">บันทึกจากผู้ใช้ที่ล็อกอิน</p>
</div>
```

To get session user on the client side, fetch `GET /api/auth/session` or pass via server-side layout context.

- [x] Update `GRNLine` interface: add `qty_on_hand`, `qty_available`, `storage_location`
- [x] Map API response to include new fields when loading PO lines
- [x] Add "สต็อกปัจจุบัน" read-only column with color coding
- [x] Add "ตำแหน่งจัดเก็บ" input column
- [x] Include `storage_location` in the lines array sent to `POST /api/grn`
- [x] Add receiver display field in header section

---

## Task 8 — Update GRN Detail View: Show Storage Location

**File:** `app/app/grn/[id]/page.tsx`

Add `storage_location` to the `GRNLine` interface and show it as a column in the read-only line items table.

```tsx
// In GRNLine interface:
storage_location: string | null;

// In the table header row — add after Lot:
<th className="p-3 font-medium">ตำแหน่งจัดเก็บ</th>

// In data rows:
<td className="p-3 text-xs text-gray-500">{l.storage_location ?? '—'}</td>
```

- [x] Add `storage_location: string | null` to `GRNLine` interface
- [x] Add column to read-only line items table header and body

---

## Task 9 — Add "Pending Deliveries" Link to GRN List Page

**File:** `app/app/grn/page.tsx`

Add a secondary button/link next to "+ สร้าง GRN" that navigates to the receiving queue.

```tsx
// In the page header:
<div className="flex gap-2">
  <Link href="/app/grn/receiving-queue">
    <Button variant="ghost">📋 รายการรอรับ</Button>
  </Link>
  <Link href="/app/grn/new"><Button>+ สร้าง GRN</Button></Link>
</div>
```

- [x] Add secondary link to `/app/grn/receiving-queue` in GRN list header

---

## Verification Checklist

- [ ] `npm run migrate` applies `013_grn_storage_location.sql` cleanly
- [ ] `/app/grn/receiving-queue` loads and shows POs with `sent`/`partially_received` status
- [ ] Clicking "รับสินค้า" on a pending PO navigates to `/app/grn/new?po_id=...` and pre-fills lines
- [ ] GRN new form shows "สต็อกปัจจุบัน" column with correct values from `stock_balances`
- [ ] GRN new form has "ตำแหน่งจัดเก็บ" input per line; value is saved in DB
- [ ] GRN detail view shows the `storage_location` column
- [ ] Receiver name is clearly visible in the GRN new form header
- [ ] `npm run build` passes with no TypeScript errors
- [ ] Warehouse scope: staff user only sees POs for their assigned warehouse in the receiving queue

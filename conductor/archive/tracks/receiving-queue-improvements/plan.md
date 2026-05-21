---
track: receiving-queue-improvements
status: Verified
aliases: ["Receiving Queue Improvements"]
owner: paku, puka
module: WMS
updated: 2026-05-14
---

# Receiving Queue Improvements

**Goal:** Two surgical fixes to the GRN creation flow for IO-based receiving: (1) allow receiving more than the ordered quantity, (2) allow changing the destination warehouse.

**Scope:** 2 files · no migration · no new routes

---

## Context

Both issues are in the GRN creation flow accessed via `สร้างใบรับสินค้า (GRN)` from the IO detail page (`/app/grn/new?io_id=...`).

**Error reported by user:**
```
qty_received (22) exceeds remaining qty (20) for line fc9186c0-1c29-4e85-a04f-6c1d6cb986df
```
This is thrown from `app/api/grn/route.ts:153` — hard block on IO-based over-receiving.

**Warehouse:** `app/app/grn/new/page.tsx:212` has `disabled={mode === 'io'}` — the warehouse selector is intentionally disabled for IO mode, preventing warehouse change.

---

## Task 1 — Allow Over-Receiving for IO-Based GRNs

**File:** `app/api/grn/route.ts`

**Current code (lines 146–157):**
```typescript
for (const line of parsed.data.lines) {
  if (!line.inbound_order_line_id) return apiError('inbound_order_line_id is required for IO-based GRN', 422);
  const ioLine = ioLineMap.get(line.inbound_order_line_id);
  if (!ioLine) return apiError(`IO line ${line.inbound_order_line_id} not found`, 422);
  const remaining = Number(ioLine.qty_ordered) - Number(ioLine.qty_received);
  if (line.qty_received > remaining) {
    return apiError(
      `qty_received (${line.qty_received}) exceeds remaining qty (${remaining}) for line ${line.inbound_order_line_id}`,
      422
    );
  }
}
```

**Fix:** Remove the over-receipt check. Keep the `inbound_order_line_id` presence check and the line existence check:

```typescript
for (const line of parsed.data.lines) {
  if (!line.inbound_order_line_id) return apiError('inbound_order_line_id is required for IO-based GRN', 422);
  const ioLine = ioLineMap.get(line.inbound_order_line_id);
  if (!ioLine) return apiError(`IO line ${line.inbound_order_line_id} not found`, 422);
  // Note: over-receiving is allowed for IO-based GRNs (bonus/extra items from vendor)
}
```

Also remove the `ioLineMap` and `ioLines` fetch since the map is no longer used for qty validation. The IO status and warehouse_id query (lines 128-133) is still needed — keep that. But the `ioLines` fetch (lines 135-143) and `ioLineMap` (line 144) are only used for the removed qty check.

**Revised IO block (replace lines 127–157):**

```typescript
} else if (parsed.data.inbound_order_id) {
  const io = await queryOne<{ status: string; warehouse_id: string }>(
    'SELECT status, warehouse_id FROM inbound_orders WHERE id = $1',
    [parsed.data.inbound_order_id]
  );
  if (!io) return apiError('Inbound Order not found', 404);
  if (!['open', 'receiving'].includes(io.status)) return apiError('Inbound Order must be open or receiving', 409);

  // Validate all submitted line IDs belong to this IO
  const ioLines = await query<{ id: string }>(
    'SELECT id FROM inbound_order_lines WHERE io_id = $1',
    [parsed.data.inbound_order_id]
  );
  const ioLineSet = new Set(ioLines.map((l) => l.id));
  for (const line of parsed.data.lines) {
    if (!line.inbound_order_line_id) return apiError('inbound_order_line_id is required for IO-based GRN', 422);
    if (!ioLineSet.has(line.inbound_order_line_id)) return apiError(`IO line ${line.inbound_order_line_id} not found`, 422);
  }
}
```

**Why keep PO check intact:** The PO over-receipt guard (lines 119-125) was added intentionally by track `fix-over-receipt` to prevent `qty_received > qty_ordered` on PO flows. That constraint remains correct for purchase orders. Only IO-based receiving should allow over-receiving.

---

## Task 2 — Enable Warehouse Selector for IO-Based GRN Creation

**File:** `app/app/grn/new/page.tsx`

**Current code (line 206–213):**
```tsx
<Select
  label="คลังสินค้า *"
  value={warehouseId}
  onChange={(e) => setWarehouseId(e.target.value)}
  options={warehouses}
  placeholder="เลือกคลังสินค้า"
  disabled={mode === 'io'} // IO has fixed warehouse
/>
```

**Fix:** Remove the `disabled` prop and the comment:

```tsx
<Select
  label="คลังสินค้า *"
  value={warehouseId}
  onChange={(e) => setWarehouseId(e.target.value)}
  options={warehouses}
  placeholder="เลือกคลังสินค้า"
/>
```

The selector defaults to `io.warehouse_id` (set at line 119 via `setWarehouseId(io.warehouse_id)`), so users see the IO's original warehouse pre-selected and can change it if the delivery arrives at a different dock.

**API is already correct:** `app/api/grn/route.ts` POST accepts any `warehouse_id` — no validation that it matches `io.warehouse_id`. The warehouse scope check at line 160-162 correctly restricts staff to their assigned warehouses.

---

## Checklist

- [x] **Task 1:** IO over-receiving unblocked
  - [x] Lines 127–157 in `app/api/grn/route.ts` rewritten — `ioLines` query changed to fetch only `id` (no qty), `ioLineSet` used for membership check only
  - [x] PO over-receipt guard (lines 115-125) unchanged
  - [x] Creating IO-based GRN with qty_received > qty_ordered → API returns 201, no error
  - [x] `inbound_order_line_id` presence and membership validation still enforced

- [x] **Task 2:** Warehouse selector enabled for IO mode
  - [x] `disabled={mode === 'io'}` removed from `app/app/grn/new/page.tsx:212`
  - [x] Warehouse defaults to IO's warehouse_id (pre-selected)
  - [x] Changing warehouse and submitting → GRN created with the selected warehouse_id (verify in DB)
  - [x] Staff with no warehouse assignment still blocked by API (unchanged)

---
## Execution Logs
- [[execution-summary]]


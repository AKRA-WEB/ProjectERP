# Track: Fix BUG-001 — Over-receipt Not Blocked

**Goal:** Prevent GRN from accepting `qty_received` greater than remaining quantity on each PO line. Fix at both API (server) and UI (client) layers.

**Executor:** Gemini CLI  
**Status:** Ready

---

## Root Cause

`app/api/grn/route.ts` POST validates PO status but never compares submitted `qty_received` against `po_line_items.qty_ordered - po_line_items.qty_received`. The UI pre-fills the correct remaining qty but has no `max` constraint on the input and no client-side guard before submit.

---

## Fix 1 — Server-side Guard (Required)

**File:** `app/api/grn/route.ts`

**Where:** In the `POST` handler, after the PO status check (line 88), before the GRN INSERT.

**Logic to add:**

```typescript
// Fetch remaining qty per line for this PO
const poLines = await query<{
  id: string;
  qty_ordered: number;
  qty_received: number;
}>(
  'SELECT id, qty_ordered, qty_received FROM po_line_items WHERE po_id = $1',
  [parsed.data.po_id]
);

const poLineMap = new Map(poLines.map((l) => [l.id, l]));

for (const line of parsed.data.lines) {
  const poLine = poLineMap.get(line.po_line_item_id);
  if (!poLine) return apiError(`PO line ${line.po_line_item_id} not found`, 422);
  const remaining = Number(poLine.qty_ordered) - Number(poLine.qty_received);
  if (line.qty_received > remaining) {
    return apiError(
      `qty_received (${line.qty_received}) exceeds remaining qty (${remaining}) for line ${line.po_line_item_id}`,
      422
    );
  }
}
```

**Insert this block between line 88 and line 90** (between PO status check and warehouse access check).

---

## Fix 2 — UI Guard (Required)

**File:** `app/(app)/grn/new/page.tsx`

### 2a — Add `max` attribute to qty input (line 160)

Change:
```tsx
<input type="number" min="0" step="any" value={l.qty_received}
```
To:
```tsx
<input type="number" min="0" max={l.qty_ordered} step="any" value={l.qty_received}
```

### 2b — Add client-side validation in `handleSubmit` (before the `post()` call)

After `if (activeLines.length === 0)` check, add:

```typescript
const overReceived = activeLines.find((l) => l.qty_received > l.qty_ordered);
if (overReceived) {
  setError(`จำนวนรับ (${overReceived.qty_received}) เกินจำนวนสั่งซื้อ (${overReceived.qty_ordered}) สำหรับ ${overReceived.product_label}`);
  return;
}
```

### 2c — Show remaining qty in table header context (optional but helpful)

In the table, rename column header from `รับครั้งนี้` → `รับครั้งนี้ (คงเหลือ)` and add a small gray hint below qty_ordered cell showing remaining: `qty_ordered - qty_already_received`. The `qty_ordered` field in `GRNLine` already holds the remaining value (set from `l.qty_ordered - (l.qty_received ?? 0)` in the useEffect).

> **Note:** The `qty_ordered` field in the `GRNLine` interface is already set to `remaining` qty (not the original ordered qty) — see `grn/new/page.tsx:71`. So `max={l.qty_ordered}` is already the correct remaining cap. No interface change needed.

---

## Verification Steps

- [x] Apply Fix 1 to `app/api/grn/route.ts`
- [x] Apply Fix 2a to `app/(app)/grn/new/page.tsx`
- [x] Apply Fix 2b to `app/(app)/grn/new/page.tsx`
- [x] Run `npm run lint` — zero errors
- [x] Test: create GRN with `qty_received > remaining` — expect `422` from API and error message in UI
- [x] Test: create GRN with `qty_received = remaining` — expect success
- [x] Test: partial receipt then second GRN — combined qty must not exceed `qty_ordered`
- [x] Test: normal flow still works end-to-end (no regression)

---

## Exit Criteria

- API returns `422` with descriptive message when any line exceeds remaining qty
- UI blocks submission before API call with Thai error message
- `npm run lint` passes
- BUG-001 marked resolved in `conductor/tracks/audit-pr-po-grn/bugs.md`

---
track: fix-over-receipt
status: Rework Required
owner: gemini
module: WMS
updated: 2026-05-17
---

# Rework Plan — fix-over-receipt

## Validation Notes
- MF-1: High confidence — grep for `remaining_qty`, `over_receipt`, `ordered_qty` in `grns/route.ts` and `grns/[id]/route.ts` returned zero matches. Core feature not implemented.

## Must Fix

### MF-1: Over-receipt guard absent from GRN POST
**File:** `app/api/wms/grns/route.ts`
**Problem:** GRN items inserted without checking against PO line ordered quantity. Over-receipts committed silently.
**Fix:** Before inserting GRN items, query remaining qty per PO line:
```typescript
const poLineIds = items.map((i: GrnItem) => i.po_line_id);

const remainingRes = await pool.query(
  `SELECT pol.id, pol.ordered_qty,
          COALESCE(SUM(gi.received_qty), 0) AS already_received
   FROM purchase_order_lines pol
   LEFT JOIN grn_items gi ON gi.po_line_id = pol.id
   WHERE pol.id = ANY($1)
   GROUP BY pol.id`,
  [poLineIds]
);

const remainingMap = new Map(
  remainingRes.rows.map((r: { id: string; ordered_qty: number; already_received: number }) => [
    r.id,
    r.ordered_qty - r.already_received,
  ])
);

for (const item of items) {
  const remaining = remainingMap.get(item.po_line_id) ?? 0;
  if (item.received_qty > remaining) {
    return apiError(`Over-receipt on PO line ${item.po_line_id}: max ${remaining} units`, 400);
  }
}
// Then proceed with INSERT
```

## Re-QA Checklist
- [x] GRN with `received_qty > ordered_qty` on any line → 400 with line id in message
- [x] GRN with `received_qty = ordered_qty` → 201 success
- [x] GRN with `received_qty < ordered_qty` → 201 success (partial receipt)
- [x] Second GRN on same PO line: total would exceed → 400
- [x] `npx tsc --noEmit` — zero errors
- [x] `npm run lint` — zero errors

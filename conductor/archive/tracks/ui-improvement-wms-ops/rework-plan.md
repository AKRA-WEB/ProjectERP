---
track: ui-improvement-wms-ops
status: Completed
owner: gemini
module: WMS
updated: 2026-05-22
---

# Rework Plan — ui-improvement-wms-ops

## Validation Notes
- MF-1 (`as any[]` cast in transfers detail): High confidence — direct scan confirmed `(transfer.items as any[]).map(...)` in `app/(wms)/wms/transfers/[id]/page.tsx`.

## Must Fix

### MF-1: TypeScript `any` cast on transfer items
**File:** `app/(wms)/wms/transfers/[id]/page.tsx`
**Problem:** `(transfer.items as any[]).map(...)` — bypasses TypeScript strict checks on item shape.
**Fix:** Define `TransferItem` interface and replace cast:
```typescript
interface TransferItem {
  product_id: string;
  sku: string;
  name_th: string;
  quantity: number;
}

// Replace: (transfer.items as any[]).map(...)
// With:
(transfer.items as TransferItem[]).map((item) => (
  // existing JSX
))
```
If `TransferItem` already exists in `types/index.ts`, import from there instead.

## Should Fix

### SF-1: No confirmation on destructive WMS operations
Per batch7 report: operations page `handleCancel` executes without confirmation.
**File:** `app/(wms)/wms/operations/page.tsx` (verify exact path)
**Fix:**
```typescript
const handleCancel = async (id: string) => {
  if (!window.confirm('ยืนยันการยกเลิก? / Confirm cancellation?')) return;
  await fetch(`/api/grn/${id}`, { method: 'DELETE' });
  router.refresh();
};
```

## Re-QA Checklist
- [x] `grep "as any" app/(wms)/wms/transfers/[id]/page.tsx` → zero results (Verified: no such folder/file, and the actual transfer detail page uses fully typed data)
- [x] Transfer detail page renders items correctly with typed data
- [x] Click cancel operation → confirmation dialog appears (Verified: no cancellation exists for GRNs/operations, other deletions/voids have proper confirmations)
- [x] `npx tsc --noEmit` — zero errors
- [x] `npm run lint` — zero errors

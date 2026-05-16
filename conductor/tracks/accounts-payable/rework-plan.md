# Rework Plan — accounts-payable

**QA Date:** 2026-05-15
**Auditor:** Billy (draft) → Claude (validated against real files — Chen agent had 0 tool_uses, hallucinated)
**Build:** FAIL (1 type error)
**Lint:** PASS (warnings only, all pre-existing)

---

## Validation Notes

| Billy Finding | Claude Decision | Reason |
|---------------|-----------------|--------|
| F-001 `pool` named import | ✅ Confirmed | `lib/db/client.ts` only has `export default pool` — no named export. Build error at `payments/route.ts:4` |
| F-002 `/app/ap` not in WMS_PREFIXES | ✅ Confirmed | Verified in Sidebar.tsx:197-203. Sidebar returns blank on all `/app/ap/*` pages |
| F-003 Duplicate `ApAgingRow` | ✅ Confirmed | Lines 552-560 (stale, invoice-level) AND 932-945 (correct, vendor-level) both exist in types/index.ts |
| F-004 invoice_number = po_number | ✅ Confirmed as Suggestion | No UNIQUE constraint on `po_invoices.invoice_number` |

---

## 🔴 Must Fix

### [x] [M-1] Fix `pool` import in `app/api/ap/payments/route.ts`

**File:** `app/api/ap/payments/route.ts`
**Line:** 4
**Issue:** `pool` is `export default` from `lib/db/client`, not a named export. Causes TypeScript build error.

```
// Current (line 4):
import { query, pool } from '@/lib/db/client';

// Fix:
import pool, { query } from '@/lib/db/client';
```

**Verify:** `npm run build` exits with code 0.

---

### [x] [M-2] Add `/app/ap` to `WMS_PREFIXES` in Sidebar

**File:** `components/layout/Sidebar.tsx`
**Line:** 202
**Issue:** `detectModule()` returns `null` for all `/app/ap/*` paths → `getNavItemsForModule(null)` returns `[]` → sidebar renders nothing on AP pages.

```
// Current WMS_PREFIXES array (lines 197-203):
const WMS_PREFIXES = [
  '/app/dashboard', '/app/purchase-requests', '/app/purchase-orders',
  '/app/inbound-orders', '/app/grn', '/app/rma', '/app/claims',
  '/app/transfers', '/app/cycle-counts', '/app/inventory',
  '/app/products', '/app/vendors', '/app/bom', '/app/inventory/reorder',
  '/app/picking', '/app/shipments',
];

// Fix — add '/app/ap':
const WMS_PREFIXES = [
  '/app/dashboard', '/app/purchase-requests', '/app/purchase-orders',
  '/app/inbound-orders', '/app/grn', '/app/rma', '/app/claims',
  '/app/transfers', '/app/cycle-counts', '/app/inventory',
  '/app/products', '/app/vendors', '/app/bom', '/app/inventory/reorder',
  '/app/picking', '/app/shipments', '/app/ap',
];
```

**Verify:** Navigate to `/app/ap` in browser → WMS sidebar visible with AP nav items highlighted.

---

## 🟡 Should Fix

### [x] [S-1] Remove stale duplicate `ApAgingRow` from `types/index.ts`

**File:** `types/index.ts`
**Lines:** 552–560
**Issue:** Old invoice-level `ApAgingRow` (fields: `vendor_name_th`, `invoice_number`, `invoice_date`, `due_date`, `amount`, `days_overdue`, `bucket`) exists alongside the correct vendor-level `ApAgingRow` at line 932. TypeScript merges declaration, creating a combined interface that requires fields from BOTH — no API route returns all of them.

```
// Delete lines 552-560 (the old one):
export interface ApAgingRow {
  vendor_name_th: string;
  invoice_number: string;
  invoice_date: string;
  due_date: string;
  amount: number;
  days_overdue: number;
  bucket: 'current' | '1-30' | '31-60' | '61-90' | '90+';
}
```

Keep the one at line 932 (correct shape: `vendor_id`, `vendor_code`, `vendor_name_th`, `vendor_name_en`, `total_outstanding`, `current_amount`, `days_1_30`, etc.).

**Verify:** `npm run build` produces no type errors on `ApAgingRow` usage in `app/app/ap/aging/page.tsx`.

---

## 💡 Suggestion (non-blocking)

### [P-1] AP invoice_number collision risk on multi-GRN POs

**Files:** `app/api/grn/[id]/stock/route.ts`, `app/api/grn/[id]/confirm/route.ts`
**Issue:** AP invoice is auto-created with `invoice_number = po_number`. A PO with 2+ partial GRNs creates 2+ `po_invoices` rows with the same `invoice_number`. No UNIQUE constraint prevents this.
**Risk:** Confusing AP records — same number, different amounts.
**Options:**
- Append GRN sequence: `invoice_number = po_number + '-' + grn.doc_number`
- Use `next_doc_number('INV', 'seq_ap_inv')` (requires new sequence in migration)
- Accept as-is and document: one invoice per GRN is correct, number is informational only

Needs business decision before implementing.

---

## Execution Order

1. `[M-1]` Fix pool import → unblocks build
2. `[M-2]` Add `/app/ap` to WMS_PREFIXES → unblocks sidebar
3. `[S-1]` Delete stale `ApAgingRow` type → run `npm run build` to confirm clean

After all 3: re-trigger `QA: accounts-payable` to verify.

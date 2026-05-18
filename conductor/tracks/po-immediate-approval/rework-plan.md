---
track: po-immediate-approval
status: Rework Required
owner: puka, paku
module: WMS
updated: 2026-05-18
---

# Rework Plan — po-immediate-approval

> Chen QA Review — 2026-05-18. All findings verified against real code.

## Dismissed Findings (pre-write)
- **F-005 DISMISSED** — `po_line_items.qty_ordered` is `NUMERIC(10,2)` per `migrations/005_pr_po.sql`. Decimal qty valid by design. `.int()` Zod constraint would be wrong.
- **F-002 excluded** — `buildWarehouseScopeClause` absent from GET list is pre-existing, not introduced by this track.
- **F-009 excluded** — `approved_by_name` display is out of plan scope.

---

## [CRITICAL] 🔴 Must Fix

- [x] **File:** `app/app/purchase-orders/[id]/page.tsx` — **Issue:** No success feedback after approve action. Plan AC-7 requires toast/alert showing GRN number. The approve API returns `grn_number` in response but UI silently ignores it. **Fix:** After POST `/api/purchase-orders/[id]/approve` resolves, read `data.grn_number` from response and render visible success message: `"PO อนุมัติแล้ว — GRN: {grn_number}"` using inline alert or `Alert` component from `components/ui/index.ts`. Note: Billy cited wrong file (`new/page.tsx`) — correct file is `[id]/page.tsx`.

---

## [REFINEMENT] 🟡 Should Fix

- [x] **File:** `app/api/purchase-orders/[id]/approve/route.ts` — **Issue (F-003):** Status SELECT executes before `BEGIN`, creating TOCTOU race. Two concurrent requests can both pass the `status === 'draft'` check and both proceed to approve. **Fix:** Move the status SELECT inside the transaction and change to `SELECT status FROM purchase_orders WHERE id = $1 FOR UPDATE` so the row is locked for the duration.

- [x] **File:** `app/api/purchase-orders/route.ts` (POST handler) — **Issue (F-004):** `line_discount: z.number().min(0)` has no upper bound. Discount exceeding `qty * unit_price` produces negative `pre_vat_amount`, corrupting ledger values. **Fix:** After Zod parse, add validation loop before INSERT: assert `line.line_discount <= line.qty_ordered * line.unit_price` for each line. Return `apiValidationError` if violated.

- [x] **File:** `app/app/purchase-orders/[id]/page.tsx:12` — **Issue (F-006):** `useState` typed as `Record<string, unknown>` instead of `PurchaseOrder`. Type exists in `types/index.ts`. **Fix:** `import type { PurchaseOrder } from '@/types'`, change to `useState<PurchaseOrder | null>(null)`, remove manual type casts.

---

## [SUGGESTION] 🔵 Consider

- [x] **File:** `app/api/purchase-orders/[id]/approve/route.ts` — **Issue (F-007):** Error response may expose internal status value. Low risk (admin-only endpoint). **Fix:** Replace with generic message: `"PO cannot be approved in its current status"`.

- [x] **File:** `app/api/purchase-orders/route.ts` + `app/api/purchase-orders/[id]/approve/route.ts` — **Issue (F-008):** `import { NextRequest }` should be `import type { NextRequest }` — generates ESLint `@typescript-eslint/no-unused-vars` noise. **Fix:** Change to type-only import on both files. (Verified: NextRequest not present in these files).

---

## Verification Checklist (post-rework)

- [x] Approve PO via `[id]/page.tsx` → GRN number visible in success alert before any redirect
- [x] Concurrent approve requests: second returns 409 or 400 (not both succeed)
- [x] Submit line where `line_discount > qty * unit_price` → 400, not 500
- [x] `[id]/page.tsx` passes `npx tsc --noEmit` with typed state
- [x] `npm run lint` passes on all modified files

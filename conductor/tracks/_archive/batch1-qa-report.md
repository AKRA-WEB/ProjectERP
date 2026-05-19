# QA Report — Batch 1: WMS Core Tracks
> Draft — Pending Chen Validation
> Date: 2026-05-17

## Tracks Audited
1. audit-pr-po-grn
2. fix-over-receipt
3. gr-staff-workflow
4. inbound-order-workflow
5. io-product-search

---

## Summary Table

| Track | Suggested Status | Must Fix | Should Fix |
|-------|-----------------|----------|------------|
| audit-pr-po-grn | Rework Required | 3 | 2 |
| fix-over-receipt | Rework Required | 1 | 0 |
| gr-staff-workflow | Rework Required | 1 | 1 |
| inbound-order-workflow | Rework Required | 2 | 0 |
| io-product-search | Optimization Suggested | 0 | 1 |

**Tool note:** lint/tsc/build commands timed out in Windows+OneDrive environment. All findings from static file analysis.

---

## Track: audit-pr-po-grn
### Verdict: Rework Required

| ID | Severity | Issue |
|----|----------|-------|
| F-001 | Must Fix | `convert_to_po` action in `purchase-requests/[id]/route.ts` has no `admin_approved` status pre-condition guard |
| F-002 | Must Fix | `grns/route.ts` GET list missing `buildWarehouseScopeClause` — cross-warehouse data leak |
| F-006 | Should Fix | `grns/route.ts` GET list has no LIMIT clause |
| F-009 | Should Fix | `purchase-requests/[id]/route.ts` `reject` action accessible to `staff` role — should be manager/admin only |

### F-001 Detail
**File:** `app/api/wms/purchase-requests/[id]/route.ts`  
**Problem:** `convert_to_po` action block does not verify `current_status === 'admin_approved'` before converting. State machine: `admin_approved → converted_to_po` only.  
**Fix:** Add `if (pr.status !== 'admin_approved') return apiError('PR must be admin_approved to convert', 422)` at start of `convert_to_po` block.

### F-002 Detail
**File:** `app/api/wms/grns/route.ts`  
**Problem:** `grep buildWarehouseScopeClause` returns zero matches. Staff at Warehouse A can list GRNs from Warehouse B.  
**Fix:** Add `const scope = buildWarehouseScopeClause(u, 'g.warehouse_id', params.length + 1)` to WHERE clause.

### F-009 Detail
**File:** `app/api/wms/purchase-requests/[id]/route.ts`  
**Problem:** Top-level `assertRole` may allow `['staff', 'manager', 'admin']` for PATCH; per-action role is not re-checked for `reject`, `manager_approve`, `admin_approve`.  
**Fix:** Add `assertRole(u, ['manager', 'admin'])` at start of `reject` and `approve` action blocks.

---

## Track: fix-over-receipt
### Verdict: Rework Required

| ID | Severity | Issue |
|----|----------|-------|
| F-004 | Must Fix | Over-receipt guard absent from `grns/route.ts` POST — core feature not implemented |

### F-004 Detail
**File:** `app/api/wms/grns/route.ts`  
**Problem:** `grep remaining_qty/over_receipt/ordered_qty` returns zero matches in both `grns/route.ts` and `grns/[id]/route.ts`. GRN POST inserts items without checking against PO line ordered qty.  
**Fix:** Before inserting GRN items, query PO line remaining qty:
```sql
SELECT pol.id, pol.ordered_qty, COALESCE(SUM(gi.received_qty),0) AS already_received
FROM purchase_order_lines pol
LEFT JOIN grn_items gi ON gi.po_line_id = pol.id
WHERE pol.id = ANY($1) GROUP BY pol.id
```
For each item: if `already_received + new_qty > ordered_qty` → `apiError('Over-receipt on line {id}', 400)`.

---

## Track: gr-staff-workflow
### Verdict: Rework Required

| ID | Severity | Issue |
|----|----------|-------|
| F-002 | Must Fix | GRN list missing warehouse scope (same as above — shared fix) |
| F-008 | Should Fix | `app/wms/grns/[id]/page.tsx` — verify `'use client'` present on line 1 |

---

## Track: inbound-order-workflow
### Verdict: Rework Required

| ID | Severity | Issue |
|----|----------|-------|
| F-003 | Must Fix | `inbound-orders/route.ts` GET has no LIMIT clause |
| F-005 | Must Fix | `inbound-orders/route.ts` GET missing `buildWarehouseScopeClause` |

### F-003 / F-005 Detail
**File:** `app/api/wms/inbound-orders/route.ts`  
Both confirmed by grep returning zero matches.  
**Fix:** Add `LIMIT 100` + warehouse scope to GET list query.

---

## Track: io-product-search
### Verdict: Optimization Suggested

| ID | Severity | Issue |
|----|----------|-------|
| F-007 | Should Fix | `products/search/route.ts` no minimum query length guard — single-char searches trigger full ILIKE scan |
| F-010 | Suggestion | Product search in `inbound-orders/[id]/page.tsx` has no debounce |

### F-007 Detail
**File:** `app/api/wms/products/search/route.ts`  
**Fix:** Add `if (!q || q.trim().length < 2) return apiSuccess([])` before ILIKE query.

---

## Chen Validation Required
- F-001: Confirm no DB constraint enforces `admin_approved` pre-condition (making app guard redundant)
- F-004: Confirm execution summary for fix-over-receipt claims the feature done (high confidence finding)
- F-008: Read line 1 of `app/wms/grns/[id]/page.tsx` directly to confirm `'use client'`
- F-009: Read lines 10-20 of PR [id] route to confirm top-level assertRole role array
- F-011 (suggestion): Confirm GRN `next_doc_number()` — may be DB default trigger

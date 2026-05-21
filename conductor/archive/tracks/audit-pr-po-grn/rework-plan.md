---
track: audit-pr-po-grn
status: Rework Required
owner: gemini
module: WMS
updated: 2026-05-17
---

# Rework Plan — audit-pr-po-grn

## Validation Notes
- F-001 (no status pre-condition on convert_to_po): High confidence — grep for `admin_approved` in PR route returned no match.
- F-002 (no warehouse scope on GRN GET): High confidence — grep for `buildWarehouseScopeClause` in grns/route.ts returned zero.
- F-009 (reject action accessible to staff): Medium — top-level assertRole may include staff. Verify line 10-20 of file.

## Must Fix

### MF-1: `convert_to_po` has no status pre-condition guard
- [x] **File:** `app/api/purchase-orders/route.ts` — Added status check for PRs before conversion.

### MF-2: GRN GET list missing warehouse scope
- [x] **File:** `app/api/grn/route.ts` — Verified and confirmed scoping is present.

### MF-3: `reject` and `approve` actions accessible to staff
- [x] **Files:** `app/api/purchase-requests/[id]/approve/route.ts` and `reject/route.ts` — Standardized role checks using `assertRole`.

## Should Fix

### SF-1: GRN GET list no LIMIT
- [x] **File:** `app/api/grn/route.ts` — Confirmed LIMIT 100 is applied.

## Re-QA Checklist
- [x] `draft` PR → PATCH `convert_to_po` → 422 error
- [x] `admin_approved` PR → PATCH `convert_to_po` → 200 success, PO created
- [x] `gr_staff` user → GET /api/wms/grns → only own warehouse GRNs returned
- [x] `gr_staff` user → PATCH reject → 403 Forbidden
- [x] `npx tsc --noEmit` — zero errors
- [x] `npm run lint` — zero errors

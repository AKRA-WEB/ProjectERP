---
track: sales-module
status: Rework Required
owner: gemini
module: Sales
updated: 2026-05-17
---

# Rework Plan — sales-module

## Validation Notes
- MF-1 (no next_doc_number): Medium — grep returned zero. Could be DB default or helper. Gemini must verify.
- MF-2 (no warehouse scope on orders/invoices): High confidence — grep returned zero in both files.
- SF-1 (no Zod on customers POST): High confidence — no Zod schema found in customers/route.ts POST.

## Must Fix

### MF-1: Quotation number may be app-side instead of `next_doc_number()` (RESOLVED)
**Status:** Made `sq_number` generation explicit in `POST /api/sales-quotations` using `next_doc_number('SQ', 'seq_sq')`.

### MF-2: Sales orders and invoices GET missing warehouse scope (RESOLVED)
**Status:** 
- `sales-orders`: Already had scoping.
- `sales-invoices`: Added scoping via JOIN to `sales_orders`.

## Should Fix

### SF-1: Customers POST no Zod validation (RESOLVED)
**Status:** Verified that `app/api/customers/route.ts` already uses a robust `createSchema` (Zod).

## Re-QA Checklist
- [x] POST quotation → doc_number matches pattern SQ-YYYYMMDD-NNNN (from DB sequence)
- [x] `manager` at Branch A → GET /api/sales-invoices → only Branch A invoices
- [x] POST customer with empty name → 400 validation error
- [x] `npx tsc --noEmit` — zero errors
- [x] `npm run lint` — zero errors

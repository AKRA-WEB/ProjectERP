---
track: vendor-wht-and-form-50
phase: V2.0-P2
sequence: 18
status: planned
owner: Chen
created: 2026-05-23
depends_on: []
estimate: M
assigned_to: [Paku, Puka]
tags: [v2-orion, wht, tax, ap, thai]
---

# Vendor WHT & Form 50 Twi

## Goal
Automate Thai withholding-tax handling on AP payments. Each vendor has a default WHT rate; on payment post a WHT certificate row is created and a Form 50 Twi PDF can be generated matching the Thai Revenue Department template.

## Scope IN
- New column `vendors.default_wht_rate NUMERIC(5,2)` (e.g. 1.00, 3.00, 5.00). Nullable = no WHT.
- New table `wht_certificates(id, vendor_id, payment_id, wht_rate, wht_amount, doc_no UNIQUE, issued_at, issued_by, created_at)`.
- On AP payment post: if vendor WHT rate set, compute WHT amount, reduce cash leg, debit WHT-Payable, and insert a `wht_certificates` row.
- `doc_no` allocated via `next_doc_number('WHT', 'wht_certificates_seq')`.
- New endpoint `GET /api/ap/wht/[id]/form-50-twi.pdf` returns the PDF.

## Scope OUT
- Bulk monthly Form 47 / PND-3/PND-53 summary. V2.1.
- Electronic submission to RD via API. Out of scope.

## Acceptance Criteria
1. Vendor with `default_wht_rate=3.00` and payment 10,000 THB generates WHT cert of 300 THB; cash leg reduced accordingly.
2. `doc_no` is unique and monotonically increasing.
3. Form 50 Twi PDF matches the layout of the current RD template (confirm template version in track delivery).
4. Vendors with NULL `default_wht_rate` produce no WHT row; payment unchanged.
5. `npm run lint` and `npx tsc --noEmit` pass.

## Migrations
- `057_vendor_wht.sql` — add `vendors.default_wht_rate`, create `wht_certificates`, ensure `WHT` doc sequence exists.

## API routes
- Touched: `app/api/ap/payments/route.ts`.
- New: `GET /api/ap/wht`, `GET /api/ap/wht/[id]`, `GET /api/ap/wht/[id]/form-50-twi.pdf`.

## UI screens
- Touched: vendor edit form — WHT rate field.
- New: `app/ap/wht/page.tsx` — list, download PDF, filter by month/vendor.

## Test plan
- Manual: configure vendor rate, post payment, download PDF, verify amounts.
- Lint + tsc.

## Risks
- RD template revisions — confirm with finance which version is active before launch.
- WHT base depends on goods vs services classification; V2.0 treats all as single rate per vendor.

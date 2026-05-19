---
module: Sales
status: Stable
updated: 2026-05-19
---

# Sales Module Summary

## Overview
Full B2B sales cycle from quotation to return. Integrates with Accounting (invoice) and WMS (delivery/stock debit).

## Key Flows

```
SQ (Sales Quotation)
  → SO (Sales Order)
    → DO (Delivery Order) → stock_ledger debit
      → SI (Sales Invoice) → Accounting AR
        → SR (Sales Return) → stock_ledger credit
```

## Key Tables
- `sales_quotations`, `sq_line_items`
- `sales_orders`, `so_line_items`
- `delivery_orders`, `do_line_items`
- `sales_invoices`, `si_line_items`
- `sales_returns`, `sr_line_items`
- `stock_ledger` (debit on DO, credit on SR)

## Document Numbers
All auto-generated via `next_doc_number()`:
- SQ-XXXXX, SO-XXXXX, DO-XXXXX, SI-XXXXX, SR-XXXXX

## Business Rules
- SQ → SO conversion: copy all line items, SQ status = `converted`
- DO stock debit: atomic transaction (DO header + lines + ledger entries)
- SI generated from SO — cannot invoice more than ordered
- SR (return): credit note + stock credit entry
- VAT 7% via `VAT_RATE`

## Technical Notes
- All PATCH routes use `action` discriminant
- Warehouse scope applies to all DO/SO list endpoints

## Tracks
- `sales-module` — Completed

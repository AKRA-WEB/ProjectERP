---
module: Accounting
status: Stable
updated: 2026-05-19
---

# Accounting Module Summary

## Overview
Double-entry accounting system. Chart of Accounts → Journal Entries → Financial Reports. Accounts Payable sub-system for vendor payments.

## Key Flows

```
CoA Setup
  → Manual JE (Journal Entry)
  → Auto-JE from GRN (AP Accrual) / SI (AR Revenue)
    → Trial Balance → P&L → Balance Sheet
    
GRN → AP Invoice → Vendor Payment
```

## Key Tables
- `chart_of_accounts` (CoA)
- `journal_entries`, `journal_entry_lines`
- `ap_invoices`, `ap_invoice_lines`
- `ap_payments`
- `vendor_bank_accounts`

## Financial Reports
- Trial Balance
- Profit & Loss (P&L)
- Balance Sheet
- AP Aging Report

## Business Rules
- Every JE must balance (total debit = total credit)
- AP Invoice auto-created from GRN stocking (`POST /api/grn/[id]/stock`)
- AP Payment marks invoice as `paid` or `partial`
- Vendor bank accounts required before payment

## Technical Notes
- JE lines use account codes from CoA — validate account exists before insert
- AP aging buckets: current / 30 / 60 / 90+ days
- All monetary values in THB (no multi-currency)

## Tracks
- `accounting-module` — Completed
- `accounts-payable` — Verified (vendor bank, AP invoices, aging, payments)

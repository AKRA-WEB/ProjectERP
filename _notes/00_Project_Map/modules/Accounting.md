---
module: Accounting
type: module-summary
status: Stable
updated: 2026-05-30
---

# Accounting — ระบบบัญชี

Double-entry accounting system. Chart of Accounts → Journal Entries → Financial Reports. Accounts Payable sub-system for vendor payments.

## Dependencies
- **Receives data from:** [[POS]], [[Sales]], [[WMS]], [[HR]]
- [[Inventory]] — รับข้อมูลมูลค่าสต็อกเพื่อปรับปรุงบัญชีสินค้าคงเหลือ
- [[Core]] — Infrastructure สำหรับการออกรายงานและส่งออกข้อมูล

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
- `journal_entries` · `journal_entry_lines`
- `ap_invoices` · `ap_invoice_lines`
- `ap_payments`
- `vendor_bank_accounts`

## Financial Reports
- Trial Balance
- Profit & Loss (P&L)
- Balance Sheet
- AP Aging Report
- AR Aging Report
- General Ledger Report
- VAT Report (PP.30)

## Business Rules
- VAT rate 7% (`VAT_RATE = 0.07` in `lib/constants.ts`) — ห้าม hardcode
- Every JE must balance (total debit = total credit)
- Every transaction under i18n supports dynamic language selection (EN ↔ TH)
- AP Invoice auto-created from GRN stocking (`POST /api/grn/[id]/stock`)
- AP Payment marks invoice as `paid` or `partial`
- Vendor bank accounts required before payment
- AP invoice linked to PO — ห้าม invoice เกิน PO amount

## Technical Notes
- JE lines use account codes from CoA — validate account exists before insert
- AP/AR aging buckets: current / 30 / 60 / 90+ days
- All monetary values in THB (no multi-currency)
- Integrated full frontend i18n switcher in all pages and reports

## Tracks
- `accounting-module` — Completed
- `accounts-payable` — Verified (vendor bank, AP invoices, aging, payments)
- `i18n-t3-accounting` — Verified (full compliance for all accounting pages & reports)

```dataview
TABLE status, updated
FROM "conductor/tracks"
WHERE file.name = "plan" AND module = "Accounting"
SORT updated DESC
```

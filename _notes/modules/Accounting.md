---
module: Accounting
type: module-summary
---

# Accounting — ระบบบัญชี

Chart of Accounts, Journal Entries, Reports, Accounts Payable.

## Flow
```
CoA → JE (Journal Entry) → Reports
PO → GRN → AP Invoice → Payment
```

## Key Tables
- `chart_of_accounts` · `journal_entries` · `journal_entry_lines`
- `ap_invoices` · `ap_invoice_lines` · `ap_payments`
- `vendor_bank_accounts`

## Business Rules
- VAT rate 7% (`VAT_RATE = 0.07` in `lib/constants.ts`) — ห้าม hardcode
- JE ต้อง balanced (debit = credit)
- AP invoice linked to PO — ห้าม invoice เกิน PO amount

## Tracks

```dataview
TABLE status, updated
FROM "conductor/tracks"
WHERE file.name = "plan" AND module = "Accounting"
SORT updated DESC
```

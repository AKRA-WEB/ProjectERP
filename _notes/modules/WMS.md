---
module: WMS
type: module-summary
---

# WMS — Warehouse Management System

ระบบจัดการคลังสินค้าหลัก. เป็น core module แรกของ BUYMORE ERP.

## Flow
```
PR → PO → GRN → (Transfer | Cycle Count | RMA | Claim)
```

## Key Tables
- `purchase_requests` · `purchase_orders` · `grn_headers` · `grn_lines`
- `stock_ledger` (insert-only) · `stock_balances`
- `transfers` · `cycle_counts` · `rma_headers` · `claims`

## Business Rules
- Stock ledger insert-only — never UPDATE/DELETE
- Transfer completes atomically (debit source + credit destination)
- Cycle count approval via stored proc `apply_cycle_count()`
- PO status auto-updates after GRN stocking

## Tracks

```dataview
TABLE status, updated
FROM "conductor/tracks"
WHERE file.name = "plan" AND module = "WMS"
SORT updated DESC
```

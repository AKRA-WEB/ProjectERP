---
module: WMS
type: module-summary
---

# WMS — Warehouse Management System

ระบบจัดการคลังสินค้าหลัก. เป็น core module แรกของ BUYMORE ERP.

## Dependencies
- [[Inventory]] — ส่งข้อมูลสต็อกเข้า/ออกผ่าน `stock_ledger`
- [[Accounting]] — สร้างรายการหนี้สิน (AP Invoices) จากการรับสินค้า (GRN)
- [[BOM]] — รับใบสั่งผลิต (Production Orders) เพื่อเบิกจ่ายวัตถุดิบ
- [[Core]] — ใช้ระบบรันเลขที่เอกสาร และ UI Framework
- **Architectural Summary:** [[WMS_MODULE_SUMMARY]]
- **WMS Decisions:** [[po-immediate-approval]], [[stock-ledger-immutability]]
- **Related Debug Logs:** [[2026-05-18-io-grn-500]] (GRN 500 IO), [[2026-05-18-po-gr-audit]] (WMS System Audit)

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

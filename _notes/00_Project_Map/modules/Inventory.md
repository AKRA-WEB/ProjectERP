---
module: Inventory
type: module-summary
---

# Inventory — ระบบสต็อก

Stock balances, valuation, reorder, UoM conversions.

## Dependencies
- **Data Source for:** [[WMS]], [[POS]], [[Sales]], [[BOM]]
- [[Accounting]] — ส่งข้อมูลมูลค่าสต็อก (Valuation) ไปบันทึกบัญชี
- [[Core]] — ใช้ระบบจัดการ UoM และ Infrastructure
- **Architectural Summary:** [[INVENTORY_MODULE_SUMMARY]]
- **Inventory Decisions:** [[stock-ledger-immutability]]

## Key Tables
- `stock_ledger` (insert-only) · `stock_balances`
- `uom_conversions` · `product_uoms`
- `reorder_points`

## Business Rules
- `stock_ledger` insert-only — trigger `sync_stock_balances()` update balances อัตโนมัติ
- `qty_available` = generated column: `qty_on_hand - qty_reserved`
- Reorder dashboard ดึง products ที่ `qty_available < reorder_point`
- Valuation ใช้ weighted average cost

## Entry Types
`grn_receipt` · `grn_qc_reject` · `rma_return` · `transfer_out` · `transfer_in` · `cycle_count_adjustment` · `po_reversal` · `manual_adjustment`

## Tracks

```dataview
TABLE status, updated
FROM "conductor/tracks"
WHERE file.name = "plan" AND module = "Inventory"
SORT updated DESC
```

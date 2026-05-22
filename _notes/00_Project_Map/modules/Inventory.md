---
module: Inventory
type: module-summary
status: Stable
updated: 2026-05-19
---

# Inventory — ระบบสต็อก

Real-time stock tracking across warehouses. Source of truth is `stock_ledger` (insert-only). `stock_balances` is a derived view maintained by trigger.

## Dependencies
- **Data Source for:** [[WMS]], [[POS]], [[Sales]], [[BOM]]
- [[Accounting]] — ส่งข้อมูลมูลค่าสต็อก (Valuation) ไปบันทึกบัญชี
- [[Core]] — ใช้ระบบจัดการ UoM และ Infrastructure
- **Inventory Decisions:** [[stock-ledger-immutability]]

## Key Concepts

### Stock Ledger (insert-only)
Every stock movement creates a new row — never UPDATE or DELETE. Entry types:
- `grn_receipt` · `grn_qc_reject` — from GRN stocking
- `transfer_out` / `transfer_in` — from warehouse transfer
- `sale_debit` — from delivery order / POS shift sales
- `return_credit` · `rma_return` — from sales return / RMA
- `adjustment` · `cycle_count_adjustment` · `manual_adjustment` — cycle count / manual corrections
- `po_reversal` — purchase order reversals

### Stock Balances
`stock_balances` = SUM of ledger entries grouped by `(product_id, warehouse_id)`. Maintained by `sync_stock_balances()` trigger.
- `qty_available` = generated column: `qty_on_hand - qty_reserved`

## Key Tables
- `stock_ledger` (insert-only, source of truth)
- `stock_balances` (derived, trigger-maintained)
- `warehouses` · `warehouse_locations`
- `products` · `product_units` · `product_uoms`
- `uom_conversions`
- `reorder_points`
- `cycle_counts` · `cycle_count_lines`

## Key Features / Business Rules
- **Cycle Count**: physical count → discrepancy → approval → ONLY via `apply_cycle_count()` stored proc — never direct UPDATE.
- **Reorder Dashboard**: products below reorder point (`qty_available < reorder_point`) → auto-PR generation.
- **Inventory Valuation Report**: stock × unit_cost per warehouse using weighted average cost.
- **Heatmap Matrix**: visual stock level by warehouse/product.
- **Over-receive guard**: GRN qty_received cannot exceed PO qty_ordered (per line).
- **Warehouse scope**: staff see only assigned warehouse stock.

## Tracks
- `vendor-product-links` — Verified
- `reorder-dashboard` — Verified
- `inventory-valuation-report` — Completed
- `inbound-order-improvements` — Verified
- `receiving-queue-improvements` — Verified
- `ui-improvement-inventory` — Optimization Suggested (heatmap matrix)

```dataview
TABLE status, updated
FROM "conductor/tracks"
WHERE file.name = "plan" AND module = "Inventory"
SORT updated DESC
```

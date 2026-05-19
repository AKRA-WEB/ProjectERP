---
module: Inventory
status: Stable
updated: 2026-05-19
---

# Inventory Module Summary

## Overview
Real-time stock tracking across warehouses. Source of truth is `stock_ledger` (insert-only). `stock_balances` is a derived view maintained by trigger.

## Key Concepts

### Stock Ledger (insert-only)
Every stock movement creates a new row — never UPDATE or DELETE. Types:
- `grn_receipt` — from GRN stocking
- `transfer_out` / `transfer_in` — from warehouse transfer
- `sale_debit` — from delivery order
- `return_credit` — from sales return / RMA
- `adjustment` — cycle count correction

### Stock Balances
`stock_balances` = SUM of ledger entries grouped by `(product_id, warehouse_id)`. Maintained by `sync_stock_balances()` trigger.

## Key Tables
- `stock_ledger` (insert-only, source of truth)
- `stock_balances` (derived, trigger-maintained)
- `warehouses`, `warehouse_locations`
- `products`, `product_units`
- `cycle_counts`, `cycle_count_lines`

## Key Features
- **Cycle Count**: physical count → discrepancy → approval → `apply_cycle_count()` stored proc
- **Reorder Dashboard**: products below reorder point → auto-PR generation
- **Inventory Valuation Report**: stock × unit_cost per warehouse
- **Heatmap Matrix**: visual stock level by warehouse/product

## Business Rules
- Cycle count approval: ONLY via `apply_cycle_count()` stored proc — never direct UPDATE
- Over-receive guard: GRN qty_received cannot exceed PO qty_ordered (per line)
- Warehouse scope: staff see only assigned warehouse stock

## Tracks
- `vendor-product-links` — Verified
- `reorder-dashboard` — Verified
- `inventory-valuation-report` — Completed
- `inbound-order-improvements` — Verified
- `receiving-queue-improvements` — Verified
- `ui-improvement-inventory` — Optimization Suggested (heatmap matrix)

---
module: BOM
status: Stable
updated: 2026-05-19
---

# BOM Module Summary

## Overview
Bill of Materials — defines product recipes for manufacturing. Supports multi-level BOM and multi-UOM components.

## Key Flows

```
Product Setup → BOM Definition (header + components)
  → Production Order
    → Material Issue (WMS stock debit per BOM component)
      → Finished Goods Receipt (WMS stock credit)
```

## Key Tables
- `bom_headers` (finished product + version)
- `bom_components` (raw material, qty, UOM)
- `production_orders`
- `stock_ledger` (debit components, credit finished goods)

## Business Rules
- BOM version control — one active version per product at a time
- Component qty in `transaction_uom` — convert to base UOM before stock debit
- Multi-UOM: component can be in KG while stock tracked in G — use UOM conversion table
- Production Order completion triggers atomic stock movements

## Technical Notes
- UOM conversions in `uom_conversions` table
- `transaction_uom_id` + `transaction_qty` on BOM components for purchase-side
- BOM explosion (recursive component lookup) done in API, not DB

## Tracks
- `bom-module` — Completed
- `uom-framework` — Optimization Suggested (global conversions, multi-UoM line fields)
- `uom-phase2-form-selectors` — Completed

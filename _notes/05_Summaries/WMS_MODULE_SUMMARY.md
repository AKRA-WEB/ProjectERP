---
module: WMS
status: Stable
updated: 2026-05-18
---

# WMS Module Summary

## Overview
The Warehouse Management System (WMS) handles the flow of goods from receiving to storage and shipping. It is the most critical module for stock accuracy and traceability.

## Sub-Modules
- **Purchasing / Receiving**: Handles PR, PO, and GRN. Supports Standalone GRN and PR→GR Direct paths.
- **Inventory**: Stock balances, warehouse locations, and stock ledger.
- **Operations**: Picking lists, Shipments, and internal transfers.
- **Post-Receipt**: RMA (Returns) and Vendor Claims.

## Key Flows

### Receiving Workflow (New)
1. **Normal**: PR → PO → GRN (Source: PO)
2. **Fast-track**: PR → GRN (Source: PR_DIRECT)
3. **Emergency**: GRN (Standalone) → Retrospective PO

### Stock Valuation
All GRN line items must capture `unit_cost` at the point of entry. This cost is recorded in the `stock_ledger` and propagates to `stock_balances`.

## Technical Details
- **Tables**: `goods_receipt_notes`, `grn_line_items`, `purchase_requisitions`, `purchase_orders`, `stock_ledger`.
- **Linking**: Bidirectional document linking ensures that even documents created out of order are traceable.
- **Transactions**: Every receipt is a transaction involving GRN insertion and multiple `stock_ledger` entries.

## Recent Changes (2026-05-18)
- Implemented GR-First workflow.
- Fixed missing `unit_cost` in `grn_line_items` (Migration 036).
- Added `source_type` enum to differentiate between PO, IO, Standalone, and PR-Direct receipts.
- **Fixed GRN 500 (io-grn-500):** Batch INSERT stride mismatch in `app/api/grn/route.ts` — stride was `i*9` but params per row = 10. Fixed to `i*10`. Also added `.refine()` for `chk_grn_source` mutual exclusivity.
- **po-gr-audit (Fixed):** PO POST, GRN POST (PO/IO path), and GRN QC routes refactored to use transactional wrapping (`pool.connect()`). GRN QC now includes role-based access control.
- **Transaction pattern:** All multi-write routes (`create`, `receive`, `stock`, `confirm`, `approve`, `qc`) use `pool.connect()` + BEGIN/COMMIT correctly.

## Known Gaps
- (none)


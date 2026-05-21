# Repack Module Summary

**Status:** ✅ Completed
**Last Updated:** 2026-05-20

## Overview
The Repack module allows for breaking down bulk products (e.g., 25kg bags) into smaller units (e.g., 1kg packs) while maintaining strict inventory integrity. It handles the automated decrement of source stock and increment of target stock within a single transaction.

## Key Components

### 1. Repack Entry (Create)
- **Location:** `/app/app/repack/new`
- **Logic:** Users select a "Source" product and multiple "Target" products.
- **Validation:** 
    - Source and Target must be different products.
    - Quantity must be > 0.
    - System calculates "Total Weight In" vs "Total Weight Out" for audit visibility.

### 2. Repack Detail & History
- **Location:** `/app/app/repack/[id]`, `/app/app/repack`
- **Features:** Shows historical conversion data, source consumption, and generated output. Includes a "Print Barcode" stub for target products.

## API Architecture

| Route | Method | Description |
|-------|--------|-------------|
| `/api/repack` | GET | List all repack operations |
| `/api/repack` | POST | Execute repack (Consumes source, Produces targets) |
| `/api/repack/[id]` | GET | Detail of a specific repack operation |

## Inventory Logic (Transaction)
Every repack operation executes the following in a single SQL transaction:
1.  **INSERT** into `repack_orders` (Header).
2.  **INSERT** into `repack_order_lines` (Targets).
3.  **INSERT** into `stock_ledger` for **Source**: `qty_change = -consumed_qty`, `entry_type = 'repack_out'`.
4.  **INSERT** into `stock_ledger` for **Targets**: `qty_change = +produced_qty`, `entry_type = 'repack_in'`.
5.  **Trigger:** `sync_stock_balances()` automatically updates `stock_balances` table.

## Engineering Standards
- **Transaction Safety:** Uses `pool.connect()` + `BEGIN/COMMIT/ROLLBACK` to prevent orphaned stock movements.
- **UoM Handling:** System supports multi-UoM (source unit vs target unit) — developers must ensure conversion factors are handled if not using base units.
- **UI:** Uses `ViewTransition` for seamless navigation between list and detail.

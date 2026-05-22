---
track: db-cleanup-test-data
status: Verified
aliases: ["Deleting Test Transactional Data"]
owner: Gemini
module: Database
updated: 2026-05-22
---

# Track: db-cleanup-test-data — Deleting Test Transactional Data

## Goal
Safely delete test transactional data (Purchase Orders, Goods Receipts / GRNs, Inbound Orders, Outbound Shipments, Stock Ledgers, Accounts Payable Invoices, and Payments) to restore the ERP database to a clean, production-ready or semi-clean state, while preserving the master data (Products, Categories, Vendors, Warehouses, Users, and Roles).

## Tasks

### Task 1 — Identify Dependency Hierarchy
- [x] Analyze the database schema foreign keys to determine the correct deletion order (bottom-up) to avoid constraint violations.

### Task 2 — Transactional Deletion Script
- [x] Write and execute a parameterized SQL script wrapped in a transaction (`BEGIN`/`COMMIT`) to purge:
  - `ap_payments`, `ap_invoices`
  - `stock_ledger`
  - `grn_lines`, `grn`
  - `purchase_order_lines`, `purchase_orders`
  - `inbound_order_lines`, `inbound_orders`

### Task 3 — Verification
- [x] Verify that master tables (e.g. `products`, `vendors`, `warehouses`, `users`) remain completely untouched.
- [x] Ensure that all stock balances are reset or synchronized to zero if no transactional records remain.

---

## Acceptance Criteria
1. Test transactional tables are completely emptied.
2. Master data (Products, Users, Warehouses) remains fully intact.
3. No foreign key constraint violations during deletion.
4. Database remains in a healthy, consistent state.

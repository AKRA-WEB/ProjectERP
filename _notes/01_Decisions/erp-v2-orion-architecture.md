# ERP V2.0 Orion — Architecture Decisions

Source: [erp-v2-orion-roadmap master plan](../../conductor/tracks/erp-v2-orion-roadmap/plan.md)
Author: Chen
Date: 2026-05-23

The following 16 decisions are the agreed architectural foundation of the V2.0 "Orion" release. They are embedded verbatim in the master roadmap and govern every track plan in `conductor/tracks/` for the V2.0 / V2.1 / V2.2 cycle.

| # | Topic | Decision |
|---|---|---|
| 1 | Migration strategy | Incremental extend. Next slot `041_*.sql`. Preserve 49 verified tracks. |
| 2 | Multi-BU isolation | `business_unit_id` on `warehouses` ONLY. BU inferred via warehouse. Reuse `buildWarehouseScopeClause`. |
| 3 | MVP cut | Foundation-first. V2.0 = Multi-BU + Min-Price+Tier + Virtual-WH + FEFO+Override + Credit-Hold + Repack-Yield + Blind-Receiving + 3-way-Match + Dispatch-Check + supporting items. V2.0 Phase 2 = WHT+Form50+MAC+AccExport+Auditor. V2.1 = Hrzoft + Auto-Replenish. V2.2 = AI/Geo/Rebate/NPD. |
| 4 | Parallelization | Sequential. One track at a time, fully verified before next starts. |
| 5 | Pricing schema | Price-list table: `product_prices(product_id, channel ENUM('TRD','AKRA'), tier ENUM('T0','T1','T2','T3'), price, valid_from, valid_to)` + `customer_price_contracts(customer_id, product_id, locked_price, discount_pct, valid_from, valid_to)`. |
| 6 | Min Price | All channels respect `products.min_price`. Below requires manager PIN + reason code. V-CLR exempt via `products.clr_min_price`. |
| 7 | Virtual WH + thermal | Separate child tables. `warehouse_zones(warehouse_id, code, thermal_type ENUM('ambient','sensitive','chilled','frozen'))` and `virtual_locations(code, purpose ENUM('buffer','damage','clearance','scrap','repack'), is_sellable, visible_channels TEXT[])`. |
| 8 | Hrzoft | Defer to V2.1. |
| 9 | Credit auto-hold | Real-time at order open. Triggers if `outstanding>credit_limit OR aging>=1 day`. Unlock: full payment or exec override. |
| 10 | Manager override | `users.override_pin_hash` (managers/admins only). Inline PIN. Audit table `override_audit(user_id, action, target_table, target_id, reason_code, original_value, override_value, created_at)`. |
| 11 | Acc export | All 3 adapters (Express + FlowAccount + PEAK) in V2.0 Phase 2. Abstraction `lib/accounting/exporters/`. |
| 12 | 3-way match | Strict zero variance. Any mismatch blocks payment. |
| 13 | MAC | Real-time recalc on each GRN-line stocking via DB trigger. New column `products.moving_avg_cost`. |
| 14 | FEFO override | Per-line PIN. Each violation logged separately. |
| 15 | Dispatch versioning | `invoice_versions(invoice_id, version_no, barcode, created_at, created_by, change_summary)`. Latest barcode only valid; old barcodes hard-blocked. |
| 16 | Channel determination | `channel ENUM('TRD','AKRA')` on `sales_orders` / `sales_invoices` / `sales_quotations`. POS=TRD, OMS=AKRA. Customer master shared. |

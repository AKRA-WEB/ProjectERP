---
track: erp-v2-orion-roadmap
status: planned
owner: Chen
created: 2026-05-23
tags: [roadmap, master-plan, v2-orion]
---

# ERP V2.0 Orion — Master Roadmap

## Executive Summary
ERP V2.0 Orion delivers Multi-BU isolation, dynamic channel pricing with min-price hard stop, virtual warehouses for quarantine/clearance/scrap, FEFO with supervisor override, real-time credit hold, blind receiving + 3-way matching, dispatch-check exit gate with invoice versioning, repack yield tracking, then a compliance layer (MAC + Thai WHT + auditor + Express/FlowAccount/PEAK export) and finally integrations (Hrzoft, auto-replenish) and analytics (AI SKU-cut, S-curve, geo-tracking, rebate). The release sequence is strictly foundation-first and one track at a time — every track must be Verified before the next begins.

## Phase Breakdown

### Phase 1 — V2.0 Foundation (sequential, 16 tracks)
| # | Track | Estimate | Assigned |
|---|---|---|---|
| 1 | multi-bu-foundation | M | Paku |
| 2 | wms-virtual-warehouses | M | Paku |
| 3 | pricing-engine | L | Paku |
| 4 | manager-override-pin | M | Paku+Puka |
| 5 | min-price-hardstop | M | Paku+Puka |
| 6 | credit-control-engine | M | Paku |
| 7 | channel-on-order-header | S | Paku |
| 8 | pos-draft-and-hybrid-flow | L | Paku+Puka |
| 9 | pos-delta-slip-and-versioning | M | Paku+Puka |
| 10 | dispatch-check-exit-gate | M | Paku+Puka |
| 11 | fefo-enforcement | M | Paku+Puka |
| 12 | blind-receiving | M | Paku+Puka |
| 13 | three-way-matching | L | Paku |
| 14 | repack-yield-loss | M | Paku+Puka |
| 15 | wholecase-strict-lock-akra | S | Paku+Puka |
| 16 | price-history-alert-pos | S | Paku+Puka |

### Phase 2 — V2.0 Compliance (4 tracks)
| # | Track | Estimate | Assigned |
|---|---|---|---|
| 17 | moving-average-cost | M | Paku |
| 18 | vendor-wht-and-form-50 | M | Paku+Puka |
| 19 | auditor-role-and-readonly-access | S | Paku |
| 20 | accounting-export-adapters | L | Paku |

### Phase 3 — V2.1 Integrations (2 tracks)
| # | Track | Estimate | Assigned |
|---|---|---|---|
| 21 | hrzoft-integration | L | Paku |
| 22 | auto-replenishment-w1-w2 | M | Paku |

### Phase 4 — V2.2 Analytics (4 tracks)
| # | Track | Estimate | Assigned |
|---|---|---|---|
| 23 | ai-sku-cut-and-s-curve-forecasting | XL | Paku |
| 24 | npd-trial-tracking | M | Paku+Puka |
| 25 | rebate-management | M | Paku |
| 26 | field-sales-geo-tracking | M | Paku+Puka |

## Decision Log (16 Approved Decisions)

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

## Sequential Execution Order

1. multi-bu-foundation
2. wms-virtual-warehouses
3. pricing-engine
4. manager-override-pin
5. min-price-hardstop
6. credit-control-engine
7. channel-on-order-header
8. pos-draft-and-hybrid-flow
9. pos-delta-slip-and-versioning
10. dispatch-check-exit-gate
11. fefo-enforcement
12. blind-receiving
13. three-way-matching
14. repack-yield-loss
15. wholecase-strict-lock-akra
16. price-history-alert-pos
17. moving-average-cost
18. vendor-wht-and-form-50
19. auditor-role-and-readonly-access
20. accounting-export-adapters
21. hrzoft-integration
22. auto-replenishment-w1-w2
23. ai-sku-cut-and-s-curve-forecasting
24. npd-trial-tracking
25. rebate-management
26. field-sales-geo-tracking

## Dependency Graph

- **manager-override-pin** blocks: `min-price-hardstop`, `fefo-enforcement`, `credit-control-engine` (exec override flow), `repack-yield-loss`
- **pricing-engine** blocks: `min-price-hardstop`, `price-history-alert-pos`
- **multi-bu-foundation** blocks: `wms-virtual-warehouses`, `channel-on-order-header`
- **wms-virtual-warehouses** blocks: `repack-yield-loss`, `dispatch-check-exit-gate`
- **channel-on-order-header** blocks: `pos-draft-and-hybrid-flow`, `wholecase-strict-lock-akra`
- **pos-delta-slip-and-versioning** blocks: `dispatch-check-exit-gate`
- **blind-receiving** blocks: `three-way-matching`
- **moving-average-cost** is independent and runs first in Phase 2
- **auditor-role-and-readonly-access** blocks: `accounting-export-adapters` (auditor needs read endpoints first)

## Rollout / Rollback

- Every track that touches live POS/OMS ships behind a feature flag (`features.<track-slug>` in `lib/feature-flags.ts`).
- All migrations are forward-only. Rollback is performed via a compensating migration (a new file that reverses the change) — never edit a shipped migration.
- No schema drops on existing live columns. Deprecate via comment + ignore in code first; physical drop deferred to a later cleanup track.
- Each track must pass `npm run lint` + `npx tsc --noEmit` + manual smoke before being marked Completed.
- Billy QA must verify before moving to the next track in the sequence.

## Out-of-Scope (Orion v2.0)

- Mobile-native app (Android/iOS) — web responsive only.
- Legacy data migration from prior accounting systems.
- Thai e-Tax Invoice XML signing — defer to V2.3.
- Multi-currency. THB only.
- BU-specific Chart of Accounts (single CoA stays in V2.0; revisit in V2.2).

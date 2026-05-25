# Project Tracks Index

## Status Guide for Gemini CLI

| Status | Gemini action |
|--------|--------------|
| `Planned` | **Queue item.** Awaiting priority activation. **Do not execute.** |
| `Active` | **Do this now.** Read `plan.md` in the track folder and execute all tasks. Update status to `Completed` when done. |
| `Completed` | Implemented. Awaiting Billy QA — do not re-implement. |
| `Verified` | Billy QA passed. No action needed. |
| `Rework Required` | **Fix required.** Read `rework-plan.md` in the track folder. Execute Must Fix items in order. Update status to `Completed` when done. |
| `Optimization Suggested` | Low priority. Read `rework-plan.md`. Execute only if no `Active` or `Rework Required` tracks remain. Update status to `Completed` when done. |

## Active Now

> Gemini CLI: start here. Execute top-to-bottom. One track at a time.

| Track | Status | Plan |
| --- | --- | --- |

## Active Queue — V2.0 Orion Roadmap

Master plan: [erp-v2-orion-roadmap](tracks/erp-v2-orion-roadmap/plan.md)

### Phase 1 — V2.0 Foundation (sequential)
| # | Track | Status | Plan |
| --- | --- | --- | --- |
| 1 | multi-bu-foundation | Verified | [plan](tracks/multi-bu-foundation/plan.md) |
| 2 | wms-virtual-warehouses | Verified | [plan](tracks/wms-virtual-warehouses/plan.md) |
| 3 | pricing-engine | Verified | [plan](tracks/pricing-engine/plan.md) |
| 4 | manager-override-pin | Verified | [plan](tracks/manager-override-pin/plan.md) |
| 5 | min-price-hardstop | Verified | [plan](tracks/min-price-hardstop/plan.md) |
| 6 | credit-control-engine | Verified | [plan](tracks/credit-control-engine/plan.md) |
| 7 | channel-on-order-header | Verified | [plan](tracks/channel-on-order-header/plan.md) |
| 8 | pos-draft-and-hybrid-flow | Verified | [plan](tracks/pos-draft-and-hybrid-flow/plan.md) |
| 9 | pos-delta-slip-and-versioning | Verified | [plan](tracks/pos-delta-slip-and-versioning/plan.md) |
| 10 | dispatch-check-exit-gate | Verified | [plan](tracks/dispatch-check-exit-gate/plan.md) |
| 11 | fefo-enforcement | Verified | [plan](tracks/fefo-enforcement/plan.md) |
| 12 | strict-receiving-flow | Verified | [plan](tracks/strict-receiving-flow/plan.md) |
| 14 | adjust-warehouses-and-thermal-zones | Verified | [plan](tracks/adjust-warehouses-and-thermal-zones/plan.md) |
| 15 | operation-core-sync-orion-2026-05-24 | Verified | [plan](tracks/operation-core-sync-orion-2026-05-24/plan.md) |
| 16 | wholecase-strict-lock-akra | Verified | [plan](tracks/wholecase-strict-lock-akra/plan.md) |
| 17 | price-history-alert-pos | Verified | [plan](tracks/price-history-alert-pos/plan.md) |

### Phase 2 — V2.0 Compliance
| # | Track | Status | Plan |
| --- | --- | --- | --- |
| 18 | moving-average-cost | Verified | [plan](tracks/moving-average-cost/plan.md) |
| 19 | vendor-wht-and-form-50 | Verified | [plan](tracks/vendor-wht-and-form-50/plan.md) |
| 20 | auditor-role-and-readonly-access | Verified | [plan](tracks/auditor-role-and-readonly-access/plan.md) |
| 21 | accounting-export-adapters | Verified | [plan](tracks/accounting-export-adapters/plan.md) |

### Phase 3 — V2.1 Integrations
| # | Track | Status | Plan |
| --- | --- | --- | --- |
| 22 | hrzoft-integration | Verified | [plan](tracks/hrzoft-integration/plan.md) |
| 23 | auto-replenishment-w1-w2 | Active | [plan](tracks/auto-replenishment-w1-w2/plan.md) |

### Phase 4 — V2.2 Analytics
| # | Track | Status | Plan |
| --- | --- | --- | --- |
| 24 | ai-sku-cut-and-s-curve-forecasting | Active | [plan](tracks/ai-sku-cut-and-s-curve-forecasting/plan.md) |
| 25 | npd-trial-tracking | Active | [plan](tracks/npd-trial-tracking/plan.md) |
| 26 | rebate-management | Active | [plan](tracks/rebate-management/plan.md) |
| 27 | field-sales-geo-tracking | Active | [plan](tracks/field-sales-geo-tracking/plan.md) |

## Rework Required

> Gemini CLI: after Active Now is clear, fix these next.

*No rework required. All tracks are fully verified by Billy QA and approved by Chen/Claude.*

## All Tracks

| Track | Status | Created | Last Updated |
|-------|--------|---------|--------------|
| [Hrzoft Integration](./archive/tracks/hrzoft-integration/plan.md) | Verified | 2026-05-25 | 2026-05-25 |
| [Accounting Export Adapters (Express / FlowAccount / PEAK)](./archive/tracks/accounting-export-adapters/plan.md) | Verified | 2026-05-25 | 2026-05-25 |
| [Auditor Role & Read-Only Access](./archive/tracks/auditor-role-and-readonly-access/plan.md) | Verified | 2026-05-25 | 2026-05-25 |
| [Vendor WHT & Form 50 Twi](./archive/tracks/vendor-wht-and-form-50/plan.md) | Verified | 2026-05-25 | 2026-05-25 |
| [Moving Average Cost](./archive/tracks/moving-average-cost/plan.md) | Verified | 2026-05-25 | 2026-05-25 |
| [Operation Core Sync & Orion Alignment](./archive/tracks/operation-core-sync-orion-2026-05-24/plan.md) | Verified | 2026-05-24 | 2026-05-24 |
| [WMS Warehouse Restructuring & Thermal Zone Alignment](./archive/tracks/adjust-warehouses-and-thermal-zones/plan.md) | Verified | 2026-05-24 | 2026-05-24 |
| [Repack Yield & Loss](./archive/tracks/repack-yield-loss/plan.md) | Verified | 2026-05-23 | 2026-05-23 |
| [Strict 5-Step Receiving Flow (PR -> PO -> BR -> GR -> Match)](./archive/tracks/strict-receiving-flow/plan.md) | Verified | 2026-05-23 | 2026-05-23 |
| [FEFO Enforcement (with Per-Line Override)](./archive/tracks/fefo-enforcement/plan.md) | Verified | 2026-05-23 | 2026-05-23 |
| [Dispatch-Check Exit Gate](./archive/tracks/dispatch-check-exit-gate/plan.md) | Verified | 2026-05-23 | 2026-05-23 |
| [POS Delta Slip + Invoice Versioning](./archive/tracks/pos-delta-slip-and-versioning/plan.md) | Verified | 2026-05-23 | 2026-05-23 |
| [POS Draft + Hybrid Picking-Slip Flow](./archive/tracks/pos-draft-and-hybrid-flow/plan.md) | Verified | 2026-05-23 | 2026-05-23 |
| [Channel on Order Header](./archive/tracks/channel-on-order-header/plan.md) | Verified | 2026-05-23 | 2026-05-23 |
| [Credit Control Engine](./archive/tracks/credit-control-engine/plan.md) | Verified | 2026-05-23 | 2026-05-23 |
| [Min-Price Hard Stop](./archive/tracks/min-price-hardstop/plan.md) | Verified | 2026-05-23 | 2026-05-23 |
| [Manager Override PIN](./archive/tracks/manager-override-pin/plan.md) | Verified | 2026-05-23 | 2026-05-23 |
| [WMS Virtual Warehouses & Thermal Zones](./archive/tracks/wms-virtual-warehouses/plan.md) | Verified | 2026-05-23 | 2026-05-23 |
| [Pricing Engine — Channel + Tier + Contract](./archive/tracks/pricing-engine/plan.md) | Verified | 2026-05-23 | 2026-05-23 |
| [Multi-BU Foundation](./archive/tracks/multi-bu-foundation/plan.md) | Verified | 2026-05-23 | 2026-05-23 |
| [grn-receiving-quantities-fix](./archive/tracks/grn-receiving-quantities-fix/plan.md) | Verified| 2026-05-22 | 2026-05-22 |
| [Menu Grid Polish & Symmetry](./archive/tracks/menu-grid-polish/plan.md) | Verified| 2026-05-22 | 2026-05-22 |
| [inbound-order-autocomplete](./archive/tracks/inbound-order-autocomplete/plan.md) | Verified| 2026-05-22 | 2026-05-22 |
| [Maintenance & Standardization](./archive/tracks/maintenance-standardization/plan.md) | Verified | 2026-05-21 | 2026-05-22 |
| [Product Detail Stock Overview](./archive/tracks/product-stock-summary/plan.md) | Verified | 2026-05-19 | 2026-05-20 |
| [PO & GRN Transaction Integrity](./archive/tracks/po-gr-audit/plan.md) | Verified | 2026-05-18 | 2026-05-20 |
| [Chen Plan Enforcement](./archive/tracks/chen-plan-enforcement/plan.md) | Verified | 2026-05-18 | 2026-05-20 |
| [GRN Role Segregation](./archive/tracks/grn-role-segregation/plan.md) | Verified | 2026-05-20 | 2026-05-20 |
| [Repack Order System](./archive/tracks/repack-order/plan.md) | Verified | 2026-05-19 | 2026-05-20 |
| [Collaboration Protocol](./PROTOCOLS.md) | Verified | 2024-05-12 | 2026-05-22 |
| [Audit PR→PO→GRN Flow](./archive/tracks/audit-pr-po-grn/plan.md) | Verified | 2026-05-10 | 2026-05-17 |
| [Fix BUG-001 Over-receipt Guard](./archive/tracks/fix-over-receipt/plan.md) | Verified | 2026-05-10 | 2026-05-17 |
| [Responsive Design](./archive/tracks/responsive-design/plan.md) | Verified | 2026-05-10 | 2026-05-17 |
| [GR Staff Workflow](./archive/tracks/gr-staff-workflow/plan.md) | Verified | 2026-05-10 | 2026-05-17 |
| [Inbound Order Workflow](./archive/tracks/inbound-order-workflow/plan.md) | Verified | 2026-05-10 | 2026-05-17 |
| [Employee Management + RBAC](./archive/tracks/employee-rbac/plan.md) | Verified | 2026-05-10 | 2026-05-17 |
| [IO Product Search + Remove Unit Cost](./archive/tracks/io-product-search/plan.md) | Verified | 2026-05-10 | 2026-05-18 |
| [Sidebar Navigation Grouping](./archive/tracks/sidebar-grouping/plan.md) | Verified | 2026-05-10 | 2026-05-18 |
| [Thai Double-Encoding Fix (TIS-620 re-encode)](./archive/tracks/encoding-fix/plan.md) | Verified | 2026-05-10 | 2026-05-17 |
| [POS Module (Point of Sale)](./archive/tracks/pos-module/plan.md) | Verified | 2026-05-11 | 2026-05-17 |
| [Sales Module (SQ→SO→DO→SI→SR)](./archive/tracks/sales-module/plan.md) | Verified | 2026-05-11 | 2026-05-17 |
| [Accounting Module (CoA→JE→Reports)](./archive/tracks/accounting-module/plan.md) | Verified | 2026-05-11 | 2026-05-17 |
| [Bug Hunt & Polish — WMS Core](./archive/tracks/bug-hunt-wms-polish/plan.md) | Verified | 2026-05-11 | 2026-05-20 |
| [HR Module (Employees→Leave→Attendance→Payroll)](./archive/tracks/hr-module/plan.md) | Verified | 2026-05-12 | 2026-05-18 |
| [UI Design System — อรุณ](./archive/tracks/ui-design-system/plan.md) | Verified | 2026-05-12 | 2026-05-20 |
| [BOM Module — สูตรการผลิต + Multi-UOM](./archive/tracks/bom-module/plan.md) | Verified | 2026-05-12 | 2026-05-17 |
| [Main Menu — Module Hub Page](./archive/tracks/main-menu/plan.md) | Verified | 2026-05-13 | 2026-05-17 |
| [Dynamic Sidebar — Module-Scoped Navigation](./archive/tracks/dynamic-sidebar/plan.md) | Verified | 2026-05-13 | 2026-05-17 |
| [UI Redesign — BM Design System v2](./archive/tracks/ui-redesign/plan.md) | Verified | 2026-05-13 | 2026-05-17 |
| [HR Bugfix Final — u.name + import sources + formatDate](./archive/tracks/hr-bugfix-final/plan.md) | Verified | 2026-05-13 | 2026-05-17 |
| [POS Bugfix — session close auth + formatDatetime + VAT constant](./archive/tracks/pos-bugfix/plan.md) | Verified | 2026-05-13 | 2026-05-17 |
| [UoM Framework — global conversions, multi-UoM line fields, admin UI](./archive/tracks/uom-framework/plan.md) | Verified | 2026-05-13 | 2026-05-20 |
| [Import Vendors from Excel](./archive/tracks/import-vendors/plan.md) | Verified | 2026-05-13 | 2026-05-17 |
| [UoM Phase 2 — Transaction Form Selectors](./archive/tracks/uom-phase2-form-selectors/plan.md) | Verified | 2026-05-13 | 2026-05-17 |
| [Inventory Valuation Report](./archive/tracks/inventory-valuation-report/plan.md) | Verified | 2026-05-13 | 2026-05-17 |
| [GRN Receiving Workflow — Staff Work Card](./archive/tracks/grn-receiving-workflow/plan.md) | Verified | 2026-05-13 | 2026-05-17 |
| [UI Improvement — Inventory Heatmap Matrix + Warehouse Cards](./archive/tracks/ui-improvement-inventory/plan.md) | Verified | 2026-05-15 | 2026-05-20 |
| [UI Improvement — POS Tier Badges · Lock Timer · Thermal Receipt](./archive/tracks/ui-improvement-pos/plan.md) | Verified | 2026-05-15 | 2026-05-20 |
| [Hamburger Sidebar Z-Index Fix](./archive/tracks/hamburger-zindex-fix/plan.md) | Verified | 2026-05-16 | 2026-05-17 |
| [hr-ui-redesign — HR UI Redesign (Dashboard · Employees · Leave · Payroll)](./archive/tracks/hr-ui-redesign/plan.md) | Verified | 2026-05-19 | 2026-05-20 |
| [IO → GR → PO Workflow — IO card + GRN receive + Supervisor confirm + PO from IO](./archive/tracks/io-gr-po-workflow/plan.md) | Verified | 2026-05-20 | 2026-05-20 |
| [GRN Receiving Fix — Mobile Date + IO Over-Receiving](./archive/tracks/grn-receiving-fix/plan.md) | Verified | 2026-05-20 | 2026-05-20 |
| [GRN Simplified Workflow](./archive/tracks/grn-simplified-workflow/plan.md) | Verified | 2026-05-20 | 2026-05-20 |
| [Main Menu UI Polish — color coding, hover anims, module stubs](./archive/tracks/main-menu-ui-polish/plan.md) | Verified | 2026-05-21 | 2026-05-21 |
| [Admin Hub Page — center dashboard with parallel counts](./archive/tracks/admin-hub/plan.md) | Verified | 2026-05-21 | 2026-05-21 |
| [GRN UI Redesign — full desktop & mobile redesign](./archive/tracks/grn-ui-redesign/plan.md) | Verified | 2026-05-21 | 2026-05-21 |
| [GRN Mobile UI — queue cards, detail compact header, edit mobile form](./archive/tracks/grn-mobile-ui/plan.md) | Verified | 2026-05-21 | 2026-05-21 |
| [IO Edit UI — expose 4 PATCH actions on Inbound Order detail page](./archive/tracks/io-edit-ui/plan.md) | Verified | 2026-05-21 | 2026-05-22 |
| [UI Improvement — WMS Operations (GRN Tabs · QC KPIs · Receiving Queue)](./archive/tracks/ui-improvement-wms-ops/plan.md) | Verified | 2026-05-15 | 2026-05-22 |
| [Optimizing Purchase Order Search](./archive/tracks/po-new-autocomplete/plan.md) | Verified | 2026-05-22 | 2026-05-22 |
| [Deleting Test Transactional Data](./archive/tracks/db-cleanup-test-data/plan.md) | Verified | 2026-05-22 | 2026-05-22 |

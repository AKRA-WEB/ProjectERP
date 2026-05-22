# Project Tracks Index

## Status Guide for Gemini CLI

| Status | Gemini action |
|--------|--------------|
| `Active` | **Do this now.** Read `plan.md` in the track folder and execute all tasks. Update status to `Completed` when done. |
| `Completed` | Implemented. Awaiting Billy QA — do not re-implement. |
| `Verified` | Billy QA passed. No action needed. |
| `Rework Required` | **Fix required.** Read `rework-plan.md` in the track folder. Execute Must Fix items in order. Update status to `Completed` when done. |
| `Optimization Suggested` | Low priority. Read `rework-plan.md`. Execute only if no `Active` or `Rework Required` tracks remain. Update status to `Completed` when done. |

## Active Now

> Gemini CLI: start here. Execute top-to-bottom. One track at a time.

- [menu-grid-polish](./tracks/menu-grid-polish/plan.md) — Active

## Rework Required

> Gemini CLI: after Active Now is clear, fix these next.

*No rework required. All tracks are fully verified by Billy QA and approved by Chen/Claude.*

## All Tracks

| Track | Status | Created | Last Updated |
|-------|--------|---------|--------------|
| [Menu Grid Polish & Symmetry](./tracks/menu-grid-polish/plan.md) | Active | 2026-05-22 | 2026-05-22 |
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

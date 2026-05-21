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

| Track | Status | Plan | Rework Plan |
|-------|--------|------|-------------|
| maintenance-standardization | Completed | [plan.md](tracks/maintenance-standardization/plan.md) | — |
| main-menu-ui-polish | Completed | [plan.md](tracks/main-menu-ui-polish/plan.md) | — |
| admin-hub | Completed | [plan.md](tracks/admin-hub/plan.md) | — |
| grn-ui-redesign | Completed | [plan.md](tracks/grn-ui-redesign/plan.md) | — |
| grn-mobile-ui | Verified | [plan.md](tracks/grn-mobile-ui/plan.md) | — |
| product-stock-summary | Completed | [plan.md](tracks/product-stock-summary/plan.md) | — |
| po-gr-audit | Completed | [plan.md](tracks/po-gr-audit/plan.md) | [rework-plan.md](tracks/po-gr-audit/rework-plan.md) |
| chen-plan-enforcement | Completed | [plan.md](tracks/chen-plan-enforcement/plan.md) | — |
| grn-receiving-fix | Completed | [plan.md](tracks/grn-receiving-fix/plan.md) | — |
| grn-simplified-workflow | Completed | [plan.md](tracks/grn-simplified-workflow/plan.md) | — |


## Rework Required

> Gemini CLI: after Active Now is clear, fix these next.

| Track | Status | Rework Plan |
|-------|--------|-------------|
| view-transitions | Completed | [rework-plan.md](tracks/view-transitions/rework-plan.md) |
| po-gr-audit | Completed | [rework-plan.md](tracks/po-gr-audit/rework-plan.md) |
| hr-ui-redesign | Completed | [rework-plan.md](tracks/hr-ui-redesign/rework-plan.md) |

## All Tracks

| Track | Status | Created | Last Updated |
|-------|--------|---------|--------------|
| [Maintenance & Standardization](./tracks/maintenance-standardization/plan.md) | Completed | 2026-05-21 | 2026-05-21 |
| [Product Detail Stock Overview](./tracks/product-stock-summary/plan.md) | Completed | 2026-05-19 | 2026-05-20 |
| [PO & GRN Transaction Integrity](./tracks/po-gr-audit/plan.md) | Completed | 2026-05-18 | 2026-05-20 |
| [Chen Plan Enforcement](./tracks/chen-plan-enforcement/plan.md) | Completed | 2026-05-18 | 2026-05-20 |
| [GRN Role Segregation](./tracks/grn-role-segregation/plan.md) | Completed | 2026-05-20 | 2026-05-20 |
| [Repack Order System](./tracks/repack-order/plan.md) | Completed | 2026-05-19 | 2026-05-20 |
| [Collaboration Protocol](./PROTOCOLS.md) | Active | 2024-05-12 | 2024-05-12 |
| [Audit PR→PO→GRN Flow](./tracks/audit-pr-po-grn/plan.md) | Completed | 2026-05-10 | 2026-05-17 |
| [Fix BUG-001 Over-receipt Guard](./tracks/fix-over-receipt/plan.md) | Completed | 2026-05-10 | 2026-05-17 |
| [Responsive Design](./tracks/responsive-design/plan.md) | Completed | 2026-05-10 | 2026-05-17 |
| [GR Staff Workflow](./tracks/gr-staff-workflow/plan.md) | Completed | 2026-05-10 | 2026-05-17 |
| [Inbound Order Workflow](./tracks/inbound-order-workflow/plan.md) | Completed | 2026-05-10 | 2026-05-17 |
| [Employee Management + RBAC](./tracks/employee-rbac/plan.md) | Completed | 2026-05-10 | 2026-05-17 |
| [IO Product Search + Remove Unit Cost](./tracks/io-product-search/plan.md) | Completed | 2026-05-10 | 2026-05-18 |
| [Sidebar Navigation Grouping](./tracks/sidebar-grouping/plan.md) | Completed | 2026-05-10 | 2026-05-18 |
| [Thai Double-Encoding Fix (TIS-620 re-encode)](./tracks/encoding-fix/plan.md) | Completed | 2026-05-10 | 2026-05-17 |
| [POS Module (Point of Sale)](./tracks/pos-module/plan.md) | Completed | 2026-05-11 | 2026-05-17 |
| [Sales Module (SQ→SO→DO→SI→SR)](./tracks/sales-module/plan.md) | Completed | 2026-05-11 | 2026-05-17 |
| [Accounting Module (CoA→JE→Reports)](./tracks/accounting-module/plan.md) | Completed | 2026-05-11 | 2026-05-17 |
| [Bug Hunt & Polish — WMS Core](./tracks/bug-hunt-wms-polish/plan.md) | Completed | 2026-05-11 | 2026-05-20 |
| [HR Module (Employees→Leave→Attendance→Payroll)](./tracks/hr-module/plan.md) | Completed | 2026-05-12 | 2026-05-18 |
| [UI Design System — อรุณ](./tracks/ui-design-system/plan.md) | Completed | 2026-05-12 | 2026-05-20 |
| [BOM Module — สูตรการผลิต + Multi-UOM](./tracks/bom-module/plan.md) | Completed | 2026-05-12 | 2026-05-17 |
| [Main Menu — Module Hub Page](./tracks/main-menu/plan.md) | Completed | 2026-05-13 | 2026-05-17 |
| [Dynamic Sidebar — Module-Scoped Navigation](./tracks/dynamic-sidebar/plan.md) | Completed | 2026-05-13 | 2026-05-17 |
| [UI Redesign — BM Design System v2](./tracks/ui-redesign/plan.md) | Completed | 2026-05-13 | 2026-05-17 |
| [HR Bugfix Final — u.name + import sources + formatDate](./tracks/hr-bugfix-final/plan.md) | Completed | 2026-05-13 | 2026-05-17 |
| [POS Bugfix — session close auth + formatDatetime + VAT constant](./tracks/pos-bugfix/plan.md) | Completed | 2026-05-13 | 2026-05-17 |
| [UoM Framework — global conversions, multi-UoM line fields, admin UI](./tracks/uom-framework/plan.md) | Completed | 2026-05-13 | 2026-05-20 |
| [Import Vendors from Excel](./tracks/import-vendors/plan.md) | Completed | 2026-05-13 | 2026-05-17 |
| [UoM Phase 2 — Transaction Form Selectors](./tracks/uom-phase2-form-selectors/plan.md) | Completed | 2026-05-13 | 2026-05-17 |
| [Inventory Valuation Report](./tracks/inventory-valuation-report/plan.md) | Completed | 2026-05-13 | 2026-05-17 |
| [GRN Receiving Workflow — Staff Work Card](./tracks/grn-receiving-workflow/plan.md) | Completed | 2026-05-13 | 2026-05-17 |
| [UI Improvement — Inventory Heatmap Matrix + Warehouse Cards](./tracks/ui-improvement-inventory/plan.md) | Completed | 2026-05-15 | 2026-05-20 |
| [UI Improvement — POS Tier Badges · Lock Timer · Thermal Receipt](./tracks/ui-improvement-pos/plan.md) | Completed | 2026-05-15 | 2026-05-20 |
| [Hamburger Sidebar Z-Index Fix](./tracks/hamburger-zindex-fix/plan.md) | Completed | 2026-05-16 | 2026-05-17 |
| [hr-ui-redesign — HR UI Redesign (Dashboard · Employees · Leave · Payroll)](./tracks/hr-ui-redesign/plan.md) | Completed | 2026-05-19 | 2026-05-20 |
| [IO → GR → PO Workflow — IO card + GRN receive + Supervisor confirm + PO from IO](./tracks/io-gr-po-workflow/plan.md) | Completed | 2026-05-20 | 2026-05-20 |
| [GRN Receiving Fix — Mobile Date + IO Over-Receiving](./tracks/grn-receiving-fix/plan.md) | Completed | 2026-05-20 | 2026-05-20 |
| [GRN Simplified Workflow](./tracks/grn-simplified-workflow/plan.md) | Completed | 2026-05-20 | 2026-05-20 |
| [Main Menu UI Polish — color coding, hover anims, module stubs](./tracks/main-menu-ui-polish/plan.md) | Completed | 2026-05-21 | 2026-05-21 |
| [Admin Hub Page — center dashboard with parallel counts](./tracks/admin-hub/plan.md) | Completed | 2026-05-21 | 2026-05-21 |
| [GRN UI Redesign — full desktop & mobile redesign](./tracks/grn-ui-redesign/plan.md) | Completed | 2026-05-21 | 2026-05-21 |
| [GRN Mobile UI — queue cards, detail compact header, edit mobile form](./tracks/grn-mobile-ui/plan.md) | Verified | 2026-05-21 | 2026-05-21 |

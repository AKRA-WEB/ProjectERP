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

| Track | Status | Plan |
|-------|--------|------|
| [hr-ui-redesign — HR UI Redesign (Dashboard · Employees · Leave · Payroll)](./tracks/hr-ui-redesign/plan.md) | Active | [plan](./tracks/hr-ui-redesign/plan.md) |

## Rework Required

> Gemini CLI: after Active Now is clear, fix these next.

| Track | Rework Plan |
|-------|-------------|
| [view-transitions — App-wide View Transitions](./tracks/view-transitions/plan.md) | [rework-plan](./tracks/view-transitions/rework-plan.md) |

## All Tracks

| Track | Status | Created | Last Updated |
|-------|--------|---------|--------------|
| [Collaboration Protocol](./PROTOCOLS.md) | Active | 2024-05-12 | 2024-05-12 |
| [Audit PR→PO→GRN Flow](./tracks/audit-pr-po-grn/plan.md) | Completed | 2026-05-10 | 2026-05-17 |
| [Fix BUG-001 Over-receipt Guard](./tracks/fix-over-receipt/plan.md) | Completed | 2026-05-10 | 2026-05-17 |
| [Responsive Design](./tracks/responsive-design/plan.md) | Completed | 2026-05-10 | 2026-05-17 |
| [GR Staff Workflow](./tracks/gr-staff-workflow/plan.md) | Completed | 2026-05-10 | 2026-05-17 |
| [Inbound Order Workflow](./tracks/inbound-order-workflow/plan.md) | Completed | 2026-05-10 | 2026-05-17 |
| [Employee Management + RBAC](./tracks/employee-rbac/plan.md) | Completed | 2026-05-10 | 2026-05-17 |
| [IO Product Search + Remove Unit Cost](./tracks/io-product-search/plan.md) | Completed | 2026-05-10 | 2026-05-18 |
| [Sidebar Navigation Grouping](./tracks/sidebar-grouping/plan.md) | Completed | 2026-05-10 | 2026-05-18 |
| [i18n Label Fix — Thai Status/Entry Labels](./tracks/i18n-label-fix/plan.md) | Verified | 2026-05-10 | 2026-05-17 |
| [Thai Double-Encoding Fix (TIS-620 re-encode)](./tracks/encoding-fix/plan.md) | Optimization Suggested | 2026-05-10 | 2026-05-17 |
| [POS Module (Point of Sale)](./tracks/pos-module/plan.md) | Completed | 2026-05-11 | 2026-05-17 |
| [Sales Module (SQ→SO→DO→SI→SR)](./tracks/sales-module/plan.md) | Completed | 2026-05-11 | 2026-05-17 |
| [Accounting Module (CoA→JE→Reports)](./tracks/accounting-module/plan.md) | Completed | 2026-05-11 | 2026-05-17 |
| [Bug Hunt & Polish — WMS Core](./tracks/bug-hunt-wms-polish/plan.md) | Optimization Suggested | 2026-05-11 | 2026-05-17 |
| [Fix Select options.map Crash](./tracks/debug-select-options-crash/plan.md) | Verified | 2026-05-11 | 2026-05-17 |
| [HR Module (Employees→Leave→Attendance→Payroll)](./tracks/hr-module/plan.md) | Completed | 2026-05-12 | 2026-05-18 |
| [UI Design System — อรุณ](./tracks/ui-design-system/plan.md) | Optimization Suggested | 2026-05-12 | 2026-05-17 |
| [BOM Module — สูตรการผลิต + Multi-UOM](./tracks/bom-module/plan.md) | Completed | 2026-05-12 | 2026-05-17 |
| [Main Menu — Module Hub Page](./tracks/main-menu/plan.md) | Completed | 2026-05-13 | 2026-05-17 |
| [Dynamic Sidebar — Module-Scoped Navigation](./tracks/dynamic-sidebar/plan.md) | Completed | 2026-05-13 | 2026-05-17 |
| [UI Redesign — BM Design System v2](./tracks/ui-redesign/plan.md) | Completed | 2026-05-13 | 2026-05-17 |
| [HR Bugfix Final — u.name + import sources + formatDate](./tracks/hr-bugfix-final/plan.md) | Completed | 2026-05-13 | 2026-05-17 |
| [POS Bugfix — session close auth + formatDatetime + VAT constant](./tracks/pos-bugfix/plan.md) | Optimization Suggested | 2026-05-13 | 2026-05-17 |
| [UoM Framework — global conversions, multi-UoM line fields, admin UI](./tracks/uom-framework/plan.md) | Optimization Suggested | 2026-05-13 | 2026-05-17 |
| [Import Vendors from Excel](./tracks/import-vendors/plan.md) | Completed | 2026-05-13 | 2026-05-17 |
| [Vendor-Product Links (data completeness)](./tracks/vendor-product-links/plan.md) | Verified | 2026-05-13 | 2026-05-13 |
| [Reorder Point Dashboard + Auto-PR](./tracks/reorder-dashboard/plan.md) | Verified | 2026-05-13 | 2026-05-13 |
| [UoM Phase 2 — Transaction Form Selectors](./tracks/uom-phase2-form-selectors/plan.md) | Completed | 2026-05-13 | 2026-05-17 |
| [Inventory Valuation Report](./tracks/inventory-valuation-report/plan.md) | Completed | 2026-05-13 | 2026-05-17 |
| [GRN Receiving Workflow — Staff Work Card](./tracks/grn-receiving-workflow/plan.md) | Completed | 2026-05-13 | 2026-05-17 |
| [Security & Vercel Performance](./tracks/security-performance-audit/plan.md) | Verified | 2026-05-14 | 2026-05-14 |
| [Inbound Order Improvements — Product Search · Warehouse Switch · Post-Receipt Cost](./tracks/inbound-order-improvements/plan.md) | Verified | 2026-05-14 | 2026-05-14 |
| [Receiving Queue Improvements — IO Over-Receiving + Warehouse Selector](./tracks/receiving-queue-improvements/plan.md) | Verified | 2026-05-14 | 2026-05-14 |
| [Outbound Picking — Pick Lists · Shipments · Stock Dispatch](./tracks/outbound-picking/plan.md) | Verified | 2026-05-14 | 2026-05-16 |
| [POS Improvements — Grid · Members · Hold Bill · Shifts · Alerts · Scanner](./tracks/pos-improvements/plan.md) | Verified | 2026-05-14 | 2026-05-15 |
| [Accounts Payable — Vendor Bank · AP Invoices · Aging · Payments](./tracks/accounts-payable/plan.md) | Verified | 2026-05-15 | 2026-05-15 |
| [UI Improvement — Dashboard (Multi-Module KPIs + Activity Feed)](./tracks/ui-improvement-dashboard/plan.md) | Optimization Suggested | 2026-05-15 | 2026-05-17 |
| [UI Redesign — POS Terminal · Inventory · GRN Mobile](./tracks/ui-redesign-pos-inventory-grn/plan.md) | Verified | 2026-05-16 | 2026-05-16 |
| [UI Improvement — Inventory Heatmap Matrix + Warehouse Cards](./tracks/ui-improvement-inventory/plan.md) | Optimization Suggested | 2026-05-15 | 2026-05-17 |
| [UI Improvement — POS Tier Badges · Lock Timer · Thermal Receipt](./tracks/ui-improvement-pos/plan.md) | Optimization Suggested | 2026-05-15 | 2026-05-17 |
| [UI Improvement — WMS Ops (GRN Tabs · QC KPIs · Receiving Queue)](./tracks/ui-improvement-wms-ops/plan.md) | Verified | 2026-05-15 | 2026-05-17 |
| [Security Fixes — Pre-Vercel Auth Guards · Warehouse Scope · Perf](./tracks/security-fixes/plan.md) | Verified | 2026-05-15 | 2026-05-16 |
| [View Transitions — App-wide Implementation](./tracks/view-transitions/plan.md) | Rework Required | 2026-05-15 | 2026-05-19 |
| [Hamburger Sidebar Z-Index Fix](./tracks/hamburger-zindex-fix/plan.md) | Optimization Suggested | 2026-05-16 | 2026-05-17 |
| [Inbound Receive Fix — IO GRN "Request failed"](./tracks/inbound-receive-fix/plan.md) | Verified | 2026-05-18 | 2026-05-19 |
| [PO Immediate Approval — Discount + Financial Summary + Auto-GRN](./tracks/po-immediate-approval/plan.md) | Verified | 2026-05-18 | 2026-05-19 |
| [GR-First Workflow — Standalone GR + GR→PO + PR→GR Direct](./tracks/gr-first-workflow/plan.md) | Verified | 2026-05-18 | 2026-05-19 |
| [i18n Language Switch — Thai ↔ English System-wide](./tracks/i18n-language-switch/plan.md) | Verified | 2026-05-18 | 2026-05-19 |
| [Chen Plan Enforcement — Architect Trigger Reliability](./tracks/chen-plan-enforcement/plan.md) | Verified | 2026-05-18 | 2026-05-19 |
| [po-fix-400 — Fix POST /api/purchase-orders 400 Bad Request](./tracks/po-fix-400/plan.md) | Verified | 2026-05-18 | 2026-05-19 |
| [po-gr-audit — PO & GRN Transaction Integrity Fix](./tracks/po-gr-audit/plan.md) | Completed | 2026-05-18 | 2026-05-18 |
| [io-grn-500 — Fix POST /api/grn 500 from IO Receive](./tracks/io-grn-500/plan.md) | Completed | 2026-05-18 | 2026-05-19 |
| [wms-search-nav-fix — Fix WMS Product Search & Navigation 404](./tracks/wms-search-nav-fix/plan.md) | Completed | 2026-05-19 | 2026-05-19 |
| [product-stock-summary — Product Detail Stock Overview](./tracks/product-stock-summary/plan.md) | Completed | 2026-05-19 | 2026-05-19 |
| [hr-ui-redesign — HR UI Redesign (Dashboard · Employees · Leave · Payroll)](./tracks/hr-ui-redesign/plan.md) | Active | 2026-05-19 | 2026-05-19 |

---
artifact: legacy-gap-audit
track: d1-legacy-gap-audit
scope: D1 Candidate Lock, Phase 1 internal-first ERP
created: 2026-06-12
updated: 2026-06-12
---

# D1 Legacy Gap Audit - ProjectERP Legacy Baseline

## Decision

Treat this repository as a legacy technical baseline and salvage source, not as the Phase 1 business source of truth.

Do not continue D1 implementation from the existing Sales/POS behavior as-is. Existing code is useful for framework, auth, DB access, migration style, table patterns, UI references, and selected operational primitives. Business rules for D1 must be re-locked against the new Phase 1 requirements before reuse.

## Scope

Focused assets:
- Sales/POS: `sales_orders`, `so_line_items`, `sales_invoices`, `invoice_versions`, `pos_sessions`, `pos_transactions`
- Stock touchpoints: `stock_ledger`, `stock_balances`, delivery order stock posting
- Governance: `audit_logs`, `override_audit`, users/roles, warehouse scoping
- Foundation tables: products, UOM, business units, warehouses

Explicitly out of scope for D1 reuse until separately locked: refund, cash drawer, official document correction, final stock ledger posting, full accounting/GL/AP, HR/payroll, VAT report, rebate, AI forecast, field-sales GPS, auto replenishment, and advanced credit control.

## Evidence Read

- Schema/migrations: `migrations/001_enums.sql`, `002_core_tables.sql`, `003_product_master.sql`, `004_inventory.sql`, `011_audit_triggers.sql`, `016_pos.sql`, `017_sales.sql`, `026_uom_framework.sql`, `029_pos_improvements.sql`, `041_multi_bu_foundation.sql`, `044_manager_override_pin.sql`, `046_channel_on_order_header.sql`, `047_pos_hybrid_flow.sql`, `048_invoice_versions.sql`
- Routes/helpers: `app/api/pos/sessions/route.ts`, `app/api/pos/sessions/[id]/route.ts`, `app/api/pos/transactions/route.ts`, `app/api/pos/transactions/[id]/route.ts`, `app/api/sales-orders/route.ts`, `app/api/sales-orders/[id]/route.ts`, `app/api/sales-invoices/route.ts`, `app/api/sales-invoices/[id]/route.ts`, `app/api/delivery-orders/route.ts`, `app/api/delivery-orders/[id]/route.ts`, `app/api/stock/ledger/route.ts`, `lib/authz.ts`, `lib/auth/override-pin.ts`, `lib/credit/check-credit-status.ts`, `lib/invoice/versioning.ts`

## Critical Findings

1. POS legacy mixes sales, payment, and stock posting.
   - `pos_transactions` stores payment method and cash/card/change fields in the table itself (`migrations/016_pos.sql:47`, `migrations/016_pos.sql:56`).
   - POS checkout validates tender and writes `pos_transactions` (`app/api/pos/transactions/route.ts:210`, `app/api/pos/transactions/route.ts:218`).
   - POS checkout also inserts `stock_ledger` entries immediately (`app/api/pos/transactions/route.ts:241`).
   - POS void restores stock by writing `stock_ledger` immediately (`app/api/pos/transactions/[id]/route.ts:95`).

2. Sales order legacy is a document header/status flow, not a D1 candidate-lock model.
   - `sales_orders` has customer, warehouse, status, expected delivery, totals, and audit timestamps (`migrations/017_sales.sql:94`).
   - Existing create flow includes credit release, mobile field check-in, AKRA UOM lock, and VAT calculation (`app/api/sales-orders/route.ts:109`, `app/api/sales-orders/route.ts:162`, `app/api/sales-orders/route.ts:187`, `app/api/sales-orders/route.ts:237`).
   - There is no dedicated sales session boundary, order version, line version, status history table, or D1 event log in the legacy order model.

3. Invoice legacy owns official-ish document lifecycle and payment state.
   - `sales_invoices` is a separate table with status, paid/void fields, and amounts (`migrations/017_sales.sql:169`).
   - Invoice versions are implemented at invoice level, not order/session level (`migrations/048_invoice_versions.sql:6`, `lib/invoice/versioning.ts:62`).
   - `PATCH /api/sales-invoices/[id]` can mark invoice paid and then mark the parent SO paid (`app/api/sales-invoices/[id]/route.ts:188`, `app/api/sales-invoices/[id]/route.ts:192`).
   - This should wait for DOC0/D6 boundaries before reuse.

4. Stock ledger is a strong technical pattern, but current callers are too final for D1.
   - `stock_ledger` is insert-only by design and syncs `stock_balances` via trigger (`migrations/004_inventory.sql:28`).
   - Delivery order shipping posts `so_delivery` to `stock_ledger` directly (`app/api/delivery-orders/[id]/route.ts:104`).
   - D1 should emit or record sales intent/events only until D3 defines reservation/final posting rules.

5. Audit foundations exist, but D8 taxonomy and actor capture are not sufficient.
   - `audit_logs` exists (`migrations/002_core_tables.sql:34`).
   - The generic trigger writes entity/action/old/new values but does not capture actor or warehouse context (`migrations/011_audit_triggers.sql:22`).
   - Current triggers cover purchasing/WMS-style tables only, not Sales/POS (`migrations/011_audit_triggers.sql:29` to `migrations/011_audit_triggers.sql:53`).
   - `override_audit` is useful for privileged approvals and single-use JWT replay protection (`migrations/044_manager_override_pin.sql:5`, `lib/auth/override-pin.ts:108`), but D8 still needs event names and target semantics.

6. Foundation tables are reusable with M-track alignment.
   - `warehouses`, `users`, `products`, `uom_conversions`, and `business_units` exist (`migrations/002_core_tables.sql:1`, `migrations/002_core_tables.sql:14`, `migrations/003_product_master.sql:19`, `migrations/026_uom_framework.sql:24`, `migrations/041_multi_bu_foundation.sql:7`).
   - They should be reviewed against M1 product/UOM, M4 TRD/AKRA/location model, and M5 permission model before becoming new Phase 1 truth.

## Legacy to D1 Mapping

| D1 Item | Existing Asset | Reuse Decision | Gap vs D1 Candidate Lock | Action |
|---|---|---|---|---|
| Sales session | `pos_sessions` | Maybe, but only as POS/cash session reference | Tied to warehouse, opening/closing float, shift, POS lifecycle; not a general sales session boundary | Define new D1 `sales_sessions` contract or deliberately map `pos_sessions` after D6 cash rules are locked |
| Sales order header | `sales_orders` | Modify/migrate | Has status/totals/channel but lacks session id, order version, status history, and event log | Salvage fields; add D1-specific session/version/history only after D1 contract is approved |
| Sales order lines | `so_line_items` | Salvage | Has quantities/UOM but lacks line version/candidate-lock semantics | Reuse product/UOM/qty fields; add line version and lock rules in D1 |
| POS transaction | `pos_transactions` | Risky, freeze for D1 | Mixes payment capture, cashier receipt, member points, and stock posting | Do not use as D1 order source; isolate as D6/POS reference |
| Invoice | `sales_invoices`, `invoice_versions` | Freeze for D1 | Owns paid/void and invoice-level correction/versioning | Wait for DOC0/D6 before reusing |
| Stock posting | `stock_ledger`, `stock_balances` | Reference pattern only | Current POS/DO callers post final movement directly | D1 should not write final stock ledger until D3 event/status model is locked |
| Delivery/shipping | `delivery_orders`, `do_line_items` | Freeze for D1 | Shipping writes stock ledger and updates SO delivery status | Treat as D3/DOC integration reference |
| Audit/event log | `audit_logs`, `override_audit` | Foundation with extension | Generic audit lacks D8 event taxonomy and actor context in trigger function | Define D8 event names, actor capture, and D1 order event append pattern |
| Users/roles/access | `users`, `permissions`, `user_warehouse_assignments`, `lib/authz.ts` | Reuse with M5 review | Role set and permissions are legacy ERP-wide | Align permission matrix to Phase 1 internal-first operations |
| Products/UOM | `products`, `units_of_measure`, `uom_conversions` | Reuse with M1 review | UOM model is advanced and global; product import fields may exceed Phase 1 | Keep technical model, trim/validate business-required fields against M1 |
| BU/warehouses | `business_units`, `warehouses` | Reuse with M4 review | Includes W1-W5 plus virtual warehouse concepts | Align TRD/Akra/location model and decide which virtual locations are Phase 1 active |
| Pricing/min-price/credit | pricing helpers, credit hold | Freeze unless Phase 1 explicitly locks it | Adds AKRA whole-case, min-price override, credit release, field-sales check-in | Keep as reference; do not make D1 depend on it |

## D1 Contract Gaps to Lock Before Coding

- What exactly is a D1 sales session, and is it separate from POS/cash session?
- Which order statuses exist in Phase 1, and which transition creates the candidate lock?
- Where are order version and line version stored, and what increments them?
- What is the append-only event model for D1 and how does it later map to D8?
- What does D1 emit to D3 before stock posting is locked: reservation intent, candidate movement, or no stock event?
- What hook shape does D1 expose to D6 without owning payment/refund/cash drawer?
- Where is the DOC0 boundary between operational order, official document, and correction document?

## Guardrails for Chen

- Do not treat `Verified` legacy tracks as Phase 1 approval.
- Do not wire D1 to `pos_transactions` for payment, cash drawer, refund, or final stock effects.
- Do not use `sales_invoices` as D1 official document truth until DOC0/D6 are approved.
- Do not let old credit, field-sales, accounting, AP, HR, rebate, AI forecast, or auto-replenishment logic become required paths for D1.
- Start D1 with a contract-first plan from the new Phase 1 source of truth, then choose legacy tables/modules one by one.

## Follow-up

The D1 Foundation architecture plan has been created at `conductor/tracks/d1-sales-lifecycle-foundation/plan.md` from the Phase 1 D1 requirements supplied on 2026-06-12.

Before implementation, confirm:

1. New or reused tables.
2. Status transition rules.
3. Versioning rules for header and lines.
4. Event log shape.
5. D3, D6, DOC0, and D8 integration boundaries.
6. Migration strategy from legacy tables if reuse is selected.

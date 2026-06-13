---
track: d1-sales-lifecycle-foundation
title: "D1 Sales Lifecycle Foundation"
status: Planned
created: 2026-06-12
updated: 2026-06-12
owner: Chen
phase: phase-1-reset
depends_on: [M1, M2, M5, M6]
tags: [d1, sales, lifecycle, schema, phase-1]
source: user-directive-2026-06-12
decision_lock: additive-bridge-2026-06-12
---

# D1 Sales Lifecycle Foundation

## Goal

Implement D1 as the operational sales lifecycle foundation for Phase 1:

1. Sales Session
2. Sales Order
3. Sales Order Line
4. Order Version and Line Version
5. Status History
6. Sales Event Log

D1 owns sales lifecycle state and emits auditable events/hooks for other modules. It must not own stock movement, payment ledger, refund, cash drawer, dispatch checking, official document correction, or warehouse-location movement.

## Legacy Baseline Decision

Use the existing ProjectERP codebase only as a technical baseline. Do not treat legacy Sales/POS behavior as approved Phase 1 business logic.

Relevant legacy audit: `conductor/tracks/d1-legacy-gap-audit/legacy-gap-audit.md`.

### Physical Migration Warning

The canonical D1 contract below uses table names such as `sales_orders`, but this repository already has legacy `sales_orders` and `so_line_items` tables with incompatible assumptions:

- legacy `sales_orders.status` uses the old `so_status` enum.
- legacy `sales_orders.warehouse_id` is required, while D1 should not own warehouse/location directly.
- legacy lines live in `so_line_items`; D1 target lines are `sales_order_lines`.
- legacy POS and invoice routes currently combine payment, document, and stock effects.

Candidate migration strategies considered:

1. **Staged v2 tables:** create `d1_sales_orders` style physical tables first, then cut over later.
2. **Canonical cutover:** migrate existing `sales_orders` in place after deprecating old routes.
3. **Additive bridge:** keep legacy tables, add D1 tables for lines/version/history/events, and expose D1 through new route/service boundaries.

Locked decision for the first implementation track: **additive bridge**. Do not mutate legacy routes in the same track.

## Decision Lock Addendum - 2026-06-12

### D1-DEC-001: Physical Migration Strategy

Use an additive bridge. Keep legacy Sales/POS tables and routes intact while D1 is implemented through new service and API boundaries.

Initial physical tables:

| Logical D1 concept | Initial physical table | Reason |
|---|---|---|
| Sales Session | `sales_sessions` | No direct legacy conflict; D1 can own this name now. |
| Sales Order | `d1_sales_orders` | Legacy `sales_orders` already exists with incompatible enum, required warehouse, and old lifecycle. |
| Sales Order Line | `d1_sales_order_lines` | Keeps D1 lines tied to `d1_sales_orders`; avoids confusion with legacy `so_line_items`. |
| Order Version | `d1_sales_order_versions` | D1-owned version table. |
| Line Version | `d1_sales_order_line_versions` | D1-owned line snapshot table. |
| Status History | `d1_sales_order_status_history` | D1-owned append-only transition history. |
| Event Log | `d1_sales_order_events` | D1-owned audit/event stream. |

Service types and API payloads may use the canonical domain names (`sales_order_id`, `sales_order_lines`, etc.). Physical table prefixes are a bridge only. A future cutover track may rename or migrate into canonical `sales_orders` after legacy Sales/POS routes are deprecated.

### D1-DEC-002: API Namespace

Use `/api/d1/...` for the first implementation. Do not cut over existing `/api/sales-orders`, `/api/pos/transactions`, or `/api/sales-invoices` routes in this track.

Initial routes:

- `POST /api/d1/sales-sessions`
- `PATCH /api/d1/sales-sessions/[id]`
- `POST /api/d1/sales-orders`
- `GET /api/d1/sales-orders/[id]`
- `PATCH /api/d1/sales-orders/[id]`
- `POST /api/d1/sales-orders/[id]/lines`
- `PATCH /api/d1/sales-orders/[id]/lines/[lineId]`

### D1-DEC-003: Candidate Lock Boundary

`CUSTOMER_CONFIRMED` is the D1 candidate lock boundary.

Before `CUSTOMER_CONFIRMED`, the order is editable draft/open work. At and after `CUSTOMER_CONFIRMED`, every material change must create a new active order version, insert line-version snapshots, and append events. D3/D4/D6/DOC modules must consume the `sales_order_id` plus `current_version_no`, not a session-only reference.

### D1-DEC-004: Session Completion Policy

Session completion is manual only.

`sales_sessions.status = COMPLETED` means the operator closed the selling round and no more D1 orders should be added to that session. It does not mean stock, payment, fulfillment, or official documents are completed.

Completion is allowed only when all child D1 orders are either at least `CUSTOMER_CONFIRMED` or `CANCELLED`. If any child order remains `DRAFT` or `OPEN_NOT_FINAL`, return `409` and require user action.

### D1-DEC-005: Initial Event Taxonomy Seeds

Seed D1 events as text/enum values with these initial types:

- Session: `SESSION_OPENED`, `SESSION_COMPLETED`, `SESSION_CANCELLED`
- Order lifecycle: `ORDER_CREATED`, `ORDER_CONFIRMED`, `ORDER_STATUS_CHANGED`, `ORDER_CANCELLED`, `ORDER_COMPLETED`
- Versioning: `VERSION_CREATED`, `VERSION_ACTIVATED`
- Lines: `ITEM_ADDED`, `ITEM_REMOVED`, `QTY_CHANGED`, `LINE_CANCELLED`
- Pricing: `PRICE_CHANGED`, `PRICE_OVERRIDE`
- Customer/header: `CUSTOMER_CHANGED`, `FULFILLMENT_TYPE_CHANGED`
- External status sync: `RESERVATION_STATUS_SYNCED`, `FULFILLMENT_STATUS_SYNCED`, `PAYMENT_STATUS_SYNCED`, `DOCUMENT_STATUS_SYNCED`

D1 must not emit events that imply it performed stock posting, payment capture, refund, cash drawer movement, or official document issuance. It may record status sync events from those modules after their contracts exist.

### D1-DEC-006: Initial Enum Values

Use the user-supplied uppercase status values as the semantic contract. PostgreSQL enum type names should be D1-prefixed, for example `d1_sales_order_status`, to avoid collisions with legacy `so_status`.

Initial enums:

- `d1_sales_session_status`: `ACTIVE`, `COMPLETED`, `CANCELLED`
- `d1_sales_channel`: `POS`, `ADMIN`, `WALK_IN`
- `d1_fulfillment_type`: `STORE_PICK`, `WAREHOUSE_PICK`
- `d1_document_status`: `DRAFT`, `NON_OFFICIAL`, `OFFICIAL`, `CORRECTION_REQUIRED`
- `d1_payment_status`: `UNPAID`, `PARTIAL`, `PAID`, `CORRECTION_REQUIRED`
- `d1_reservation_status`: `NOT_RESERVED`, `RESERVED`, `PARTIAL_RELEASED`, `RELEASED`
- `d1_price_source`: `CUSTOMER_TIER`, `MANUAL_OVERRIDE`, `PROMO`, `STANDARD`
- `d1_order_change_type`: `ITEM_ADD`, `ITEM_REMOVE`, `QTY_CHANGE`, `PRICE_CHANGE`, `CUSTOMER_CHANGE`
- `d1_source_module`: `D1`, `D3`, `D4`, `D6`, `DOC`, `SYSTEM`

### D1-DEC-007: Dependency Handling

D1 implementation may create nullable UUID fields for M6 reason codes and future DOC/payment references, but it must not invent M6/M7/DOC tables. Add hard FKs only when the owning module tables are confirmed in the repo.

Required existing dependency checks before migration:

- M1 product/UOM physical table and column names.
- M2 customer physical table and active/inactive semantics.
- M5 user/permission model for D1 route guards.
- M6 reason-code table availability. If absent, leave reason-code columns nullable UUID without FK and document the pending owner.

## Non-Goals

- No `stock_ledger` writes in D1.
- No payment transaction detail, payment method detail, refund detail, or cash drawer movement in D1.
- No picker/checker detail in D1.
- No official invoice/receipt detail in D1.
- No warehouse location movement in D1.
- No damage/return-to-stock handling in D1.
- No full accounting, AP, GL, VAT, HR, rebate, AI forecast, field-sales GPS, or auto-replenishment dependencies.

## Target Schema Contract

### 1. `sales_sessions`

Sales session is a user-controlled selling round/cart/session. D1 no longer auto-completes sessions; the user must complete the session explicitly.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | Default `gen_random_uuid()` |
| `session_no` | VARCHAR unique | Generated by PostgreSQL doc-number function |
| `customer_id` | UUID FK | Owner: M2 |
| `status` | enum | `ACTIVE`, `COMPLETED`, `CANCELLED` |
| `started_by_user_id` | UUID FK | Owner: M5 |
| `started_at` | timestamptz | Defaults to `NOW()` |
| `completed_by_user_id` | UUID FK nullable | User who completes session |
| `completed_at` | timestamptz nullable | Completion timestamp |
| `note` | text nullable | Operator note |
| `created_at` | timestamptz | System timestamp |
| `updated_at` | timestamptz | System timestamp |

### 2. `sales_orders`

Sales order is the main operational document. Stock, fulfillment, payment, and documents must reference `sales_order_id`, not a floating session id.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | Default `gen_random_uuid()` |
| `order_no` | VARCHAR unique | Generated by PostgreSQL doc-number function |
| `sales_session_id` | UUID FK | References D1 sales session |
| `customer_id` | UUID FK | Owner: M2 |
| `sales_channel` | enum | `POS`, `ADMIN`, `WALK_IN`, extensible |
| `fulfillment_type` | enum | `STORE_PICK`, `WAREHOUSE_PICK` |
| `status` | enum | D1 lifecycle status below |
| `document_status` | enum | `DRAFT`, `NON_OFFICIAL`, `OFFICIAL`, `CORRECTION_REQUIRED` |
| `payment_status` | enum | `UNPAID`, `PARTIAL`, `PAID`, `CORRECTION_REQUIRED` |
| `reservation_status` | enum | `NOT_RESERVED`, `RESERVED`, `PARTIAL_RELEASED`, `RELEASED` |
| `current_version_no` | integer | Starts at 1 |
| `manual_price_override_flag` | boolean | True if any line is manually overridden |
| `customer_tier_snapshot` | jsonb/text | Snapshot at order creation |
| `price_tier_snapshot` | jsonb/text | Snapshot at pricing calculation |
| `subtotal_amount` | numeric(15,2) | Before discounts |
| `discount_amount` | numeric(15,2) | Order-level discount |
| `total_amount` | numeric(15,2) | Final operational total |
| `created_by_user_id` | UUID FK | Owner: M5 |
| `confirmed_by_user_id` | UUID FK nullable | User who confirms customer/order |
| `completed_by_user_id` | UUID FK nullable | User who completes order |
| `created_at` | timestamptz | System timestamp |
| `updated_at` | timestamptz | System timestamp |

### 3. `sales_order_lines`

Line rows are operational product commitments for an order. Snapshot fields protect historical orders from master-data changes.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | Default `gen_random_uuid()` |
| `sales_order_id` | UUID FK | Parent order |
| `line_no` | integer | Unique per order |
| `product_id` | UUID FK | Owner: M1 |
| `sku_snapshot` | varchar | SKU at sale time |
| `product_name_snapshot` | text | Name at sale time |
| `barcode_snapshot` | varchar nullable | Barcode used |
| `uom_id` | UUID FK | Owner: M1 UOM |
| `qty_ordered` | numeric(15,4) | Ordered quantity |
| `qty_reserved` | numeric(15,4) | Written from D3 contract only |
| `qty_picked` | numeric(15,4) | Written from D4 contract only |
| `qty_checked` | numeric(15,4) | Written from D4 contract only |
| `qty_cancelled` | numeric(15,4) | Cancelled quantity |
| `unit_price` | numeric(15,2) | Operational unit price |
| `price_source` | enum | `CUSTOMER_TIER`, `MANUAL_OVERRIDE`, `PROMO`, `STANDARD` |
| `manual_price_override_flag` | boolean | If true, price cannot be auto-overwritten by tier recalculation |
| `manual_price_reason_code_id` | UUID FK nullable | Owner: M6 |
| `line_status` | enum | `ACTIVE`, `CANCELLED`, `FULFILLMENT_PENDING`, `READY_FOR_PAYMENT`, extensible |
| `created_at` | timestamptz | System timestamp |
| `updated_at` | timestamptz | System timestamp |

### 4. `sales_order_versions`

Order version rows prevent D4 picker/checker confusion. D4 must know which version it is working from.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | Default `gen_random_uuid()` |
| `sales_order_id` | UUID FK | Parent order |
| `version_no` | integer | Starts at 1, unique per order |
| `change_type` | enum | `ITEM_ADD`, `ITEM_REMOVE`, `QTY_CHANGE`, `PRICE_CHANGE`, `CUSTOMER_CHANGE` |
| `changed_by_user_id` | UUID FK | Owner: M5 |
| `changed_at` | timestamptz | Defaults to `NOW()` |
| `change_reason_code_id` | UUID FK nullable | Owner: M6 |
| `change_note` | text nullable | Operator note |
| `is_active_version` | boolean | Only one active version per order |

### 5. `sales_order_line_versions`

Line-version snapshots support diffing between versions.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | Default `gen_random_uuid()` |
| `sales_order_version_id` | UUID FK | Parent version |
| `sales_order_line_id` | UUID FK | Source line |
| `product_id` | UUID FK | Owner: M1 |
| `qty_ordered` | numeric(15,4) | Quantity in that version |
| `unit_price` | numeric(15,2) | Unit price in that version |
| `line_status` | enum | Status in that version |

### 6. `sales_order_status_history`

Append-only audit trail for D1 lifecycle transitions.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | Default `gen_random_uuid()` |
| `sales_order_id` | UUID FK | Parent order |
| `from_status` | enum nullable | Null for first status |
| `to_status` | enum | New status |
| `changed_by_user_id` | UUID FK | Owner: M5 |
| `changed_at` | timestamptz | Defaults to `NOW()` |
| `reason_code_id` | UUID FK nullable | Owner: M6 |
| `note` | text nullable | Operator note |
| `source_module` | enum/text | `D1`, `D4`, `D6`, `SYSTEM` |

### 7. `sales_order_events`

D1 event log for audit and D8 integration. This is not a stock/payment/document ledger.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | Default `gen_random_uuid()` |
| `sales_order_id` | UUID FK | Parent order |
| `sales_session_id` | UUID FK nullable | Related session |
| `event_type` | enum/text | `ITEM_ADDED`, `QTY_CHANGED`, `PRICE_OVERRIDE`, `DOCUMENT_ISSUED`, etc. |
| `event_payload_json` | jsonb | Before/after detail |
| `created_by_user_id` | UUID FK | Owner: M5 |
| `created_at` | timestamptz | Defaults to `NOW()` |
| `source_module` | enum/text | `D1`, `D3`, `D4`, `D6` |

## Status Contracts

### `sales_sessions.status`

- `ACTIVE`
- `COMPLETED`
- `CANCELLED`

Manual completion only. No auto-complete behavior in D1.

### `sales_orders.status`

Initial target names:

- `DRAFT`
- `OPEN_NOT_FINAL`
- `CUSTOMER_CONFIRMED`
- `FULFILLMENT_PENDING`
- `FULFILLMENT_IN_PROGRESS`
- `FULFILLMENT_READY_FOR_PAYMENT`
- `READY_FOR_PAYMENT`
- `PAYMENT_PENDING`
- `PAYMENT_CONFIRMED`
- `PENDING_RELEASE`
- `COMPLETED`
- `CANCELLED`
- `DOCUMENT_CORRECTION_REQUIRED`
- `POST_PAYMENT_CORRECTION_REQUIRED`

The final enum names may be cleaned before migration, but D1 must preserve these semantic states.

## Ownership Boundaries

| Field/Concern | Owner |
|---|---|
| `customer_id` | M2 |
| `product_id` | M1 |
| `uom_id` | M1 |
| warehouse/location | D3/D4/M4, not D1 direct ownership |
| `reason_code_id` | M6 |
| `payment_method_id` | M7/D6 |
| `document_id` | DOC1/DOC2 |
| user references | M5 |
| stock ledger movement | D3 |
| picker/checker detail | D4 |
| payment/refund/cash drawer | D6 |
| official invoice/receipt detail | DOC2 |
| document correction boundary | DOC0/DOC2 |
| damage/return-to-stock handling | D7 |

## Architectural Gates

### Transaction Boundary

Every multi-row D1 write must be atomic:

- Create order: `BEGIN` -> insert parent order -> insert lines -> insert order version -> insert line-version snapshots -> insert initial status history -> insert events -> `COMMIT`.
- Edit order: `BEGIN` -> lock order -> apply line/header changes -> deactivate previous active version -> insert next version -> insert line-version snapshots -> insert events -> `COMMIT`.
- Status transition: `BEGIN` -> lock order -> validate transition -> update order status -> insert status history -> insert event -> `COMMIT`.
- Complete session: `BEGIN` -> lock session -> validate completion policy -> update session -> insert session/order events as required -> `COMMIT`.

On any failure: `ROLLBACK`.

### Doc Number Generation

Use PostgreSQL doc-number generation only:

- `sales_sessions.session_no`: `next_doc_number('SES', 'seq_sales_session')` or final approved prefix.
- `sales_orders.order_no`: `next_doc_number('SO', 'seq_sales_order')` or final approved prefix.

No application-side running number generation.

### Child Inserts

Create order must always implement full parent-to-child logic:

1. Insert sales order parent and get `sales_order_id`.
2. For each line, insert `sales_order_lines` with `sales_order_id`.
3. Insert `sales_order_versions` V1.
4. For each current line, insert `sales_order_line_versions` linked to V1.
5. Insert initial `sales_order_status_history`.
6. Insert `sales_order_events`.

No header-only skeleton implementation.

### Side Effects

D1 may write only D1-owned lifecycle/event data. D1 must not:

- insert/update/delete `stock_ledger`;
- create payment transactions;
- create refunds;
- move cash drawer balances;
- create official invoices/receipts;
- mutate warehouse locations;
- run dispatch/pick/check workflows.

Integration with D3/D4/D6/DOC modules must be via explicit status/event hooks defined in `sales_order_events` or later approved module contracts.

### Response Shape

Use `apiSuccess` / `apiError` only for routes.

Initial response interfaces:

```ts
interface D1SalesSessionResponse {
  id: string;
  session_no: string;
  customer_id: string;
  status: 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
  started_by_user_id: string;
  started_at: string;
  completed_by_user_id: string | null;
  completed_at: string | null;
  note: string | null;
}

interface D1SalesOrderResponse {
  id: string;
  order_no: string;
  sales_session_id: string;
  customer_id: string;
  sales_channel: 'POS' | 'ADMIN' | 'WALK_IN';
  fulfillment_type: 'STORE_PICK' | 'WAREHOUSE_PICK';
  status: string;
  document_status: 'DRAFT' | 'NON_OFFICIAL' | 'OFFICIAL' | 'CORRECTION_REQUIRED';
  payment_status: 'UNPAID' | 'PARTIAL' | 'PAID' | 'CORRECTION_REQUIRED';
  reservation_status: 'NOT_RESERVED' | 'RESERVED' | 'PARTIAL_RELEASED' | 'RELEASED';
  current_version_no: number;
  manual_price_override_flag: boolean;
  subtotal_amount: number;
  discount_amount: number;
  total_amount: number;
  lines: D1SalesOrderLineResponse[];
}

interface D1SalesOrderLineResponse {
  id: string;
  sales_order_id: string;
  line_no: number;
  product_id: string;
  sku_snapshot: string;
  product_name_snapshot: string;
  barcode_snapshot: string | null;
  uom_id: string;
  qty_ordered: number;
  qty_reserved: number;
  qty_picked: number;
  qty_checked: number;
  qty_cancelled: number;
  unit_price: number;
  price_source: 'CUSTOMER_TIER' | 'MANUAL_OVERRIDE' | 'PROMO' | 'STANDARD';
  manual_price_override_flag: boolean;
  manual_price_reason_code_id: string | null;
  line_status: string;
}
```

## API Surface Draft

Locked initial route namespace:

- `POST /api/d1/sales-sessions` opens a manual session.
- `PATCH /api/d1/sales-sessions/[id]` completes or cancels a session.
- `POST /api/d1/sales-orders` creates an order inside a session.
- `GET /api/d1/sales-orders/[id]` returns order, lines, active version, status history, and events.
- `PATCH /api/d1/sales-orders/[id]` applies controlled header/status changes.
- `POST /api/d1/sales-orders/[id]/lines` adds a line and creates a new version.
- `PATCH /api/d1/sales-orders/[id]/lines/[lineId]` changes quantity/price/status and creates a new version.

Do not reuse legacy `app/api/pos/transactions`, legacy `app/api/sales-orders`, or legacy `app/api/sales-invoices` paths for D1 behavior in the first implementation track.

## Testing Strategy

Implementation must add behavior tests. Minimum required assertions:

- Opening a sales session creates `ACTIVE` session and does not auto-complete.
- Creating an order inserts parent, lines, V1 order version, V1 line-version snapshots, status history, and event rows in one transaction.
- Changing item, quantity, price, or customer increments `current_version_no` and deactivates the previous active version.
- Manual price override sets line/order override flags and prevents later customer-tier recalculation from overwriting the manual unit price.
- Status transition inserts exactly one `sales_order_status_history` row and one event row.
- Completing a session is user-triggered and does not write stock/payment/document records.
- D1 routes do not write `stock_ledger`, POS payment tables, refund tables, cash drawer tables, or invoice/receipt document tables.

## Implementation Tasks

- [x] Lock physical migration strategy: additive bridge.
- [x] Lock initial enum names and semantic values for D1 statuses, document status, payment status, reservation status, sales channel, fulfillment type, price source, change type, and source module.
- [ ] Write migration for D1-owned tables/columns only.
- [ ] Create server-side lifecycle service functions with transaction boundaries.
- [ ] Create D1 API routes using auth, permission checks, Zod validation, parameterized SQL, and `apiSuccess`/`apiError`.
- [ ] Add tests listed above.
- [ ] Update `docs/SCHEMA.md`, `_notes/02_Agent_Memory/current-state.md`, and relevant module docs after implementation.
- [ ] Run `npm run qa:verify` and `npm run agent:closeout`.

## Remaining Open Decisions

- Confirm whether M6 reason-code tables already exist or D1 must leave reason-code FKs pending.
- Confirm exact M5 permission ids for D1 route guards.
- Confirm future cutover criteria for replacing legacy `/api/sales-orders` with D1 routes.
- Confirm whether `OFFICIAL` document status can be set only by DOC modules or by D1 operator action after DOC contract exists.

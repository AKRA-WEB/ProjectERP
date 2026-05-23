---
track: channel-on-order-header
phase: V2.0-P1
sequence: 7
status: Verified
owner: Chen
created: 2026-05-23
updated: 2026-05-23
depends_on: [multi-bu-foundation]
estimate: S
assigned_to: [Paku]
tags: [v2-orion, channel, schema, sales]
---

# Channel on Order Header

## Goal
Stamp `channel ENUM('TRD','AKRA')` on every sales document so that pricing, UoM constraints, and reporting can be partitioned by channel without inferring it from the warehouse on each query.

## Scope IN
- New column `channel sales_channel NOT NULL` on `sales_orders`, `sales_invoices`, `sales_quotations`.
- New PostgreSQL ENUM `sales_channel AS ENUM('TRD','AKRA')`.
- Backfill: orders/invoices/quotations linked to W1 -> `TRD`; everything else -> `AKRA`.
- Default in POS routes: `TRD`. Default in OMS routes: `AKRA`.
- Wire `channel` into the pricing-engine resolver call.

## Scope OUT
- BU-stamping on transactional tables (BU is inferred from warehouse — see track #1).
- Channel on purchase documents (PO/GRN) — not needed in V2.0.

## Acceptance Criteria
1. All three tables have non-null `channel` on every existing row after migration.
2. POS API persists `channel='TRD'`; OMS API persists `channel='AKRA'`.
3. Pricing-engine resolver receives the stamped channel and returns matching tier price.
4. Reports filter by channel cleanly.
5. `npm run lint` and `npx tsc --noEmit` pass.

## Migrations
- `046_channel_on_order_header.sql` — create enum, add column with NOT NULL DEFAULT after backfill, drop default, add index `(channel, created_at)` on each of the 3 tables.

## API routes
- Touched: `app/api/pos/orders/route.ts` (set TRD).
- Touched: `app/api/oms/orders/route.ts` (set AKRA).
- Touched: `app/api/sales/quotations/route.ts`, `app/api/sales/invoices/route.ts`.

## UI screens
- Touched: order list pages show a Channel badge.
- New: filter dropdown by channel on sales list pages.

## Test plan
- Manual: create POS order, confirm `channel='TRD'` persisted. Same for OMS -> AKRA.
- Reports filter by channel returns correct counts.
- Lint + tsc.

## Risks
- Backfill must be exhaustive — verify zero rows with NULL channel before adding NOT NULL.
- Adding NOT NULL on a non-trivial table can take a write lock; run migration off-hours.

## Verified Facts (pre-plan)
- Pricing engine (track 3) introduces enum `price_channel AS ENUM ('TRD','AKRA')`. **Reuse that enum** — do not create a duplicate `sales_channel`. Update this plan's reference accordingly.
- `sales_orders`, `sales_invoices`, `sales_quotations` already exist (017_sales.sql).
- `warehouses.code = 'W1'` maps to TRD per track 1's seed.
- POS write path: `app/api/pos/transactions/route.ts`. OMS write path: `app/api/sales-orders/route.ts` etc.

---

## Tasks

### T1 — Migration `046_channel_on_order_header.sql`
**File:** `migrations/046_channel_on_order_header.sql` (new)
**Operation:** add migration

**Details:**
- The `price_channel` enum is created by migration 043 (track 3); this migration assumes it exists.
- Wrap in `BEGIN; ... COMMIT;`:
  1. Add nullable columns first to allow backfill:
     - `ALTER TABLE sales_orders ADD COLUMN IF NOT EXISTS channel price_channel;`
     - `ALTER TABLE sales_invoices ADD COLUMN IF NOT EXISTS channel price_channel;`
     - `ALTER TABLE sales_quotations ADD COLUMN IF NOT EXISTS channel price_channel;`
  2. Backfill for each table:
     ```sql
     UPDATE sales_orders so SET channel='TRD'::price_channel
       FROM warehouses w WHERE w.id = so.warehouse_id AND w.code='W1' AND so.channel IS NULL;
     UPDATE sales_orders so SET channel='AKRA'::price_channel
       FROM warehouses w WHERE w.id = so.warehouse_id AND w.code <> 'W1' AND so.channel IS NULL;
     -- repeat for sales_quotations (has warehouse_id)
     -- sales_invoices does NOT have warehouse_id directly (see 017_sales.sql:169) — derive via JOIN sales_orders:
     UPDATE sales_invoices si SET channel = so.channel FROM sales_orders so WHERE so.id = si.so_id AND si.channel IS NULL;
     ```
  3. `ALTER TABLE ... ALTER COLUMN channel SET NOT NULL` for all three.
  4. Indexes:
     - `CREATE INDEX IF NOT EXISTS idx_sales_orders_channel ON sales_orders(channel, created_at DESC);`
     - `CREATE INDEX IF NOT EXISTS idx_sales_invoices_channel ON sales_invoices(channel, created_at DESC);`
     - `CREATE INDEX IF NOT EXISTS idx_sales_quotations_channel ON sales_quotations(channel, created_at DESC);`

**Quality Gate:**
- Transaction boundary: `BEGIN`/`COMMIT`.
- Doc number generation: N/A.
- Parent→child inserts: N/A.
- Side effects: none (no ledger writes).
- Response shape: N/A.

- [ ] T1 complete

### T2 — Stamp channel in POS routes
**File:** `app/api/pos/transactions/route.ts`
**Operation:** extend

**Details:**
- POS doesn't directly write `sales_orders`. If POS creates an SI via flows discovered with `Grep "INSERT INTO sales_invoices"`, ensure the insert sets `channel='TRD'`.
- For pos_transactions itself, no channel column is required (POS = TRD by definition); leave pos_transactions schema unchanged.

**Quality Gate:**
- Transaction boundary: existing preserved.
- Doc number generation: existing.
- Parent→child inserts: existing.
- Side effects: existing.
- Response shape: unchanged.

- [ ] T2 complete

### T3 — Stamp channel in OMS routes
**File:** `app/api/sales-orders/route.ts` + `app/api/sales-invoices/route.ts` + `app/api/sales-quotations/route.ts`
**Operation:** extend

**Details:**
- Zod schema gains `channel: z.enum(['TRD','AKRA']).optional()` (defaulting to `'AKRA'` for the OMS routes).
- Parent INSERT now includes `channel` column with value from body or default.
- Where the existing route is also used by POS-style flows, accept `'TRD'` as a value (gated by role/source — POS sessions only).

**Quality Gate:**
- Transaction boundary: existing `BEGIN`/`COMMIT` preserved.
- Doc number generation: existing.
- Parent→child inserts: parent now includes `channel`; children unchanged.
- Side effects: existing.
- Response shape: `apiSuccess({ ..., channel })`.

- [ ] T3 complete

### T4 — Type updates
**File:** `types/db.ts` (extend) + `types/index.ts` (re-export)
**Operation:** extend

**Details:**
- Add `channel: PriceChannel` to `SalesOrder`, `SalesInvoice`, `SalesQuotation` interfaces.

**Quality Gate:** N/A.

- [ ] T4 complete

### T5 — Wire channel into pricing-resolver call sites
**File:** all call sites of `resolvePrice` (introduced by track 3, T8)
**Operation:** extend

**Details:**
- Replace any hardcoded `'TRD'` / `'AKRA'` with the parent document's `channel` field.

**Quality Gate:** N/A (logic-only change).

- [ ] T5 complete

### T6 — UI channel badge + filter
**File:** locate via `Glob "app/app/sales-orders/page.tsx"`, `app/app/sales-invoices/page.tsx`, etc.
**Operation:** extend

**Details:**
- Render a small badge near the document number: `TRD` = blue, `AKRA` = green.
- Add `<Select>` filter `Channel: All | TRD | AKRA` that appends `?channel=...` to the list fetch.

**Quality Gate:** N/A (UI).

- [ ] T6 complete

### T7 — Update `current-state.md`
**File:** `_notes/02_Agent_Memory/current-state.md`
**Operation:** extend

**Details:** `sales_orders.channel price_channel NOT NULL`, same for `sales_invoices`, `sales_quotations`. Migration → 046.

- [ ] T7 complete

## Definition of Done

- [ ] All tasks T1..T7 ticked
- [ ] `npm run lint` + `npx tsc --noEmit` pass
- [ ] Migration idempotent
- [ ] Manual smoke: existing rows backfilled (no NULLs); new SO created via OMS = `AKRA`; new SI via POS = `TRD`
- [ ] `_notes/02_Agent_Memory/current-state.md` updated
- [ ] Status set to `Completed`

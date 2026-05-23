---
track: pricing-engine
phase: V2.0-P1
sequence: 3
status: Verified
owner: Chen
created: 2026-05-23
depends_on: []
estimate: L
assigned_to: [Paku]
tags: [v2-orion, pricing, tiers, contracts, schema]
---

# Pricing Engine — Channel + Tier + Contract

## Goal
Replace ad-hoc pricing logic with a single deterministic resolver that takes `(channel, customer_id, product_id, qty, at_date)` and returns the correct price by precedence: locked contract > customer tier > channel default. Adds T0/T1/T2/T3 tiers to members, `min_price` and `clr_min_price` to products, and a price-list table per channel/tier.

## Scope IN
- New table `product_prices(id, product_id, channel ENUM('TRD','AKRA'), tier ENUM('T0','T1','T2','T3'), price NUMERIC(14,4), valid_from DATE, valid_to DATE, created_at)` with `UNIQUE(product_id, channel, tier, valid_from)`.
- New table `customer_price_contracts(id, customer_id, product_id, locked_price NUMERIC(14,4), discount_pct NUMERIC(5,2), valid_from DATE, valid_to DATE, created_at)`.
- New columns: `products.min_price NUMERIC(14,4)`, `products.clr_min_price NUMERIC(14,4)`.
- New column: `pos_members.tier ENUM('T0','T1','T2','T3') DEFAULT 'T0'`.
- New helper `lib/pricing/resolve.ts: resolvePrice(channel, customer_id, product_id, qty, at_date) -> { price, source, applied_contract_id?, tier? }`.
- Bulk-import endpoint for price-list updates (admin).

## Scope OUT
- Promotional pricing (campaigns, time-bound discounts beyond `valid_from/to`). V2.2 candidate.
- Currency conversion — THB only.

## Acceptance Criteria
1. Resolver returns price by precedence: locked contract > tier-specific price > channel default (`T0`).
2. If no matching row, resolver returns null and caller responds with a clear "no price set" error.
3. `valid_from/valid_to` honored; future-dated rows do not leak into today's queries.
4. POS reads price via the resolver only (no inline `SELECT price FROM products`).
5. `npm run lint` and `npx tsc --noEmit` pass.

## Migrations
- `043_pricing_engine.sql` — create both tables, add `products.min_price` and `products.clr_min_price`, add `pos_members.tier`, seed tier `T0` for existing members.

## API routes
- New: `GET /api/pricing/resolve?channel=&customer_id=&product_id=&qty=&at_date=`.
- New: `POST /api/admin/product-prices/bulk` (CSV upload for price list).
- New: `GET/POST /api/admin/customer-price-contracts`.

## UI screens
- New: `app/admin/pricing/page.tsx` — price list per channel/tier with filter and bulk upload.
- New: `app/admin/customers/[id]/price-contracts/page.tsx` — manage locked-price contracts.
- Touched: POS line-add and OMS line-add call the resolver.

## Test plan
- Manual: create a T2 contract for one customer, change channel, confirm right price selected.
- Validate that overlapping `valid_from/valid_to` ranges per `(product_id, channel, tier)` are rejected by UNIQUE/CHECK.
- Lint + tsc.

## Risks
- Customers without an explicit tier default to `T0`; verify the resolver never crashes on missing tier rows.
- Bulk CSV upload must validate price > 0 and `valid_to >= valid_from`.

## Verified Facts (pre-plan)
- `products.id` is UUID; `unit_cost NUMERIC(15,2)` already exists (see `migrations/003_product_master.sql:29`). No `min_price`/`clr_min_price` columns exist yet.
- `pos_members.tier` already exists as `VARCHAR(20) NOT NULL DEFAULT 'standard'` (see `migrations/029_pos_improvements.sql:28`). This track must convert/extend that column — do **not** "ADD COLUMN" (it exists).
- `customers.id` is UUID.
- `sales_orders.warehouse_id` is UUID (017_sales.sql).

---

## Tasks

### T1 — Migration `043_pricing_engine.sql`
**File:** `migrations/043_pricing_engine.sql` (new)
**Operation:** add migration

**Details:**
- Top of file (outside transaction):
  - `DO $$ BEGIN CREATE TYPE price_channel AS ENUM ('TRD','AKRA'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;`
  - `DO $$ BEGIN CREATE TYPE price_tier AS ENUM ('T0','T1','T2','T3'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;`
- Wrap rest in `BEGIN; ... COMMIT;`:
  1. `ALTER TABLE products ADD COLUMN IF NOT EXISTS min_price NUMERIC(15,4) NOT NULL DEFAULT 0;`
  2. `ALTER TABLE products ADD COLUMN IF NOT EXISTS clr_min_price NUMERIC(15,4) NOT NULL DEFAULT 0;`
  3. **`pos_members.tier` already exists as VARCHAR(20).** Strategy: leave existing column intact; **add a new column** `pos_members.price_tier price_tier NOT NULL DEFAULT 'T0';` to avoid migrating mixed string values. Add `CREATE INDEX IF NOT EXISTS idx_pos_members_price_tier ON pos_members(price_tier);`. (Document deprecation of legacy `tier` column in `_notes/02_Agent_Memory/current-state.md` per ERP-V2 rollout rule.)
  4. `CREATE TABLE IF NOT EXISTS product_prices ( id UUID PRIMARY KEY DEFAULT gen_random_uuid(), product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE, channel price_channel NOT NULL, tier price_tier NOT NULL, price NUMERIC(15,4) NOT NULL CHECK (price >= 0), valid_from DATE NOT NULL, valid_to DATE, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE(product_id, channel, tier, valid_from), CHECK (valid_to IS NULL OR valid_to >= valid_from) );`
  5. `CREATE TABLE IF NOT EXISTS customer_price_contracts ( id UUID PRIMARY KEY DEFAULT gen_random_uuid(), customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE, product_id UUID REFERENCES products(id), locked_price NUMERIC(15,4), discount_pct NUMERIC(5,2), valid_from DATE NOT NULL, valid_to DATE, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), CHECK (locked_price IS NOT NULL OR discount_pct IS NOT NULL), CHECK (valid_to IS NULL OR valid_to >= valid_from) );`
  6. `CREATE INDEX IF NOT EXISTS idx_product_prices_lookup ON product_prices(product_id, channel, tier, valid_from);`
  7. `CREATE INDEX IF NOT EXISTS idx_customer_price_contracts_lookup ON customer_price_contracts(customer_id, product_id, valid_from);`

**Quality Gate:**
- Transaction boundary: `BEGIN`/`COMMIT` around ALTER+CREATE (enums outside).
- Doc number generation: N/A.
- Parent→child inserts: N/A (DDL only).
- Side effects: none.
- Response shape: N/A.

- [ ] T1 complete

### T2 — `lib/pricing/resolve.ts`
**File:** `lib/pricing/resolve.ts` (new)
**Operation:** create

**Details:**
- Export:
  ```ts
  export interface PriceResolution {
    price: number;
    source: 'contract' | 'tier' | 'fallback';
    applied_contract_id?: string;
    tier?: 'T0' | 'T1' | 'T2' | 'T3';
  }
  export async function resolvePrice(args: {
    channel: 'TRD' | 'AKRA';
    customer_id: string | null;
    product_id: string;
    qty: number;
    at_date?: string; // ISO date; default today
  }): Promise<PriceResolution | null>
  ```
- Implementation precedence:
  1. **Contract**: `SELECT id, locked_price, discount_pct FROM customer_price_contracts WHERE customer_id=$1 AND (product_id=$2 OR product_id IS NULL) AND valid_from <= $3 AND (valid_to IS NULL OR valid_to >= $3) ORDER BY product_id NULLS LAST LIMIT 1`. If `locked_price` present → return `{price: locked_price, source: 'contract', applied_contract_id}`. If `discount_pct` present → fall through to tier lookup, then apply discount.
  2. **Tier**: read `pos_members.price_tier` for customer (or default `T0` for non-member POS). `SELECT price FROM product_prices WHERE product_id=$1 AND channel=$2 AND tier=$3 AND valid_from <= $4 AND (valid_to IS NULL OR valid_to >= $4) ORDER BY valid_from DESC LIMIT 1`. Return `{price, source: 'tier', tier}`.
  3. **Fallback**: `SELECT unit_cost FROM products WHERE id=$1`; return `{price: unit_cost, source: 'fallback'}`.
- If query throws or product not found → return `null`.

**Quality Gate:**
- Transaction boundary: read-only — no transaction needed; but the entire resolution must run on a single `pool.connect()` client for consistency (use `pool.query()`).
- Doc number generation: N/A.
- Parent→child inserts: N/A.
- Side effects: none.
- Response shape: `PriceResolution | null`.

- [ ] T2 complete

### T3 — Types
**File:** `types/db.ts` (extend) + `types/index.ts` (re-export)
**Operation:** extend

**Details:**
- Add: `PriceChannel = 'TRD' | 'AKRA'`, `PriceTier = 'T0'|'T1'|'T2'|'T3'`, `ProductPrice`, `CustomerPriceContract`, `PriceResolution` (re-export from `lib/pricing/resolve.ts`).

**Quality Gate:** N/A.

- [ ] T3 complete

### T4 — `GET /api/pricing/resolve`
**File:** `app/api/pricing/resolve/route.ts` (new)
**Operation:** create

**Details:**
- Standard auth preamble.
- `assertPermission(u, 'pos:operate')` OR fallback to any authenticated user; for V2.0 allow any authenticated user.
- Parse query string with Zod: `channel`, `customer_id?`, `product_id` (uuid), `qty` (number), `at_date?` (YYYY-MM-DD).
- Call `resolvePrice(...)`.
- Return `apiSuccess({ resolution })` or `apiError('Price not configured', 404)` if `null`.

**Quality Gate:**
- Transaction boundary: N/A (read).
- Doc number generation: N/A.
- Parent→child inserts: N/A.
- Side effects: none.
- Response shape: `apiSuccess({ resolution: PriceResolution })` or 404.

- [ ] T4 complete

### T5 — `POST /api/admin/product-prices/bulk` + `GET`
**File:** `app/api/admin/product-prices/bulk/route.ts` (new)
**Operation:** create

**Details:**
- POST: accept JSON `{ rows: ProductPrice[] }` with Zod validation. `assertRole(u, ['admin','manager'])`.
- Wrap inserts in transaction: `BEGIN; INSERT ... ON CONFLICT (product_id, channel, tier, valid_from) DO UPDATE SET price=EXCLUDED.price, valid_to=EXCLUDED.valid_to; COMMIT;`
- On error: `ROLLBACK` and return `apiError(err.message, 400)`.
- Return `apiSuccess({ inserted: rows.length })`.

**Quality Gate:**
- Transaction boundary: explicit `BEGIN`/`COMMIT`/`ROLLBACK` for the bulk write.
- Doc number generation: N/A.
- Parent→child inserts: parent = none; each row is independent.
- Side effects: none.
- Response shape: `apiSuccess({ inserted: number })`.

- [ ] T5 complete

### T6 — `GET/POST /api/admin/customer-price-contracts`
**File:** `app/api/admin/customer-price-contracts/route.ts` (new)
**Operation:** create

**Details:**
- GET: list with optional `customer_id` filter; `assertRole(u, ['admin','manager','auditor'])`.
- POST: insert row, validate exactly one of `locked_price`/`discount_pct` provided. `assertRole(u, ['admin','manager'])`.
- Single INSERT (no parent/child).

**Quality Gate:**
- Transaction boundary: single statement — no transaction needed.
- Doc number generation: N/A.
- Parent→child inserts: N/A.
- Side effects: none.
- Response shape: `apiSuccess({ contract })` (POST) / `apiSuccess({ data })` (GET).

- [ ] T6 complete

### T7 — Admin pricing UI
**File:** `app/admin/pricing/page.tsx` (new) + `app/admin/customers/[id]/price-contracts/page.tsx` (new)
**Operation:** create

**Details:**
- `'use client'`. Components from `components/ui/index.ts`. Basic CRUD tables for price-list and contracts. CSV upload textarea for bulk.

**Quality Gate:** N/A (UI).

- [ ] T7 complete

### T8 — Wire resolver into POS & OMS line-add
**File:** `app/api/pos/transactions/route.ts` + `app/api/sales-orders/route.ts` + `app/api/sales-invoices/route.ts`
**Operation:** extend

**Details:**
- At each insert path (line creation), call `resolvePrice(...)` to determine the unit_price (replace inline `SELECT price FROM products`).
- If resolver returns `null` → return `apiError('No price configured for this product/channel', 422)`.
- Channel argument comes from track 7 (`channel-on-order-header`); until that ships, hard-default to `'TRD'` for POS and `'AKRA'` for sales-orders/sales-invoices.

**Quality Gate:**
- Transaction boundary: insert paths are already inside `BEGIN`/`COMMIT` blocks for POS/SO/SI — preserve.
- Doc number generation: pre-existing (`SO`, `SI`, `RCP`).
- Parent→child inserts: existing parent (order/transaction) → children (line items) preserved.
- Side effects: pre-existing stock_ledger writes on confirm.
- Response shape: unchanged on success; new `422` on missing price.

- [ ] T8 complete

### T9 — Update `current-state.md`
**File:** `_notes/02_Agent_Memory/current-state.md`
**Operation:** extend

**Details:** Append: `product_prices(product_id, channel, tier, price, valid_from, valid_to)` UNIQUE; `customer_price_contracts(customer_id, product_id, locked_price, discount_pct, valid_from, valid_to)`; `products.min_price`, `products.clr_min_price`; `pos_members.price_tier price_tier DEFAULT 'T0'` (legacy `tier VARCHAR(20)` kept). Migration → 043.

- [ ] T9 complete

## Definition of Done

- [ ] All tasks T1..T9 ticked
- [ ] `npm run lint` passes
- [ ] `npx tsc --noEmit` passes
- [ ] Migration runs idempotently
- [ ] Manual smoke: resolve a T2-locked contract → price returned; resolve missing → 404
- [ ] `_notes/02_Agent_Memory/current-state.md` updated
- [ ] Status set to `Completed` in `conductor/index.md`

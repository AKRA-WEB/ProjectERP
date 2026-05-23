---
track: wholecase-strict-lock-akra
phase: V2.0-P1
sequence: 15
status: planned
owner: Chen
created: 2026-05-23
depends_on: [channel-on-order-header]
estimate: S
assigned_to: [Paku, Puka]
tags: [v2-orion, uom, channel, akra, guard]
---

# Whole-Case Strict Lock (AKRA Channel)

## Goal
Akra Wholesale must never sell loose pieces — only whole cases. Enforce a per-product whitelist of UoMs per channel; reject any AKRA order line with a UoM outside the whitelist.

## Scope IN
- New table `product_channel_uoms(id, product_id, channel sales_channel, allowed_uoms TEXT[], created_at)` with `UNIQUE(product_id, channel)`.
- Default seed: for every product with case UoM defined, allowed_uoms=['case'] under AKRA channel.
- Guard inserted into `POST /api/oms/orders` and PATCH: if `channel='AKRA'` and submitted UoM not in `allowed_uoms`, return 422 `UOM_NOT_ALLOWED { allowed_uoms }`.
- POS (TRD) is unaffected.

## Scope OUT
- Per-customer UoM overrides (e.g. VIP customer allowed loose). Future revision.
- Allowed UoMs management UI beyond a basic admin page.

## Acceptance Criteria
1. Posting an AKRA order line with a non-allowed UoM returns 422.
2. POS order with TRD channel and any UoM remains unaffected.
3. Bulk-update endpoint can set allowed_uoms for many products at once.
4. Existing AKRA orders before migration are not retroactively rejected (only new writes are blocked).
5. `npm run lint` and `npx tsc --noEmit` pass.

## Migrations
- `054_wholecase_strict_lock.sql` — create table, seed AKRA whitelist for all products with a case UoM, foreign-key to products.

## API routes
- New: `GET/PATCH /api/admin/product-channel-uoms`.
- Touched: `app/api/oms/orders/route.ts` and `[id]/route.ts`.

## UI screens
- New: `app/admin/product-channel-uoms/page.tsx`.
- Touched: OMS line editor — UoM dropdown filtered to allowed list.

## Test plan
- Manual: try AKRA order with `each` UoM, confirm 422. Switch to `case`, confirm accepted.
- TRD same SKU each UoM works.
- Lint + tsc.

## Risks
- Products without a case UoM defined accidentally end up with empty allowed_uoms -> AKRA can't sell them at all. Add visibility/report on AKRA-sellable status.
- UoM string casing — normalise lowercase on both write and check.

## Verified Facts (pre-plan)
- `price_channel` enum from track 3 = `('TRD','AKRA')`.
- `products.uom_id` references `units_of_measure` (003_product_master.sql:28).
- UoM framework arrives via `migrations/026_uom_framework.sql` (per file list); read to understand the product UoM tables.
- OMS routes: `app/api/sales-orders/route.ts`, `app/api/sales-orders/[id]/route.ts`. POS is unaffected.

---

## Tasks

### T1 — Migration `054_wholecase_strict_lock.sql`
**File:** `migrations/054_wholecase_strict_lock.sql` (new)
**Operation:** add migration

**Details:**
- Wrap in `BEGIN; ... COMMIT;`:
  1. `CREATE TABLE IF NOT EXISTS product_channel_uoms ( id UUID PRIMARY KEY DEFAULT gen_random_uuid(), product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE, channel price_channel NOT NULL, allowed_uoms TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[], created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE(product_id, channel) );`
  2. `CREATE INDEX IF NOT EXISTS idx_product_channel_uoms_lookup ON product_channel_uoms(product_id, channel);`
  3. Seed: for every product, insert an AKRA row with `allowed_uoms = ARRAY[<base uom code>]`. Implementation depends on UoM table — read `migrations/026_uom_framework.sql` for the code column. Skeleton:
     ```sql
     INSERT INTO product_channel_uoms (product_id, channel, allowed_uoms)
     SELECT p.id, 'AKRA'::price_channel, ARRAY[LOWER(uom.code)]::TEXT[]
       FROM products p JOIN units_of_measure uom ON uom.id = p.uom_id
      ON CONFLICT (product_id, channel) DO NOTHING;
     ```

**Quality Gate:**
- Transaction boundary: `BEGIN`/`COMMIT`.
- Doc number generation: N/A.
- Parent→child inserts: N/A.
- Side effects: none.
- Response shape: N/A.

- [ ] T1 complete

### T2 — Enforce in `POST /api/sales-orders`
**File:** `app/api/sales-orders/route.ts`
**Operation:** extend

**Details:**
- After Zod validation, when `channel === 'AKRA'`:
  - For each line, query `SELECT allowed_uoms FROM product_channel_uoms WHERE product_id=$1 AND channel='AKRA'`.
  - The line UoM must be derived from the request body (or from `products.uom_id` if not specified). Normalise to lowercase.
  - If the line's UoM not in `allowed_uoms` → return `apiError('UoM not allowed for AKRA channel', 422, { code: 'UOM_NOT_ALLOWED', product_id, allowed_uoms })`.
- Apply BEFORE parent INSERT to keep transaction clean.

**Quality Gate:**
- Transaction boundary: existing `BEGIN`/`COMMIT`/`ROLLBACK` preserved.
- Doc number generation: existing.
- Parent→child inserts: existing.
- Side effects: existing.
- Response shape: existing + 422 with `UOM_NOT_ALLOWED` on block.

- [ ] T2 complete

### T3 — `PATCH /api/sales-orders/[id]` enforcement
**File:** `app/api/sales-orders/[id]/route.ts`
**Operation:** extend

**Details:** Same guard as T2 in any action that mutates lines (`body.action === 'update_lines'` etc.).

**Quality Gate:** As T2. Others N/A.

- [ ] T3 complete

### T4 — Admin API + UI for managing channel UoMs
**File:** `app/api/admin/product-channel-uoms/route.ts` (new) + `app/admin/product-channel-uoms/page.tsx` (new)
**Operation:** create

**Details:**
- GET: list rows with optional product/channel filter; `assertRole(u, ['admin','manager','auditor'])`.
- PATCH/POST: upsert single row; `assertRole(u, ['admin','manager'])`.
- UI: table with product, channel, allowed UoMs editor (chip-style multi-select).

**Quality Gate:**
- Transaction boundary: single statement upsert — no transaction needed.
- Doc number generation: N/A.
- Parent→child inserts: N/A.
- Side effects: none.
- Response shape: `apiSuccess({ row })` (PATCH); `apiSuccess({ data })` (GET).

- [ ] T4 complete

### T5 — OMS line editor: filter UoM dropdown
**File:** locate OMS line editor (`Glob "app/app/sales-orders/**.tsx"`)
**Operation:** extend

**Details:**
- When channel='AKRA', fetch `/api/admin/product-channel-uoms?product_id=&channel=AKRA` and restrict the UoM dropdown options to `allowed_uoms`.

**Quality Gate:** N/A (UI).

- [ ] T5 complete

### T6 — Update `current-state.md`
**File:** `_notes/02_Agent_Memory/current-state.md`
**Operation:** extend

**Details:** `product_channel_uoms(product_id, channel, allowed_uoms TEXT[])`. Migration → 054. OMS routes return 422 `UOM_NOT_ALLOWED` for AKRA channel violations.

- [ ] T6 complete

## Definition of Done

- [ ] T1..T6 ticked
- [ ] `npm run lint` + `npx tsc --noEmit` pass
- [ ] Manual smoke: AKRA SO with `each` UoM → 422; switch to `case` → OK; same product on TRD with `each` → OK
- [ ] Migration idempotent
- [ ] `_notes/02_Agent_Memory/current-state.md` updated
- [ ] Status set to `Completed`

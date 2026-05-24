---
track: min-price-hardstop
phase: V2.0-P1
sequence: 5
status: Verified
owner: Chen
created: 2026-05-23
updated: 2026-05-23
depends_on: [pricing-engine, manager-override-pin]
estimate: M
assigned_to: [Paku, Puka]
tags: [v2-orion, pricing, guard, override]
---

# Min-Price Hard Stop

## Goal
Hard-block any sales line where `unit_price < products.min_price` unless an in-flight manager override token is presented. Clearance stock (in `V-CLR`) falls back to `products.clr_min_price` instead.

## Scope IN
- Server-side guard inserted into every endpoint that creates/updates a sales line: POS line save, sales-order POST/PATCH, sales-invoice POST/PATCH.
- Resolver: if the source location is `V-CLR`, compare against `clr_min_price`, else `min_price`.
- Inline PIN modal triggered on the client when the server returns `409 MIN_PRICE_VIOLATION { min_price, reason_codes:[...] }`.
- Reason codes seed list: `bulk-deal`, `damaged-discount`, `customer-retention`, `promo-mismatch`, `other`.
- Each override logs to `override_audit` with the original price and approved price.

## Scope OUT
- Bulk-pricing promotional overrides — V2.2.
- Per-customer min price (use customer-price-contracts in track #3 instead).

## Acceptance Criteria
1. Submitting `unit_price < min_price` without a token returns HTTP 409 `MIN_PRICE_VIOLATION`.
2. Re-submitting with a valid override token allows the line; an `override_audit` row is written.
3. Lines whose source location is `V-CLR` are validated against `clr_min_price`.
4. POS UI shows the modal automatically on 409 and retries on PIN approval.
5. `npm run lint` and `npx tsc --noEmit` pass.

## Migrations
- None (columns added in track #3). New helper module only.

## API routes
- Touched: `app/api/pos/orders/route.ts`, `app/api/pos/orders/[id]/route.ts`.
- Touched: `app/api/sales/orders/route.ts`, `app/api/sales/orders/[id]/route.ts`.
- Touched: `app/api/sales/invoices/route.ts`, `app/api/sales/invoices/[id]/route.ts`.
- New helper: `lib/pricing/enforceMinPrice.ts`.

## UI screens
- Touched: POS line editor — wires `<OverridePinModal>` to the 409 flow.
- Touched: Sales order / invoice edit pages — same wiring.

## Test plan
- Manual: try selling below min, confirm block; provide PIN, confirm sale and audit entry.
- Confirm V-CLR sale below `min_price` but >= `clr_min_price` is allowed without PIN.
- Lint + tsc.

## Risks
- Off-by-one rounding when comparing `unit_price * qty` vs `min_price * qty`. Compare per-unit only.
- Missed edit endpoint that bypasses the guard — checklist must cover every POS/SO/SI write path.

## Verified Facts (pre-plan)
- `products.min_price` and `products.clr_min_price` arrive in track 3 (`pricing-engine`) migration 043 — depends_on is correct.
- Override audit table `override_audit(jti UNIQUE, ...)` and `consumeOverrideToken` arrive in track 4 — also depends_on.
- Existing POS write paths verified: `app/api/pos/transactions/route.ts`, `app/api/pos/transactions/[id]/route.ts`, `app/api/pos/held-carts/route.ts`, `app/api/pos/held-carts/[id]/route.ts`. There is **no** `app/api/pos/orders/route.ts` — original plan's path was wrong; correct path uses `pos/transactions`.
- Existing OMS write paths: `app/api/sales-orders/route.ts`, `app/api/sales-invoices/route.ts`, `app/api/sales-quotations/route.ts`.
- No virtual-location wiring on existing stock yet — V-CLR detection in V2.0 must check via the line's source warehouse code (treat `warehouse.code='V-CLR'` if seeded as a separate warehouse, OR via `virtual_locations.code` once integrated; for V2.0 hardstop use a `clearance_flag` boolean passed from the call site).

---

## Tasks

### T1 — Guard helper `lib/pricing/enforce-min-price.ts`
**File:** `lib/pricing/enforce-min-price.ts` (new)
**Operation:** create

**Details:**
- Export:
  ```ts
  export type MinPriceContext = {
    product_id: string;
    unit_price: number;
    is_clearance: boolean;
    override_token?: string;
    user_id: string;
    target_table: 'sales_orders' | 'sales_invoices' | 'pos_transactions' | 'sales_quotations';
    target_id: string;
    reason_code?: string;
  };
  export async function enforceMinPrice(ctx: MinPriceContext): Promise<void>; // throws apiError-shaped errors with status 409
  ```
- Query: `SELECT min_price, clr_min_price FROM products WHERE id=$1`.
- Determine threshold: `is_clearance ? clr_min_price : min_price`.
- If `unit_price >= threshold` → return.
- If `override_token` absent → throw error with payload `{ code: 'MIN_PRICE_VIOLATION', min_price: threshold, reason_codes: ['bulk-deal','damaged-discount','customer-retention','promo-mismatch','other'] }` and HTTP 409.
- If `override_token` present → call `consumeOverrideToken(override_token, 'min_price_override', { target_table, target_id, reason_code, original_value: { unit_price: threshold }, override_value: { unit_price }, user_id })` from track 4. Replay or invalid token → 401/409.

**Quality Gate:**
- Transaction boundary: helper itself does not wrap a transaction; caller may be inside one. The `override_audit` insert (from `consumeOverrideToken`) participates in caller's transaction via the same `pool` if invoked from a connection — for V2.0 use `pool.query` (auto-commit) since `override_audit` is intentionally orthogonal to the business write.
- Doc number generation: N/A.
- Parent→child inserts: N/A.
- Side effects: writes one `override_audit` row on successful override.
- Response shape: throws structured error; caller transforms via `apiError(message, 409, { code, min_price, reason_codes })` — extend `apiError` to pass extras if not already supported.

- [x] T1 complete

### T2 — Wire into `POST /api/sales-orders`
**File:** `app/api/sales-orders/route.ts`
**Operation:** extend

**Details:**
- In POST handler, after Zod validation and before parent INSERT, for each `line` call `enforceMinPrice({ product_id: line.product_id, unit_price: line.unit_price, is_clearance: false, override_token: body.override_token, user_id: u.id, target_table: 'sales_orders', target_id: '<computed-after-insert>', reason_code: body.reason_code })`. Because `target_id` requires the new SO row's id, perform the check **before** insert with `target_id: 'pending'`; pass the real id to `override_audit` post-insert via an additional `consumeOverrideToken` argument (the override must occur after parent INSERT but inside the transaction — restructure: insert parent first, validate prices using parent id, abort on 409 via `ROLLBACK`).
- All line validations inside `BEGIN; ... COMMIT;` — on 409, `ROLLBACK` and return `apiError(...)`.

**Quality Gate:**
- Transaction boundary: `BEGIN`/`COMMIT`/`ROLLBACK` — parent insert, line guards, child inserts all in one block.
- Doc number generation: existing `next_doc_number('SO','seq_so')` (auto via DEFAULT).
- Parent→child inserts: `INSERT INTO sales_orders ... RETURNING id` → FOR EACH line: enforce check → `INSERT INTO so_line_items (so_id, ...)`.
- Side effects: on override approval → one `override_audit` row per violating line.
- Response shape: `apiSuccess({ sales_order })` on success; `apiError('Min price violation', 409, { code: 'MIN_PRICE_VIOLATION', min_price, reason_codes })` on block.

- [x] T2 complete

### T3 — Wire into `POST/PATCH /api/sales-invoices`
**File:** `app/api/sales-invoices/route.ts` + `app/api/sales-invoices/[id]/route.ts`
**Operation:** extend

**Details:**
- POST `sales_invoices` derives lines from `delivery_orders` → `do_line_items`. Apply `enforceMinPrice` to each derived line's `unit_price` before the parent insert; on 409 → return 409 (no rollback needed since no insert yet).
- PATCH (action discriminant `body.action`): when the action mutates prices (e.g. `action: 'update_lines'`), re-run `enforceMinPrice` against each line.
- Same wrap-in-transaction rule as T2 if any write happens.

**Quality Gate:**
- Transaction boundary: existing `BEGIN`/`COMMIT` preserved; ROLLBACK on 409.
- Doc number generation: existing `next_doc_number('SI','seq_si')` preserved.
- Parent→child inserts: invoice header → derived line items (existing pattern).
- Side effects: override_audit on override.
- Response shape: `apiSuccess({ sales_invoice })` / `apiError('Min price violation', 409, {...})`.

- [x] T3 complete

### T4 — Wire into POS endpoints
**File:** `app/api/pos/transactions/route.ts` + `app/api/pos/transactions/[id]/route.ts` + `app/api/pos/held-carts/route.ts` + `app/api/pos/held-carts/[id]/route.ts`
**Operation:** extend

**Details:**
- For every endpoint that accepts a line with `unit_price`, call `enforceMinPrice(...)` per line.
- POS held-carts may store lines as draft — apply the guard at **finalize/checkout** time only (not on hold save).

**Quality Gate:**
- Transaction boundary: existing POS checkout transaction preserved; ROLLBACK on 409.
- Doc number generation: existing `RCP` series.
- Parent→child inserts: `pos_transactions` → `pos_transaction_lines` (verify exact child table name via Grep).
- Side effects: override_audit on override; stock_ledger writes unchanged.
- Response shape: existing on success; 409 with reason codes on block.

- [x] T4 complete

### T5 — POS UI inline override modal
**File:** locate POS line editor via `Grep "pos.*line.*price"` (likely `app/app/pos/**`).
**Operation:** extend

**Details:**
- On 409 with `code: 'MIN_PRICE_VIOLATION'`, open `<OverridePinModal>` (from track 4) prefilled with the violated line and a reason-code dropdown sourced from the API response.
- On approval, re-submit the original request with `override_token` and `reason_code` set.

**Quality Gate:** N/A (UI).

- [x] T5 complete

### T6 — OMS UI inline override modal
**File:** locate OMS/SO/SI line editor — likely `app/app/sales-orders/[id]/page.tsx` and `app/app/sales-invoices/[id]/page.tsx`.
**Operation:** extend

**Details:** Same UX as T5 — modal on 409 → retry with `override_token`+`reason_code`.

**Quality Gate:** N/A (UI).

- [x] T6 complete

### T7 — Update `current-state.md`
**File:** `_notes/02_Agent_Memory/current-state.md`
**Operation:** extend

**Details:**
- API behavior: 409 `MIN_PRICE_VIOLATION` returned by SO/SI/POS line write endpoints when `unit_price < threshold`.
- New helper: `lib/pricing/enforce-min-price.ts`.

- [x] T7 complete

## Definition of Done

- [x] All tasks T1..T7 ticked
- [x] `npm run lint` passes
- [x] `npx tsc --noEmit` passes
- [x] Manual smoke:
  - Submit SO with `unit_price < min_price` → 409
  - Resubmit with valid override_token → 200, audit row written
  - Set `is_clearance=true` AND `unit_price < min_price` AND `unit_price >= clr_min_price` → allowed
- [x] `_notes/02_Agent_Memory/current-state.md` updated
- [x] Status set to `Completed` in `conductor/index.md`


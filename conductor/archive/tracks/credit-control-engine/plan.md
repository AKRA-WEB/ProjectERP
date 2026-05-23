---
track: credit-control-engine
phase: V2.0-P1
sequence: 6
status: Verified
owner: Chen
created: 2026-05-23
depends_on: [manager-override-pin]
estimate: M
assigned_to: [Paku]
tags: [v2-orion, credit, ar, guard]
---

# Credit Control Engine

## Goal
Block new orders when a customer is over their credit limit or has any invoice aged >= 1 day past due, in real time at order open. Allow release via full payment or an exec-level manager override.

## Scope IN
- New column `customers.on_hold BOOLEAN DEFAULT false`.
- New table `customer_credit_holds(id, customer_id, reason TEXT, started_at, released_at, released_by, released_reason)`.
- Helper `lib/credit/checkCreditStatus(customer_id) -> { on_hold, reason, outstanding, max_aging_days, can_override }`.
- Wire into `POST /api/oms/orders` (AKRA) and `POST /api/pos/orders` (TRD when customer attached).
- Exec override flow consumes a manager-override token with `action='credit_release'`; writes both to `override_audit` and to `customer_credit_holds.released_*`.
- Nightly job to recompute aging and stamp/clear `customers.on_hold`.

## Scope OUT
- Per-customer credit limit by BU — single limit in V2.0; V2.2 may split.
- Automatic payment-reminder emails. Out of scope.

## Acceptance Criteria
1. Order POST returns `412 CREDIT_HOLD { reason, outstanding, max_aging_days }` when the customer is on hold.
2. After full payment is recorded, the next order open finds the customer not on hold (no manual unlock).
3. Exec override with valid token allows the order; both audit tables are written.
4. Nightly job is idempotent — re-running on the same day yields the same hold state.
5. `npm run lint` and `npx tsc --noEmit` pass.

## Migrations
- `045_credit_control_engine.sql` — add column + create table + index on `(customer_id, released_at)`.

## API routes
- New: `GET /api/customers/[id]/credit-status`.
- New: `POST /api/customers/[id]/credit-release` (consumes override token).
- Touched: `app/api/oms/orders/route.ts`, `app/api/pos/orders/route.ts`.

## UI screens
- Touched: POS / OMS order entry — block screen + override modal.
- New: `app/sales/credit-holds/page.tsx` — list of on-hold customers, release action.

## Test plan
- Manual: simulate overdue invoice, open order, confirm block.
- Pay overdue, retry, confirm allowed.
- Override with exec PIN, confirm audit row.
- Lint + tsc.

## Risks
- Aging definition must match accounting policy exactly — sign off with finance before launch.
- Concurrent override + payment race: ensure idempotency on `customer_credit_holds.released_at`.

## Verified Facts (pre-plan)
- `customers.id` is UUID; `customers.credit_limit NUMERIC(15,2) NOT NULL DEFAULT 0` and `payment_terms_days INTEGER` exist (see `migrations/017_sales.sql:53`).
- `sales_invoices.due_date`, `total_amount`, `paid_at` exist. Status enum `si_status` includes `'paid'` and `'void'`.
- No `on_hold` column on `customers` yet.
- Existing OMS write route is **`app/api/sales-orders/route.ts`** (not `app/api/oms/orders/route.ts`). Update plan accordingly.
- Existing POS write route is **`app/api/pos/transactions/route.ts`** (not `app/api/pos/orders/route.ts`).

---

## Tasks

### T1 — Migration `045_credit_control_engine.sql`
**File:** `migrations/045_credit_control_engine.sql` (new)
**Operation:** add migration

**Details:**
- Wrap in `BEGIN; ... COMMIT;`:
  1. `ALTER TABLE customers ADD COLUMN IF NOT EXISTS on_hold BOOLEAN NOT NULL DEFAULT FALSE;`
  2. `CREATE TABLE IF NOT EXISTS customer_credit_holds ( id UUID PRIMARY KEY DEFAULT gen_random_uuid(), customer_id UUID NOT NULL REFERENCES customers(id), reason TEXT NOT NULL, started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), released_at TIMESTAMPTZ, released_by UUID REFERENCES users(id), released_reason TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW() );`
  3. `CREATE INDEX IF NOT EXISTS idx_customer_credit_holds_open ON customer_credit_holds(customer_id) WHERE released_at IS NULL;`
  4. `CREATE INDEX IF NOT EXISTS idx_customers_on_hold ON customers(on_hold) WHERE on_hold = TRUE;`

**Quality Gate:**
- Transaction boundary: `BEGIN`/`COMMIT`.
- Doc number generation: N/A.
- Parent→child inserts: N/A.
- Side effects: none.
- Response shape: N/A.

- [ ] T1 complete

### T2 — Helper `lib/credit/check-credit-status.ts`
**File:** `lib/credit/check-credit-status.ts` (new)
**Operation:** create

**Details:**
- Export:
  ```ts
  export interface CreditStatus {
    on_hold: boolean;
    outstanding: number;
    credit_limit: number;
    max_aging_days: number;
    reason?: string;
    can_override: boolean;
  }
  export async function checkCreditStatus(customerId: string): Promise<CreditStatus>
  ```
- Single SQL: `SELECT c.credit_limit, c.on_hold, COALESCE(SUM(si.total_amount - COALESCE(si.paid_amount,0)),0) AS outstanding, MAX(GREATEST(0, CURRENT_DATE - si.due_date))::INT AS max_aging_days FROM customers c LEFT JOIN sales_invoices si ON si.customer_id=c.id AND si.status IN ('issued') AND si.paid_at IS NULL WHERE c.id=$1 GROUP BY c.id`. (Verify column name `paid_amount` on `sales_invoices` — if absent, treat unpaid as `paid_at IS NULL`.)
- Compute:
  - `on_hold = (outstanding > credit_limit) OR (max_aging_days >= 1)` OR existing `customers.on_hold = true`.
  - `reason = on_hold ? 'over_limit_or_aging' : null`.
  - `can_override = true` always (only managers may consume the token).

**Quality Gate:**
- Transaction boundary: read-only.
- Doc number generation: N/A.
- Parent→child inserts: N/A.
- Side effects: none.
- Response shape: `CreditStatus`.

- [ ] T2 complete

### T3 — `GET /api/customers/[id]/credit-status`
**File:** `app/api/customers/[id]/credit-status/route.ts` (new)
**Operation:** create

**Details:**
- Auth preamble. `assertRole(u, ['admin','manager','staff','auditor'])` (any logged-in user can read for their own workflow).
- Call `checkCreditStatus(id)`. `apiSuccess({ status: CreditStatus })`.

**Quality Gate:** Response shape: `apiSuccess({ status: CreditStatus })`. Others N/A.

- [ ] T3 complete

### T4 — `POST /api/customers/[id]/credit-release`
**File:** `app/api/customers/[id]/credit-release/route.ts` (new)
**Operation:** create

**Details:**
- Auth; `assertRole(u, ['manager','admin'])`.
- Zod: `{ override_token: z.string(), released_reason: z.string().min(3) }`.
- Wrap in `BEGIN; ... COMMIT;`:
  1. `consumeOverrideToken(override_token, 'credit_release', { user_id: u.id, target_table: 'customers', target_id: id, original_value: {on_hold: true}, override_value: {on_hold: false}, reason_code: 'manual_release' })` (writes `override_audit` row; on replay → throw → ROLLBACK + 401).
  2. `UPDATE customer_credit_holds SET released_at=NOW(), released_by=$1, released_reason=$2 WHERE customer_id=$3 AND released_at IS NULL`.
  3. `UPDATE customers SET on_hold=FALSE WHERE id=$1`.
- Return `apiSuccess({ released: true })`.

**Quality Gate:**
- Transaction boundary: `BEGIN`/`COMMIT`/`ROLLBACK`.
- Doc number generation: N/A.
- Parent→child inserts: token consume writes parent `override_audit`; then UPDATE on hold + customer.
- Side effects: `override_audit` insert + 2 UPDATEs.
- Response shape: `apiSuccess({ released: true })`.

- [ ] T4 complete

### T5 — Wire guard into `POST /api/sales-orders`
**File:** `app/api/sales-orders/route.ts`
**Operation:** extend

**Details:**
- Before parent INSERT, call `checkCreditStatus(body.customer_id)`. If `on_hold=true` and no valid `override_token` provided → return `apiError('Credit hold', 412, { code: 'CREDIT_HOLD', outstanding, max_aging_days })`.
- If `override_token` provided and `consumeOverrideToken(token, 'credit_release', ...)` succeeds → proceed.
- All inside the existing `BEGIN`/`COMMIT`.

**Quality Gate:**
- Transaction boundary: `BEGIN`/`COMMIT`/`ROLLBACK` preserved.
- Doc number generation: `next_doc_number('SO','seq_so')` (DEFAULT).
- Parent→child inserts: sales_orders → so_line_items (existing).
- Side effects: stock reservation unchanged; +override_audit on override.
- Response shape: `apiSuccess({ sales_order })` / `apiError('Credit hold', 412, {...})`.

- [ ] T5 complete

### T6 — Wire guard into POS checkout
**File:** `app/api/pos/transactions/route.ts`
**Operation:** extend

**Details:**
- Only check when `body.member_id` is set (cash-only POS skips). Otherwise same flow as T5.

**Quality Gate:**
- Transaction boundary: existing checkout `BEGIN`/`COMMIT`/`ROLLBACK` preserved.
- Doc number generation: `next_doc_number('RCP','seq_pos')` (existing DEFAULT).
- Parent→child inserts: pos_transactions → pos_transaction_lines.
- Side effects: stock_ledger (`pos_sale`) preserved.
- Response shape: `apiError('Credit hold', 412, {...})` on block.

- [ ] T6 complete

### T7 — Nightly aging sweep `lib/jobs/credit-aging-sweep.ts`
**File:** `lib/jobs/credit-aging-sweep.ts` (new)
**Operation:** create

**Details:**
- Export `runCreditAgingSweep(): Promise<{ updated: number }>`.
- Single SQL (idempotent):
  ```sql
  WITH delinquent AS (
    SELECT customer_id FROM sales_invoices
    WHERE paid_at IS NULL AND due_date < CURRENT_DATE
    GROUP BY customer_id
  )
  UPDATE customers SET on_hold = TRUE WHERE id IN (SELECT customer_id FROM delinquent) AND on_hold = FALSE;
  ```
- INSERT a `customer_credit_holds` row (reason='aging_sweep') for each newly-held customer.
- Wrap in `BEGIN; ... COMMIT;`.

**Quality Gate:**
- Transaction boundary: `BEGIN`/`COMMIT`.
- Doc number generation: N/A.
- Parent→child inserts: customers UPDATE → then INSERT customer_credit_holds (parent → child of the hold).
- Side effects: customers.on_hold flips.
- Response shape: function returns `{ updated: number }`.

- [ ] T7 complete

### T8 — Credit holds UI page
**File:** `app/sales/credit-holds/page.tsx` (new)
**Operation:** create

**Details:**
- `'use client'`. List of on-hold customers from `/api/customers?on_hold=true` (extend GET if needed). Action button "Release" opens `<OverridePinModal>` (track 4) and on token approval calls `POST /api/customers/[id]/credit-release`.

**Quality Gate:** N/A (UI).

- [ ] T8 complete

### T9 — Update `current-state.md`
**File:** `_notes/02_Agent_Memory/current-state.md`
**Operation:** extend

**Details:** `customers.on_hold BOOLEAN DEFAULT FALSE`; `customer_credit_holds(customer_id, reason, started_at, released_at, released_by)`. Migration → 045. Sales-order / POS checkout now returns 412 `CREDIT_HOLD`.

- [ ] T9 complete

## Definition of Done

- [ ] All tasks T1..T9 ticked
- [ ] `npm run lint` + `npx tsc --noEmit` pass
- [ ] Migration idempotent
- [ ] Manual smoke: aging invoice → on_hold flips → SO POST returns 412 → override_token releases → next POST succeeds
- [ ] `_notes/02_Agent_Memory/current-state.md` updated
- [ ] Status set to `Completed` in `conductor/index.md`

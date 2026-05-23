---
track: price-history-alert-pos
phase: V2.0-P1
sequence: 16
status: planned
owner: Chen
created: 2026-05-23
depends_on: [pricing-engine]
estimate: S
assigned_to: [Paku, Puka]
tags: [v2-orion, pos, ux, pricing]
---

# Price-History Alert at POS

## Goal
At POS line-add, surface the last unit price the same customer paid for the same SKU so the cashier can spot accidental under-/over-pricing instantly.

## Scope IN
- New endpoint `GET /api/pos/price-history?customer_id=&sku=` returning `{ last_unit_price, last_paid_at, invoice_no }` from the most recent `sales_invoice_lines` row for that pair (within the last 365 days).
- POS line-add flow calls this endpoint on every line and shows a toast "Last paid by this customer: 410.00 THB on 2026-04-18".
- Covering index to keep query latency low.
- No writes — purely read.

## Scope OUT
- Trend across multiple customers / averages. V2.2.
- Suggest correction button. UX-only toast in V2.0.

## Acceptance Criteria
1. Endpoint returns the most recent matching line per `(customer_id, product_id)` within 365 days.
2. Returns 204 No Content when no history exists.
3. P95 latency < 100ms with covering index.
4. POS toast appears within 500ms of line add.
5. `npm run lint` and `npx tsc --noEmit` pass.

## Migrations
- `055_price_history_index.sql` — covering index on `sales_invoice_lines(customer_id, product_id, created_at DESC)`.

## API routes
- New: `GET /api/pos/price-history`.

## UI screens
- Touched: POS line-add toast / inline hint.

## Test plan
- Manual: add line for repeat customer + SKU; verify toast displays last price + date.
- Add line for never-bought-this combo; verify silent.
- Lint + tsc.

## Risks
- N+1 calls if POS adds many lines quickly — debounce per line or batch endpoint if observed.
- Customer-less (cash-only) POS sales must not call the endpoint at all.

## Verified Facts (pre-plan)
- **There is no `sales_invoice_lines` table.** Invoice lines come from `do_line_items` linked via `sales_invoices.delivery_order_id → delivery_orders.id`. The query must JOIN.
- `do_line_items` columns: `id, do_id, so_line_item_id, product_id, qty_to_deliver, unit_price, line_total` (017_sales.sql:156).
- `sales_invoices`: `id, si_number, so_id, delivery_order_id, customer_id, status, invoice_date, due_date, total_amount, paid_at, created_at`.
- Joining path: `sales_invoices → delivery_orders → do_line_items`.

---

## Tasks

### T1 — Migration `055_price_history_index.sql`
**File:** `migrations/055_price_history_index.sql` (new)
**Operation:** add migration

**Details:**
- Wrap in `BEGIN; ... COMMIT;`:
  - Two indexes (covering the join path):
    - `CREATE INDEX IF NOT EXISTS idx_si_customer_created ON sales_invoices(customer_id, created_at DESC);`
    - `CREATE INDEX IF NOT EXISTS idx_do_line_items_product ON do_line_items(product_id);`
- The composite query plan will be: `sales_invoices` (by customer+date) → `delivery_orders` (PK) → `do_line_items` (product filter).

**Quality Gate:**
- Transaction boundary: `BEGIN`/`COMMIT`.
- Doc number generation: N/A.
- Parent→child inserts: N/A.
- Side effects: none.
- Response shape: N/A.

- [ ] T1 complete

### T2 — `GET /api/pos/price-history`
**File:** `app/api/pos/price-history/route.ts` (new)
**Operation:** create

**Details:**
- Auth; `assertRole(u, ['admin','manager','staff'])`.
- Zod (query): `{ customer_id: z.string().uuid(), product_id: z.string().uuid() }`.
- SQL:
  ```sql
  SELECT do_li.unit_price, si.si_number AS invoice_no, si.created_at AS sold_at
    FROM sales_invoices si
    JOIN delivery_orders do_ ON do_.id = si.delivery_order_id
    JOIN do_line_items do_li ON do_li.do_id = do_.id
   WHERE si.customer_id = $1
     AND do_li.product_id = $2
     AND si.status IN ('issued','paid')
     AND si.created_at >= NOW() - INTERVAL '365 days'
   ORDER BY si.created_at DESC
   LIMIT 1
  ```
- If no row → return `apiSuccess({ history: null })` (HTTP 200 with null payload — easier to consume than 204 which `apiSuccess` can't naturally return).
- Else return `apiSuccess({ history: { unit_price, invoice_no, sold_at } })`.

**Quality Gate:**
- Transaction boundary: N/A (read).
- Doc number generation: N/A.
- Parent→child inserts: N/A.
- Side effects: none.
- Response shape: `apiSuccess({ history: { unit_price: number, invoice_no: string, sold_at: string } | null })`.

- [ ] T2 complete

### T3 — POS line-add UI toast
**File:** locate POS line-add component (`Glob "app/app/pos/**"`, e.g. cart editor)
**Operation:** extend

**Details:**
- On each line add, if `customer_id` (member) is attached, fetch `/api/pos/price-history?customer_id=&product_id=` (debounced 300ms).
- If `history` non-null, show a toast (Thai primary): `"ลูกค้ารายนี้ซื้อล่าสุด: 410.00 THB เมื่อ 18 เม.ย. 2026 (INV-...)"`.
- Skip the call entirely when no `customer_id` (cash-only sale).
- Read-only; no auto-apply.

**Quality Gate:** N/A (UI).

- [ ] T3 complete

### T4 — Update `current-state.md`
**File:** `_notes/02_Agent_Memory/current-state.md`
**Operation:** extend

**Details:** New endpoint `GET /api/pos/price-history`. Indexes `idx_si_customer_created`, `idx_do_line_items_product`. Migration → 055. Note: there is no `sales_invoice_lines` table — history derived via `do_line_items` JOIN.

- [ ] T4 complete

## Definition of Done

- [ ] T1..T4 ticked
- [ ] `npm run lint` + `npx tsc --noEmit` pass
- [ ] Manual smoke: repeat purchase combo → toast shows; never-bought combo → silent
- [ ] Cash-only sale → no fetch issued
- [ ] Migration idempotent
- [ ] `_notes/02_Agent_Memory/current-state.md` updated
- [ ] Status set to `Completed`

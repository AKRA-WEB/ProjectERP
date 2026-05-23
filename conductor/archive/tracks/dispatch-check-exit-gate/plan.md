---
track: dispatch-check-exit-gate
phase: V2.0-P1
sequence: 10
status: Verified
owner: Chen
updated: 2026-05-23
created: 2026-05-23
depends_on: [pos-delta-slip-and-versioning, wms-virtual-warehouses]
estimate: M
assigned_to: [Paku, Puka]
tags: [v2-orion, dispatch, gate, scanner, audit]
---

# Dispatch-Check Exit Gate

## Goal
Add a final scan-out gate at the warehouse exit. The handheld scans the invoice barcode (must be the latest version) and then each item SKU. Quantities are tallied and compared against the invoice. Any mismatch hard-blocks release.

## Scope IN
- New table `dispatch_check_log(id, invoice_id, sku, scanned_qty NUMERIC, gate_user_id, scanned_at, result ENUM('matched','mismatched','stale_barcode'))`.
- New endpoint `POST /api/dispatch/scan-invoice { barcode }` — validates barcode = latest version, returns invoice lines + a session token for the item-scan loop.
- New endpoint `POST /api/dispatch/scan-item { session_token, sku, qty }`.
- New endpoint `POST /api/dispatch/release { session_token }` — only succeeds when every line is fully scanned.
- Stale barcode returns HTTP 410 Gone with the latest version's barcode.

## Scope OUT
- Multi-invoice consolidated release (one invoice per session in V2.0).
- Photo capture at gate. V2.2.

## Acceptance Criteria
1. Scanning a stale invoice barcode returns 410 with the latest version barcode.
2. Releasing without scanning all lines returns 409 with the missing-quantity report.
3. Mismatched scans (extra SKU, over-qty) are logged with `result='mismatched'`.
4. Successful release writes one ledger entry per line moving stock out of W2/W3/W4/W5 to "shipped".
5. `npm run lint` and `npx tsc --noEmit` pass.

## Migrations
- `049_dispatch_check.sql` — create table + composite index `(invoice_id, scanned_at)`.

## API routes
- New: `POST /api/dispatch/scan-invoice`.
- New: `POST /api/dispatch/scan-item`.
- New: `POST /api/dispatch/release`.
- New: `GET /api/dispatch/sessions/[id]`.

## UI screens
- New: `app/dispatch/scan/page.tsx` — handheld-friendly large-button UI.
- New: `app/dispatch/log/page.tsx` — supervisor review of mismatches.

## Test plan
- Manual: edit invoice on POS, attempt to scan old barcode at gate, confirm 410 rejection.
- Scan full invoice, confirm release.
- Skip one item, attempt release, confirm 409.
- Lint + tsc.

## Risks
- Network blip mid-session — session token must be resumable; persist scan progress server-side.
- Same SKU on two lines (different lots) — must distinguish lot, not aggregate.

## Verified Facts (pre-plan)
- `sales_invoices.current_barcode` introduced by track 9 (migration 048). This track depends on it.
- Invoice lines are derived via `do_line_items` linked to `sales_invoices.delivery_order_id`.
- `stock_ledger.entry_type` needs a `dispatch_out` value — add via this migration (use existing extension pattern).
- All warehouses are UUID-keyed.

---

## Tasks

### T1 — Migration `049_dispatch_check.sql`
**File:** `migrations/049_dispatch_check.sql` (new)
**Operation:** add migration

**Details:**
- Top of file (outside transaction):
  - `ALTER TYPE ledger_entry_type ADD VALUE IF NOT EXISTS 'dispatch_out';`
  - `DO $$ BEGIN CREATE TYPE dispatch_check_result AS ENUM ('matched','mismatched','stale_barcode'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;`
  - `DO $$ BEGIN CREATE TYPE dispatch_session_status AS ENUM ('open','released','aborted'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;`
- Wrap rest in `BEGIN; ... COMMIT;`:
  1. `CREATE TABLE IF NOT EXISTS dispatch_sessions ( id UUID PRIMARY KEY DEFAULT gen_random_uuid(), invoice_id UUID NOT NULL REFERENCES sales_invoices(id), gate_user_id UUID NOT NULL REFERENCES users(id), started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), released_at TIMESTAMPTZ, status dispatch_session_status NOT NULL DEFAULT 'open' );`
  2. `CREATE TABLE IF NOT EXISTS dispatch_check_log ( id BIGSERIAL PRIMARY KEY, session_id UUID NOT NULL REFERENCES dispatch_sessions(id) ON DELETE CASCADE, invoice_id UUID NOT NULL REFERENCES sales_invoices(id), product_id UUID NOT NULL REFERENCES products(id), lot_id UUID REFERENCES lots(id), scanned_qty NUMERIC(15,4) NOT NULL DEFAULT 0, expected_qty NUMERIC(15,4) NOT NULL, gate_user_id UUID NOT NULL REFERENCES users(id), scanned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), result dispatch_check_result NOT NULL );`
  3. `CREATE INDEX IF NOT EXISTS idx_dispatch_log_invoice ON dispatch_check_log(invoice_id, scanned_at DESC);`
  4. `CREATE INDEX IF NOT EXISTS idx_dispatch_sessions_invoice ON dispatch_sessions(invoice_id);`

**Quality Gate:**
- Transaction boundary: `BEGIN`/`COMMIT` (enums + ALTER TYPE outside).
- Doc number generation: N/A.
- Parent→child inserts: N/A.
- Side effects: none.
- Response shape: N/A.

- [x] T1 complete

### T2 — `POST /api/dispatch/scan-invoice`
**File:** `app/api/dispatch/scan-invoice/route.ts` (new)
**Operation:** create

**Details:**
- Auth; `assertRole(u, ['admin','manager','staff'])`.
- Zod: `{ barcode: z.string() }`.
- Call `verifyInvoiceBarcode(barcode)` (from track 9). If `null` → `apiError('Invalid barcode', 404)`.
- If `version_no < current_version` of the invoice → return `apiError('Stale barcode', 410, { code: 'STALE_BARCODE', current_barcode })`.
- Create dispatch session: `INSERT INTO dispatch_sessions (invoice_id, gate_user_id) VALUES ($1,$2) RETURNING id`.
- Read expected lines from `do_line_items` joined via `sales_invoices.delivery_order_id`.
- Return `apiSuccess({ session_id, lines: [{ product_id, expected_qty }] })`.

**Quality Gate:**
- Transaction boundary: single INSERT — no explicit BEGIN needed.
- Doc number generation: N/A.
- Parent→child inserts: N/A.
- Side effects: dispatch_sessions row created.
- Response shape: `apiSuccess({ session_id: string, lines: ExpectedLine[] })`.

- [x] T2 complete

### T3 — `POST /api/dispatch/scan-item`
**File:** `app/api/dispatch/scan-item/route.ts` (new)
**Operation:** create

**Details:**
- Auth; `assertRole(u, ['admin','manager','staff'])`.
- Zod: `{ session_id: z.string().uuid(), product_id: z.string().uuid(), lot_id: z.string().uuid().optional(), qty: z.number().positive() }`.
- Verify session is `open` (else 409).
- Compute expected_qty from `do_line_items` filtered by product (and lot if applicable).
- Wrap in `BEGIN; ... COMMIT;`:
  1. `INSERT INTO dispatch_check_log (session_id, invoice_id, product_id, lot_id, scanned_qty, expected_qty, gate_user_id, result) VALUES (...)`.
  2. `result='matched'` when running total equals expected_qty; otherwise `mismatched`.
- Return `apiSuccess({ result, scanned_total, expected_qty })`.

**Quality Gate:**
- Transaction boundary: `BEGIN`/`COMMIT`/`ROLLBACK` (single INSERT — minimal).
- Doc number generation: N/A.
- Parent→child inserts: N/A.
- Side effects: dispatch_check_log row inserted.
- Response shape: `apiSuccess({ result, scanned_total, expected_qty })`.

- [x] T3 complete

### T4 — `POST /api/dispatch/release`
**File:** `app/api/dispatch/release/route.ts` (new)
**Operation:** create

**Details:**
- Auth; `assertRole(u, ['manager','admin','staff'])`.
- Zod: `{ session_id: z.string().uuid() }`.
- Wrap in `BEGIN; ... COMMIT;`:
  1. `SELECT invoice_id FROM dispatch_sessions WHERE id=$1 AND status='open' FOR UPDATE` — fail (409) if not open.
  2. Compute expected vs scanned totals from `dispatch_check_log` grouped by product. If any product has scanned_total < expected_qty → return `apiError('Missing quantities', 409, { code: 'MISSING_QTY', missing: [...] })` and `ROLLBACK`.
  3. For each product line, INSERT into `stock_ledger`:
     ```
     INSERT INTO stock_ledger (warehouse_id, product_id, lot_id, entry_type, reference_type, reference_id, qty_change, qty_after, created_by)
     VALUES ($wh, $product, $lot, 'dispatch_out', 'sales_invoices', $invoice_id, -$qty, (current_qty - $qty), $user_id)
     ```
     (compute `qty_after` from current `stock_balances.qty_on_hand`).
  4. `UPDATE dispatch_sessions SET status='released', released_at=NOW() WHERE id=$1`.
- Return `apiSuccess({ released: true })`.

**Quality Gate:**
- Transaction boundary: `BEGIN`/`COMMIT`/`ROLLBACK`.
- Doc number generation: N/A.
- Parent→child inserts: parent=dispatch_sessions update; children=multiple stock_ledger rows (one per product+lot).
- Side effects: stock_ledger inserts trigger `sync_stock_balances()` automatically; dispatch_sessions status flips.
- Response shape: `apiSuccess({ released: true })` / `apiError('Missing quantities', 409, { code, missing })`.

- [x] T4 complete

### T5 — `GET /api/dispatch/sessions/[id]`
**File:** `app/api/dispatch/sessions/[id]/route.ts` (new)
**Operation:** create

**Details:**
- Auth. Return session + per-line scanned vs expected aggregates.
- `apiSuccess({ session, lines })`.

**Quality Gate:** Response shape: `apiSuccess({ session: DispatchSession, lines: Aggregated[] })`. Others N/A.

- [x] T5 complete

### T6 — UI: dispatch handheld + supervisor log
**File:** `app/dispatch/scan/page.tsx` (new) + `app/dispatch/log/page.tsx` (new)
**Operation:** create

**Details:**
- `'use client'`. Handheld: large barcode input, post-scan item list with running scanned vs expected counts, "Release" button.
- Supervisor log: list mismatched scans by gate session.

**Quality Gate:** N/A (UI).

- [ ] T6 complete

### T7 — Update `current-state.md`
**File:** `_notes/02_Agent_Memory/current-state.md`
**Operation:** extend

**Details:** `dispatch_sessions(invoice_id, gate_user_id, status)`, `dispatch_check_log(session_id, product_id, lot_id, scanned_qty, expected_qty, result)`. `ledger_entry_type` now includes `dispatch_out`. Migration → 049.

- [ ] T7 complete

## Definition of Done

- [ ] T1..T7 ticked
- [ ] `npm run lint` + `npx tsc --noEmit` pass
- [ ] Manual smoke: bump invoice version → scan old barcode → 410; scan latest → session opens; missing scan → release 409; full scan → stock_ledger entries posted
- [ ] Migration idempotent
- [ ] `_notes/02_Agent_Memory/current-state.md` updated
- [ ] Status set to `Completed`

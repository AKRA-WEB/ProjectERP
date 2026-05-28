---
track: grn-reversal
phase: V2.3
sequence: 30
status: Verified
owner: Chen
created: 2026-05-28
updated: 2026-05-28
depends_on: []
estimate: L
assigned_to: [Paku]
tags: [wms, grn, reversal, stock, accounting]
---

# GRN Reversal (Cancel Stocked GRN)

## Goal
Allow admin/manager to formally cancel a `stocked` GRN, reversing the stock movement via a negative stock ledger entry and voiding the auto-created AP invoice. MAC (Moving Average Cost) integrity is preserved by blocking reversal if any stock consumption occurred on that product+warehouse after the GRN was stocked.

## Design Decision — MAC Approach
**Option B chosen:** Block reversal if any outbound stock movement (`pos_sale`, `so_delivery`, `transfer_out`) occurred on the same `product_id + warehouse_id` after `goods_receipt_notes.stocked_at`. The app returns 422 with the blocking transaction list. If blocking transactions exist, the accountant must manually post a correcting JE via the existing JE module.

Rationale: safe, simple, no risk of incorrect MAC recalculation. Covers the common case (reversal shortly after stocking before any consumption). Complex MAC recalc (Option A) can be a future V3 enhancement.

## Scope IN
- `grn_status` enum: add value `cancelled` (outside transaction — PostgreSQL constraint).
- `ledger_entry_type` enum: add value `grn_reversal` (outside transaction).
- New table `grn_reversal_log` — audit trail for all reversals.
- `POST /api/grn/[id]/cancel` — full reversal action endpoint.
  - Guard: status must be `stocked`.
  - Guard: no outbound stock movements after `stocked_at` on any line's `product_id + warehouse_id`.
  - Action: insert negative `stock_ledger` entries (`grn_reversal`) per line.
  - Action: void linked `po_invoices` row (set `is_paid = false`, add `voided` flag — or mark via new column).
  - Action: revert `purchase_orders.status` if this GRN was the sole GRN (revert to `sent`).
  - Action: set `goods_receipt_notes.status = 'cancelled'`.
  - Action: INSERT into `grn_reversal_log`.
- UI: "ยกเลิก GRN" button on GRN detail page (admin/manager only, visible when `status = 'stocked'`).
- UI: blocking dialog shows which transactions prevent reversal.

## Scope OUT
- Partial reversal (cancel only some lines) — full reversal only in V2.3.
- MAC recalculation after reversal — blocked by guard, manual JE path remains.
- Auto-create Credit Note toward vendor — manual process.

## Acceptance Criteria
1. GRN in `draft`/`received`/`qc_passed` status — cancel returns 409 (wrong state).
2. GRN in `stocked` + no outbound consumption after `stocked_at` — cancel succeeds, `status = 'cancelled'`, negative ledger entries visible, AP invoice voided.
3. GRN in `stocked` + outbound consumption exists — cancel returns 422 with `{ blocking_transactions: [...] }`.
4. Reversed stock_balances reflect the subtracted qty (via trigger on negative ledger insert).
5. `grn_reversal_log` row exists after successful cancel.
6. `npm run qa:verify` passes.

## Migrations
- `072_grn_reversal.sql`
  - `ALTER TYPE grn_status ADD VALUE 'cancelled'` — outside transaction.
  - `ALTER TYPE ledger_entry_type ADD VALUE 'grn_reversal'` — outside transaction.
  - `ALTER TABLE po_invoices ADD COLUMN IF NOT EXISTS voided BOOLEAN NOT NULL DEFAULT FALSE` — for AP invoice void flag.
  - New table `grn_reversal_log`.

## API Routes
- New: `POST /api/grn/[id]/cancel`

## UI Screens
- Touched: GRN detail page — add cancel button + blocking dialog.

## Test Plan
- Manual: stock a GRN → immediately cancel → verify status `cancelled`, stock_balances reduced.
- Manual: stock a GRN → post a POS sale for same product+warehouse → try cancel → verify 422 + blocking list.
- Manual: cancel GRN → check `grn_reversal_log` row.
- Manual: cancel GRN → check linked `po_invoices.voided = true`.
- Lint + tsc.

## Risks
- `sync_stock_balances()` trigger (migration 004) fires on `stock_ledger` INSERT for any `qty_change`. Negative `grn_reversal` entry will automatically decrement `stock_balances.qty_on_hand`. If `qty_on_hand` would go negative after reversal, the CHECK on `stock_balances` will block the INSERT (no explicit check exists, but real-world stock_ledger balances could misalign). Verify that `qty_on_hand - reversed_qty >= 0` before inserting; if not, return 422.
- `grn_status` enum: `ALTER TYPE ... ADD VALUE` must run outside transaction per PostgreSQL rules — migration file must use DO blocks outside BEGIN/COMMIT.
- `ledger_entry_type` enum: same constraint.
- AP invoice void: `po_invoices` has `is_paid BOOLEAN`. If `is_paid = true`, block cancellation (invoice already paid — accountant must handle manually).

## Verified Facts (pre-plan)
- `goods_receipt_notes.stocked_at TIMESTAMPTZ` — migration 006.
- `grn_status ENUM ('draft','received','qc_pending','qc_passed','qc_failed','stocked')` — no `cancelled` yet — migration 001.
- `ledger_entry_type ENUM` — has `po_reversal` but no `grn_reversal` — migration 001.
- `po_invoices` columns: `id, po_id, vendor_id, grn_id, invoice_number, invoice_date, due_date, amount, paid_amount, is_paid` — migration 031.
- `sync_stock_balances()` trigger fires AFTER INSERT on `stock_ledger` — handles negative qty_change correctly (decrements qty_on_hand).
- `trg_stock_ledger_mac` fires on `grn_receipt` only — will NOT fire on `grn_reversal` — safe, MAC stays as-is.
- GRN stocking route: `app/api/grn/[id]/stock/route.ts`.

---

## Tasks

### T1 — Migration `072_grn_reversal.sql`
**File:** `migrations/072_grn_reversal.sql` (new)
**Operation:** add migration

**Details:**
- Outside transaction (enum ADD VALUE cannot be in transaction):
  ```sql
  DO $$ BEGIN
    ALTER TYPE grn_status ADD VALUE 'cancelled';
  EXCEPTION WHEN duplicate_object THEN NULL; END $$;

  DO $$ BEGIN
    ALTER TYPE ledger_entry_type ADD VALUE 'grn_reversal';
  EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  ```
- Wrap in `BEGIN; ... COMMIT;`:
  ```sql
  ALTER TABLE po_invoices ADD COLUMN IF NOT EXISTS voided BOOLEAN NOT NULL DEFAULT FALSE;

  CREATE TABLE IF NOT EXISTS grn_reversal_log (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    grn_id           UUID NOT NULL REFERENCES goods_receipt_notes(id),
    reversed_by      UUID NOT NULL REFERENCES users(id),
    reason           TEXT,
    original_stocked_at TIMESTAMPTZ NOT NULL,
    reversed_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  CREATE INDEX IF NOT EXISTS idx_grn_reversal_grn ON grn_reversal_log(grn_id);
  ```

**Quality Gate:**
- Enum ADD VALUE outside transaction — critical for PostgreSQL.
- Transaction boundary: `BEGIN`/`COMMIT` for table changes.
- Side effects: none.

- [x] T1 complete

### T2 — `POST /api/grn/[id]/cancel`
**File:** `app/api/grn/[id]/cancel/route.ts` (new)
**Operation:** create

**Details:**
- Auth; `assertRole(u, ['admin','manager'])`.
- Inside transaction (`BEGIN/COMMIT`):
  1. `SELECT status, stocked_at, po_id, warehouse_id FROM goods_receipt_notes WHERE id=$1 FOR UPDATE` — 404 if missing, 409 if not `stocked`.
  2. `SELECT id FROM po_invoices WHERE grn_id=$1 AND is_paid=true FOR SHARE` — if any paid invoice exists, 422 `{ code: 'INVOICE_PAID', message: 'AP invoice already paid — reverse manually via Journal Entry' }`.
  3. Fetch all reversal lines: `SELECT product_id, COALESCE(base_qty, qty_accepted, qty_received) AS effective_qty FROM grn_line_items WHERE grn_id=$1 AND (qty_accepted > 0 OR qty_received > 0)`.
  4. For each line: `SELECT id, reference_type, reference_id FROM stock_ledger WHERE warehouse_id=$2 AND product_id=$3 AND entry_type IN ('pos_sale','so_delivery','transfer_out') AND created_at > $4 LIMIT 1` where $4 = `stocked_at`. If any row: collect `{ type: reference_type, id: reference_id }` into `blocking` array.
  5. If `blocking.length > 0`: ROLLBACK, return 422 `{ code: 'CONSUMPTION_EXISTS', message: 'Stock consumed after GRN stocking', blocking_transactions: blocking }`.
  6. For each line: check `SELECT qty_on_hand FROM stock_balances WHERE warehouse_id=$1 AND product_id=$2 FOR UPDATE`. If `qty_on_hand < effective_qty`: ROLLBACK, 422 `insufficient stock to reverse`.
  7. For each line: INSERT `stock_ledger (warehouse_id, product_id, entry_type='grn_reversal', reference_type='grn_reversal', reference_id=grn_id, qty_change=-effective_qty, qty_after=qty_on_hand-effective_qty, created_by)`.
  8. `UPDATE po_invoices SET voided=true WHERE grn_id=$1 AND is_paid=false`.
  9. Revert PO status: if `po_id IS NOT NULL`, check if any other non-cancelled GRN exists for the PO. If none, `UPDATE purchase_orders SET status='sent' WHERE id=po_id`.
  10. `UPDATE goods_receipt_notes SET status='cancelled', updated_at=NOW() WHERE id=$1`.
  11. `INSERT INTO grn_reversal_log (grn_id, reversed_by, reason, original_stocked_at)`.
  12. COMMIT.
- Return: `apiSuccess({ id, status: 'cancelled' })`.

**Quality Gate:**
- Transaction boundary: full `BEGIN`/`COMMIT`/`ROLLBACK`.
- All stock reads inside transaction use `FOR UPDATE`.
- No stock_balances direct write — only via stock_ledger trigger.
- Response shape: `apiSuccess({ id, status: 'cancelled' })`.

- [x] T2 complete

### T3 — GRN Detail UI — Cancel Button
**File:** locate GRN detail page via `Glob "app/**/grn/[id]/page.tsx"` or `Glob "app/**/grn/**"`
**Operation:** extend

**Details:**
- Add "ยกเลิก GRN" button — visible only when `grn.status === 'stocked'` AND `u.role` is `admin` or `manager`.
- On click: POST `/api/grn/${id}/cancel` with optional `reason` text field.
- If 422 with `code='CONSUMPTION_EXISTS'`: show modal listing `blocking_transactions` with message "ไม่สามารถยกเลิกได้ — มีรายการเบิกจ่ายสินค้าหลังรับสินค้าเข้าคลัง".
- If 422 with `code='INVOICE_PAID'`: show alert "ใบแจ้งหนี้ชำระแล้ว — กรุณาลงบัญชีแก้ไขผ่านสมุดรายวัน".
- On success: reload GRN detail; show status `ยกเลิกแล้ว` badge.

**Quality Gate:** N/A (UI).

- [x] T3 complete

### T4 — Update `current-state.md`
**File:** `_notes/02_Agent_Memory/current-state.md`
**Operation:** extend

**Details:**
- DB: `grn_status` now has `cancelled` value. `ledger_entry_type` now has `grn_reversal`. `po_invoices.voided BOOLEAN`. `grn_reversal_log` table. Migration 072.
- API: `POST /api/grn/[id]/cancel`.
- Pitfall to add: "GRN reversal blocked by outbound consumption — check `stock_ledger` for `pos_sale/so_delivery/transfer_out` after `stocked_at` before reversing."

- [x] T4 complete

## Definition of Done

- [x] T1..T4 ticked
- [x] `npm run qa:verify` passes (0 errors)
- [x] Manual smoke: stock GRN → cancel → status `cancelled`, stock_balances decremented, AP invoice `voided=true`
- [x] Manual smoke: stock GRN → post POS sale → cancel → 422 with blocking list
- [x] `grn_reversal_log` row exists
- [x] Migration idempotent
- [x] `_notes/02_Agent_Memory/current-state.md` updated
- [x] Status set to `Completed`

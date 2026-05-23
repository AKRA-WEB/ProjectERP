---
track: repack-yield-loss
phase: V2.0-P1
sequence: 14
status: planned
owner: Chen
created: 2026-05-23
depends_on: [wms-virtual-warehouses, manager-override-pin]
estimate: M
assigned_to: [Paku, Puka]
tags: [v2-orion, repack, yield, je]
---

# Repack Yield & Loss

## Goal
Track shrinkage in repack operations: bulk stock moves BLK -> V-PACK (staging) -> RTL (retail). On close, the operator must report yield-loss quantity (>=0). Any loss > 0 auto-posts a JE to a configured COGS-Operational-Waste account.

## Scope IN
- Extend `repack_orders` with `yield_loss_qty NUMERIC(14,3) DEFAULT 0 NOT NULL`, `yield_loss_reason TEXT`, `closed_je_id BIGINT`.
- New ledger entry types `repack_stage_in`, `repack_stage_out` (reused from track #2 enum extension) to record movement through V-PACK.
- Helper `lib/repack/postYieldLossJE.ts` to auto-create JE when `yield_loss_qty > 0`.
- Configured GL account `COGS-Operational-Waste` in `chart_of_accounts`; configurable via settings.
- Manager override required when `yield_loss_qty / input_qty > threshold` (default 5%).

## Scope OUT
- BOM-driven yield expectations (compare actual vs expected). V2.2.
- Multi-output repack (e.g. one bulk -> two RTL SKUs). Single-output in V2.0.

## Acceptance Criteria
1. Closing a repack order without entering yield_loss_qty returns 422.
2. Closing with loss > 0 auto-posts JE: DR COGS-Operational-Waste, CR Inventory; `repack_orders.closed_je_id` set.
3. Loss > 5% requires manager PIN; rejection if not provided.
4. Stock ledger shows three entries: BLK->V-PACK, V-PACK->RTL, V-PACK->V-KILL (loss).
5. `npm run lint` and `npx tsc --noEmit` pass.

## Migrations
- `053_repack_yield_loss.sql` — add three columns to `repack_orders`, seed `COGS-Operational-Waste` account, configurable threshold in settings table.

## API routes
- Touched: `app/api/repack-orders/[id]/close/route.ts`.
- New: `GET /api/settings/repack-loss-threshold` and `PATCH` (admin).

## UI screens
- Touched: repack close form — yield_loss inputs + reason + PIN modal at >5%.
- Touched: repack list — yield loss column.
- New: settings page for threshold.

## Test plan
- Manual: close repack with 0 loss, 3% loss, 7% loss; confirm 7% requires PIN.
- Confirm JE posted with correct amount.
- Lint + tsc.

## Risks
- Threshold change retroactively — audit trail of threshold value at JE-post time required.
- Decimal precision on yield_loss vs lot quantities; match existing `NUMERIC(14,3)`.

## Verified Facts (pre-plan)
- `repack_orders` exists (UUID id, order_number UNIQUE, source_product_id, source_qty NUMERIC(15,4), source_unit_cost NUMERIC(15,2), warehouse_id, status repack_status, notes, created_by, completed_at) — `migrations/037_repack_system.sql:39`.
- `repack_order_items` is the child line table.
- `repack_status` enum: `('draft','completed','void')`.
- `ledger_entry_type` extensions `repack_stage_in`, `repack_stage_out` arrive in track 2 (migration 042).
- `journal_entries` table exists (UUID id, entry_number `JE-`, fiscal_period_id, entry_date, entry_type, status, ...) — `migrations/018_accounting.sql:65`.
- `journal_entry_lines` with `account_id`, `debit_amount`, `credit_amount`.
- Existing close endpoint: `app/api/repack/[id]/route.ts` — verify exact PATCH action discriminant (likely `body.action === 'complete'`).
- Accounts table requires the `COGS-Operational-Waste` account by seed in this migration; verify if it already exists via `Grep "COGS"` in migrations.
- Field name discrepancy: original plan called for `NUMERIC(14,3)`; existing schema uses `NUMERIC(15,4)`. Use `NUMERIC(15,4)` to match.

---

## Tasks

### T1 — Migration `053_repack_yield_loss.sql`
**File:** `migrations/053_repack_yield_loss.sql` (new)
**Operation:** add migration

**Details:**
- Wrap in `BEGIN; ... COMMIT;`:
  1. `ALTER TABLE repack_orders ADD COLUMN IF NOT EXISTS yield_loss_qty NUMERIC(15,4) NOT NULL DEFAULT 0;`
  2. `ALTER TABLE repack_orders ADD COLUMN IF NOT EXISTS yield_loss_reason TEXT;`
  3. `ALTER TABLE repack_orders ADD COLUMN IF NOT EXISTS closed_je_id UUID REFERENCES journal_entries(id);`
  4. Seed `COGS-Operational-Waste` account (only if absent):
     ```sql
     INSERT INTO accounts (account_code, name_th, name_en, account_type, normal_balance, allows_direct_posting)
     VALUES ('5910', 'ขาดทุนจากการแปรรูป (Repack Yield Loss)', 'COGS — Operational Waste', 'expense', 'debit', TRUE)
     ON CONFLICT (account_code) DO NOTHING;
     ```
  5. `CREATE TABLE IF NOT EXISTS repack_loss_settings ( id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1), threshold_pct NUMERIC(5,2) NOT NULL DEFAULT 5.00, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW() );`
  6. `INSERT INTO repack_loss_settings (id) VALUES (1) ON CONFLICT DO NOTHING;`

**Quality Gate:**
- Transaction boundary: `BEGIN`/`COMMIT`.
- Doc number generation: N/A.
- Parent→child inserts: N/A.
- Side effects: none.
- Response shape: N/A.

- [ ] T1 complete

### T2 — Helper `lib/repack/postYieldLossJE.ts`
**File:** `lib/repack/postYieldLossJE.ts` (new)
**Operation:** create

**Details:**
- Export `postYieldLossJE(client: PoolClient, repackOrderId: string, lossQty: number, sourceUnitCost: number, fiscalPeriodId: string, userId: string): Promise<{ je_id: string }>`.
- Compute `lossValue = lossQty * sourceUnitCost`.
- Wrap (inside caller transaction):
  1. `INSERT INTO journal_entries (fiscal_period_id, entry_date, entry_type, status, reference_type, reference_id, description, created_by, posted_by, posted_at) VALUES ($1, CURRENT_DATE, 'inventory_adjustment', 'posted', 'repack_orders', $2, 'Repack yield loss', $3, $3, NOW()) RETURNING id`.
  2. INSERT 2 lines into `journal_entry_lines`:
     - DR account_code=5910 (`COGS-Operational-Waste`) with `debit_amount = lossValue, credit_amount = 0, line_number=1`
     - CR Inventory account (resolve account_code via lookup — verify by `Grep "Inventory" migrations/018_*.sql`) with `credit_amount = lossValue, debit_amount = 0, line_number=2`
  3. Return `{ je_id }`.

**Quality Gate:**
- Transaction boundary: caller-supplied `PoolClient`.
- Doc number generation: `next_doc_number('JE','seq_je')` (existing DEFAULT on `journal_entries.entry_number`).
- Parent→child inserts: parent `journal_entries` → children `journal_entry_lines` (DR + CR).
- Side effects: 1 JE + 2 JE lines written.
- Response shape: `{ je_id: string }`.

- [ ] T2 complete

### T3 — Extend repack close endpoint
**File:** `app/api/repack/[id]/route.ts`
**Operation:** extend

**Details:**
- Discover via Read: locate PATCH action `complete` (or POST close action). Extend:
- Zod additions: `{ yield_loss_qty: z.number().min(0), yield_loss_reason: z.string().optional(), override_token: z.string().optional() }`.
- Compute loss percent: `loss_pct = yield_loss_qty / source_qty * 100`.
- Wrap in `BEGIN; ... COMMIT;`:
  1. `SELECT source_qty, source_unit_cost, warehouse_id, status, source_product_id FROM repack_orders WHERE id=$1 FOR UPDATE` — fail (409) if status != 'draft'.
  2. Load threshold: `SELECT threshold_pct FROM repack_loss_settings WHERE id=1`.
  3. If `loss_pct > threshold` AND no `override_token` → `ROLLBACK` + `apiError('Yield loss above threshold', 412, { code: 'YIELD_OVER_THRESHOLD', threshold_pct, loss_pct })`.
  4. If `override_token` present → `consumeOverrideToken(token, 'repack_yield_override', { user_id, target_table: 'repack_orders', target_id: id, original_value: { threshold_pct }, override_value: { loss_pct }, reason_code: 'yield_loss_above_threshold' })`.
  5. Existing stock_ledger writes for `repack_stage_in` (BLK → V-PACK), `repack_stage_out` (V-PACK → RTL) — verify existing implementation; if not present, ADD these inserts. Also INSERT a `scrap` ledger entry for `yield_loss_qty` (V-PACK → V-KILL).
  6. If `yield_loss_qty > 0` → call `postYieldLossJE(client, id, yield_loss_qty, source_unit_cost, fiscal_period_id, u.id)` → `UPDATE repack_orders SET closed_je_id = $je_id, ...`.
  7. `UPDATE repack_orders SET status='completed', completed_at=NOW(), yield_loss_qty=$1, yield_loss_reason=$2 WHERE id=$3`.

**Quality Gate:**
- Transaction boundary: `BEGIN`/`COMMIT`/`ROLLBACK`.
- Doc number generation: `next_doc_number('JE','seq_je')` (via DEFAULT).
- Parent→child inserts: stock_ledger inserts + journal_entries → journal_entry_lines.
- Side effects: 3 stock_ledger rows (BLK→V-PACK, V-PACK→RTL, V-PACK→V-KILL when loss>0), `journal_entries` + 2 lines, repack_orders updated.
- Response shape: `apiSuccess({ repack_order, je_id? })` or `apiError('Yield loss above threshold', 412, { code, threshold_pct, loss_pct })`.

- [ ] T3 complete

### T4 — Settings endpoint
**File:** `app/api/settings/repack-loss-threshold/route.ts` (new)
**Operation:** create

**Details:**
- GET: read row 1 from `repack_loss_settings`.
- PATCH: `assertRole(u, ['admin'])`; update `threshold_pct`. Audit via `audit_logs` if available.
- `apiSuccess({ threshold_pct })`.

**Quality Gate:** Response shape `apiSuccess({ threshold_pct })`. Others N/A.

- [ ] T4 complete

### T5 — UI: close form + settings + list column
**File:** repack close modal (locate via `Glob "app/app/repack/**"`) + new settings page + repack list page
**Operation:** extend + create

**Details:**
- Close modal: required numeric input `yield_loss_qty` (≥0) + reason textarea. On 412, open `<OverridePinModal>` (track 4).
- Settings page: numeric input for threshold pct.
- Repack list: new column "Yield Loss".

**Quality Gate:** N/A (UI).

- [ ] T5 complete

### T6 — Update `current-state.md`
**File:** `_notes/02_Agent_Memory/current-state.md`
**Operation:** extend

**Details:** `repack_orders.yield_loss_qty`, `repack_orders.yield_loss_reason`, `repack_orders.closed_je_id`. `repack_loss_settings(threshold_pct)`. Seeded GL account `5910 COGS-Operational-Waste`. Migration → 053.

- [ ] T6 complete

## Definition of Done

- [ ] T1..T6 ticked
- [ ] `npm run lint` + `npx tsc --noEmit` pass
- [ ] Manual smoke: close with loss=0 OK; loss=3% OK; loss=7% (threshold 5%) → 412 → override → OK with JE posted
- [ ] JE balances (DR = CR)
- [ ] Stock ledger shows 3 entries (BLK→V-PACK, V-PACK→RTL, V-PACK→V-KILL) when loss > 0
- [ ] Migration idempotent
- [ ] `_notes/02_Agent_Memory/current-state.md` updated
- [ ] Status set to `Completed`

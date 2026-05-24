---
track: fefo-enforcement
phase: V2.0-P1
sequence: 11
status: Verified
owner: Chen
updated: 2026-05-23
created: 2026-05-23
depends_on: [manager-override-pin]
estimate: M
assigned_to: [Paku, Puka]
tags: [v2-orion, fefo, expiry, override]
---

# FEFO Enforcement (with Per-Line Override)

## Goal
Pick lists are generated in First-Expiry-First-Out order. The handheld scanner rejects any lot whose expiry is not the earliest available; accepting a non-FEFO lot requires a manager override PIN per line, with every violation logged.

## Scope IN
- Picker UI generator orders by `MIN(expiry_date) ASC` per product+warehouse, falling back to FIFO when expiry is null.
- Scanner endpoint `POST /api/picking/scan-lot { pick_id, lot_id }` returns 409 `FEFO_VIOLATION { earliest_lot, earliest_expiry }` for non-FEFO lots.
- Override consumes a manager-override token; one token per line scan.
- Each acceptance logs to `override_audit` with `action='fefo_violation'`, `target_table='picking_lines'`, `original_value={earliest_lot_id, earliest_expiry}`, `override_value={accepted_lot_id, accepted_expiry}`.
- Covering DB index to keep picker generation fast.

## Scope OUT
- New `override_audit` table — reuses table from track #4.
- Auto-block expired lots from selection — already enforced by existing inventory filters; verify only.

## Acceptance Criteria
1. Pick list output is strictly FEFO-ordered for every product+warehouse combination.
2. Scanning a non-FEFO lot returns 409 with the earliest alternative.
3. Override with valid PIN allows the scan and writes one row per violation to `override_audit`.
4. Performance: picker generation for a 200-line pick completes < 1.5s on the existing dataset.
5. `npm run lint` and `npx tsc --noEmit` pass.

## Migrations
- `050_fefo_indexes.sql` — covering index on `(product_id, warehouse_id, expiry_date)` over the lot/stock_balances table.

## API routes
- Touched: `app/api/picking/generate/route.ts` (FEFO ordering).
- New: `POST /api/picking/scan-lot`.
- Touched: any picker-finalize route to read scanned lots.

## UI screens
- Touched: handheld picking screen — per-line PIN modal on 409.
- Touched: picker supervisor dashboard — count of overrides per shift.

## Test plan
- Manual: seed two lots, scan the later-expiry lot, confirm 409.
- Provide override PIN, confirm accepted + audit row.
- Lint + tsc.

## Risks
- Lots without an expiry date must not block sellable products with FEFO peers — verify NULL-handling.
- High override volume signals a process issue — dashboard must surface this clearly.

## Verified Facts (pre-plan)
- The lot table is **`lots`** (NOT `product_lots`) — see `migrations/004_inventory.sql:11`: columns `id, product_id, warehouse_id, lot_number, serial_number, expiry_date, qty_on_hand, received_at, created_at`.
- Existing FEFO-relevant index: `idx_lots_expiry ON lots(expiry_date) WHERE expiry_date IS NOT NULL`. Need a composite covering index for `(product_id, warehouse_id, expiry_date)`.
- `pick_lists` table exists (UUID id, sales_order_id, warehouse_id, status pick_list_status) — `migrations/028_outbound_picking.sql:25`.
- `pick_list_lines` table exists with `pick_list_id`, `product_id`, `qty_requested`, `qty_picked`, `status pick_line_status`.
- No `lot_id` column on `pick_list_lines` — need to track scanned lot at line level (add column).
- `override_audit` and `consumeOverrideToken` from track 4.

---

## Tasks

### T1 — Migration `050_fefo_indexes.sql`
**File:** `migrations/050_fefo_indexes.sql` (new)
**Operation:** add migration

**Details:**
- Wrap in `BEGIN; ... COMMIT;`:
  1. `CREATE INDEX IF NOT EXISTS idx_lots_fefo ON lots(product_id, warehouse_id, expiry_date NULLS LAST);`
  2. `ALTER TABLE pick_list_lines ADD COLUMN IF NOT EXISTS lot_id UUID REFERENCES lots(id);`
  3. `ALTER TABLE pick_list_lines ADD COLUMN IF NOT EXISTS fefo_override_jti VARCHAR(100) REFERENCES override_audit(jti);` (nullable — only set when override used).

**Quality Gate:**
- Transaction boundary: `BEGIN`/`COMMIT`.
- Doc number generation: N/A.
- Parent→child inserts: N/A.
- Side effects: none.
- Response shape: N/A.

- [x] T1 complete

### T2 — Extend pick-list generation: order by FEFO
**File:** `app/api/pick-lists/route.ts` (POST handler — verify by reading)
**Operation:** extend

**Details:**
- When generating pick_list_lines from a sales-order, the line allocation must consult `lots` ordered by `expiry_date ASC NULLS LAST, received_at ASC` (use the new index).
- Store the suggested `lot_id` on `pick_list_lines.lot_id`.
- Skip lots where `qty_on_hand <= 0`.

**Quality Gate:**
- Transaction boundary: existing `BEGIN`/`COMMIT` preserved.
- Doc number generation: existing `next_doc_number('PL','seq_pick')`.
- Parent→child inserts: parent `pick_lists` → children `pick_list_lines` (preserved).
- Side effects: none beyond existing pick-list creation.
- Response shape: existing `apiSuccess({ pick_list })`.

- [x] T2 complete

### T3 — `POST /api/pick-lists/[id]/scan-lot`
**File:** `app/api/pick-lists/[id]/scan-lot/route.ts` (new)
**Operation:** create

**Details:**
- Auth; `assertRole(u, ['admin','manager','staff'])`.
- Zod: `{ line_id: z.string().uuid(), lot_id: z.string().uuid(), override_token: z.string().optional() }`.
- Wrap in `BEGIN; ... COMMIT;`:
  1. `SELECT pll.product_id, pll.lot_id AS suggested_lot_id, l.expiry_date AS scanned_expiry, sl.expiry_date AS suggested_expiry FROM pick_list_lines pll JOIN lots l ON l.id=$2 LEFT JOIN lots sl ON sl.id=pll.lot_id WHERE pll.id=$1 FOR UPDATE`.
  2. If scanned lot is FEFO-correct (`scanned_expiry <= suggested_expiry` OR suggested_expiry IS NULL) → simply `UPDATE pick_list_lines SET lot_id=$2 WHERE id=$1` and return `apiSuccess({ ok: true })`.
  3. Else (FEFO violation):
     - If no `override_token` → `ROLLBACK` + `apiError('FEFO violation', 409, { code: 'FEFO_VIOLATION', earliest_lot_id: suggested_lot_id, earliest_expiry: suggested_expiry })`.
     - If `override_token` present → `consumeOverrideToken(token, 'fefo_violation', { user_id: u.id, target_table: 'pick_list_lines', target_id: line_id, original_value: {lot_id: suggested_lot_id, expiry: suggested_expiry}, override_value: {lot_id: lot_id, expiry: scanned_expiry}, reason_code: 'fefo_override' })` returns `{ jti }`. Then `UPDATE pick_list_lines SET lot_id=$2, fefo_override_jti=$3 WHERE id=$1`. Replay caught by `override_audit.jti UNIQUE`.

**Quality Gate:**
- Transaction boundary: `BEGIN`/`COMMIT`/`ROLLBACK`.
- Doc number generation: N/A.
- Parent→child inserts: N/A (single line update + audit row insert).
- Side effects: `pick_list_lines.lot_id` + `fefo_override_jti` UPDATE; `override_audit` insert on override.
- Response shape: `apiSuccess({ ok: true })` / `apiError('FEFO violation', 409, { code, earliest_lot_id, earliest_expiry })`.

- [x] T3 complete

### T4 — Handheld picking UI
**File:** locate via `Glob "app/wms/picking/**"` or new page `app/wms/picking/[id]/page.tsx`
**Operation:** extend or create

**Details:**
- Show FEFO-suggested lot per line. On scan, post to T3 endpoint.
- On 409 FEFO_VIOLATION, open `<OverridePinModal>` (track 4). On token → resubmit with `override_token`.

**Quality Gate:** N/A (UI).

- [x] T4 complete

### T5 — Supervisor dashboard: FEFO override count
**File:** locate via `Glob "app/wms/picking/**dashboard**"` or new page `app/wms/picking/overrides/page.tsx`
**Operation:** extend or create

**Details:**
- Query `override_audit WHERE action='fefo_violation'` grouped by day / picker. Read-only table.

**Quality Gate:** N/A (UI).

- [x] T5 complete

### T6 — Update `current-state.md` + `pitfalls.md`
**File:** `_notes/02_Agent_Memory/current-state.md` + `pitfalls.md`
**Operation:** extend

**Details:**
- DB: `pick_list_lines.lot_id`, `pick_list_lines.fefo_override_jti`. New index `idx_lots_fefo`. Migration → 050.
- Pitfall (append): "Lots without expiry_date — FEFO order must use `NULLS LAST` to keep dated lots first."

- [x] T6 complete

## Definition of Done

- [x] T1..T6 ticked
- [x] `npm run lint` + `npx tsc --noEmit` pass
- [x] Manual smoke: two lots (early + late expiry); scan late → 409; provide token → accepted, `override_audit` row written
- [x] Migration idempotent
- [x] `_notes/02_Agent_Memory/current-state.md` updated
- [x] Status set to `Completed`


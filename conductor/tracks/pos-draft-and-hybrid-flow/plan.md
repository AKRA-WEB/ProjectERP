---
track: pos-draft-and-hybrid-flow
phase: V2.0-P1
sequence: 8
status: planned
owner: Chen
created: 2026-05-23
depends_on: [channel-on-order-header]
estimate: L
assigned_to: [Paku, Puka]
tags: [v2-orion, pos, draft, hybrid, schema]
---

# POS Draft + Hybrid Picking-Slip Flow

## Goal
Support the real-world counter behavior: a cashier opens a draft cart, marks it hybrid when wholesale lines must be physically picked from W2, prints a picking slip for the warehouse team, then resumes the cart and finalises the invoice when the goods return to the counter.

## Scope IN
- Extend `pos_held_carts` with `is_hybrid BOOLEAN DEFAULT false`, `wholesale_picking_slip_id BIGINT`.
- New table `pos_picking_slips(id, draft_cart_id, printed_at, printed_by, picked_at, picked_by, lines JSONB, status ENUM('printed','picked','cancelled'))`.
- New endpoint `POST /api/pos/carts/[id]/picking-slip` to print + persist the slip.
- New endpoint `POST /api/pos/picking-slips/[id]/mark-picked` (warehouse staff).
- POS recall flow: when picking slip is `picked`, lines auto-merge back into the cart with updated lot info.

## Scope OUT
- Multi-warehouse picking from a single slip (single source warehouse per slip in V2.0).
- Mobile native picking app — web-only handheld UI.

## Acceptance Criteria
1. Cashier toggles "Hybrid" on draft cart -> `is_hybrid=true` persisted.
2. Print Picking Slip produces a `pos_picking_slips` row with a barcode and PDF download.
3. Warehouse marks slip picked; resuming the cart shows the picked lines + lot data.
4. Recall cannot finalize until linked slip is in `picked` status.
5. `npm run lint` and `npx tsc --noEmit` pass.

## Migrations
- `047_pos_hybrid_flow.sql` — add two columns to `pos_held_carts`, create `pos_picking_slips` table with indexes.

## API routes
- New: `POST /api/pos/carts/[id]/picking-slip`.
- New: `POST /api/pos/picking-slips/[id]/mark-picked`.
- Touched: `app/api/pos/carts/[id]/route.ts` to gate finalisation when hybrid + unpicked.

## UI screens
- Touched: POS cart screen — Hybrid toggle + Print Slip button.
- New: `app/wms/picking-slips/page.tsx` — warehouse staff queue.
- Touched: POS recall view — picked-status badge.

## Test plan
- Manual: open cart, mark hybrid, print slip, simulate warehouse mark picked, finalize sale.
- Lint + tsc.

## Risks
- Stale draft carts left in `is_hybrid=true` indefinitely — add a 24h cleanup job.
- JSON `lines` column must be kept in sync with cart edits up to print-time; lock the cart on print.

## Verified Facts (pre-plan)
- `pos_held_carts` already exists (id UUID, hold_number, session_id, warehouse_id, note, created_by, created_at) — see `migrations/029_pos_improvements.sql:60`.
- `pos_held_cart_lines` exists with `held_cart_id`, `product_id`, `qty`, `unit_price`, `discount_amount`.
- No `is_hybrid` or `wholesale_picking_slip_id` columns yet.
- `next_doc_number('HLD','seq_pos_held')` already used by `hold_number` DEFAULT.
- POS API routes: `app/api/pos/held-carts/route.ts`, `app/api/pos/held-carts/[id]/route.ts`, `app/api/pos/transactions/route.ts`.

---

## Tasks

### T1 — Migration `047_pos_hybrid_flow.sql`
**File:** `migrations/047_pos_hybrid_flow.sql` (new)
**Operation:** add migration

**Details:**
- Top of file (outside transaction):
  - `DO $$ BEGIN CREATE TYPE pos_picking_slip_status AS ENUM ('printed','picked','cancelled'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;`
- Wrap in `BEGIN; ... COMMIT;`:
  1. `CREATE SEQUENCE IF NOT EXISTS seq_pos_pps START 1;`
  2. `ALTER TABLE pos_held_carts ADD COLUMN IF NOT EXISTS is_hybrid BOOLEAN NOT NULL DEFAULT FALSE;`
  3. `ALTER TABLE pos_held_carts ADD COLUMN IF NOT EXISTS wholesale_picking_slip_id UUID;`
  4. `CREATE TABLE IF NOT EXISTS pos_picking_slips ( id UUID PRIMARY KEY DEFAULT gen_random_uuid(), doc_no VARCHAR(50) NOT NULL UNIQUE DEFAULT next_doc_number('PPS','seq_pos_pps'), draft_cart_id UUID NOT NULL REFERENCES pos_held_carts(id) ON DELETE CASCADE, status pos_picking_slip_status NOT NULL DEFAULT 'printed', source_warehouse_id UUID NOT NULL REFERENCES warehouses(id), printed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), printed_by UUID NOT NULL REFERENCES users(id), picked_at TIMESTAMPTZ, picked_by UUID REFERENCES users(id), lines JSONB NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW() );`
  5. `ALTER TABLE pos_held_carts ADD CONSTRAINT fk_held_cart_pps FOREIGN KEY (wholesale_picking_slip_id) REFERENCES pos_picking_slips(id);` (inside an `IF NOT EXISTS`-style DO block to make idempotent).
  6. `CREATE INDEX IF NOT EXISTS idx_pps_draft_cart ON pos_picking_slips(draft_cart_id);`
  7. `CREATE INDEX IF NOT EXISTS idx_pps_status ON pos_picking_slips(status);`
  8. `CREATE OR REPLACE TRIGGER trg_pps_updated_at BEFORE UPDATE ON pos_picking_slips FOR EACH ROW EXECUTE FUNCTION set_updated_at();`

**Quality Gate:**
- Transaction boundary: `BEGIN`/`COMMIT` (enum outside).
- Doc number generation: `next_doc_number('PPS','seq_pos_pps')` set as column DEFAULT — generation is automatic on insert.
- Parent→child inserts: N/A.
- Side effects: none.
- Response shape: N/A.

- [ ] T1 complete

### T2 — `POST /api/pos/carts/[id]/picking-slip`
**File:** `app/api/pos/carts/[id]/picking-slip/route.ts` (new)
**Operation:** create

**Details:**
- Auth; require `assertPermission(u, 'pos:operate')` (or `assertRole(u, ['admin','manager','staff'])`).
- Zod: `{ source_warehouse_id: z.string().uuid() }` (e.g. `W2` ID).
- Wrap in `BEGIN; ... COMMIT;`:
  1. `SELECT is_hybrid, wholesale_picking_slip_id FROM pos_held_carts WHERE id=$1 FOR UPDATE` — fail if `wholesale_picking_slip_id IS NOT NULL` (already has slip).
  2. Pull lines: `SELECT product_id, qty, unit_price, discount_amount FROM pos_held_cart_lines WHERE held_cart_id=$1`.
  3. `INSERT INTO pos_picking_slips (draft_cart_id, source_warehouse_id, printed_by, lines) VALUES ($1,$2,$3,$4::jsonb) RETURNING id, doc_no` (DEFAULT `doc_no` via `next_doc_number`).
  4. `UPDATE pos_held_carts SET is_hybrid=TRUE, wholesale_picking_slip_id=$1 WHERE id=$2`.
- Return `apiSuccess({ slip: { id, doc_no, lines } })`.

**Quality Gate:**
- Transaction boundary: `BEGIN`/`COMMIT`/`ROLLBACK`.
- Doc number generation: `next_doc_number('PPS','seq_pos_pps')` via column DEFAULT.
- Parent→child inserts: parent=picking_slip; lines stored as JSONB snapshot (no child table to keep things lightweight).
- Side effects: cart row updated (`is_hybrid`, `wholesale_picking_slip_id`).
- Response shape: `apiSuccess({ slip: { id: string, doc_no: string, lines: object[] } })`.

- [ ] T2 complete

### T3 — `POST /api/pos/picking-slips/[id]/mark-picked`
**File:** `app/api/pos/picking-slips/[id]/mark-picked/route.ts` (new)
**Operation:** create

**Details:**
- Auth; `assertRole(u, ['manager','admin','staff'])`.
- Wrap in `BEGIN; ... COMMIT;`:
  1. `UPDATE pos_picking_slips SET status='picked', picked_at=NOW(), picked_by=$1 WHERE id=$2 AND status='printed' RETURNING draft_cart_id, lines`.
  2. If no row updated → `ROLLBACK` and `apiError('Slip not in printed state', 409)`.
- Return `apiSuccess({ ok: true })`.

**Quality Gate:**
- Transaction boundary: `BEGIN`/`COMMIT`/`ROLLBACK`.
- Doc number generation: N/A.
- Parent→child inserts: N/A.
- Side effects: status flip.
- Response shape: `apiSuccess({ ok: true })`.

- [ ] T3 complete

### T4 — Extend `app/api/pos/held-carts/[id]/route.ts` finalize gate
**File:** `app/api/pos/held-carts/[id]/route.ts`
**Operation:** extend

**Details:**
- If the resume/finalize action is triggered, check: when `is_hybrid=true` AND `wholesale_picking_slip_id IS NOT NULL` AND the linked slip is **not** in `picked` status → return `apiError('Picking slip not yet picked', 409)`.

**Quality Gate:**
- Transaction boundary: existing preserved.
- Doc number generation: N/A.
- Parent→child inserts: N/A.
- Side effects: existing.
- Response shape: existing + 409 on hybrid not picked.

- [ ] T4 complete

### T5 — Types + UI
**File:** `types/db.ts` + `app/app/pos/**/*.tsx` (UI) + `app/wms/picking-slips/page.tsx` (new)
**Operation:** extend + create

**Details:**
- Types: `PosPickingSlip`, `PosPickingSlipStatus`.
- POS UI: Hybrid toggle on cart screen + "Print Picking Slip" button (calls T2 endpoint), opens print preview.
- WMS staff queue: `app/wms/picking-slips/page.tsx` — list `printed` slips, button "Mark Picked" (T3).
- POS recall view: badge for slip status; recall disabled when status != `picked`.

**Quality Gate:** N/A (UI).

- [ ] T5 complete

### T6 — Update `current-state.md`
**File:** `_notes/02_Agent_Memory/current-state.md`
**Operation:** extend

**Details:** `pos_held_carts.is_hybrid BOOLEAN`, `pos_held_carts.wholesale_picking_slip_id UUID`. `pos_picking_slips(doc_no PPS-, draft_cart_id, status, source_warehouse_id, lines JSONB)`. Migration → 047.

- [ ] T6 complete

## Definition of Done

- [ ] T1..T6 ticked
- [ ] `npm run lint` + `npx tsc --noEmit` pass
- [ ] Manual smoke: hybrid cart prints slip; mark-picked allowed; resume blocked until picked
- [ ] Migration idempotent
- [ ] `_notes/02_Agent_Memory/current-state.md` updated
- [ ] Status set to `Completed` in `conductor/index.md`

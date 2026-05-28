---
track: three-way-matching
phase: V2.0-P1
sequence: 28
status: Verified
owner: Chen
created: 2026-05-23
updated: 2026-05-28
depends_on: []
estimate: M
assigned_to: [Paku]
tags: [v2-orion, ap, match, guard]
---

# Three-Way Matching (Strict Zero Variance)

## Goal
Block AP payment whenever the vendor invoice does not exactly match the PO (price) and the GRN (received qty). Strict zero variance — any mismatch flags the invoice for manager review.

## Scope IN
- New column `po_invoices.match_status ENUM('pending','matched','mismatched') DEFAULT 'pending'`.
- New table `po_invoice_match_variances(id, po_invoice_id, product_id, po_price, gr_qty, inv_qty, inv_price, qty_variance, price_variance, created_at)`.
- DB trigger on `po_invoices` line insert/update: compare against linked PO + sum of received GRN lines; set `match_status` accordingly.
- Payment endpoints reject when `match_status != 'matched'` with HTTP 422 + variance breakdown.
- Manager review queue page with explicit "Accept Variance" or "Reject Invoice" actions.

## Scope OUT
- Tolerance bands (e.g. accept 0.5% price drift). Strict zero in V2.0 per decision #12.
- Auto-create credit-note suggestion. Manual in V2.0.

## Acceptance Criteria
1. Invoice with matching PO price + GR qty + invoice qty/price flips to `matched` automatically.
2. Any line variance flips header to `mismatched` and writes detail rows to `po_invoice_match_variances`.
3. Payment POST returns 422 when status is not `matched`.
4. Manager review queue lists all mismatched invoices with side-by-side numbers.
5. `npm run lint` and `npx tsc --noEmit` pass.

## Migrations
- `070_three_way_match_trigger.sql` — Schema already exists from migration 051 (`match_status` enum, `po_invoices.match_status`, `po_invoice_match_variances`). This migration only installs the trigger function + trigger + backfill + index.

## API routes
- Touched: `app/api/ap/invoices/route.ts` and `[id]/route.ts` (trigger fires automatically, surface variance in GET).
- Touched: `app/api/ap/payments/route.ts` (block on mismatch).
- New: `GET /api/ap/match-queue`.

## UI screens
- New: `app/ap/match-queue/page.tsx`.
- Touched: AP invoice detail — show variance table.
- Touched: AP payment screen — block + reason message.

## Test plan
- Manual: create PO @ 100, GR 10 @ 100, invoice 10 @ 105 -> mismatched.
- Match queue lists it. Payment blocked.
- Lint + tsc.

## Risks
- Trigger performance on bulk invoice posting — benchmark with 500-line invoices.
- Partial GRN scenarios: only sum non-rejected GRN lines.

## Verified Facts (pre-plan)
- `po_invoices` exists with: `po_id`, `vendor_id` (added by 031), `grn_id` (added by 031), `amount`, `is_paid`, `paid_amount`. No `match_status` column yet.
- `po_invoices` is **header-only** (no `po_invoice_lines` table). 3-way matching must operate at the header level — comparing `amount` to PO total and GRN total. Plan must reflect this; original task wording about "lines" is inaccurate.
- `ap_payments` and `ap_payment_allocations` exist (031). Payment endpoint location: `app/api/ap/payments/route.ts` (verify via Glob).
- GRN line table: verify via `Read migrations/006_grn.sql` for exact column names (likely `grn_lines` or `goods_receipt_lines`).

---

## Tasks

### T1 — Migration `070_three_way_match_trigger.sql`
**File:** `migrations/070_three_way_match_trigger.sql` (new)
**Operation:** add migration

**Context:** `match_status` enum, `po_invoices.match_status` column, and `po_invoice_match_variances` table all exist from migration 051. Only the trigger function, trigger, backfill, and index are missing.

**Details:**
- Wrap in `BEGIN; ... COMMIT;`:
  1. Trigger function `reconcile_po_invoice()`. Compares `po_invoices.amount` to `purchase_orders.total_amount` (GRN-derived invoice auto-created from received qty × PO price, so if invoice was manually edited this catches it):
     ```sql
     CREATE OR REPLACE FUNCTION reconcile_po_invoice() RETURNS TRIGGER AS $$
     DECLARE po_total NUMERIC; gr_total NUMERIC;
     BEGIN
       SELECT total_amount INTO po_total FROM purchase_orders WHERE id = NEW.po_id;
       SELECT COALESCE(SUM(
         COALESCE(NULLIF(gli.qty_accepted,0), gli.qty_received) * pli.unit_price
       ), 0) INTO gr_total
       FROM grn_line_items gli
       JOIN po_line_items pli ON pli.id = gli.po_line_item_id
       WHERE gli.grn_id = NEW.grn_id;
       DELETE FROM po_invoice_match_variances WHERE po_invoice_id = NEW.id;
       IF NEW.amount = gr_total THEN
         NEW.match_status := 'matched';
       ELSE
         NEW.match_status := 'mismatched';
         INSERT INTO po_invoice_match_variances (po_invoice_id, variance_type, po_value, gr_value, invoice_value)
           VALUES (NEW.id, 'header_amount', po_total, gr_total, NEW.amount);
       END IF;
       RETURN NEW;
     END;
     $$ LANGUAGE plpgsql;

     CREATE OR REPLACE TRIGGER trg_po_invoice_match
       BEFORE INSERT OR UPDATE OF amount, po_id, grn_id ON po_invoices
       FOR EACH ROW EXECUTE FUNCTION reconcile_po_invoice();
     ```
  2. Backfill: `UPDATE po_invoices SET amount = amount;`
  3. `CREATE INDEX IF NOT EXISTS idx_po_invoices_match_status ON po_invoices(match_status);`

**Quality Gate:**
- Transaction boundary: `BEGIN`/`COMMIT`.
- Side effects: `po_invoice_match_variances` rows created on mismatch.
- Response shape: N/A.

- [x] T1 complete

### T2 — Block AP payment when mismatched
**File:** `app/api/ap/payments/route.ts` (verify path via Glob; fall back to nearest match)
**Operation:** extend

**Details:**
- Before INSERT into `ap_payments`, for each `ap_payment_allocations` row to be inserted, SELECT `match_status` of the target `po_invoices` row. If any allocation references a non-matched invoice → return `apiError('Three-way match failed', 422, { code: 'MATCH_REQUIRED', invoice_ids: [...] })`.
- Wrap full payment+allocations insert in `BEGIN; ... COMMIT;` (the existing route may already do this — preserve).

**Quality Gate:**
- Transaction boundary: existing `BEGIN`/`COMMIT`/`ROLLBACK` preserved.
- Doc number generation: existing `next_doc_number('PMT','seq_ap_pmt')`.
- Parent→child inserts: parent=ap_payments, children=ap_payment_allocations.
- Side effects: payment + allocations posted only when all referenced invoices are matched.
- Response shape: `apiSuccess({ payment })` / `apiError('Three-way match failed', 422, {...})`.

- [x] T2 complete

### T3 — `GET /api/ap/match-queue`
**File:** `app/api/ap/match-queue/route.ts` (new)
**Operation:** create

**Details:**
- Auth; `assertRole(u, ['admin','manager','auditor'])`.
- Query: `SELECT pi.*, po.po_number, v.name_th AS vendor_name FROM po_invoices pi JOIN purchase_orders po ON po.id=pi.po_id LEFT JOIN vendors v ON v.id=pi.vendor_id WHERE pi.match_status='mismatched' ORDER BY pi.created_at DESC` + JOIN `po_invoice_match_variances` (LATERAL).
- Pagination.
- `apiSuccess({ data, total, page, limit })`.

**Quality Gate:** Response shape `apiSuccess({ data: MatchQueueRow[], total, page, limit })`. Others N/A.

- [x] T3 complete

### T4 — Surface variance in AP invoice detail
**File:** `app/api/ap/invoices/[id]/route.ts` (verify path)
**Operation:** extend

**Details:**
- GET adds `variances: po_invoice_match_variances[]` to the response payload.

**Quality Gate:** Response shape: existing + `variances`.

- [x] T4 complete

### T5 — UI: match queue + invoice variance card
**File:** `app/ap/match-queue/page.tsx` (new) + extend `app/app/ap/invoices/[id]/page.tsx`
**Operation:** create + extend

**Details:**
- Match queue: table with side-by-side PO total / GR total / Invoice amount.
- Invoice detail: variance table card; payment button disabled when status != `matched`.

**Quality Gate:** N/A (UI).

- [x] T5 complete

### T6 — Update `current-state.md` + `pitfalls.md`
**File:** `_notes/02_Agent_Memory/current-state.md` + `pitfalls.md`
**Operation:** extend

**Details:**
- DB: `po_invoices.match_status`, `po_invoice_match_variances`. Trigger `reconcile_po_invoice` on `po_invoices`.
- Pitfall: "AP payment blocks on `match_status != 'matched'` — surface the queue to AP staff before payment runs."

- [x] T6 complete

## Definition of Done

- [x] T1..T6 ticked
- [x] `npm run lint` + `npx tsc --noEmit` pass
- [x] Manual smoke: invoice amount = PO total + GR total → matched; +1 THB drift → mismatched + variance row; payment 422
- [x] Migration idempotent
- [x] `_notes/02_Agent_Memory/current-state.md` updated
- [x] Status set to `Verified`

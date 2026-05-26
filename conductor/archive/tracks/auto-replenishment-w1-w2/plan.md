---
track: auto-replenishment-w1-w2
phase: V2.1
sequence: 22
status: Verified
owner: Chen
created: 2026-05-23
updated: 2026-05-26
depends_on: [wms-virtual-warehouses]
estimate: M
assigned_to: [Paku]
tags: [v2-orion, replenishment, transfer, wms]
---

# Auto-Replenishment W1 from W2

## Goal
Automate restocking of the retail front (W1) from the wholesale hub (W2). Each product has a reorder point and reorder qty; a nightly job creates a transfer suggestion when W1 stock drops below the point. A manager approves before the transfer executes.

## Inter-BU Context

W2 is BU `AKRA` (wholesale hub). W1 is BU `TRD` (retail front). Any W2→W1 transfer is an **Inter-BU transfer** and carries two additional constraints not present in same-BU moves:

1. **Warehouse isolation** — `buildWarehouseScopeClause` restricts TRD staff from seeing AKRA/W2 inventory. The replenishment job and approval UI must bypass this with a system-level scope and expose the approval surface only to `manager` or `admin` roles.
2. **Inter-BU accounting** — moving inventory across BU boundaries reduces AKRA's inventory asset and increases TRD's. This requires double-entry journal vouchers, not just a `stock_ledger` move.

## Scope IN
- New columns `products.w1_reorder_point NUMERIC(14,3)`, `products.w1_reorder_qty NUMERIC(14,3)`.
- Nightly job `lib/jobs/replenish-w1.ts` runs under **system scope** (no warehouse filter) — evaluates every product; creates `transfer_suggestions(id, product_id, suggested_qty, source_wh, target_wh, source_bu, target_bu, created_at, approved_at, approved_by, transfer_id, je_id UUID REFERENCES journal_entries, status ENUM('pending','approved','rejected','executed'))`.
- `source_bu` / `target_bu` columns tag the BUs at suggestion time so audit trail is preserved even if warehouse config changes later.
- Manager-review UI to approve / reject / edit suggestion. **Access guard: `assertRole(u, ['manager','admin'])` in all suggestion API routes.**
- On approve: create transfer order pre-populated with suggested qty AND post an Inter-BU journal entry (see Accounting below).

## Inter-BU Accounting (on approval)

When `source_bu = 'AKRA'` and `target_bu = 'TRD'`, the approval handler must post a journal entry via the existing `POST /api/accounting/journal-entries` pattern:

| Line | Account | Debit | Credit | Description |
|------|---------|-------|--------|-------------|
| 1 | `1300-TRD` Inventory — TRD | transfer value | — | Inventory received at W1 |
| 2 | `1300-AKRA` Inventory — AKRA | — | transfer value | Inventory released from W2 |
| 3 | `2190-AKRA` Inter-company Payable — AKRA | — | transfer value | AKRA owes TRD (clearing) |
| 4 | `1190-TRD` Inter-company Receivable — TRD | transfer value | — | TRD claims from AKRA (clearing) |

Transfer value = `suggested_qty × products.moving_avg_cost` (MAC). Link `je_id` back to the suggestion row.

Inter-company clearing accounts `2190-AKRA` / `1190-TRD` must be seeded in the migration if not present.

## Scope OUT
- Multi-source replenishment beyond W2 -> W1. Future revision.
- Demand-forecast-driven reorder qty. V2.2 (AI track).
- Netting/settlement of inter-company balances. Finance handles manually in V2.0.

## Acceptance Criteria
1. Nightly job creates exactly one pending suggestion per product below its reorder point.
2. Staff-role API calls to suggestion endpoints return 403.
3. Approval flow creates transfer order and posts Inter-BU JE; `je_id` on suggestion row is non-null.
4. JE reduces `1300-AKRA` and increases `1300-TRD` by the same MAC-based value; clears via `2190-AKRA` / `1190-TRD`.
5. Re-running the job before approval does not create duplicates.
6. Rejected suggestions are not re-suggested for 7 days.
7. `npm run lint` and `npx tsc --noEmit` pass.

## Migrations
- `061_auto_replenishment.sql` — add two product columns, create `transfer_suggestions` table (with `source_bu`, `target_bu`, `je_id`), seed inter-company clearing accounts `2190-AKRA` and `1190-TRD` if absent.

## API routes
- New: `GET /api/replenish/suggestions`, `PATCH /api/replenish/suggestions/[id]` — both require `manager` or `admin` role.
- New: `POST /api/admin/replenish/run-now` (admin trigger, runs job synchronously for testing).

## UI screens
- New: `app/wms/replenish/page.tsx` — suggestion queue with approve / reject / edit. Route guard: redirect non-manager/admin to 403 page.
- Touched: product edit form — reorder point + qty inputs.

## Test plan
- Manual: configure reorder point, drain W1 stock, run job via `run-now`, verify suggestion created.
- Log in as staff (TRD cashier role), attempt `GET /api/replenish/suggestions` — expect 403.
- Log in as manager, approve suggestion — confirm transfer order created AND JE posted with correct amounts.
- Check `1300-AKRA` balance decreased, `1300-TRD` increased, clearing accounts balanced.
- Re-run job, confirm no duplicate suggestion.
- Lint + tsc.

## Risks
- Job runtime grows linearly with product count — index well and consider parallel chunks at 5k+ products.
- Reorder qty too high causes overstock — surface sanity-check warning in UI.
- MAC may be 0 for new products not yet received via GRN — guard: skip JE if MAC = 0, surface warning on approval screen.

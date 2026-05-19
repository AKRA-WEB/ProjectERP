---
track: inbound-receive-fix
status: Verified
owner: gemini
module: WMS
updated: 2026-05-18
aliases: ["Plan — Inbound Receive \"Request failed\" Fix"]
---

# Plan — Inbound Receive "Request failed" Fix

## Root Cause Analysis

### Confirmed bugs in `app/api/grn/[id]/receive/route.ts`

**Bug 1 (CRITICAL): Split GRN header fails for IO-based GRN**

File: `receive/route.ts:34`
```typescript
// Current — missing inbound_order_id
const grn = await queryOne<{ status: string; po_id: string; warehouse_id: string; split_from_grn_id: string | null }>(
  'SELECT status, po_id, warehouse_id, split_from_grn_id FROM goods_receipt_notes WHERE id = $1',
  [id]
);
```
And `receive/route.ts:136-145`:
```typescript
// Current — INSERT uses grn.po_id (null for IO) and omits inbound_order_id
INSERT INTO goods_receipt_notes (po_id, warehouse_id, received_by, split_from_grn_id, notes, status)
VALUES ($1, $2, $3, $4, $5, 'draft')
```
Result: `chk_grn_source` constraint (`014_inbound_orders.sql:71`) fires — requires exactly one of `po_id`/`inbound_order_id` to be non-null. For IO GRN, both are null → **DB error → ROLLBACK → "Request failed"**.

Triggers when: any line has `qty_received < qty_expected` (partial receipt, common in practice).

---

**Bug 2 (CRITICAL): Split GRN line items fail for IO-based GRN**

File: `receive/route.ts:63`
```typescript
// Current — missing inbound_order_line_id
SELECT id, product_id, po_line_item_id, qty_expected, line_number
FROM grn_line_items WHERE grn_id = $1
```
And `receive/route.ts:150-157`:
```typescript
// Current — INSERT uses sl.po_line_item_id (null for IO), omits inbound_order_line_id
INSERT INTO grn_line_items (grn_id, po_line_item_id, product_id, qty_received, qty_expected, line_number)
VALUES ($1, $2, $3, 0, $4, $5)
```
Result: `chk_grn_line_source` constraint fires — for IO lines `po_line_item_id = null` and `inbound_order_line_id` not in INSERT → both null → **DB error**.

---

**Bug 3 (MEDIUM): Extra lines INSERT violates constraint**

File: `receive/route.ts:96-104`
```typescript
// Current — neither po_line_item_id nor inbound_order_line_id included
INSERT INTO grn_line_items (grn_id, product_id, qty_received, qty_accepted, qty_expected, storage_location, line_number)
VALUES ($1, $2, $3, $3, NULL, $4, $5)
```
Result: `chk_grn_line_source` constraint requires exactly one FK to be set, but extra/bonus items legitimately have neither. **DB error** whenever user adds a bonus item.

---

## Fix Tasks

### Task 1 — Migration: relax `chk_grn_line_source` for extra items [x]
...
### Task 2 — Fix receive/route.ts: fetch `inbound_order_id` in GRN SELECT [x]
...
### Task 3 — Fix receive/route.ts: fetch `inbound_order_line_id` in GRN lines SELECT [x]
...
### Task 4 — Fix receive/route.ts: split GRN header INSERT for IO [x]
...
### Task 5 — Fix receive/route.ts: split GRN line items INSERT for IO [x]

---

## Execution Order

1. Task 1 (migration) — must run before code changes are deployed
2. Tasks 2–3 (SELECT fixes) — prerequisite for Tasks 4–5
3. Tasks 4–5 (INSERT fixes) — depend on Tasks 2–3

## Acceptance Criteria

- [x] IO GRN in `draft` status: submit Work Card with full qty → status becomes `received`, no split GRN created
- [x] IO GRN in `draft` status: submit Work Card with partial qty (< expected) → status becomes `received`, split GRN created correctly with correct `inbound_order_id` and `inbound_order_line_id`
- [x] IO GRN: add bonus item (extra line) → receive succeeds, extra line stored with both FKs null
- [x] PO GRN: receive still works (regression check)
- [x] `npx tsc --noEmit` — zero errors (local file confirmed, layout errors pre-exist)
- [x] `npm run lint` — zero errors

## Risk Notes

- Migration is additive (DROP + ADD constraint) — safe on existing data since no existing rows can have both FKs set
- Split GRN flow for PO-based GRN is unchanged (po_id not null, inbound_order_id null — constraint passes as before)
- If DB hasn't run migration 027 yet, `qty_expected` and `receiver_name` columns don't exist — run `npm run migrate` first

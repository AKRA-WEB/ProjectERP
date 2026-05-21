---
track: bug-hunt-wms-polish
status: Completed
aliases: ["Bug Hunt & Polish — WMS Core"]
owner: paku, puka
module: WMS
updated: 2026-05-20
---

# Track: Bug Hunt & Polish — WMS Core

**Created:** 2026-05-11
**Status:** Active
**Architect:** Claude

---

## Overview

Systematic review of existing WMS code (PR → PO → GRN → Stock → Transfers → Cycle Counts → RMA).
Found 3 confirmed data bugs (P1), 4 logic/security issues (P2), and 4 UX/cosmetic issues (P3).
No new features — fix only.

---

## Priority Classification

| ID | Severity | Area | Summary |
|---|---|---|---|
| BUG-001 | **P1 — Data** | GRN API list | INNER JOIN drops all IO-based GRNs from list |
| BUG-002 | **P1 — Data** | GRN list page | PO link uses GRN `id` instead of `po_id` |
| BUG-003 | **P1 — Logic** | Transfer list | Warehouse scope only on source; destination staff blind |
| BUG-004 | **P2 — Logic** | Transfer create | No `FOR UPDATE` lock before stock check — race condition |
| BUG-005 | **P2 — Validation** | GRN QC | No validation: `qty_accepted + qty_rejected ≤ qty_received` |
| BUG-006 | **P2 — Missing** | Sales module | `delivery-orders/[id]/page.tsx` missing |
| BUG-007 | **P2 — Missing** | Sales module | `sales-returns/[id]/page.tsx` missing |
| BUG-008 | **P2 — Missing** | Accounting | `reports/general-ledger/page.tsx` missing |
| BUG-009 | **P3 — UX** | GRN detail page | Typo: `setVerifyVerifyNotes` in state declaration |
| BUG-010 | **P3 — UX** | GRN list modal | IO-based GRN modal shows "เลข PO" label with null value |
| BUG-011 | **P3 — UX** | GRN list page | Tab "verified" missing from TABS array (IO GRN status) |
| BUG-012 | **P3 — UX** | Sidebar | GRN Receiving Queue has no sidebar link |

---

## Bug Details & Fixes

---

### BUG-001 — P1: GRN API list drops IO-based GRNs

**File:** `app/api/grn/route.ts`

**Problem:** Line 64 uses `JOIN purchase_orders po ON po.id = g.po_id` (INNER JOIN). GRNs
created from inbound orders have `po_id = NULL`, so the INNER JOIN excludes them entirely.
IO-based GRNs are completely invisible in the list.

**Fix:**

```diff
- JOIN purchase_orders po ON po.id = g.po_id
+ LEFT JOIN purchase_orders po ON po.id = g.po_id
+ LEFT JOIN inbound_orders io ON io.id = g.inbound_order_id
```

Also update the SELECT to return the source reference:
```sql
SELECT g.id, g.grn_number, g.status, g.received_date, g.created_at,
       po.po_number,
       io.io_number,
       g.po_id,
       g.inbound_order_id,
       w.code AS warehouse_code, w.name_th AS warehouse_name,
       u.name_en AS received_by_name, COUNT(li.id) AS line_count
```

The `JOIN users u ON u.id = g.received_by` stays as INNER JOIN (received_by is always set on create).

**Verification:** Create one IO-based GRN and one PO-based GRN. Both appear in `/api/grn` list.

---

### BUG-002 — P1: GRN list page links to wrong detail page

**File:** `app/app/grn/page.tsx`

**Problem:** Line 292:
```tsx
<Link href={`/app/purchase-orders/${g.id}`} ...>{g.po_number}</Link>
```
Uses `g.id` (the GRN's own id) — navigates to wrong PO detail page.

**Fix:**
```tsx
{g.po_id ? (
  <Link href={`/app/purchase-orders/${g.po_id}`} className="hover:underline">{g.po_number}</Link>
) : g.io_number ? (
  <Link href={`/app/inbound-orders/${g.inbound_order_id}`} className="hover:underline">{g.io_number}</Link>
) : '—'}
```

The GRN interface on this page must also add `po_id`, `io_number`, `inbound_order_id` fields to match the API response after BUG-001 fix.

Also update GRN list table header: column "เลข PO" → "เอกสารอ้างอิง / Ref." to be accurate for both PO and IO GRNs.

**Verification:** Click PO-based GRN row PO number → navigates to correct PO page. IO-based GRN → navigates to IO page.

---

### BUG-003 — P1: Transfer list scope blinds destination-only staff

**File:** `app/api/transfers/route.ts`

**Problem:** Line 40:
```typescript
const scope = buildWarehouseScopeClause(u, 't.source_warehouse_id', idx);
```
Staff assigned only to warehouse B cannot see transfers where B is the **destination**. They should see both.

**Fix:**

For non-admin users, apply a combined source OR destination scope:

```typescript
// Build scope for source
const srcScope = buildWarehouseScopeClause(u, 't.source_warehouse_id', idx);
if (srcScope) {
  const dstScope = buildWarehouseScopeClause(u, 't.dest_warehouse_id', idx + srcScope.params.length);
  // srcScope and dstScope use the same warehouse_ids array — combine with OR
  conditions.push(`(${srcScope.clause} OR ${dstScope.clause})`);
  params.push(...srcScope.params);
  // dstScope.params is same array reference; only push once (the ANY($n::uuid[]) param)
  idx += srcScope.params.length;
}
```

> **Note:** `buildWarehouseScopeClause` returns `null` for admin (no filter) — safe to skip.
> For `FALSE` clause (staff with no assignments) both sides are `FALSE OR FALSE = FALSE` which is correct.
> For `ANY($n::uuid[])` clause, both sides use the same `assignedWarehouseIds` array; add it to params only once and reuse the same `$n` in both OR sides.

Simplified approach — just build the clause manually:

```typescript
if (u.role !== 'admin') {
  if (!u.assignedWarehouseIds.length) {
    conditions.push('FALSE');
  } else {
    conditions.push(`(t.source_warehouse_id = ANY($${idx}::uuid[]) OR t.dest_warehouse_id = ANY($${idx}::uuid[]))`);
    params.push(u.assignedWarehouseIds);
    idx += 1;
  }
}
```

**Verification:** Staff with only warehouse B assignment can see transfers where B is destination OR source.

---

### BUG-004 — P2: Transfer stock check has race condition

**File:** `app/api/transfers/route.ts`

**Problem:** Lines 83–91: `qty_available` is checked with a plain SELECT before the transaction
inserts stock_ledger rows. Two concurrent transfers for the same product can both pass the check
and both deduct, leaving negative stock.

**Fix:** Change the pre-check SELECT to use `FOR UPDATE`:

```typescript
const balance = await client.query<{ qty_available: string }>(
  'SELECT qty_available FROM stock_balances WHERE warehouse_id = $1 AND product_id = $2 FOR UPDATE',
  [parsed.data.source_warehouse_id, line.product_id]
);
```

This locks the row within the transaction; the second concurrent transfer blocks until the first commits/rolls back.

Also add a zero-stock guard: if `balance.rows[0]` is null (no row in stock_balances), treat as 0 qty.

**Verification:** Two simultaneous transfer requests for the same product with qty=total_available — only one should succeed, the other gets 409.

---

### BUG-005 — P2: GRN QC accepts qty > qty_received

**File:** `app/api/grn/[id]/qc/route.ts`

**Problem:** No server-side validation that `qty_accepted + qty_rejected ≤ qty_received` per line.
A user could accept 100 items when only 50 were received.

**Fix:** Before the UPDATE loop, fetch `qty_received` for each line and validate:

```typescript
// After GRN status check, before loop:
const lineIds = parsed.data.lines.map((l) => l.id);
const existingLines = await query<{ id: string; qty_received: number }>(
  'SELECT id, qty_received FROM grn_line_items WHERE grn_id = $1 AND id = ANY($2::uuid[])',
  [id, lineIds]
);
const lineMap = new Map(existingLines.map((l) => [l.id, l]));

for (const line of parsed.data.lines) {
  const existing = lineMap.get(line.id);
  if (!existing) return apiError(`Line ${line.id} not found`, 422);
  if (line.qty_accepted + line.qty_rejected > Number(existing.qty_received)) {
    return apiError(
      `Line ${line.id}: qty_accepted (${line.qty_accepted}) + qty_rejected (${line.qty_rejected}) exceeds qty_received (${existing.qty_received})`,
      422
    );
  }
}
```

**Verification:** Submit QC with `qty_accepted=100, qty_rejected=0` on a line where `qty_received=50` → returns 422.

---

### BUG-006 — P2: Missing page `delivery-orders/[id]/page.tsx`

**File to CREATE:** `app/app/delivery-orders/[id]/page.tsx`

Per Sales module plan Task 4d, this page was not created. It shows DO detail with action buttons.

Minimum viable page:
- Fetch `GET /api/delivery-orders/[id]`
- Display: do_number, so_number (link to SO), customer, warehouse, status badge, notes
- Lines table: sku, name_th, qty_to_deliver, unit_price, line_total
- Action buttons by status:
  - `draft`: "พร้อมส่ง / Mark Ready" → PATCH `{ action: 'ready' }`
  - `ready`: "ส่งสินค้า / Ship" → PATCH `{ action: 'ship' }` (deducts stock)
  - `shipped`: "ยืนยันส่งถึง / Confirm Delivered" → PATCH `{ action: 'deliver' }`
  - `draft` or `ready`: "ยกเลิก / Cancel" → PATCH `{ action: 'cancel' }`
- Follow `'use client'` + `get`/`patch` from `lib/api-client.ts` pattern

Also need to confirm: does `app/api/delivery-orders/[id]/route.ts` exist? Yes — from glob. Page only is missing.

**Verification:** Navigate to `/app/delivery-orders/[id]` — page loads with correct data.

---

### BUG-007 — P2: Missing page `sales-returns/[id]/page.tsx`

**File to CREATE:** `app/app/sales-returns/[id]/page.tsx`

Per Sales module plan Task 4f, this page was not created.

Minimum viable page:
- Fetch `GET /api/sales-returns/[id]`
- Display: sr_number, customer, warehouse, so_number (if linked), status badge, reason, notes
- Lines table: sku, name_th, qty_returned
- Action buttons by status:
  - `open`: "รับสินค้าคืน / Receive" → PATCH `{ action: 'receive' }`
  - `received`: "คืนสต็อก / Restock" → PATCH `{ action: 'restock' }` (inserts so_return ledger entry)
  - `received`: "ทำลาย / Dispose" → PATCH `{ action: 'dispose' }`
- Follow same pattern as other detail pages

**Verification:** Navigate to `/app/sales-returns/[id]` — page loads and actions work.

---

### BUG-008 — P2: Missing page `accounting/reports/general-ledger/page.tsx`

**File to CREATE:** `app/app/accounting/reports/general-ledger/page.tsx`

Per Accounting module plan Task 4d, this page was not created (it's missing from glob output).

The API route exists: `app/api/accounting/reports/general-ledger/route.ts`

Minimum viable page:
- Filter bar: account selector (CoA dropdown, search by code/name), from_date, to_date
- Table: date, entry_number (link to JE detail), description, debit, credit, running_balance
- Opening balance row at top
- Empty state if no account selected
- `'use client'`, `get` from api-client, `formatDate`, `formatCurrency`

**Verification:** Select account 1100 (Cash), set date range, table shows posted entries with running balance.

---

### BUG-009 — P3: Typo in state setter name

**File:** `app/app/grn/[id]/page.tsx`

**Problem:** Line 62:
```typescript
const [verifyNotes, setVerifyVerifyNotes] = useState('');
```
Setter named `setVerifyVerifyNotes` (doubled "Verify").

**Fix:**
```typescript
const [verifyNotes, setVerifyNotes] = useState('');
```
Update all uses of `setVerifyVerifyNotes` → `setVerifyNotes` (line 255).

**Verification:** `npm run lint` passes. State update still works.

---

### BUG-010 — P3: GRN list modal shows "เลข PO" for IO-based GRNs

**File:** `app/app/grn/page.tsx`

**Problem:** Lines 122–128 in `GRNDetailModal`:
```typescript
{ l: 'เลข PO', v: grn.po_number },
```
For IO-based GRNs, `po_number` is null → shows "—" with misleading label.

**Fix (after BUG-001 adds `io_number` and `inbound_order_id` to API response):**
```typescript
{ l: grn.inbound_order_id ? 'เลข IO' : 'เลข PO', v: grn.io_number ?? grn.po_number ?? '—' },
```

**Verification:** IO-based GRN modal shows "เลข IO" label with IO number.

---

### BUG-011 — P3: GRN list missing "verified" status tab

**File:** `app/app/grn/page.tsx`

**Problem:** The `TABS` array on line 49 is missing `'verified'` status:
```typescript
const TABS = [
  { id: '', label: 'ทั้งหมด' },
  { id: 'draft', label: 'ร่าง' },
  { id: 'received', label: 'รับแล้ว' },
  { id: 'qc_pending', label: 'รอ QC' },
  { id: 'qc_passed', label: 'QC ผ่าน' },
  { id: 'qc_failed', label: 'QC ไม่ผ่าน' },
  { id: 'stocked', label: 'นำเข้าคลัง' },
  // Missing: verified
];
```

**Fix:** Add `{ id: 'verified', label: 'ตรวจสอบแล้ว' }` after `qc_failed`.

**Verification:** "ตรวจสอบแล้ว" tab appears and filters correctly to IO GRNs in verified status.

---

### BUG-012 — P3: GRN Receiving Queue missing sidebar link

**File:** `components/layout/Sidebar.tsx`

**Problem:** `app/app/grn/receiving-queue/page.tsx` exists and is useful, but has no sidebar entry.
Users must navigate via the GRN page button. This hides an important workflow step.

**Fix:** Add to the "รับสินค้า / Receiving" group, after the GRN link:
```typescript
{ href: '/app/grn/receiving-queue', label: 'คิวรับสินค้า / Queue', icon: '📋', permission: 'grn:view' },
```

**Verification:** Sidebar shows new link for users with `grn:view`. Click navigates to receiving queue.

---

## Execution Order

Run in this sequence — some fixes depend on others:

1. **BUG-001** (API fix) → must come before BUG-002, BUG-010
2. **BUG-002** (page fix, depends on API response change from BUG-001)
3. **BUG-003** (transfer scope — standalone)
4. **BUG-004** (transfer race condition — standalone)
5. **BUG-005** (GRN QC validation — standalone)
6. **BUG-006** (create delivery-orders detail page — standalone)
7. **BUG-007** (create sales-returns detail page — standalone)
8. **BUG-008** (create general-ledger report page — standalone)
9. **BUG-009 to BUG-012** (cosmetic — do in one pass)

---

## Files to Modify / Create

| Action | Path | Bug |
|--------|------|-----|
| MODIFY | `app/api/grn/route.ts` | BUG-001 |
| MODIFY | `app/app/grn/page.tsx` | BUG-002, BUG-010, BUG-011 |
| MODIFY | `app/api/transfers/route.ts` | BUG-003, BUG-004 |
| MODIFY | `app/api/grn/[id]/qc/route.ts` | BUG-005 |
| CREATE | `app/app/delivery-orders/[id]/page.tsx` | BUG-006 |
| CREATE | `app/app/sales-returns/[id]/page.tsx` | BUG-007 |
| CREATE | `app/app/accounting/reports/general-ledger/page.tsx` | BUG-008 |
| MODIFY | `app/app/grn/[id]/page.tsx` | BUG-009 |
| MODIFY | `components/layout/Sidebar.tsx` | BUG-012 |

Total: 6 modified, 3 created.

---

## Acceptance Criteria

1. `npm run lint` passes with zero errors after all changes
2. IO-based GRNs appear in GRN list (`/api/grn` returns them)
3. PO link on GRN list navigates to correct PO; IO GRN shows IO link
4. Staff with destination-only warehouse assignment sees incoming transfers
5. Two simultaneous transfers for same product — only one succeeds
6. QC submission with `qty_accepted + qty_rejected > qty_received` returns 422
7. `/app/delivery-orders/[id]` page loads, all action buttons work
8. `/app/sales-returns/[id]` page loads, all action buttons work
9. `/app/accounting/reports/general-ledger` page loads and filters work
10. "ตรวจสอบแล้ว" tab appears in GRN list
11. GRN Receiving Queue link appears in sidebar
12. No regression in existing GRN, PO, or Transfer flows

---
## Execution Logs
- [[execution-summary]]


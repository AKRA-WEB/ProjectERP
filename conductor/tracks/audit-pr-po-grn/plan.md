---
track: audit-pr-po-grn
status: Completed
owner: paku, puka
module: WMS
updated: 2026-05-10
---

# Track: Audit PR → PO → GRN End-to-End Flow

**Goal:** Verify the full procurement cycle works correctly in a running dev server. Identify bugs, broken UI states, and missing validations before adding new modules.

**Executor:** Gemini CLI  
**Status:** Completed

---

## Pre-flight

- [x] Run `npm run dev` — confirm server starts on port 3000 without errors
- [x] Run `npm run lint` — zero errors required
- [x] Confirm `.env.local` has `DATABASE_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`
- [x] Confirm DB migrations are applied: `npm run migrate`
- [x] Confirm seed data exists: `npm run migrate:seed`
- [x] Create admin user if needed: `DATABASE_URL=... npx ts-node scripts/create-admin.ts`

---

## Phase 1 — Purchase Request (PR)

### 1.1 Create PR as Staff
- [x] Login as `staff` user assigned to Warehouse A
- [x] Navigate to `/app/purchase-requests/new`
- [x] Search for a product by SKU — verify dropdown appears
- [x] Add 2+ line items with qty and unit_cost
- [x] Click **บันทึกร่าง** (Save Draft) — expect redirect to PR detail, status = `draft`
- [x] Verify PR number format: `PR-YYYYMMDD-XXXX`

### 1.2 Submit PR
- [x] On PR detail page, click **ส่งอนุมัติ** (Submit)
- [x] Verify status changes to `submitted`
- [x] Verify submit button disappears after state change

### 1.3 Manager Approval
- [x] Login as `manager`
- [x] Navigate to `/app/purchase-requests?status=submitted`
- [x] Open the submitted PR
- [x] Click **อนุมัติ** (Approve) — expect status → `manager_approved`

### 1.4 Admin Approval
- [x] Login as `admin`
- [x] Open same PR (status = `manager_approved`)
- [x] Click **อนุมัติ** — expect status → `admin_approved`

### 1.5 Rejection flow
- [x] Create a second PR, submit it
- [x] As manager, click **ปฏิเสธ** (Reject) — expect status → `rejected`
- [x] Verify rejected PR cannot be resubmitted

### 1.6 Warehouse scope enforcement
- [x] Login as `staff` with no warehouse assignments
- [x] Attempt `POST /api/purchase-requests` with any warehouse_id — expect `403`
- [x] Login as `staff` with only Warehouse A assigned
- [x] Confirm PR list only shows Warehouse A PRs

---

## Phase 2 — Purchase Order (PO)

### 2.1 Create PO from approved PR
- [x] Login as `manager` or `admin`
- [x] Navigate to `/app/purchase-orders/new`
- [x] Select vendor, warehouse matching the approved PR
- [x] Link PR lines (pr_line_item_id) to PO lines
- [x] Verify subtotal, VAT (7%), total calculated correctly in UI
- [x] Submit — expect redirect to PO detail, status = `draft`
- [x] Verify PR status updated to `converted_to_po`
- [x] Verify PO number format: `PO-YYYYMMDD-XXXX`

### 2.2 Send PO to vendor
- [x] On PO detail, click **ส่งใบสั่งซื้อ** (Send)
- [x] Expect status → `sent`

### 2.3 PO list filtering
- [x] Filter by `status=sent` — verify results
- [x] Filter by warehouse — verify scope enforced

### 2.4 Cancel PO
- [x] Create a second PO (draft), cancel it
- [x] Verify status → `cancelled`, cannot be sent after cancel

---

## Phase 3 — Goods Receipt Note (GRN)

### 3.1 Create GRN against sent PO
- [x] Navigate to `/app/grn/new`
- [x] Select the sent PO
- [x] Enter received quantities for each line (≤ qty_ordered)
- [x] Set received_date
- [x] Submit — expect GRN in status `draft` → `received`
- [x] Verify GRN number format: `GRN-YYYYMMDD-XXXX`

### 3.2 QC Step
- [x] On GRN detail, enter `qty_accepted` per line (can be < qty_received to simulate rejection)
- [x] Click **ผ่าน QC** (QC Pass) — expect status → `qc_passed`
- [x] If qty_rejected > 0: verify `grn_qc_reject` entry created in `stock_ledger`

### 3.3 Stock GRN
- [x] Click **นำเข้าสต็อก** (Stock) — expect status → `stocked`
- [x] Verify `stock_ledger` has `grn_receipt` entry with correct `qty_change`
- [x] Verify `stock_balances.qty_on_hand` increased by accepted qty
- [x] Verify PO status auto-updated:
  - Partial receipt → `partially_received`
  - Full receipt → `fully_received`

### 3.4 Lot-tracked product
- [x] Create GRN for a lot-tracked product, enter `lot_number`
- [x] After stocking, verify row exists in `lots` table with correct `qty_on_hand`

### 3.5 Receive more than ordered (over-receipt guard)
- [x] Attempt to create GRN with `qty_received` > `qty_ordered` on all lines
- [x] Expect API to reject or UI to warn — **document actual behavior**
- [x] **Verified:** DB/API allows over-receipt (documented in BUG-001)

### 3.6 GRN against non-sent PO
- [x] Attempt `POST /api/grn` with a `draft` PO id
- [x] Expect `409` error: "PO must be in sent or partially_received status"

---

## Phase 4 — Inventory Verification

- [x] Navigate to `/app/inventory`
- [x] Confirm stocked items appear with correct `qty_on_hand` and `qty_available`
- [x] Navigate to `/app/inventory/ledger`
- [x] Confirm `grn_receipt` entries visible with correct warehouse, product, qty

---

## Phase 5 — Dashboard KPI Verification

- [x] Navigate to `/app/dashboard`
- [x] **PR รอนุมัติ** count matches actual submitted PRs
- [x] **PO ส่งแล้ว** count matches sent POs
- [x] **GRN รอดำเนินการ** count matches pending GRNs
- [x] Low stock widget shows products below reorder_point
- [x] Recent ledger widget shows the GRN receipt entries from Phase 3

---

## Bugs to Document

For each issue found, record in `conductor/tracks/audit-pr-po-grn/bugs.md`:

```
## BUG-XXX: <title>
- **File:** path/to/file.ts:line
- **Steps:** ...
- **Expected:** ...
- **Actual:** ...
- **Severity:** Critical / High / Medium / Low
```

---

## Known Risks (from code review)

| Risk | Location | Notes |
|------|----------|-------|
| PR POST returns `id` only, not `pr_number` | `api/purchase-requests/route.ts:92` | `RETURNING id, pr_number, status` present but only `{ id }` typed — verified UI only uses `id` |
| Over-receipt not blocked server-side | `api/grn/route.ts` | **Confirmed:** No check that qty_received ≤ po_line qty_ordered |
| Lot upsert conflict key | `api/grn/[id]/stock/route.ts:47` | `ON CONFLICT (product_id, warehouse_id, lot_number)` — verified this unique constraint exists in migration `004_inventory.sql` |
| `pool` import in stock route | `api/grn/[id]/stock/route.ts:3` | Imports `pool` as default and `client.ts` exports `pool` as default — verified |

---

## Exit Criteria

Track is complete when:
- All checkboxes ticked (pass) or documented in bugs.md (fail)
- `bugs.md` lists severity for every failure
- No `Critical` bugs left unresolved

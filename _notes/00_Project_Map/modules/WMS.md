---
module: WMS
type: module-summary
status: Stable
updated: 2026-05-18
---

# WMS — Warehouse Management System

The Warehouse Management System (WMS) handles the flow of goods from receiving to storage and shipping. It is the most critical module for stock accuracy and traceability.

## Dependencies
- [[Inventory]] — ส่งข้อมูลสต็อกเข้า/ออกผ่าน `stock_ledger`
- [[Accounting]] — สร้างรายการหนี้สิน (AP Invoices) จากการรับสินค้า (GRN)
- [[BOM]] — รับใบสั่งผลิต (Production Orders) เพื่อเบิกจ่ายวัตถุดิบ
- [[Core]] — ใช้ระบบรันเลขที่เอกสาร และ UI Framework
- **WMS Decisions:** [[po-immediate-approval]], [[stock-ledger-immutability]]
- **Related Debug Logs:** [[2026-05-18-io-grn-500]] (GRN 500 IO), [[2026-05-18-po-gr-audit]] (WMS System Audit)

## Sub-Modules
- **Purchasing / Receiving**: Handles PR, PO, and GRN. Supports Standalone GRN and PR→GR Direct paths.
- **Inventory**: Stock balances, warehouse locations, and stock ledger.
- **Operations**: Picking lists, Shipments, and internal transfers.
- **Post-Receipt**: RMA (Returns) and Vendor Claims.

## Key Flows
```
PR → PO → GRN → (Transfer | Cycle Count | RMA | Claim)
```

### Receiving Workflow (New)
1. **Normal**: PR → PO → GRN (Source: PO)
2. **Fast-track**: PR → GRN (Source: PR_DIRECT)
3. **Emergency**: GRN (Standalone) → Retrospective PO

### Stock Valuation
All GRN line items must capture `unit_cost` at the point of entry. This cost is recorded in the `stock_ledger` and propagates to `stock_balances`.

## API Routes (quick reference)
```
GET/POST   /api/grn                     list + create (IO + PO + standalone)
GET/PATCH  /api/grn/[id]               detail + status transitions
POST       /api/grn/[id]/receive        mark received
POST       /api/grn/[id]/qc            QC accept/reject (role-gated)
POST       /api/grn/[id]/stock         insert stock_ledger rows
GET        /api/grn/receiving-queue    dashboard
GET/POST   /api/inbound-orders         IO list + create
GET/PATCH  /api/inbound-orders/[id]    IO detail
GET        /api/inventory              stock balances
GET        /api/inventory/reorder      reorder analysis
GET        /api/inventory/valuation    valuation report
GET/POST   /api/cycle-counts           cycle count
```

## Key DB Column / Query Traps
```sql
-- grn_line_items must include unit_cost (Migration 036)
INSERT INTO grn_line_items (..., unit_cost, line_total)

-- GRN source: XOR — NOT (po_id IS NOT NULL AND inbound_order_id IS NOT NULL)
-- IO-based GRN splits: always carry inbound_order_id

-- stock_ledger: INSERT ONLY — never UPDATE/DELETE
-- stock_balances: generated column — never UPDATE directly

-- Batch INSERT enum cast required: $N::grn_source_type
```

## Technical Details
- **Tables**: `goods_receipt_notes` / `grn_headers`, `grn_line_items` / `grn_lines`, `purchase_requisitions` / `purchase_requests`, `purchase_orders`, `stock_ledger`, `transfers`, `cycle_counts`, `rma_headers`, `claims`.
- **Linking**: Bidirectional — `po_id` on GRN (normal flow), `source_grn_id` on PO (retrospective).
- **Transactions**: All multi-write routes (`create`, `receive`, `stock`, `confirm`, `approve`, `qc`) use `pool.connect()` + BEGIN/COMMIT/ROLLBACK.

## Business Rules
- Stock ledger insert-only — never UPDATE/DELETE.
- Transfer completes atomically (debit source + credit destination).
- Cycle count approval via stored proc `apply_cycle_count()`.
- PO status auto-updates after GRN stocking.

## Recent Changes (2026-05-18)
- Implemented GR-First workflow.
- Fixed missing `unit_cost` in `grn_line_items` (Migration 036).
- Added `source_type` enum to differentiate between PO, IO, Standalone, and PR-Direct receipts.
- **Fixed GRN 500 (io-grn-500):** Batch INSERT stride mismatch in `app/api/grn/route.ts` — stride was `i*9` but params per row = 10. Fixed to `i*10`. Also added `.refine()` for `chk_grn_source` mutual exclusivity.
- **po-gr-audit (Fixed):** PO POST, GRN POST (PO/IO path), and GRN QC routes refactored to use transactional wrapping (`pool.connect()`). GRN QC now includes role-based access control.
- **Transaction pattern:** All multi-write routes use `pool.connect()` + BEGIN/COMMIT correctly.

## Tracks

```dataview
TABLE status, updated
FROM "conductor/tracks"
WHERE file.name = "plan" AND module = "WMS"
SORT updated DESC
```

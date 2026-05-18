# Debug Log — PO & GRN System Audit
**Date:** 2026-05-18
**Module:** WMS — Purchase Orders, Goods Receipts
**Trigger:** User report "หลายฟังก์ชันใช้งานไม่ได้ การบันทึกไม่ทำงาน"

---

## Root Cause Summary

ปัญหาเกิดจาก 2 แหล่ง: Gemini execution gaps + Claude planning gaps

### Gemini Execution Failures

**1. Header-only INSERT pattern (เกิดซ้ำ PO + GRN)**
- `POST /api/purchase-orders` → INSERT `purchase_orders` header เท่านั้น, `purchase_order_items` ว่างเปล่า
- `POST /api/goods-receipts` → เหมือนกัน
- `GET /api/purchase-orders/[id]` → ไม่ JOIN items table
- Pattern: Gemini implement "first step" แล้วหยุด ไม่ทำ child table inserts

**2. CLAUDE.md conventions ถูกข้ามทั้งหมด**
- `body.action` discriminant → ไม่ใช้, ส่ง `{ status: 'x' }` แทน
- `buildWarehouseScopeClause()` → ไม่เรียกใน GET list ทุก endpoint
- `next_doc_number(prefix, seq)` → ไม่เรียก, ไม่มี doc number หรือ generate app-side

**3. Stock ledger ไม่มี INSERT (critical)**
- GRN `stocked` transition → UPDATE status เท่านั้น
- ไม่มี `INSERT INTO stock_ledger` → `sync_stock_balances()` trigger ไม่เคย fire
- ผล: stock balances ไม่เคยอัพเดทเลยตั้งแต่ deploy

**4. ไม่มี transaction wrapping**
- Multi-step writes ทุก route ทำ separate `db.query()` calls
- Partial failure → orphan rows, inconsistent state

**5. Status machine ไม่ enforce**
- PATCH ไม่ validate current status ก่อน apply ใหม่
- ไม่มี role guard บน privileged transitions

### Claude Planning Failures

**6. Plan ไม่ระบุ sub-steps ครบ**
- Plan บอกแค่ "สร้าง PO API" ไม่ได้ break down: items insert, transaction boundary, doc number, side effects
- Gemini implement แค่ที่เห็นชัด → skeleton ที่ compile ได้แต่ logic ขาด

---

## Files Affected

| File | Issues |
|------|--------|
| `app/api/purchase-orders/route.ts` | PO-API-01, 02, 03, 04, 05 |
| `app/api/purchase-orders/[id]/route.ts` | PO-API-06, 07, 08 |
| `app/api/goods-receipts/route.ts` | GRN-API-01, 02, 03, 04, 08 |
| `app/api/goods-receipts/[id]/route.ts` | GRN-API-05, 06, 07, 09 |
| `app/(wms)/purchase-orders/new/page.tsx` | PO-UI-01, 02 |
| `app/(wms)/purchase-orders/[id]/page.tsx` | PO-UI-03, 04 |
| `app/(wms)/purchase-orders/page.tsx` | PO-UI-05 |
| `app/(wms)/goods-receipts/new/page.tsx` | GRN-UI-01, 02, 03 |
| `app/(wms)/goods-receipts/[id]/page.tsx` | GRN-UI-04 |
| `app/(wms)/goods-receipts/page.tsx` | GRN-UI-05 |

---

## Fix Plan

→ `conductor/tracks/po-gr-audit/plan.md` (14 tasks, written 2026-05-18)

---

## Prevention

→ Pitfalls added to `_notes/02_Agent_Memory/pitfalls.md`:
- Skeleton Implementation trap
- CLAUDE.md conventions not read by Gemini
- Side effects missing on status transitions
- Missing transaction wrapping
- Plan sub-steps insufficient (Claude)

→ Chen checklist updated: every task plan must spec transaction boundary, doc number step, child table inserts, side effects, response shape

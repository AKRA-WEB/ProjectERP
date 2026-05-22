---
module: Repack
type: module-summary
status: Completed
updated: 2026-05-20
---

# Repack — ระบบปรับปรุงแพ็คเกจสินค้า (การแบ่งสินค้า)

The Repack module allows for breaking down bulk products (e.g., 25kg bags) into smaller units (e.g., 1kg packs) while maintaining strict inventory integrity. It handles the automated decrement of source stock and increment of target stock within a single transaction.

## Dependencies
- [[Inventory]] (ดึงข้อมูลสต็อกต้นทางและปลายทาง)
- [[WMS]] (จัดการการเบิก-จ่ายทางบัญชีคลังสินค้า)
- [[Core]] (ระบบ Transaction, UI Layout, ViewTransition)

## Flow
```
Select Source Product (Bulk) 
  → Set Multiple Target Products (Packs) 
    → Weight Validation (Weight In = Weight Out)
      → Auto-decrement Source Qty 
        → Auto-increment Target Qty 
          → Print Barcode Stub
```

## API Architecture

| Route | Method | Description |
|-------|--------|-------------|
| `/api/repack` | GET | List all repack operations |
| `/api/repack` | POST | Execute repack (Consumes source, Produces targets) |
| `/api/repack/[id]` | GET | Detail of a specific repack operation |

## Inventory Logic (Transaction)
Every repack operation executes the following in a single SQL transaction (`pool.connect()` + `BEGIN/COMMIT/ROLLBACK`):
1. **INSERT** into `repack_orders` (Header บันทึกการแปลงแพ็คเกจ).
2. **INSERT** into `repack_order_lines` (Line items รายการสินค้าปลายทางที่ผลิตได้).
3. **INSERT** into `stock_ledger` for **Source**: `qty_change = -consumed_qty`, `entry_type = 'repack_out'`.
4. **INSERT** into `stock_ledger` for **Targets**: `qty_change = +produced_qty`, `entry_type = 'repack_in'`.
5. **Trigger:** `sync_stock_balances()` automatically updates `stock_balances` table.

## Business Rules
- วัตถุดิบต้นทาง (Source) กับ สินค้าปลายทาง (Target) ต้องเป็นคนละตัวกัน.
- จำนวนสินค้า (Qty) ต้องมากกว่า 0 เสมอ.
- ระบบจะเช็ค Weight In vs Weight Out เพื่อนำเสนอรายงานความแตกต่างน้ำหนักในการผลิต.
- สต็อกจะถูกปรับเปลี่ยนแบบ Real-time ทันทีผ่าน SQL Transaction เดียวเพื่อป้องกันสต็อกขาดหรือเกินเสมือน.

## Engineering Standards
- **Transaction Safety:** Uses `pool.connect()` + `BEGIN/COMMIT/ROLLBACK` to prevent orphaned stock movements.
- **UoM Handling:** System supports multi-UoM (source unit vs target unit) — developers must ensure conversion factors are handled if not using base units.
- **UI:** Uses `ViewTransition` for seamless navigation between list and detail.

## Tracks
- `repack-order` — Completed

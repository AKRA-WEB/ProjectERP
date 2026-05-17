---
module: POS
type: module-summary
---

# POS — Point of Sale

ระบบขายหน้าร้าน. รองรับ member, held bills, shifts, barcode scanner.

## Dependencies
- [[Inventory]] — ตัดสต็อกทันทีเมื่อปิดการขาย (Stock Deduction)
- [[Accounting]] — ส่งข้อมูลรายได้ (Revenue) และภาษีขาย
- [[Core]] — ใช้ระบบ Auth และ UI สำหรับหน้าจอ Touchscreen

## Flow
```
Open Session → Shift → Cart → (Hold Bill | Checkout) → Transaction → Close Session
```

## Key Tables
- `pos_sessions` · `pos_shifts` · `pos_transactions` · `pos_transaction_items`
- `pos_held_carts` · `pos_members`

## Business Rules
- Session ต้อง open ก่อน transaction
- Points update ต้องอยู่ใน transaction block (ก่อน COMMIT)
- Shift number ต้องใช้ sequence — ห้าม Math.random()
- Discount validation ต้องอยู่ server-side

## Tracks

```dataview
TABLE status, updated
FROM "conductor/tracks"
WHERE file.name = "plan" AND module = "POS"
SORT updated DESC
```

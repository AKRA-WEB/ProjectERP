---
module: Repack
type: module-summary
---

# Repack — ระบบปรับปรุงแพ็คเกจสินค้า (การแบ่งสินค้า)

ระบบที่ใช้แตกสินค้าชิ้นใหญ่ (Bulk เช่น กระสอบ 25kg) เป็นสินค้าขนาดเล็ก (Packs เช่น ถุง 1kg) โดยระบบจะช่วยควบคุมความถูกต้องของสต็อกและ UoM ในระดับธุรกรรม (Database Transaction)

## Dependencies
- **Receives data from:** [[Inventory]] (ดึงข้อมูลสต็อกต้นทางและปลายทาง)
- **Feeds data to:** [[WMS]] (จัดการการเบิก-จ่ายทางบัญชีคลังสินค้า)
- **References:** [[REPACK_MODULE_SUMMARY]] (รายละเอียดเชิงลึกและ API)
- **Uses Infrastructure from:** [[Core]] (ระบบ Transaction, UI Layout)

## Flow
```
Select Source Product (Bulk) 
  → Set Multiple Target Products (Packs) 
    → Weight Validation (Weight In = Weight Out)
      → Auto-decrement Source Qty 
        → Auto-increment Target Qty 
          → Print Barcodes
```

## Key Tables
- `repack_orders` (Header บันทึกการแปลงแพ็คเกจ)
- `repack_order_lines` (Line items รายการสินค้าปลายทางที่ผลิตได้)
- `stock_ledger` (บันทึกความเคลื่อนไหว: `repack_out` สำหรับต้นทาง, `repack_in` สำหรับปลายทาง)

## Business Rules
- วัตถุดิบต้นทาง (Source) กับ สินค้าปลายทาง (Target) ต้องเป็นคนละตัวกัน
- จำนวนสินค้า (Qty) ต้องมากกว่า 0 เสมอ
- ระบบจะเช็ค Weight In vs Weight Out เพื่อนำเสนอรายงานความแตกต่างน้ำหนักในการผลิต
- สต็อกจะถูกปรับเปลี่ยนแบบ Real-time ทันทีผ่าน SQL Transaction เดียวเพื่อป้องกันสต็อกขาดหรือเกินเสมือน

## Tracks
- `repack-order` — Completed

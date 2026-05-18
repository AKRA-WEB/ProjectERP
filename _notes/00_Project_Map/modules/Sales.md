---
module: Sales
type: module-summary
---

# Sales — ระบบขาย

ระบบ Sales Order Management ครบวงจร.

## Dependencies
- [[Inventory]] — ตรวจสอบสถานะสินค้าและจองสินค้า (Picking/Reservation)
- [[Accounting]] — สร้างใบแจ้งหนี้ (Sales Invoices) และรายการลูกหนี้ (AR)
- [[Core]] — ใช้ระบบรันเลขที่เอกสาร (SQ, SO, DO, SI, SR)

## Flow
```
SQ (Quotation) → SO (Order) → DO (Delivery) → SI (Invoice) → SR (Receipt)
```

## Key Tables
- `sales_quotations` · `sales_orders` · `delivery_orders`
- `sales_invoices` · `sales_receipts`

## Business Rules
- SO confirmed → triggers outbound picking workflow
- SI linked to SO — ห้าม invoice เกิน qty ที่ deliver
- SR ต้อง match กับ SI amount

## Tracks

```dataview
TABLE status, updated
FROM "conductor/tracks"
WHERE file.name = "plan" AND module = "Sales"
SORT updated DESC
```

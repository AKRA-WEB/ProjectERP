---
module: Vendors
type: module-summary
---

# Vendors — ระบบผู้ขาย

Vendor master, product links, bank accounts, Excel import.

## Dependencies
- [[WMS]] — ข้อมูลพื้นฐานสำหรับสร้าง PR/PO
- [[Accounting]] — จัดการข้อมูลบัญชีเจ้าหนี้ (AP)
- [[Inventory]] — เชื่อมโยงราคาทุนและ Lead time ของสินค้า
- **Architectural Summaries:** [[ACCOUNTING_MODULE_SUMMARY]] (AP Sub-system), [[WMS_MODULE_SUMMARY]] (Purchase Orders)

## Key Tables
- `vendors` · `vendor_products` (product links)
- `vendor_bank_accounts`

## Business Rules
- Vendor-product link: vendor สามารถมีหลาย products, product สามารถมีหลาย vendors
- Import Excel: validate SKU ก่อน insert — ถ้า SKU ไม่มีใน products → skip with error log
- Bank account ต้องมี account_number + bank_name อย่างน้อย

## Tracks

```dataview
TABLE status, updated
FROM "conductor/tracks"
WHERE file.name = "plan" AND module = "Vendors"
SORT updated DESC
```

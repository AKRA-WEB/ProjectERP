---
track: i18n-t2-keys
phase: i18n-compliance
sequence: 2
status: Verified
owner: Chen
created: 2026-05-29
depends_on: [i18n-t1-prevention]
estimate: S
tags: [i18n, translation-keys]
spec: docs/superpowers/specs/2026-05-29-i18n-full-compliance-design.md
---

# i18n Track 2 — Translation Keys Expansion

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

## Goal

Add ~65 missing translation keys to `lib/i18n/en.json` and `lib/i18n/th.json` so that Tracks 3–6 can reference them. Both files must stay in sync — every key in one must exist in the other.

## Architecture

No code changes. Pure JSON additions. Keys are grouped by the module that uses them (accounting, GRN, admin/WMS, menu).

## Tech Stack

JSON, TypeScript (DictKey type auto-derived from th.json keyof)

## Acceptance Criteria

1. All keys listed below exist in both `en.json` and `th.json`
2. `npx tsc --noEmit` passes — DictKey type still valid
3. No duplicate keys (check with grep)

---

## Files

| Action | Path |
|--------|------|
| Modify | `lib/i18n/en.json` |
| Modify | `lib/i18n/th.json` |

---

## Tasks

### Task 1: Add keys to en.json

- [x] **Step 1.1:** Open `lib/i18n/en.json`. Find the end of the `"page.*"` block. Add after the last page key:

```json
  "page.audit_ledger": "Audit General Ledger",
  "page.vat_report_desc": "Monthly VAT report (PP.30) — purchase and sales tax",
  "page.admin_pricing": "Product Pricing",
  "page.wms_replenish": "Replenishment",
  "page.hrzoft_integration": "Hrzoft Integration",
  "page.select_module": "Select Module",
```

- [x] **Step 1.2:** Find the end of the `"label.*"` block. Add after the last label key:

```json
  "label.from_date": "From Date",
  "label.to_date": "To Date",
  "label.je_no": "JE No.",
  "label.memo": "Memo",
  "label.debit": "Debit",
  "label.credit": "Credit",
  "label.all_accounts": "All Accounts",
  "label.select_account": "Account",
  "label.purchase_vat": "Purchase VAT",
  "label.sales_vat": "Sales VAT",
  "label.tax_base": "Tax Base",
  "label.vat_7pct": "VAT 7%",
  "label.tax_period": "Tax Period",
  "label.lot_no": "Lot No.",
  "label.expiry_date": "Expiry Date",
  "label.mfg_date": "Mfg. Date",
  "label.storage_location": "Storage Location",
  "label.po_number": "PO No.",
  "label.qty_ordered": "Qty Ordered",
  "label.qty_received": "Qty Received",
  "label.qty_input": "Receive Qty",
  "label.bonus_item": "Bonus Item",
  "label.min_price": "Min Price",
  "label.price_channel": "Channel",
  "label.price_tier": "Tier",
  "label.valid_from": "Valid From",
  "label.valid_to": "Valid To",
  "label.reorder_point": "Reorder Point",
  "label.stock_on_hand": "On Hand",
  "label.skipped": "Not Arrived",
  "label.grn_lines": "Receipt Lines",
```

- [x] **Step 1.3:** Find the end of the `"confirm.*"` block. Add:

```json
  "confirm.finalize_purchase_vat": "Confirm lock \"Purchase VAT\" for period",
  "confirm.finalize_sales_vat": "Confirm lock \"Sales VAT\" for period",
  "confirm.irreversible": "Once locked, this cannot be undone.",
  "confirm.delete_grn": "Confirm delete this GRN? This cannot be undone.",
```

- [x] **Step 1.4:** Find the end of the `"error.*"` block. Add:

```json
  "error.select_sku": "Please select a product (SKU)",
  "error.invalid_price": "Price must be a number ≥ 0",
  "error.invalid_date_format": "Date must be YYYY-MM-DD",
  "error.date_range": "End date must not be before start date",
  "error.select_product": "Please select a product first",
```

- [x] **Step 1.5:** Find the end of the `"greeting.*"` block (last block). Add a new `"msg.*"` block after it:

```json
  "msg.lock_report_success": "Report locked and audit log created",
  "msg.lock_report_error": "Failed to lock report",
  "msg.loading_data": "Loading...",
  "msg.no_access": "You do not have access to any modules",
  "msg.no_records": "No records found",
  "msg.save_success": "Saved successfully",
  "msg.save_error": "Failed to save",
  "msg.import_success": "Imported successfully",
  "msg.import_error": "Import failed",
  "msg.grn_success": "GRN created successfully",
  "msg.grn_error": "Failed to create GRN",
  "msg.searching": "Searching...",
  "msg.not_arrived": "Not arrived",
```

- [x] **Step 1.6:** Add a `"month.*"` block after `"msg.*"`:

```json
  "month.jan": "January",
  "month.feb": "February",
  "month.mar": "March",
  "month.apr": "April",
  "month.may": "May",
  "month.jun": "June",
  "month.jul": "July",
  "month.aug": "August",
  "month.sep": "September",
  "month.oct": "October",
  "month.nov": "November",
  "month.dec": "December",
```

---

### Task 2: Mirror all keys in th.json

- [x] **Step 2.1:** Open `lib/i18n/th.json`. Add the same key groups with Thai translations in the same positions:

**page.* additions:**
```json
  "page.audit_ledger": "สมุดบัญชีแยกประเภท (ผู้ตรวจสอบ)",
  "page.vat_report_desc": "รายงานภาษีซื้อและภาษีขายประจำเดือน เพื่อยื่นสรรพากร (ภ.พ.30)",
  "page.admin_pricing": "ตั้งราคาสินค้า",
  "page.wms_replenish": "การเติมสต็อก",
  "page.hrzoft_integration": "การเชื่อมต่อ Hrzoft",
  "page.select_module": "เลือกระบบงาน",
```

**label.* additions:**
```json
  "label.from_date": "ตั้งแต่วันที่",
  "label.to_date": "ถึงวันที่",
  "label.je_no": "เลขที่ใบสำคัญ",
  "label.memo": "รายละเอียด",
  "label.debit": "เดบิต",
  "label.credit": "เครดิต",
  "label.all_accounts": "ทั้งหมด",
  "label.select_account": "รหัสหรือชื่อบัญชี",
  "label.purchase_vat": "ภาษีซื้อ",
  "label.sales_vat": "ภาษีขาย",
  "label.tax_base": "มูลค่า (ฐานภาษี)",
  "label.vat_7pct": "ภาษีมูลค่าเพิ่ม 7%",
  "label.tax_period": "รอบภาษี",
  "label.lot_no": "เลขที่ล็อต",
  "label.expiry_date": "วันหมดอายุ",
  "label.mfg_date": "วันที่ผลิต",
  "label.storage_location": "ตำแหน่งจัดเก็บ",
  "label.po_number": "เลขที่ใบสั่งซื้อ",
  "label.qty_ordered": "จำนวนสั่งซื้อ",
  "label.qty_received": "จำนวนที่รับแล้ว",
  "label.qty_input": "จำนวนรับครั้งนี้",
  "label.bonus_item": "สินค้าแถม",
  "label.min_price": "ราคาขั้นต่ำ",
  "label.price_channel": "ช่องทาง",
  "label.price_tier": "ระดับ",
  "label.valid_from": "วันที่เริ่มต้น",
  "label.valid_to": "วันที่สิ้นสุด",
  "label.reorder_point": "จุดสั่งซื้อ",
  "label.stock_on_hand": "คงเหลือ",
  "label.skipped": "ยังไม่เข้า",
  "label.grn_lines": "รายการรับสินค้า",
```

**confirm.* additions:**
```json
  "confirm.finalize_purchase_vat": "คุณแน่ใจหรือไม่ที่จะล็อก \"ภาษีซื้อ\" ประจำรอบ",
  "confirm.finalize_sales_vat": "คุณแน่ใจหรือไม่ที่จะล็อก \"ภาษีขาย\" ประจำรอบ",
  "confirm.irreversible": "เมื่อล็อกแล้วจะไม่สามารถย้อนกลับหรือแก้ไขได้",
  "confirm.delete_grn": "ยืนยันลบใบรับสินค้านี้? ไม่สามารถย้อนกลับได้",
```

**error.* additions:**
```json
  "error.select_sku": "กรุณาเลือกสินค้า (SKU)",
  "error.invalid_price": "ราคาต้องเป็นตัวเลขและมากกว่าหรือเท่ากับ 0",
  "error.invalid_date_format": "วันที่ต้องอยู่ในรูปแบบ YYYY-MM-DD",
  "error.date_range": "วันที่สิ้นสุดต้องไม่น้อยกว่าวันที่เริ่มต้น",
  "error.select_product": "กรุณาเลือกสินค้าก่อน",
```

**msg.* additions:**
```json
  "msg.lock_report_success": "ล็อกรายงานและสร้างบันทึกประวัติสำเร็จเรียบร้อยแล้ว",
  "msg.lock_report_error": "เกิดข้อผิดพลาดในการล็อกรายงาน",
  "msg.loading_data": "กำลังโหลดข้อมูล...",
  "msg.no_access": "ขออภัย คุณยังไม่มีสิทธิ์เข้าถึงระบบใดๆ",
  "msg.no_records": "ไม่พบรายการที่ตรงกัน",
  "msg.save_success": "บันทึกสำเร็จ",
  "msg.save_error": "เกิดข้อผิดพลาดในการบันทึก",
  "msg.import_success": "นำเข้าข้อมูลสำเร็จ",
  "msg.import_error": "เกิดข้อผิดพลาดในการนำเข้าข้อมูล",
  "msg.grn_success": "สร้างใบรับสินค้าสำเร็จ",
  "msg.grn_error": "เกิดข้อผิดพลาดในการสร้างใบรับสินค้า",
  "msg.searching": "กำลังค้นหา...",
  "msg.not_arrived": "ยังไม่มาถึง",
```

**month.* additions:**
```json
  "month.jan": "มกราคม",
  "month.feb": "กุมภาพันธ์",
  "month.mar": "มีนาคม",
  "month.apr": "เมษายน",
  "month.may": "พฤษภาคม",
  "month.jun": "มิถุนายน",
  "month.jul": "กรกฎาคม",
  "month.aug": "สิงหาคม",
  "month.sep": "กันยายน",
  "month.oct": "ตุลาคม",
  "month.nov": "พฤศจิกายน",
  "month.dec": "ธันวาคม",
```

---

### Task 3: Validate and commit

- [x] **Step 3.1:** Verify JSON is valid

```bash
node -e "require('./lib/i18n/en.json'); console.log('en.json OK')"
node -e "require('./lib/i18n/th.json'); console.log('th.json OK')"
```

Expected: `en.json OK` and `th.json OK`. If syntax error, fix the JSON (missing comma, trailing comma, etc.)

- [x] **Step 3.2:** Verify no duplicate keys

```bash
node -e "
const en = require('./lib/i18n/en.json');
const th = require('./lib/i18n/th.json');
const enKeys = Object.keys(en);
const thKeys = Object.keys(th);
const missing = enKeys.filter(k => !th[k]);
const extra = thKeys.filter(k => !en[k]);
if (missing.length) console.error('Missing in th.json:', missing);
if (extra.length) console.error('Extra in th.json:', extra);
if (!missing.length && !extra.length) console.log('Keys in sync:', enKeys.length, 'keys');
"
```

Expected: `Keys in sync: <N> keys` — no missing or extra.

- [x] **Step 3.3:** Run TypeScript check

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: 0 errors related to `DictKey`.

- [x] **Step 3.4:** Commit

```bash
git add lib/i18n/en.json lib/i18n/th.json
git commit -m "feat(i18n): add ~65 missing translation keys for accounting/GRN/admin/WMS/menu"
```

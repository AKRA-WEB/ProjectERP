# Track: i18n Label Fix — Thai Labels for Statuses, Entry Types & Modules

**Status:** Completed  
**Created:** 2026-05-10  
**Priority:** Medium — UX issue, not a blocker

---

## Problem Summary

Several UI labels display raw English/code values instead of Thai text:

| Location | Current (Bug) | Expected |
|---|---|---|
| `StatusBadge` (all list + detail pages) | `manager approved`, `pending verification` | ผู้จัดการอนุมัติ, รอตรวจสอบ |
| `inventory/ledger/page.tsx` — filter dropdown | `grn receipt`, `transfer out` | รับสินค้า GRN, โอนออก |
| `inventory/ledger/page.tsx` — table badge | `grn_receipt` → `grn receipt` | รับสินค้า GRN |
| `admin/roles/new/page.tsx` — permission module header | `inbound_order` | Inbound Order |
| `admin/roles/[id]/page.tsx` — permission module header | `inbound_order` | Inbound Order |
| `admin/users/UserRoleModal.tsx:100` | `toLocaleDateString()` (no locale) | use `formatDate()` utility |

---

## Tasks

### Task 1 — Add Thai label map to `StatusBadge`
- [x] File: `components/ui/StatusBadge.tsx`
- [x] Add `LABEL_TH: Record<string, string>` mapping all known status codes to Thai
- [x] Change display: `LABEL_TH[status] ?? status.replace(/_/g, ' ')`

**Full mapping needed:**
```
draft           → ร่าง
submitted       → ส่งแล้ว
manager_approved → ผู้จัดการอนุมัติ
admin_approved  → แอดมินอนุมัติ
rejected        → ถูกปฏิเสธ
converted_to_po → แปลงเป็น PO
sent            → ส่งแล้ว
partially_received → รับบางส่วน
fully_received  → รับครบ
invoiced        → ออกใบแจ้งหนี้
paid            → ชำระแล้ว
closed          → ปิดแล้ว
cancelled       → ยกเลิก
received        → รับแล้ว
verified        → ตรวจสอบแล้ว
receiving       → กำลังรับ
pending_verification → รอตรวจสอบ
qc_pending      → รอ QC
qc_passed       → ผ่าน QC
qc_failed       → ไม่ผ่าน QC
stocked         → เข้าสต็อกแล้ว
pending         → รอดำเนินการ
completed       → เสร็จสิ้น
open            → เปิด
in_review       → กำลังพิจารณา
resolved        → แก้ไขแล้ว
approved        → อนุมัติแล้ว
counting        → กำลังนับ
pending_approval → รออนุมัติ
```

---

### Task 2 — Add Thai labels to ledger entry type filter & badge
- [x] File: `app/app/inventory/ledger/page.tsx`
- [x] Add `ENTRY_LABELS: Record<string, string>` mapping:
  ```
  grn_receipt           → รับสินค้า (GRN)
  grn_qc_reject         → ตีคืน QC
  rma_return            → รับคืน RMA
  rma_vendor_return     → คืนผู้จำหน่าย
  transfer_out          → โอนออก
  transfer_in           → โอนเข้า
  cycle_count_adjustment → ปรับสต็อก (นับ)
  manual_adjustment     → ปรับสต็อก (manual)
  ```
- [x] Use in filter `<option>`: `ENTRY_LABELS[t] ?? t`
- [x] Use in table `<Badge>`: `ENTRY_LABELS[l.entry_type] ?? l.entry_type`

---

### Task 3 — Add Thai labels to permission module headers
- [x] File: `app/app/admin/roles/new/page.tsx` (line 75)
- [x] File: `app/app/admin/roles/[id]/page.tsx` (line 98)
- [x] Add `MODULE_LABELS: Record<string, string>`:
  ```
  inbound_order   → Inbound Order (รับสินค้า LINE)
  purchase_request → ใบขอซื้อ
  purchase_order  → ใบสั่งซื้อ
  grn             → ใบรับสินค้า (GRN)
  rma             → การคืนสินค้า (RMA)
  claim           → การเคลม
  transfer        → การโอนสินค้า
  cycle_count     → การนับสต็อก
  inventory       → สต็อก / คลัง
  admin           → จัดการระบบ
  ```
- [x] Change display: `MODULE_LABELS[module] ?? module.replace(/_/g, ' ')`

---

### Task 4 — Fix raw `toLocaleDateString()` → `formatDate()`
- [x] File: `app/app/admin/users/UserRoleModal.tsx` line 100
- [x] Replace `new Date(r.assigned_at).toLocaleDateString()` → `formatDate(r.assigned_at)`
- [x] Add import: `import { formatDate } from '@/lib/format'`

---

## Acceptance Criteria

- [x] All status badges across list pages and detail pages show Thai text
- [x] Ledger filter dropdown shows Thai entry type names
- [x] Ledger table badges show Thai entry type names
- [x] Permission module group headers in Roles admin show Thai/bilingual names
- [x] Role assignment date in UserRoleModal uses Thai locale (Bangkok TZ)
- [x] No new TypeScript errors
- [x] `npm run build` passes cleanly

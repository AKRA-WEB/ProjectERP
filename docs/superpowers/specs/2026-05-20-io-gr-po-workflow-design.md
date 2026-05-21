# IO → GR → PO Workflow Design

**Date:** 2026-05-20  
**Status:** Approved  
**Module:** WMS / Purchasing  
**Track (to be created):** `io-gr-po-workflow`

---

## 1. Objective

Replace the current PR → PO → GRN flow with a warehouse-first flow:

**IO (หัวหน้าสร้าง) → GRN (Staff รับสินค้า) → Confirm (หัวหน้ายืนยัน + Stock IN) → PO (จัดซื้อใส่ราคา)**

Pain points solved:
- ของมาแล้วแต่ยังไม่มี PO → รับไม่ได้ในระบบเดิม
- Partial delivery ทำให้ข้อมูลกระจาย
- ค่าลิฟท์ (W2) ไม่มีที่บันทึก
- ไม่มี supervisor verification step ก่อน stock เข้า

---

## 2. Roles & Permissions

| Role | สิทธิ์ |
|------|--------|
| `manager` / `admin` (Supervisor) | สร้าง IO, แก้ไข IO, ยืนยัน GRN, ตีกลับ GRN, เห็นทุก IO/GRN ในคลังตัวเอง |
| `warehouse_staff` (Staff) | ดู IO ที่ open/receiving, สร้าง GRN จาก IO, พักบิล, ส่งรับเรียบร้อย, แก้ไข GRN ที่ rejected |
| `manager` / `admin` (Purchaser) | ดู IO ที่ confirmed, สร้าง PO จาก IO หลายใบ (ใช้ role เดิม — ไม่ต้อง role ใหม่) |

---

## 3. State Machines

### IO Status

```
open → receiving → received → confirmed → converted_to_po
                       ↑           |
                       └── rejected ←┘  (Supervisor ตีกลับ)
```

| Status | Triggered by |
|--------|-------------|
| `open` | Supervisor สร้าง IO |
| `receiving` | Staff สร้าง GRN แรกจาก IO นี้ |
| `received` | Staff กด [รับลงสินค้าเรียบร้อย] |
| `confirmed` | Supervisor กด [ยืนยันการรับสินค้า] → **stock ledger insert** |
| `converted_to_po` | Purchaser สร้าง PO ที่รวม IO นี้ |
| `receiving` (กลับ) | Supervisor กด [ตีกลับ] |

### GRN Status (IO-based)

```
draft → received → confirmed → stocked → po_created
            ↑           |
            └── rejected ←┘  (Supervisor ตีกลับ)
```

| Status | Triggered by |
|--------|-------------|
| `draft` | Staff กด [พักบิล] |
| `received` | Staff กด [รับลงสินค้าเรียบร้อย] |
| `confirmed` | Supervisor กด [ยืนยัน] |
| `stocked` | **Auto** ทันทีหลัง confirmed — INSERT stock_ledger (unit_cost = 0) |
| `po_created` | Purchaser สร้าง PO รวม IO นี้ |
| `rejected` | Supervisor กด [ตีกลับ] |

---

## 4. Partial Delivery — Auto IO Split

เมื่อ Staff กด [รับลงสินค้าเรียบร้อย]:
- System เปรียบเทียบ `grn_line_items.qty_received` vs `inbound_order_lines.qty_ordered`
- หาก `qty_received < qty_ordered` สำหรับ line ใดก็ตาม:
  - System สร้าง IO ใหม่อัตโนมัติ (`parent_io_id = io.id`)
  - IO ใหม่มีเฉพาะ lines ที่ qty เหลือ (`qty_ordered = qty_ordered - qty_received`)
  - IO ใหม่ status = `open`
  - IO เดิมดำเนินการต่อปกติ (received → confirmed)

---

## 5. DB Schema Changes

### Migration: `038_io_gr_po_workflow.sql`

```sql
-- IO: order_date + parent_io_id
ALTER TABLE inbound_orders
  ADD COLUMN order_date DATE NOT NULL DEFAULT CURRENT_DATE,
  ADD COLUMN parent_io_id UUID REFERENCES inbound_orders(id);

-- IO status: เพิ่ม confirmed, converted_to_po, rejected
ALTER TYPE io_status ADD VALUE IF NOT EXISTS 'confirmed';
ALTER TYPE io_status ADD VALUE IF NOT EXISTS 'converted_to_po';
ALTER TYPE io_status ADD VALUE IF NOT EXISTS 'rejected';

-- GRN: received_by_names + lift fee
ALTER TABLE goods_receipt_notes
  ADD COLUMN received_by_names TEXT,
  ADD COLUMN lift_fee_rounds INTEGER DEFAULT 0,
  ADD COLUMN lift_fee_amount NUMERIC(10,2) GENERATED ALWAYS AS (lift_fee_rounds * 50.00) STORED;

-- GRN status: เพิ่ม confirmed, rejected, po_created
ALTER TYPE grn_status ADD VALUE IF NOT EXISTS 'confirmed';
ALTER TYPE grn_status ADD VALUE IF NOT EXISTS 'rejected';
ALTER TYPE grn_status ADD VALUE IF NOT EXISTS 'po_created';

-- GRN line: date_type + mfg_date
ALTER TABLE grn_line_items
  ADD COLUMN date_type VARCHAR(10) NOT NULL DEFAULT 'expiry' CHECK (date_type IN ('expiry', 'mfg')),
  ADD COLUMN mfg_date DATE;

-- IO-PO link table (many-to-many)
CREATE TABLE io_po_links (
  io_id UUID NOT NULL REFERENCES inbound_orders(id),
  po_id UUID NOT NULL REFERENCES purchase_orders(id),
  PRIMARY KEY (io_id, po_id)
);
```

### Affected tables summary

| Table | New columns |
|-------|-------------|
| `inbound_orders` | `order_date`, `parent_io_id` |
| `goods_receipt_notes` | `received_by_names`, `lift_fee_rounds`, `lift_fee_amount` |
| `grn_line_items` | `date_type`, `mfg_date` |
| `io_po_links` | new table |

---

## 6. API Changes

### IO routes

| Method | Path | Change |
|--------|------|--------|
| `POST` | `/api/inbound-orders` | Add `order_date` field |
| `PATCH` | `/api/inbound-orders/[id]` | Add action: `update_lines` (edit lines before receiving), `update_notes` |

### GRN routes

| Method | Path | Change |
|--------|------|--------|
| `POST` | `/api/grn` | Add `received_by_names`, `lift_fee_rounds`, per-line `date_type` + `mfg_date` |
| `POST` | `/api/grn/[id]/confirm` | **Modify existing** — add branch for `source_type = 'inbound_order'`: skip PO qty_received update, skip AP invoice creation, insert stock_ledger with `unit_cost = 0`, update IO status → `confirmed`, trigger partial-IO split if applicable. PO-based path unchanged. |
| `POST` | `/api/grn/[id]/reject` | **New** — Supervisor only (manager/admin). Body: `{ reason: string }`. GRN → `rejected`, IO → `receiving`. |
| `POST` | `/api/grn/[id]/resubmit` | **New** — Staff only (warehouse_staff). GRN `rejected` → `draft`. Staff edits and calls existing receive endpoint to re-submit. |

### PO route

| Method | Path | Change |
|--------|------|--------|
| `POST` | `/api/purchase-orders` | Add `io_ids: string[]`. When provided: pull lines from IOs, require `unit_price` per line, INSERT `io_po_links`, UPDATE `grn_line_items.unit_cost`, UPDATE IO status → `converted_to_po`. |

---

## 7. UI Pages

### 7.1 IO List — `/app/inbound-orders`

Layout: **Full-width row card** (B) — แสดง vendor / วันที่สั่ง / คลัง / จำนวนรายการ / status badge  
Filter tabs: All / Open / Receiving / Confirmed  
CTA: ปุ่ม [+ สร้าง IO] สำหรับ Supervisor

### 7.2 IO Create/Edit — `/app/inbound-orders/new` + `/app/inbound-orders/[id]` (edit mode)

Fields:
- Vendor (dropdown)
- วันที่สั่ง (date picker, default today)
- คลังที่ต้องการให้ลง (dropdown)
- รายการสินค้า: product / qty_ordered / unit (UOM) / หมายเหตุต่อรายการ
- หมายเหตุท้ายใบ

Edit allowed: เฉพาะ IO ที่ status = `open` เท่านั้น

### 7.3 Receive Form — `/app/grn/new?io_id=<id>` (enhanced)

Layout: **Single page scroll** (A)

Sections (top → bottom):
1. **IO summary bar** — io_number / vendor / วันที่สั่ง / status badge (read-only)
2. **ข้อมูลการรับ**
   - วันที่มาส่ง (date, required)
   - คลังที่รับลง (dropdown, default = IO.warehouse_id, editable)
   - ผู้รับลงสินค้า (free-text, comma-separated)
   - ค่าลิฟท์ (แสดงเฉพาะ warehouse = W2): checkbox [มีค่าลิฟท์] → inline input จำนวนรอบ → แสดง = รอบ × ฿50
3. **รายการสินค้า** — per line:
   - ชื่อสินค้า / SKU / qty_ordered (read-only reference)
   - จำนวนรับจริง (number input, required)
   - toggle label: "📅 วันหมดอายุ → เปลี่ยนเป็น MFG" / "🏭 วันที่ผลิต → เปลี่ยนเป็น EXP"
   - date input (expiry_date หรือ mfg_date ตาม toggle)
4. **หมายเหตุ** (textarea)
5. **Buttons**: [⏸ พักบิล] (save draft) · [✅ รับลงสินค้าเรียบร้อย] (submit received)

### 7.4 Supervisor Confirmation View — `/app/inbound-orders/[id]` (detail)

แสดงเมื่อ IO status = `received`:
- ดูรายละเอียด GRN ที่ Staff กรอก (quantities / dates / lift fee / หมายเหตุ)
- ปุ่ม [ยืนยันการรับสินค้า] (POST /api/grn/[id]/confirm)
- ปุ่ม [ตีกลับ] → modal ใส่เหตุผล (POST /api/grn/[id]/reject)

### 7.5 PO Create from IO — `/app/purchase-orders/new?from=io`

Purchaser เลือก IO จาก list (multi-select, status = `confirmed`) → ดึง line items → กรอก unit_price ต่อรายการ → สร้าง PO

---

## 8. Business Rules

- **Lift fee:** เฉพาะ warehouse ที่มี code = `W2`. Rate = ฿50/รอบ. `lift_fee_amount` = generated column.
- **Partial delivery:** ถ้า qty_received < qty_ordered ใน line ใดก็ตาม → auto-create IO ใหม่สำหรับ qty คงเหลือ (`parent_io_id` link กลับหา IO เดิม).
- **Stock entry:** `entry_type = 'grn_receipt'`, `unit_cost = 0` ตอน confirm (stock_ledger insert-only). เมื่อ PO สร้าง → UPDATE `grn_line_items.unit_cost` + INSERT correction ledger entry (`entry_type = 'cost_update'`, qty_change = 0, notes = cost adjustment) — ห้าม UPDATE stock_ledger row เดิม.
- **W2 detection:** ตรวจจาก `warehouses.code = 'W2'` ฝั่ง frontend fetch เมื่อ warehouse เปลี่ยน.
- **IO edit lock:** ห้ามแก้ไข IO เมื่อ status ≠ `open`.
- **GRN reject:** Staff แก้ GRN ที่ rejected ได้ → resubmit → กลับเป็น received รอ Supervisor อีกครั้ง.
- **Multi-IO PO:** IO หลายใบที่ vendor เดียวกันรวมเป็น PO ได้ 1 ใบ. ต่าง vendor = ต้องแยก PO.

---

## 9. Out of Scope

- QC step (ยกเลิกสำหรับ IO-based GRN — Supervisor confirmation แทน)
- PR → IO conversion (ไม่มีใน workflow นี้)
- Barcode/label printing (track แยก)
- Cost correction ledger (phase 2 — ตอนนี้ unit_cost = 0 ไปก่อน)

---

## 10. Open Questions (resolved)

| # | คำถาม | คำตอบ |
|---|-------|-------|
| Q1 | Stock เข้าเมื่อไหร่? | Supervisor confirm → stocked auto |
| Q2 | 1 IO : กี่ GRN? | 1:1 per delivery — Partial → auto-split IO ใหม่ |
| Q3 | Lift fee คำนวณอย่างไร? | Staff กรอกจำนวนรอบ × ฿50 = total |
| Q4 | IO list layout? | Full-width row card |
| Q5 | Receive form layout? | Single page scroll |
| Q6 | Date toggle per-line? | Link toggle (เปลี่ยน label + link text) |

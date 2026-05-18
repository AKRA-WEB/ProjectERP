# AI Wisdom & Pitfalls — Critical Anti-patterns

บันทึกข้อผิดพลาดและสิ่งที่ "ห้ามทำ" เพื่อป้องกันความเสียหายต่อโปรเจกต์

## Critical Pitfalls

### 1. DB Pool Import ผิด
- **สิ่งที่เกิดขึ้น:** `import { pool } from '@/lib/db/client'`
- **ความจริง:** `pool` เป็น **default export**
- **ที่ถูกต้อง:** `import pool from '@/lib/db/client'`
- **ผลเสีย:** Build Error — API ใช้งานไม่ได้

### 2. ลืมอัปเดต Sidebar Prefix
- **สิ่งที่เกิดขึ้น:** สร้างหน้าใหม่ใน `/app/ap/*` แต่ไม่เพิ่มใน `WMS_PREFIXES`
- **ความจริง:** `Sidebar.tsx` ใช้ `WMS_PREFIXES` ตัดสินใจแสดง Sidebar
- **ที่ถูกต้อง:** เพิ่ม path prefix ใน `components/layout/Sidebar.tsx` ทุกครั้งที่สร้าง module ใหม่
- **ผลเสีย:** หน้าเว็บ Empty Sidebar

### 3. Type Declaration ซ้ำ (Merge Collision)
- **สิ่งที่เกิดขึ้น:** ประกาศ `interface ApAgingRow` ซ้ำใน `types/index.ts` โครงสร้างต่างกัน
- **ความจริง:** TypeScript merge interface ชื่อเดียวกัน → Error ว่าขาด Field
- **ที่ถูกต้อง:** ตั้งชื่อ Type เฉพาะเจาะจง เช่น `ApInvoiceAgingRow` vs `ApVendorAgingRow`
- **ผลเสีย:** Build Error ที่แก้ยาก

### 4. เดาชื่อ Component Props
- **สิ่งที่เกิดขึ้น:** `<StatusBadge label="..." />`
- **ความจริง:** Component ใช้ `labelOverride` prop
- **ที่ถูกต้อง:** เปิดอ่าน `interface Props` ใน `components/ui/` ก่อนใช้งานเสมอ
- **ผลเสีย:** UI ไม่แสดงผล + Build Error

### 5. Transaction Atomicity — UPDATE หลัง client.release()
- **สิ่งที่เกิดขึ้น:** `UPDATE pos_members SET points_balance` รันหลัง `client.release()`
- **ความจริง:** รันนอก transaction — ถ้า crash หลัง COMMIT แต้มไม่ถูกบวก ไม่มี rollback
- **ที่ถูกต้อง:** ทุก UPDATE ที่เกี่ยวกับ state ต้องอยู่ก่อน `COMMIT` ก่อน `client.release()`

### 6. Split GRN สำหรับ IO ไม่รวม inbound_order_id
- **สิ่งที่เกิดขึ้น:** `receive/route.ts` สร้าง split GRN ด้วย `po_id = null` เท่านั้น
- **ความจริง:** `chk_grn_source` constraint ต้องการ exactly one ของ `po_id` / `inbound_order_id`
- **ที่ถูกต้อง:** SELECT + INSERT ต้องรวม `inbound_order_id` สำหรับ IO-based GRN
- **ผลเสีย:** IO receive ล้มเหลวทุกครั้งที่ partial receipt

### 7. Missing Financial Columns in grn_line_items
- **สิ่งที่เกิดขึ้น:** พยายามคำนวณราคาต้นทุนหรือยอดรวมใน GRN โดยไม่มี column `unit_cost`
- **ความจริง:** `grn_line_items` เริ่มต้นไม่มี `unit_cost` และ `line_total`
- **ที่ถูกต้อง:** ตรวจสอบ Migration 036 — ต้องระบุ `unit_cost` ทุกครั้งที่สร้าง GRN (โดยเฉพาะ Standalone)
- **ผลเสีย:** ระบบบัญชีประเมินมูลค่าสินค้าไม่ได้

### 8. i18n Infrastructure — .ts vs .tsx
- **สิ่งที่เกิดขึ้น:** ตั้งชื่อไฟล์ Provider เป็น `.ts`
- **ความจริง:** มีการใช้ JSX/Context ในไฟล์
- **ที่ถูกต้อง:** ต้องใช้นามสกุล `.tsx` และระบุ `'use client'` ที่บรรทัดแรกเสมอ
- **ผลเสีย:** Build Error — TypeScript compiler ไม่รู้จัก angle brackets

---

## Best Practices

- ห้ามข้ามขั้นตอน `npm run build` — Lint อย่างเดียวไม่พอ
- ห้ามลบ Type เก่าโดยไม่เช็ค Reference
- ห้าม generate document number ใน app code — ใช้ `next_doc_number()` จาก DB เท่านั้น
- ทุก GET list endpoint ต้องมี `LIMIT` อย่างน้อย 100
- ห้ามแก้ไขไฟล์นอก task scope (Surgical Execution)

---

## ❌ Trap — Agent doc contradiction causes wrong behavior

**Context:** `PROTOCOLS.md` said "Claude writes plan.md" while `chen.agent.md` Phase 3 said "use Write tool". Mixed signals → Claude wrote plans inline instead of spawning Chen.

**Rule:** When two agent-facing docs contradict each other on ownership, the agent picks whichever behavior is easier (inline text). Always fix contradictions at the source — don't rely on memory notes alone.

**Fix pattern:** (1) Fix the contradiction in both docs, (2) Add a `UserPromptSubmit` hook for hard enforcement when the behavior is critical.

---
*Updated: 2026-05-18*

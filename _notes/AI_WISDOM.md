# 🧠 AI Wisdom & Pitfalls
บันทึกข้อผิดพลาดและสิ่งที่ "ห้ามทำ" เพื่อป้องกันความเสียหายต่อโปรเจกต์

## 🔴 ข้อผิดพลาดที่ "ห้าม" เกิดขึ้นซ้ำ (Critical Pitfalls)

### 1. การนำเข้า (Import) DB Pool ผิดพลาด
- **สิ่งที่เกิดขึ้น:** พยายาม `import { pool } from '@/lib/db/client'`
- **ความจริง:** `pool` ถูกส่งออกเป็น **default export** ใน `lib/db/client.ts`
- **ที่ถูกต้อง:** ต้องใช้ `import pool from '@/lib/db/client'` เท่านั้น
- **ผลเสีย:** Build Error (TypeScript) ทำให้ API ใช้งานไม่ได้

### 2. ลืมอัปเดต Sidebar Prefix
- **สิ่งที่เกิดขึ้น:** สร้างหน้าใหม่ใน `/app/ap/*` แต่ไม่ได้เพิ่มใน `WMS_PREFIXES`
- **ความจริง:** `Sidebar.tsx` ใช้ `WMS_PREFIXES` ในการตัดสินใจว่าจะแสดง Sidebar หรือไม่
- **ที่ถูกต้อง:** เมื่อเพิ่ม Module ใหม่ ต้องเพิ่ม Path prefix ใน `components/layout/Sidebar.tsx` เสมอ
- **ผลเสีย:** หน้าเว็บจะว่างเปล่า (Empty Sidebar) เมื่อผู้ใช้เข้าถึงหน้านั้นๆ

### 3. การประกาศ Type ซ้ำซ้อน (Type Merger Collision)
- **สิ่งที่เกิดขึ้น:** ประกาศ `interface ApAgingRow` ซ้ำใน `types/index.ts` โดยมีโครงสร้างต่างกัน
- **ความจริง:** TypeScript จะนำ interface ชื่อเดียวกันมารวมกัน (Merge) ทำให้เกิด Error ว่าขาด Field ของอีกตัวหนึ่ง
- **ที่ถูกต้อง:** ตั้งชื่อ Type ให้เฉพาะเจาะจงเสมอ เช่น `ApInvoiceAgingRow` (ระดับ Invoice) vs `ApVendorAgingRow` (ระดับ Vendor)
- **ผลเสีย:** สร้าง Build Error ที่แก้ไขยากและทำให้โค้ดส่วนอื่นที่ใช้งาน Type เดิมพัง

### 4. การเดาชื่อ Component Props
- **สิ่งที่เกิดขึ้น:** ใช้ `<StatusBadge label="..." />`
- **ความจริง:** Component `StatusBadge.tsx` ใช้ Prop ชื่อ `labelOverride`
- **ที่ถูกต้อง:** ต้องเปิดอ่านไฟล์ Component ใน `components/ui/` เพื่อเช็ค `interface Props` ก่อนใช้งานเสมอ
- **ผลเสีย:** UI ไม่แสดงผลตามที่คาดหวัง และ Build Error

---

## ⚠️ สิ่งที่ไม่ควรทำ (Best Practices to Follow)

- **ห้ามข้ามขั้นตอน `npm run build`:** การรัน Test หรือ Lint อย่างเดียวไม่พอสำหรับโปรเจกต์ TypeScript ขนาดใหญ่
- **ห้ามลบ Type เก่าโดยไม่เช็ค Reference:** การลบ Type ที่คิดว่า "ไม่ได้ใช้" อาจไปพังรายงานบัญชีหรือส่วนอื่นๆ ที่ไม่ได้อยู่ใน Module ปัจจุบัน
- **ห้ามละเลย "Html" Import Error:** แม้จะเป็น Error เดิมที่มีอยู่แล้ว แต่ต้องระวังไม่ให้สร้างเพิ่มโดยการ Import `Html`, `Head`, `Main` จาก `next/document` เข้ามาใน App Router (ต้องใช้จาก `next/head` หรือ Metadata API แทน)
- **ห้ามแก้ไขไฟล์นอกเหนือจาก Task:** รักษาวินัย **Surgical Execution** เพื่อไม่ให้เกิด Merge Conflict หรือ Bug ในส่วนที่ไม่เกี่ยวข้อง

---
*บันทึกโดย: Gemini CLI (2026-05-15)*

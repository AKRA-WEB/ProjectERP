# Track Plan: main-menu-ui-polish

ปรับปรุงหน้าจอเมนูหลักของระบบ (Main Menu Hub) ให้ตรงตามดีไซน์ต้นแบบ (`docs/design/main-menu.html`) เพื่อมอบประสบการณ์การใช้งานที่สวยงาม Premium และรองรับ Module ใหม่ในอนาคต

---

## Status
- **Status:** Verified
- **Created:** 2026-05-21
- **Updated:** 2026-05-21

---

## Proposed Changes

### [Component] Main Menu Hub

#### [MODIFY] [page.tsx](file:///C:/Users/AKRA-Panich-Front/OneDrive/02-2%20-%20AKRA/projectERP/app/app/menu/page.tsx)
ปรับปรุงหน้าจอ `app/app/menu/page.tsx`
- ปรับโครงสร้าง Layout จาก Grid แถวแนวนอนยาว เป็น Flex-Wrap Card Grid (กว้าง 172px ต่อการ์ด, แนวตั้งสูงสวยงาม) เหมือนตามต้นแบบ HTML
- เพิ่มสีสันเฉพาะตัวสำหรับแต่ละโมดูล (Per-card accent color) โดยกำหนด CSS Variable `--accent` ให้กับการ์ดแต่ละใบ
  - POS: `#b85c3c` (terracotta)
  - ขาย (Sales): `#3a7a7a` (teal)
  - จัดซื้อ (Purchasing): `#4f5d8a` (indigo-slate)
  - คลังสินค้า (Warehouse): `#5b7a99` (steel blue)
  - บัญชี (Accounting): `#a98038` (gold)
  - บุคคล (HR): `#6b8e6f` (sage)
  - ผู้ดูแลระบบ (Admin): `#7a5a7e` (mauve)
- ใส่แถบด้านบนของการ์ดสูง 2px (Top accent bar) ซึ่งจะขยายเป็น 3px เมื่อเอาเมาส์ไปชี้ (Hover)
- ทำ Hover Animation แบบพรีเมียม: การ์ดขยับลอยตัวขึ้นเล็กน้อย `translateY(-2px)` + มีเงาที่โดดเด่นขึ้น (Box-Shadow Lift) + ลูกศรสีสันตรงธีมชี้ขึ้นด้านขวาลอยเด่นชัดขึ้น (Opacity 0 → 1)
- แสดงการ์ดสำหรับ **ขาย (Sales)** และ **จัดซื้อ (Purchasing)** ที่ยังไม่มีระบบจริงในตอนนี้ โดยเมื่อผู้ใช้คลิกจะแสดง Toast เตือน "🚧 โมดูล ขาย/จัดซื้อ อยู่ในระหว่างการพัฒนา" และไม่ทำการเปลี่ยนหน้า
- ปรับปรุงแถบ Footer ด้านล่างแสดงเวอร์ชันเป็น `v 2.4` และวันที่ปัจจุบัน (ปี พ.ศ. ของไทย)

---

## Tasks

- [ ] อ่านไฟล์โค้ด `app/app/menu/page.tsx` เพื่อตรวจสอบการดึง Permission และโครงสร้างปัจจุบัน
- [ ] อัปเดต CSS และ CSS variables สำหรับ `--accent` สีเฉพาะตัวในหน้า `app/app/menu/page.tsx`
- [ ] พัฒนาโมดูลจำลอง (Stubs) สำหรับ ขาย (Sales) และ จัดซื้อ (Purchasing) พร้อม Toast แจ้งเตือนเมื่อคลิก
- [ ] ปรับดีไซน์ Card Layout ให้กว้าง 172px และความสูงแนวตั้งตามสัดส่วนที่ถูกต้อง
- [ ] เพิ่ม Top Accent Bar และ Hover Effects ให้ลื่นไหล มี Micro-animations
- [ ] อัปเดต Footer เป็น `v 2.4` 
- [ ] ทดสอบความถูกต้องด้วย `npx tsc --noEmit`
- [ ] ทดสอบการแสดงผลบนหน้าจอ ขนาดต่างๆ (Responsive)

---

## Verification Plan

### Manual Verification
1. เปิดหน้าเมนูหลักของระบบ สังเกตสีสันของแต่ละโมดูลว่าตรงตามสเปกสีหรือไม่
2. ชี้เมาส์ที่โมดูลต่างๆ สังเกตความลอยตัว การขยายของแถบสีด้านบน และความหนาของเส้น
3. คลิกที่โมดูล **ขาย** และ **จัดซื้อ** ตรวจสอบการทำงานของ Toast "🚧 โมดูลนี้อยู่ในระหว่างการพัฒนา" ว่าแสดงอย่างถูกต้อง
4. ตรวจสอบการแสดงผลในหน้าจอขนาดเล็ก (Mobile Screen) ว่าการจัดวาง Layout ปรับลดคอลัมน์ได้อย่างเหมาะสม

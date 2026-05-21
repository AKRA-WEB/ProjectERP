# Progress Log

---

## Session: 2026-05-20 (Session 15 — HR UX Redesign Rework & System Compaction)

### สิ่งที่ทำวันนี้

#### 1. hr-ui-redesign: HR Redesign Rework Complete — ✅
- **View Transitions:** ตรวจสอบและใส่ `<DirectionalTransition>` ให้กับทุกหน้าจอหลักของ HR (Dashboard, Employees, Leave, Attendance, Payroll Detail) ครบถ้วนทุกจุด เพื่อรักษาความลื่นไหลของ UX
- **Probation Stats:** เพิ่มค่า `probationDaysRemaining` (จำนวนวันขั้นต่ำที่พนักงานทดลองงานคนแรกจะเหลือการประเมิน) ใน API `/api/hr/stats` โดยคำนวณจริงจากฐานข้อมูลพนักงานที่จ้างในระยะ 120 วัน
- **Employee Detail Page:** พัฒนาการแสดงผลหน้าพนักงานแบบ Premium Redesign รองรับ 4 แท็บข้อมูล (Info, Leave, Attendance, Payroll) เพื่อให้เป็นหน้าจอที่สมบูรณ์แบบตาม Mockup
- **i18n & Currency Formatting:** ปรับปรุงและส่ง `lang` จาก `useLanguage()` เข้าในฟังก์ชัน `formatCurrency` และ `formatDate` ทุกจุดของหน้าจอ เพื่อให้รอบรับสองภาษาและแสดงผลตาม พ.ศ. ของไทยอย่างถูกต้อง
- **Shift Late Logic:** ปรับให้ API `/api/hr/stats` คำนวณการมาสาย (Late) โดยนำไปเชื่อมข้อมูล (JOIN) กับ `work_schedules` ของพนักงานแต่ละคนแทนการใช้ค่า '09:00:00' แบบ Hardcoded เพื่อความยืดหยุ่นทางธุรกิจ

#### 2. System Token Compaction — ✅
- **Archive PROGRESS.md:** ทำการบีบอัดไฟล์ความคืบหน้า โดยย้ายประวัติเก่าตั้งแต่ Session 1-13 (ประมาณ 40KB) ไปไว้ที่ `docs/archive/PROGRESS_HISTORY.md` ทำให้ตัวช่วย AI ไม่ต้องโหลดประวัติงานที่เสร็จแล้วเข้ามาซ้ำซ้อน
- **Archive Verified Tracks:** ย้ายรายการแทร็คที่ผ่านการตรวจสอบจาก Billy QA ทั้งหมดออกจาก `conductor/index.md` ไปจัดเก็บในแฟ้มประวัติ `conductor/archive/verified_tracks.md` เพื่อประหยัด Token สูงสุด
- **Remove Unused Skills:** ย้าย Skill rules ที่ไม่ได้เป็นเจ้าของบทบาท (เช่น กฎความปลอดภัย Meena, กฎวิเคราะห์ capture) เข้าส่วน Archive

### สถานะโค้ด (Code Stability)

| ระบบ | สถานะ |
|------|-------|
| WMS Core | ✅ Verified |
| POS Module | ✅ Verified |
| HR Module | ✅ Completed & Reworked |
| Sales Module | ✅ Completed |
| Accounting Module | ✅ Completed |

---

## Session: 2026-05-19 (Session 14 — UX Stability + Inbound Logic Fixes)

### สิ่งที่ทำวันนี้

#### 1. hr-ui-redesign: Full HR Bundle Redesign — ✅
- **Dashboard:** Redesign ใหม่ทั้งหมดพร้อม KPI Strip, Today's Attendance Feed, Pending Leave Queue, Headcount Chart และ Upcoming Events
- **Employees:** เพิ่ม API Stats, ระบบกรองสาขา/ประเภทสัญญา, การคำนวณอายุงาน (Tenure) และระบบซ่อนเงินเดือนตามสิทธิ์
- **Leave:** เพิ่ม Team Calendar (CSS Grid), แผงอนุมัติใบลาแบบ Interactive และ API รายเดือน
- **Payroll:** เพิ่ม Workflow Stepper (Draft → Processing → Approved → Paid), KPI Strip รายละเอียดเงินเดือน และ Footer สรุปยอดรวมในตาราง
- **Navigation:** ขยาย Sidebar HR เป็น 8 กลุ่มเมนู (20 รายการ) พร้อม Stub pages ครบถ้วน
- **Validation:** `npm run lint` และ `npx tsc --noEmit` ผ่าน 100% (Zero errors/warnings)
- **Compaction:** อัปเดต `gemini-changelog.md` และสร้าง `REPACK_MODULE_SUMMARY.md` เพื่อบีบอัดความรู้ของโมดูลใหม่ลงใน Obsidian
- **Memory Management:** เคลียร์ `Active Work` ใน `current-state.md` และย้ายทุก Track เข้าสู่สถานะ `Needs QA`

#### 2. View Transitions: Final Rework & Verification — ✅
- **Navigation:** ตรวจสอบและยืนยันการใช้ `viewTransition` prop ใน Sidebar และ TopBar ครบถ้วนทุกจุด
- **Stability:** ยืนยันการใช้ Bridge API เพื่อป้องกัน Build error และเปิด Experimental flag ใน Config เรียบร้อย
- **Status:** อัปเดตสถานะเป็น Completed ในระบบ Conductor

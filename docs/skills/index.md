# Skill Modules Index

## ⚡ Shared Principles — อ่านก่อนทุกครั้ง (ทุก Agent)
 
อ่าน `docs/skills/agent-principles.md` ก่อนเริ่มงานทุกครั้ง — กฎเหล็ก 9 ข้อ (รวม Andrej Karpathy Guidelines) เพื่อลดความผิดพลาดและรักษามาตรฐานโปรเจกต์
 
---
 
## Skill Modules (โหลดเฉพาะกิจ — ห้ามโหลดล่วงหน้าหลายไฟล์พร้อมกัน)
เพื่อประหยัด Token ห้ามอ่านไฟล์เหล่านี้ล่วงหน้า ให้ใช้คำสั่ง File Read เพื่อดึงมาอ่านเมื่อตรงกับบริบทของงานเท่านั้น:

1. **[Frontend_UI]**: สำหรับงานสร้าง UI, React Components, Tailwind CSS, หรือ Client Pages (`'use client'`)
   -> ให้ไปอ่านกฎที่: `docs/skills/frontend_ui_rules.md` (ข้อควรระวัง: ห้ามทำ RSC data fetching ในฝั่ง Client)
2. **[Backend_API]**: สำหรับงานสร้าง Next.js API Routes (App Router), NextAuth v5, การ Validate ข้อมูลด้วย Zod
   -> ให้ไปอ่านกฎที่: `docs/skills/backend_api_rules.md` (ข้อควรระวัง: ต้องใช้ `apiError()` / `apiSuccess()` ในการตอบกลับเสมอ)
3. **[Database_SQL]**: สำหรับงานเชื่อมต่อ PostgreSQL (raw `pg`), การทำ Pagination, จัดการ Stock Ledger, หรือการเขียน Query
   -> ให้ไปอ่านกฎที่: `docs/skills/database_sql_rules.md` (ข้อควรระวัง: บังคับใช้ Parameterized queries `$1, $2` เท่านั้น ห้ามต่อ String)
4. **[QA_Audit]**: สำหรับงานตรวจสอบโค้ดตามแผน `plan.md` (หน้าที่ของ Billy), การรัน Lint/Build, หรือการสร้าง `rework-plan.md`
   -> ให้ไปอ่านกฎที่: `docs/skills/qa_audit_rules.md`
5. **[Vercel_Rules]**: สำหรับงานตรวจสอบความเข้ากันได้กับการติดตั้งบน Vercel, การจัดการ Async Waterfall, การทำ Bundle Optimization, และการหลีกเลี่ยง traps ของ Serverless Environment
   -> ให้ไปอ่านกฎที่: `docs/skills/vercel_rules.md`

# Operating Protocol (กฎการทำงาน 3 ขั้นตอน)
เมื่อได้รับคำสั่ง (เช่น `Architect: ...` หรือ `QA: ...`) ให้คุณทำงานตามลำดับนี้เสมอ:
1. **Analyze (วิเคราะห์):** ตรวจสอบว่าคำสั่งนี้อยู่ในหมวดหมู่ไหนจาก Skill Modules Index (เป็นงาน Frontend, Backend, DB หรือ QA?)
2. **Load On-Demand (โหลดเฉพาะกิจ):** ใช้คำสั่งอ่านไฟล์ (File Read Tool) เพื่อเข้าไปอ่านเฉพาะไฟล์ `.md` ที่เกี่ยวข้องกับหมวดหมู่นั้นเท่านั้น
3. **Execute (ลงมือทำ):** นำมาตรฐานและ Technical Standards ที่ได้จากไฟล์ย่อยนั้น มาใช้เขียนโค้ด, วางแผน (Chen), หรือตรวจสอบโค้ด (Billy)

# Constraints (ข้อห้ามเด็ดขาด)
- ห้ามดึงไฟล์ Skill Modules มาอ่านพร้อมกันทีเดียวหลายไฟล์เด็ดขาด
- ก่อนจะแก้บั๊กหรืออ้างอิงไฟล์ใดๆ (โดยเฉพาะเรื่อง Database Schema หรือ Route path) ต้องใช้เครื่องมือ `search` หรือ `execute` เพื่อตรวจสอบว่าไฟล์หรือคอลัมน์นั้นมีอยู่จริง (เช่น เช็กไฟล์ `migrations/*.sql` ก่อนเสมอ)
- ห้ามเดาหรือทึกทักเอาเอง หาก Requirement หรือชื่อไฟล์กำกวม ให้หยุดและสอบถามเพื่อขอความชัดเจนก่อน
- โค้ดทั้งหมดต้องเป็น TypeScript strict mode (ห้ามใช้ `any` โดยไม่มีเหตุผล)

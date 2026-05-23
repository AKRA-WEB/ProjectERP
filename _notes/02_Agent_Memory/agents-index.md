# Agents & Skills Index — BUYMORE ERP

## AI Roles (Role-as-a-Skill Model)

โมเดลเดี่ยวสามารถสวมบทบาทเหล่านี้สลับกันตามคำสั่ง โดยอิงจากกฎมาตรฐานในทักษะกลาง:

| บทบาท (Role) | คำสั่งหลัก (Trigger) | หน้าที่และความรับผิดชอบ |
| :--- | :--- | :--- |
| **Chen (Architect)** | `Architect: <requirement>` | วิเคราะห์โค้ดเชิงสถาปัตยกรรม เขียนแผนปฏิบัติการ `plan.md` และสร้างแทร็ก |
| **Gemini (Implementer)** | `Go` | ดึงงานในคิวมาลุยเขียนโค้ด แก้ไขบั๊ก รัน Auto-QA และ Sweep แทร็ก |
| **Billy (Auditor)** | `QA: <track-name>` | รัน Static checks และทำประเมินผลเทียบเคียงแผน ออกดราฟต์รีพอร์ต |

## Skill Files (load on-demand)

| ขอบเขตงาน / สถานการณ์ | โหลด Skill File (ทักษะ) | คำอธิบาย |
| :--- | :--- | :--- |
| จัดการกระบวนการพัฒนา ประสานงาน และคิวงาน | [[docs/skills/ai_workflow_rules]] | คู่มือพัฒนาหลัก และ Obsidian Guide (โหลดก่อนเริ่มงานทุกครั้ง) |
| เขียน React component / UI / Tailwind | [[docs/skills/frontend_ui_rules]] | มาตรฐานงานหน้าบ้าน ระบบสองภาษา และ Traps บน React 19 |
| เขียน API route / auth / Zod | [[docs/skills/backend_api_rules]] | มาตรฐานงาน API การตรวจสอบ Input และ NextAuth v5 |
| เขียน SQL / migration / ledger | [[docs/skills/database_sql_rules]] | มาตรฐาน Parameterized, การควบคุมสต็อก และลำดับ Migration |
| QA / audit / lint / build | [[docs/skills/qa_audit_rules]] | มาตรฐานการตรวจสอบโค้ด และจัดระดับปัญหา (Must/Should Fix) |
| การปรับแต่ง Vercel และ Serverless | [[docs/skills/vercel_rules]] | การแก้ Async Waterfall, ความปลอดภัยของคีย์ และ Bundle Size |

## Critical Traps (latest)

- ❌ `ViewTransition` → import จาก `lib/react-vts.tsx` เท่านั้น
- ❌ `SessionUser` → define ใน `types/index.ts` เท่านั้น
- ❌ Nested API access → guard ด้วย `?.` + `?? 0`
- ❌ Split GRN สำหรับ IO → ต้องรวม `inbound_order_id` ใน SELECT + INSERT
- ✅ `npx tsc --noEmit` ก่อน mark task done ทุกครั้ง

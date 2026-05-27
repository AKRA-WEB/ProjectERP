# 🚀 BUYMORE ERP (Thailand) — Next.js 15 + PostgreSQL Full ERP

ระบบการบริหารจัดการทรัพยากรองค์กร (ERP) แบบครบวงจรสำหรับ BUYMORE (THAILAND) COMPANY LIMITED ขับเคลื่อนด้วยสถาปัตยกรรม Next.js 15 (App Router), React 19, TypeScript และ PostgreSQL (raw `pg`)

---

## 🤖 1. AI Agents Onboarding Portal (สำหรับ AI ทุกระบบที่เข้ามาร่วมพัฒนา)

หากคุณเป็น AI Assistant (เช่น Codex, Claude Code, Gemini CLI, ChatGPT หรืออื่น ๆ) ที่เพิ่งเปิดบริบทเข้ามาร่วมงานใน Repository นี้ **กรุณาปฏิบัติตามคำแนะนำในการสวมบทบาทและทำความเข้าใจขั้นตอนทำงานดังต่อไปนี้ทันที:**

### 🚨 จุดเริ่มต้นการรับบรีฟ (Where to Start)
1. **คิวปิดคู่มือการทำงานกลาง:** เปิดอ่านและสตรีมความรู้จาก [docs/AI_WORKFLOW_GUIDE.md](file:///C:/dev/projectERP/docs/AI_WORKFLOW_GUIDE.md) (หรือทักษะ [docs/skills/ai_workflow_rules.md](file:///C:/dev/projectERP/docs/skills/ai_workflow_rules.md)) เป็นอันดับแรกก่อนทำงาน เพื่อรับทราบกระบวนการ Pre-Flight Checklist, คำสั่งการสวมบทบาท และขั้นตอนจดบันทึก Obsidian
2. **เช็คสถานะปัจจุบันของโครงการ:** เข้าไปอ่าน [_notes/02_Agent_Memory/current-state.md](file:///C:/dev/projectERP/_notes/02_Agent_Memory/current-state.md) เพื่อรับทราบข้อมูลตาราง/คอลัมน์ DB ล่าสุด, เส้นทาง API ที่เพิ่มขึ้น และหมายเลข Migration ล่าสุด เพื่อป้องกัน Context Loss
3. **ศึกษาข้อห้ามและการทำงานที่ผิดพลาดในอดีต:** อ่าน [_notes/02_Agent_Memory/pitfalls.md](file:///C:/dev/projectERP/_notes/02_Agent_Memory/pitfalls.md) เพื่อทราบสิ่งแปลกปลอมในโค้ดและ Traps ด้านความปลอดภัย

### 🔄 แผนผังคำสั่งสวมบทบาทสลับโหมด (Role-as-a-Skill)
คุณสามารถสวมบทบาทและสลับโหมดการทำงานได้ด้วยคำสั่งทริกเกอร์เหล่านี้:

* **คำสั่ง `Init` (สั่งเป็นคำแรกสุดเมื่อเริ่มเซสชันแชทใหม่):**
  สั่งให้ AI รัน Pre-Flight Checklist เต็มรูปแบบทันที (Git sync, sweep แทร็กเก่า, โหลดความจำ `current-state.md` + pitfalls และนำเสนอรายงานสรุปความพร้อมของระบบ)
* **คำสั่ง `Architect: <requirement>` (สวมบท Chen / Architect):**
  คุณต้องวิเคราะห์โค้ดตามความต้องการของ User และสร้างโฟลเดอร์แทร็กพร้อมแผนปฏิบัติงานที่ `conductor/tracks/<feature-name>/plan.md` และลงทะเบียนบนกระดานดัชนี `conductor/index.md`
* **คำสั่ง `Go` (สวมบท Gemini / Implementer):**
  คุณต้องอ่านแผนงาน `plan.md` ในแทร็กที่เป็น `Active` ดำเนินการเขียนโค้ด ทดสอบ ตรวจสอบ Auto-QA และ Rework โค้ดจนเสร็จสมบูรณ์ 100%
* **คำสั่ง `QA: <track-name>` (สวมบท Billy / QA Auditor):**
  คุณต้องรัน Static checks (`npm run lint` + `npx tsc --noEmit`) และทำ Deep Review เพื่อเขียนรายงานตรวจสอบความเสี่ยงไปที่ `conductor/qa-reports/<track-name>.md`

---

## 💻 2. Developer Quick Start (สำหรับผู้พัฒนาที่เป็นมนุษย์)

### ⚙️ Environment Setup
คัดลอกไฟล์ต้นแบบ `.env.example` เป็น `.env` และกำหนดค่าต่าง ๆ:
```bash
cp .env.example .env
```
กำหนดตัวแปรให้เรียบร้อย:
```env
DATABASE_URL=postgresql://user:password@localhost:5432/buymore_erp
NEXTAUTH_SECRET=your_super_secret_key_here
NEXTAUTH_URL=http://localhost:3000
```

### 🛠️ Commands
* **รัน Development Server (Next.js 15):**
  ```bash
  npm run dev
  ```
* **รัน Build สำหรับ Production:**
  ```bash
  npm run build
  ```
* **รันตรวจสอบ Lint (ESLint):**
  ```bash
  npm run lint
  ```
* **รันสร้างโครงสร้าง DB (Database Migration):**
  ```bash
  npm run migrate
  ```
* **รันสร้างข้อมูลตัวอย่างสำหรับการพัฒนา (Database Seeding):**
  ```bash
  npm run migrate:seed
  ```

---

## 🗂️ 3. Project Directory Map

* `app/app/` — หน้าต่างอินเทอร์เฟซผู้ใช้ (Pages/Client Components - บังคับ `'use client'`)
* `app/api/` — เส้นทาง Endpoint ระบบหลังบ้าน (Next.js 15 API Routes)
* `components/ui/` — คลังเก็บ Shared UI Components หลักของโปรเจกต์
* `lib/` — ฟังก์ชันยูทิลิตี้ร่วม (Database Client, Auth Helper, Locale, Formatter)
* `types/` — ระบบ Type Strict ในระดับสากลของโปรเจกต์
* `migrations/` — แฟ้มเก็บไฟล์ SQL Migrations เรียงตามลำดับชื่อไฟล์ (`001_xxx.sql`)
* `conductor/` — แผงควบคุมและประเมินผลแทร็กงานพัฒนา (`index.md`, `tracks/`, `qa-reports/`)
* `_notes/` — แหล่งจัดเก็บเอกสารความรู้และประมวลผล Obsidian Vault
* `docs/skills/` — คลังเก็บกฎระเบียบเชิงเทคนิครายด้าน (Frontend, Backend, SQL, Vercel, QA, Workflow)

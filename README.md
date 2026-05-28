# 🚀 BUYMORE ERP (Thailand) — Next.js 15 + PostgreSQL Full ERP

ระบบการบริหารจัดการทรัพยากรองค์กร (ERP) แบบครบวงจรสำหรับ BUYMORE (THAILAND) COMPANY LIMITED ขับเคลื่อนด้วยสถาปัตยกรรม Next.js 15 (App Router), React 19, TypeScript และ PostgreSQL (raw `pg`)

---

## 🤖 1. AI Agents Onboarding Portal (Unified Brain Architecture)

หากคุณเป็น AI Assistant (Codex, Claude, Gemini, Antigravity, etc.) กรุณาปฏิบัติตาม **Universal Brain Architecture** ดังนี้:

### 🚨 จุดเริ่มต้น (READ FIRST)
1. **Universal Protocol:** โหลดสติปัญญาจาก [docs/skills/universal_agent_rules.md](file:///C:/dev/projectERP/docs/skills/universal_agent_rules.md) เป็นอันดับแรก
2. **Master Schema:** ใช้ [docs/SCHEMA.md](file:///C:/dev/projectERP/docs/SCHEMA.md) เป็น Source of Truth สำหรับ Database เสมอ (ห้ามเดาชื่อ Column)
3. **Workflow Guide:** ทำความเข้าใจวงจรทำงานที่ [docs/AI_WORKFLOW_GUIDE.md](file:///C:/dev/projectERP/docs/AI_WORKFLOW_GUIDE.md)

### 🔄 Command Triggers (โหมดการทำงาน)
* **`Init`**: เตรียมความพร้อมระบบ (Checklist + Memory)
* **`Architect: <req>`**: เข้าสู่ **Architect Mode** (วางแผนงานลงใน `plan.md`)
* **`Go`**: เข้าสู่ **Implementer Mode** (ลงมือโค้ด + Auto-QA จนสะอาด 100%)
* **`QA: <track>`**: เข้าสู่ **Auditor Mode** (ตรวจสอบความเสี่ยงเชิงลึก)

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

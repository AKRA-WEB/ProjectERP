# Gemini Project Context

You are the **Implementer** in this project's hybrid AI workflow.

## Trigger Words
- **`Go`** or **`Implement`**: Automatically find the first "Active" track in `conductor/index.md`, read its `plan.md`, and execute the next unchecked task.
- **`Summary`**: Generate the `execution-summary.md` for the current track.

## Collaboration Protocol
Refer to `conductor/PROTOCOLS.md` for details. Your primary role is to execute plans created by Claude (The Architect) located in `conductor/tracks/`.

## Skill Modules — Load On-Demand

**อ่าน `docs/skills/index.md` ก่อนเริ่มทุก task** เพื่อรู้ว่าต้องโหลด skill file ใด จากนั้นโหลดเฉพาะไฟล์ที่เกี่ยวข้อง:

| Task Type | Skill File |
|-----------|-----------|
| UI, React Components, Client Pages | `docs/skills/frontend_ui_rules.md` |
| API Routes, NextAuth, Zod | `docs/skills/backend_api_rules.md` |
| SQL, Migration, Stock Ledger | `docs/skills/database_sql_rules.md` |
| QA, Audit, rework-plan.md | `docs/skills/qa_audit_rules.md` |

**กฎสำคัญ:**
- โหลดทีละไฟล์เท่านั้น ห้ามโหลดทั้งหมดพร้อมกัน
- ก่อนอ้างอิง column/table ใดๆ ต้องตรวจสอบจาก `migrations/*.sql` ก่อน
- ห้ามเดา — ถ้าไม่แน่ใจ HALT แล้วถาม

## Execution Rules (Conductor Protocol)
Refer to `conductor/conductor-protocol-skill.md` for the full skill.

1. **Surgical Execution:** Strictly do not modify files or refactor code unrelated to the current Task.
2. **Zero Assumptions:** If the plan is ambiguous or contradictory, HALT and ask for clarification.
3. **Step-by-Step Updates:** Update the `plan.md` checkbox [x] immediately after completing EACH task. Do not bundle.
4. **Validation:** Run `npm run lint` and verify changes before checking off a task.

## Project Specifics
- **Framework:** Next.js 15 (App Router)
- **Database:** PostgreSQL (Raw `pg`)
- **UI:** Tailwind CSS + Radix-like components in `components/ui/`
- **Auth:** NextAuth v5

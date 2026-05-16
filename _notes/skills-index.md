# Skills & Agents Index — BUYMORE ERP

## AI Agents

```dataview
TABLE role, skill
FROM ".claude/agents"
WHERE type = "agent"
SORT role ASC
```

| Agent     | Trigger            | หน้าที่                              |
| --------- | ------------------ | ------------------------------------ |
| **Chen**  | `Architect: <req>` | วิเคราะห์ requirement → plan.md      |
| **Puka**  | assigned in plan   | Frontend: React, Tailwind, UI        |
| **Paku**  | assigned in plan   | Backend: API routes, SQL, migrations |
| **Billy** | `QA: <track>`      | Audit + Draft QA Report              |
| **Meena** | `Meena: audit`     | Security + Vercel performance        |

---

## Skill Files (load on-demand)

```dataview
TABLE domain, agent, load-when
FROM "docs/skills"
WHERE type = "skill"
SORT domain ASC
```

---

## Quick Load Reference

| สถานการณ์ | โหลด skill file |
|-----------|----------------|
| เขียน React component / page | [[docs/skills/frontend_ui_rules]] |
| เขียน API route / auth / Zod | [[docs/skills/backend_api_rules]] |
| เขียน SQL / migration / ledger | [[docs/skills/database_sql_rules]] |
| QA / audit / rework-plan | [[docs/skills/qa_audit_rules]] |

---

## Critical Traps (latest)

- ❌ `ViewTransition` → import จาก `lib/react-vts.tsx` เท่านั้น
- ❌ `SessionUser` → define ใน `types/index.ts` เท่านั้น
- ❌ Nested API access → guard ด้วย `?.` + `?? 0`
- ✅ `npx tsc --noEmit` ก่อน mark task done ทุกครั้ง

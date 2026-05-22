---
type: skill
domain: qa
agent: billy
load-when: "QA, audit, rework-plan, lint, build, review"
---

# QA Audit Rules & Code Review Standards

**ใช้เมื่อ:** ตรวจสอบ track ที่ implement แล้ว, รัน lint/build, ทำ Code Review เชิงลึก, หรือสร้าง `rework-plan.md` (หน้าที่ของ Billy)

---

## Pre-Audit Checklist (ก่อนเริ่ม)

1. **อ่าน `docs/skills/agent-principles.md`** — shared operating principles
2. **อ่าน `_notes/02_Agent_Memory/pitfalls.md`** — รู้ traps ก่อน audit

## Obsidian Writes (Billy)

- ✅ MAY append `## ❌ Trap — <name>` ใน `docs/skills/qa_audit_rules.md` หรือ skill file ที่เกี่ยวข้อง ถ้าพบ trap ใหม่
- ✅ MAY append ใน `_notes/02_Agent_Memory/pitfalls.md` ถ้าพบ pattern ที่เป็น systemic issue
- ❌ ห้าม write/modify `conductor/tracks/*/rework-plan.md` — หน้าที่ของ Claude (หลัง Chen validate)
- ❌ ห้าม update `conductor/index.md` — หน้าที่ของ Claude

---

## Audit Process (ทำตามลำดับ)

1. **อ่าน `plan.md`** ของ track ที่ต้องตรวจ
2. **ตรวจทุก checkbox** — verify file exists + implementation matches spec
3. **รัน `npm run lint`** — ต้องผ่านก่อน mark ว่า pass
4. **ทำ Deep Code Review** — ตรวจสอบ logic, performance, และ maintainability ตาม checklist ด้านล่าง
5. **สร้าง Draft QA Report** แสดงผลเป็น structured text ใน response (ห้ามใช้ tool เขียนไฟล์ `rework-plan.md` เองเนื่องจากเป็นข้อจำกัดของ sandbox environment)
6. **ส่งต่อรายงานให้ Chen/Claude เพื่อทำการ Validate** และเขียน `rework-plan.md` พร้อมกับอัปเดต `index.md` ตามลำดับ

## Severity Classification

| Level | Label | เมื่อไหร่ |
|-------|-------|---------|
| 🔴 | **Must Fix** | ทำให้ระบบ crash, data loss, security hole, N+1 Query รุนแรง, หรือ violate CLAUDE.md rules |
| 🟡 | **Should Fix** | Code smell, missing validation, performance issue, duplicated UI, convention violation |
| 🔵 | **Suggestion** | Nice-to-have, future improvement, code readability enhancement |

## rework-plan.md Format

```markdown
# Rework Plan — [track-name]

**QA Date:** YYYY-MM-DD
**Auditor:** Billy
**Verdict:** [Rework Required | Verified]

---

## 🔴 Must Fix

- [ ] **MF-1 · [Short title]**
  [ปัญหาคืออะไร, อยู่ไฟล์ไหน บรรทัดไหน]
  **Fix:** [วิธีแก้ที่ชัดเจน]

---

## 🟡 Should Fix

- [ ] **SF-1 · [Short title]**
  [ปัญหา + ที่อยู่]
  **Fix:** [วิธีแก้]

---

## 🔵 Suggestions

- [ ] **S-1 · [Short title]**
```

## Checklist — สิ่งที่ต้องตรวจทุก track

### 1. API Routes & Database (Structural & Performance)
- [ ] **Auth & Scope:** `const session = await auth()`, SessionUser cast, และ `buildWarehouseScopeClause`
- [ ] **Validation:** Zod validation ทุก POST/PATCH — ต้องครอบคลุม edge cases (เช่น negative numbers, empty arrays, max length)
- [ ] **Response Format:** `apiSuccess` / `apiError` เท่านั้น — ห้าม `Response.json()`
- [ ] **Error Clarity:** ข้อความใน `apiError` ต้องอ่านรู้เรื่องและชี้เป้าปัญหาได้ชัดเจน ไม่ใช้ข้อความกว้างๆ เช่น "Error occurred"
- [ ] **Transaction Guard:** ใช้ `pool.connect()` + BEGIN/COMMIT/ROLLBACK เสมอหากมี multi-table write
- [ ] **Query Safety:** Parameterized queries (`$1, $2`) — ห้ามทำ string interpolation
- [ ] **Performance (No N+1):** ห้ามมี SQL Query ซ่อนอยู่ในลูป (เช่น `await query` ใน `for...of`) หากทำได้ ให้ใช้ `IN ($1::uuid[])` หรือ `json_agg` แทน

### 2. UI Pages & Components (Maintainability & UX)
- [ ] **Clean Code:** `grep -r "// BUG\|// TODO\|// FIXME\|// HACK\|intentionally omitted" <track-files>` — any match in modified files = 🔴 Must Fix. Placeholder comments = task not done.
- [ ] **Artifact Free:** ไม่มี `console.log` / `console.error` / `console.warn`
- [ ] **Component Reusability:** ไม่เขียน HTML ซ้ำซ้อน — ถ้า UI element ถูกใช้มากกว่า 2 ที่ ต้อง extract เป็น component หรือดึงจาก `components/ui/index.ts`
- [ ] **Formatting:** ใช้ `formatDate()` และ `formatCurrency()` เสมอ
- [ ] **Bilingual:** ข้อความ/Label ต้องรองรับ Thai / English (หรือใช้ `useT()`)
- [ ] **Hardcode Check:** ห้ามมี Hardcoded VAT rate (`0.07`) — ต้องใช้ `VAT_RATE` จาก `lib/constants.ts`
- [ ] **Pagination & Limits:** ทุกตารางข้อมูลต้องมี Pagination และไม่ fetch unbounded list

### 3. Migration & Architecture
- [ ] ไฟล์ใหม่ ไม่แก้ไฟล์เก่า (Immutability of migrations)
- [ ] FK references ไปยัง table ที่มีอยู่จริง พร้อม Index บน FK columns
- [ ] `stock_ledger` ต้องเป็น insert-only
- [ ] `users.name_th` + `users.name_en` — ไม่มี `name`
- [ ] การ Generate Document Numbers ต้องผ่าน `next_doc_number()` จาก DB เท่านั้น

---

## Patterns & Traps — Captured in Field

## ❌ Trap — Multiple replacements in one turn
**Symptom:** Code changes are missing or partially reverted after a turn with multiple `replace` calls to the same file.
**Root cause:** If multiple `replace` tools are called for the same file in one turn, and they all use `old_string` from the *original* file content, the later ones might not account for changes made by the earlier ones, or they might race.
**Fix:** Avoid multiple `replace` calls for the same file in a single turn. Either consolidate them into one `replace` or `write_file`, or perform them in sequential turns.
**Found in:** task [N/A] of track [dynamic-sidebar] rework



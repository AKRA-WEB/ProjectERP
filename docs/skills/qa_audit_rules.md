---
type: skill
domain: qa
agent: auditor
load-when: "QA, audit, rework-plan, lint, build, review"
---

# QA Audit Rules & Code Review Standards

**ใช้เมื่อ:** ตรวจสอบ track ที่ implement แล้ว, รัน lint/build, ทำ Code Review เชิงลึก, หรือ validate เพื่อสร้าง `rework-plan.md` ใน QA-Reviewer mode

---

## Pre-Audit Checklist (ก่อนเริ่ม)

1. **อ่าน `docs/skills/agent-principles.md`** — shared operating principles
2. **อ่าน `_notes/02_Agent_Memory/pitfalls.md`** — รู้ traps ก่อน audit

## Obsidian Writes (Auditor Role)

- ✅ MAY append `## ❌ Trap — <name>` ใน `docs/skills/qa_audit_rules.md` หรือ skill file ที่เกี่ยวข้อง ถ้าพบ trap ใหม่
- ✅ MAY append ใน `_notes/02_Agent_Memory/pitfalls.md` ถ้าพบ pattern ที่เป็น systemic issue
- ❌ Auditor draft mode ห้าม write/modify `conductor/tracks/*/rework-plan.md`
- ❌ Auditor draft mode ห้าม update `conductor/index.md`
- ✅ QA-Reviewer/maintainer mode may write `rework-plan.md` and update `conductor/index.md` only after validating findings against real files or when explicitly asked by the user.

---

## Audit Process (ทำตามลำดับ)

1. **อ่าน `plan.md`** ของ track ที่ต้องตรวจ
2. **ตรวจทุก checkbox** — verify file exists + implementation matches spec
3. **รัน `npm run lint` และ `npm run check:notes`** — ต้องผ่าน 100% ไม่มี undocumented routes หรือ migration mismatch
4. **ตรวจ Knowledge Elevation** — ตรวจสอบว่า DB columns/tables และ API routes ใหม่ ถูกจดบันทึกใน `current-state.md` หรือ module notes แล้วจริง
5. **ทำ Deep Code Review** — ตรวจสอบ logic, performance, และ maintainability ตาม checklist ด้านล่าง
6. **สร้าง Draft QA Report** เขียนรายงานผลตรวจสอบโดยตรงไปที่ `conductor/qa-reports/<track-name>.md` (ห้ามสร้างไฟล์ `rework-plan.md` ใน Auditor draft mode)
7. **ส่งต่อรายงานให้ QA Reviewer / Architect role เพื่อทำการ Validate** ซึ่ง role นี้จะวิเคราะห์โค้ดจริงเพื่อออก `rework-plan.md` และปรับเปลี่ยนสถานะใน `conductor/index.md` ตามลำดับ

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
**Auditor:** <agent or role name>
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
- [ ] **Artifact Free (debug noise):** ไม่มี `console.log` / `console.warn` ที่เป็น debug. **ข้อยกเว้น:** `console.error` (หรือ logger) ใน `catch` block = **บังคับต้องมี** — error ห้ามถูกกลืนเงียบ. `catch {}` ว่าง = 🔴 Must Fix (principle B5).
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

### 4. Security / Infra / Enforcement (cross-cutting — ตรวจทุก track)
> Origin: full-audit 2026-06-06. ของพวกนี้ไม่มี feature track ไหน own → ต้องตรวจทุกครั้งจนกว่าจะมี automated gate (`hardening-t2-ci-gate`).
- [ ] **No gaming gate:** ไม่มี `eslint-disable local-rules/*` ในไฟล์ที่แก้ (Hard-Rule #9). ถ้าเจอ = 🔴 task ยังไม่เสร็จจริง
- [ ] **Test asserts behavior:** logic ใหม่/แก้ มี test ที่ assert จริง ไม่ใช่แค่ suite รันผ่าน (Hard-Rule #8)
- [ ] **No as any:** `git grep "as any" <track-files>` — เจอที่ไม่ใช่ NextAuth bridge = 🔴
- [ ] **Unbounded query:** ทุก list query มี `LIMIT`/`OFFSET` (Hard-Rule #4)
- [ ] **DB TLS:** ไม่มีการตั้ง `rejectUnauthorized: false` นอก dev branch (Hard-Rule #14)
- [ ] **Secrets:** ไม่มี secret/`.env`/cert commit เข้า repo; key ใหม่อยู่ใน `.env.example` (placeholder เท่านั้น)
- [ ] **Deps/config:** dependency ใหม่จำเป็นจริง, version ไม่ชนกับ framework, ไม่มี dev artifact (scratch/binary) ติดมา

---

## Patterns & Traps — Captured in Field

## ❌ Trap — Multiple replacements in one turn
**Symptom:** Code changes are missing or partially reverted after a turn with multiple `replace` calls to the same file.
**Root cause:** If multiple `replace` tools are called for the same file in one turn, and they all use `old_string` from the *original* file content, the later ones might not account for changes made by the earlier ones, or they might race.
**Fix:** Avoid multiple `replace` calls for the same file in a single turn. Either consolidate them into one `replace` or `write_file`, or perform them in sequential turns.
**Found in:** task [N/A] of track [dynamic-sidebar] rework

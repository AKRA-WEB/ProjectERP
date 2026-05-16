---
type: skill
domain: qa
agent: billy
load-when: "QA, audit, rework-plan, lint, build, review"
---

# QA Audit Rules

**ใช้เมื่อ:** ตรวจสอบ track ที่ implement แล้ว, รัน lint/build, หรือสร้าง `rework-plan.md` (หน้าที่ของ Billy)

---

## Audit Process (ทำตามลำดับ)

1. **อ่าน `plan.md`** ของ track ที่ต้องตรวจ
2. **ตรวจทุก checkbox** — verify file exists + implementation matches spec
3. **รัน `npm run lint`** — ต้องผ่านก่อน mark ว่า pass
4. **สร้าง `rework-plan.md`** ถ้าพบปัญหา
5. **อัพเดท `conductor/index.md`** — เปลี่ยน status เป็น `Verified` หรือ `Rework Required`

## Severity Classification

| Level | Label | เมื่อไหร่ |
|-------|-------|---------|
| 🔴 | **Must Fix** | ทำให้ระบบ crash, data loss, security hole, หรือ violate CLAUDE.md rules |
| 🟡 | **Should Fix** | Code smell, missing validation, performance issue, convention violation |
| 🔵 | **Suggestion** | Nice-to-have, future improvement |

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

### API Routes
- [ ] Auth check (`const session = await auth()`)
- [ ] SessionUser cast (`as unknown as SessionUser`)
- [ ] `buildWarehouseScopeClause` บน GET list
- [ ] Zod validation ทุก POST/PATCH
- [ ] `apiSuccess` / `apiError` response — ห้าม `Response.json()`
- [ ] Transaction (`pool.connect()` + BEGIN/COMMIT/ROLLBACK) ถ้ามี multi-table write
- [ ] No unbounded queries (มี LIMIT/OFFSET)
- [ ] Parameterized queries (`$1, $2`) — ไม่มี string interpolation

### UI Pages
- [ ] `'use client'` directive
- [ ] Pagination component มี
- [ ] `formatDate()` ใช้แทน raw date format
- [ ] `formatCurrency()` ใช้แทน inline number format
- [ ] Bilingual labels (Thai / English)
- [ ] ใช้ components จาก `components/ui/index.ts`
- [ ] ไม่มี `console.log` / `console.error` / `console.warn` debug artifacts
- [ ] ไม่มี hardcoded VAT rate (`0.07`) — ต้องใช้ `VAT_RATE` จาก `lib/constants.ts`

### Migration
- [ ] ไฟล์ใหม่ ไม่แก้ไฟล์เก่า
- [ ] FK references ไปยัง table ที่มีอยู่จริง
- [ ] มี index บน foreign key columns
- [ ] Wrapped ใน BEGIN/COMMIT

### Business Rules
- [ ] `users.name_th` + `users.name_en` — ไม่มี `name`
- [ ] `stock_ledger` insert-only
- [ ] Document numbers ผ่าน `next_doc_number()`
- [ ] Role restrictions ถูกต้อง

## Constraints

- ห้าม mark Verified ถ้า lint fail
- ห้าม mark Verified ถ้ามี Must Fix ค้างอยู่
- ต้อง verify file exists จริงก่อน report — ห้ามเดาจาก plan เท่านั้น

---

## Patterns & Traps — Captured in Field

<!-- Claude and Gemini append here after each task. Format:
## ✅ Pattern — [name]   or   ## ❌ Trap — [name]
-->

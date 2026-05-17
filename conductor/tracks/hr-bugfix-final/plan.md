---
track: hr-bugfix-final
status: Completed
aliases: ["HR Bugfix Final Implementation Plan"]
owner: paku, puka
module: HR
updated: 2026-05-13
---

# HR Bugfix Final Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **⚠️ Gemini: Tasks 1 and 2 are already committed. Start at Task 3.**
> - Task 1 done: commit `24767e3` — departments API u.name fix
> - Task 2 done: commit `7df1f3d` — payroll slip u.name fix

**Goal:** Fix 9 remaining bugs in the HR module — 3 broken SQL `u.name` aliases, 1 stale `Department` type, 2 wrong import sources, and 3 locale-formatting violations.

**Architecture:** Surgical edits to existing files only. No migrations, no new components, no new utilities. All changes are in `app/api/hr/`, `app/app/hr/`, and `types/index.ts`.

**Tech Stack:** Next.js 15 App Router · TypeScript 5 strict · PostgreSQL (raw `pg`) · `lib/format.ts` (formatDate, formatNumber, formatCurrency)

**Spec:** `docs/superpowers/specs/2026-05-13-hr-bugfix-final-design.md`

---

## File Map

| File | Change |
|------|--------|
| `app/api/hr/departments/route.ts` | SQL + inline type: `u.name` → `name_th/name_en` |
| `app/api/hr/departments/[id]/route.ts` | SQL only: `u.name` → `name_th/name_en` |
| `app/api/hr/payroll-runs/[id]/slip/[employee_id]/route.tsx` | SQL + type + 2 PDF render sites |
| `types/index.ts` | `Department` interface: `manager_name` → `manager_name_th/en` |
| `app/app/hr/departments/page.tsx` | Render site: `d.manager_name` → bilingual fallback |
| `app/app/hr/attendance/my/page.tsx` | Add `formatDate` import, replace 2× `toLocaleDateString` |
| `app/app/hr/employees/page.tsx` | Add `formatNumber` import, replace 1× `toLocaleString` |
| `app/app/hr/leave-requests/page.tsx` | Fix wrong import source, add `formatNumber`, replace 1× `toLocaleString` |
| `app/app/hr/payroll/page.tsx` | Fix wrong import source, add `THAI_MONTHS` const, replace 1× `toLocaleString` |

---

## ~~Task 1: Fix `u.name` in departments API~~ ✅ DONE (commit 24767e3)

**Root cause:** `users` table has no `name` column. Both department endpoints use `u.name AS manager_name` in their JOIN — this throws a PostgreSQL "column does not exist" error on every request.

**Files:**
- Modify: `app/api/hr/departments/route.ts`
- Modify: `app/api/hr/departments/[id]/route.ts`

- [x] **Step 1: Edit `app/api/hr/departments/route.ts` — fix inline type block**
- [x] **Step 2: Edit `app/api/hr/departments/route.ts` — fix SQL**
- [x] **Step 3: Edit `app/api/hr/departments/[id]/route.ts` — fix SQL**
- [x] **Step 4: Lint**
- [x] **Step 5: Commit**

---

## ~~Task 2: Fix `u.name` in payroll slip PDF~~ ✅ DONE (commit 7df1f3d)

**Root cause:** Slip PDF route selects `u.name AS employee_name`. Column `name` does not exist — any PDF generation request fails at the SQL level.

**Files:**
- Modify: `app/api/hr/payroll-runs/[id]/slip/[employee_id]/route.tsx`

- [x] **Step 1: Fix inline type block**
- [x] **Step 2: Fix SQL**
- [x] **Step 3: Fix PDF text render**
- [x] **Step 4: Fix PDF filename**
- [x] **Step 5: Lint**
- [x] **Step 6: Commit**

---

## ~~Task 3: Update `Department` type and UI consumer~~ ✅ DONE

**Root cause:** After Task 1, the departments API returns `manager_name_th` / `manager_name_en` instead of `manager_name`. The `Department` interface in `types/index.ts` and its render site in `departments/page.tsx` must be updated to match.

**Files:**
- Modify: `types/index.ts`
- Modify: `app/app/hr/departments/page.tsx`

- [x] **Step 1: Edit `types/index.ts` — update `Department` interface**
- [x] **Step 2: Edit `app/app/hr/departments/page.tsx` — update render site**
- [x] **Step 3: Lint**
- [x] **Step 4: Commit**

---

## ~~Task 4: Fix locale formatting in attendance/my page~~ ✅ DONE

**Root cause:** `toLocaleDateString('th-TH', ...)` does not enforce `Asia/Bangkok` timezone. Project convention is `formatDate()` from `lib/format.ts` which uses `Intl.DateTimeFormat` with `timeZone: 'Asia/Bangkok'`. File currently has no format imports.

**Files:**
- Modify: `app/app/hr/attendance/my/page.tsx`

- [x] **Step 1: Add `formatDate` import**
- [x] **Step 2: Fix today's date display (line ~76)**
- [x] **Step 3: Fix work_date display in history table (line ~139)**
- [x] **Step 4: Lint**
- [x] **Step 5: Commit**

---

## ~~Task 5: Fix locale formatting in employees page~~ ✅ DONE

**Root cause:** `(data?.total ?? 0).toLocaleString('th-TH')` uses browser locale. Project convention uses `formatNumber()` from `lib/format.ts`. File has no format imports.

**Files:**
- Modify: `app/app/hr/employees/page.tsx`

- [x] **Step 1: Add `formatNumber` import**
- [x] **Step 2: Fix count display (line ~76)**
- [x] **Step 3: Lint**
- [x] **Step 4: Commit**

---

## ~~Task 6: Fix wrong import source and locale formatting in leave-requests page~~ ✅ DONE

**Root cause:** `lib/utils.ts` exports only `cn()` — it does NOT export `formatDate` or `formatNumber`. Line 8 currently imports both from `@/lib/utils`, making them `undefined` at runtime. Additionally, the record count uses `toLocaleString` instead of `formatNumber`.

**Files:**
- Modify: `app/app/hr/leave-requests/page.tsx`

- [x] **Step 1: Fix import source (line 8)**
- [x] **Step 2: Fix count display (line ~59)**
- [x] **Step 3: Lint**
- [x] **Step 4: Commit**

---

## ~~Task 7: Fix wrong import source and month dropdown in payroll page~~ ✅ DONE

**Root cause:** `lib/utils.ts` exports only `cn()`. Line 8 imports `formatCurrency` from `@/lib/utils` — undefined at runtime, breaking all currency display. Month dropdown uses `toLocaleString` instead of a static Thai month array.

**Files:**
- Modify: `app/app/hr/payroll/page.tsx`

- [x] **Step 1: Fix import source (line 8)**
- [x] **Step 2: Add `THAI_MONTHS` constant**
- [x] **Step 3: Fix month dropdown (line ~134)**
- [x] **Step 4: Lint**
- [x] **Step 5: Commit**

---

## Final Verification ✅ DONE

- [x] **Run full lint**
- [x] **Verify no `u.name` remains in HR API**
- [x] **Verify no `toLocaleDateString`/`toLocaleString` remains in HR UI**
- [x] **Verify no `@/lib/utils` format imports remain in HR UI**
- [x] **Verify no stale `manager_name` field (without `_th`/`_en` suffix)**

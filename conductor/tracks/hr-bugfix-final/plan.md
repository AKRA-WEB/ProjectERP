# HR Bugfix Final Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

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

## Task 1: Fix `u.name` in departments API

**Root cause:** `users` table has no `name` column. Both department endpoints use `u.name AS manager_name` in their JOIN — this throws a PostgreSQL "column does not exist" error on every request.

**Files:**
- Modify: `app/api/hr/departments/route.ts`
- Modify: `app/api/hr/departments/[id]/route.ts`

- [ ] **Step 1: Edit `app/api/hr/departments/route.ts` — fix inline type block**

Find the `query<{...}>` type argument (around line 20-26). Replace:
```typescript
  id: string; code: string; name_th: string; name_en: string;
  parent_id: string | null; manager_id: string | null; manager_name: string | null;
  is_active: boolean; created_at: string; updated_at: string;
```
with:
```typescript
  id: string; code: string; name_th: string; name_en: string;
  parent_id: string | null; manager_id: string | null;
  manager_name_th: string | null; manager_name_en: string | null;
  is_active: boolean; created_at: string; updated_at: string;
```

- [ ] **Step 2: Edit `app/api/hr/departments/route.ts` — fix SQL**

In the SQL string, replace:
```sql
    SELECT d.*, u.name AS manager_name
```
with:
```sql
    SELECT d.*, u.name_th AS manager_name_th, u.name_en AS manager_name_en
```

- [ ] **Step 3: Edit `app/api/hr/departments/[id]/route.ts` — fix SQL**

In the SQL string, replace:
```sql
    SELECT d.*, u.name AS manager_name
```
with:
```sql
    SELECT d.*, u.name_th AS manager_name_th, u.name_en AS manager_name_en
```
(Return type is `object` — no type change needed in this file.)

- [ ] **Step 4: Lint**

```bash
npm run lint
```
Expected: no new errors.

- [ ] **Step 5: Commit**

```bash
git add app/api/hr/departments/route.ts "app/api/hr/departments/[id]/route.ts"
git commit -m "fix(hr): departments API — u.name → name_th/name_en"
```

---

## Task 2: Fix `u.name` in payroll slip PDF

**Root cause:** Slip PDF route selects `u.name AS employee_name`. Column `name` does not exist — any PDF generation request fails at the SQL level.

**Files:**
- Modify: `app/api/hr/payroll-runs/[id]/slip/[employee_id]/route.tsx`

- [ ] **Step 1: Fix inline type block**

Find the `queryOne<{...}>` type argument (around line 32-35). Replace:
```typescript
    employee_name: string; employee_id_code: string | null;
```
with:
```typescript
    employee_name_th: string; employee_name_en: string; employee_id_code: string | null;
```

- [ ] **Step 2: Fix SQL**

In the SQL string (around line 37), replace:
```sql
    SELECT pl.*, u.name AS employee_name, u.employee_id AS employee_id_code
```
with:
```sql
    SELECT pl.*, u.name_th AS employee_name_th, u.name_en AS employee_name_en, u.employee_id AS employee_id_code
```

- [ ] **Step 3: Fix PDF text render**

Find the PDF `<Text>` that renders the employee name (around line 62). Replace:
```tsx
<Text>{line.employee_name}</Text>
```
with:
```tsx
<Text>{line.employee_name_th || line.employee_name_en}</Text>
```

- [ ] **Step 4: Fix PDF filename**

Find the `Content-Disposition` header (around line 92). Replace:
```typescript
`inline; filename="slip-${line.employee_name}-${run.period_year}-${String(run.period_month).padStart(2,'0')}.pdf"`
```
with:
```typescript
`inline; filename="slip-${(line.employee_name_en || line.employee_name_th).replace(/\s+/g, '_')}-${run.period_year}-${String(run.period_month).padStart(2,'0')}.pdf"`
```

- [ ] **Step 5: Lint**

```bash
npm run lint
```
Expected: no new errors.

- [ ] **Step 6: Commit**

```bash
git add "app/api/hr/payroll-runs/[id]/slip/[employee_id]/route.tsx"
git commit -m "fix(hr): payroll slip — u.name → name_th/name_en, fix PDF render + filename"
```

---

## Task 3: Update `Department` type and UI consumer

**Root cause:** After Task 1, the departments API returns `manager_name_th` / `manager_name_en` instead of `manager_name`. The `Department` interface in `types/index.ts` and its render site in `departments/page.tsx` must be updated to match.

**Files:**
- Modify: `types/index.ts`
- Modify: `app/app/hr/departments/page.tsx`

- [ ] **Step 1: Edit `types/index.ts` — update `Department` interface**

Find the `Department` interface (around line 502-513). Replace:
```typescript
  manager_name?: string;
```
with:
```typescript
  manager_name_th?: string;
  manager_name_en?: string;
```

- [ ] **Step 2: Edit `app/app/hr/departments/page.tsx` — update render site**

Find the table cell that renders manager name (around line 118). Replace:
```tsx
{d.manager_name || '—'}
```
with:
```tsx
{d.manager_name_th || d.manager_name_en || '—'}
```

- [ ] **Step 3: Lint**

```bash
npm run lint
```
Expected: no new errors. TypeScript will catch any remaining `manager_name` references.

- [ ] **Step 4: Commit**

```bash
git add types/index.ts app/app/hr/departments/page.tsx
git commit -m "fix(hr): Department type — manager_name → manager_name_th/en"
```

---

## Task 4: Fix locale formatting in attendance/my page

**Root cause:** `toLocaleDateString('th-TH', ...)` does not enforce `Asia/Bangkok` timezone. Project convention is `formatDate()` from `lib/format.ts` which uses `Intl.DateTimeFormat` with `timeZone: 'Asia/Bangkok'`. File currently has no format imports.

**Files:**
- Modify: `app/app/hr/attendance/my/page.tsx`

- [ ] **Step 1: Add `formatDate` import**

At the top of the file, add to imports:
```typescript
import { formatDate } from '@/lib/format';
```

- [ ] **Step 2: Fix today's date display (line ~76)**

Replace:
```tsx
{new Date().toLocaleDateString('th-TH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
```
with:
```tsx
{formatDate(new Date())}
```

- [ ] **Step 3: Fix work_date display in history table (line ~139)**

Replace:
```tsx
{new Date(r.work_date).toLocaleDateString('th-TH', { day: '2-digit', month: 'short' })}
```
with:
```tsx
{formatDate(r.work_date)}
```

Note: `toLocaleTimeString` calls for clock-in/clock-out times are intentionally left unchanged — no `formatTime` utility exists in `lib/format.ts`.

- [ ] **Step 4: Lint**

```bash
npm run lint
```
Expected: no new errors.

- [ ] **Step 5: Commit**

```bash
git add app/app/hr/attendance/my/page.tsx
git commit -m "fix(hr): attendance/my page — toLocaleDateString → formatDate"
```

---

## Task 5: Fix locale formatting in employees page

**Root cause:** `(data?.total ?? 0).toLocaleString('th-TH')` uses browser locale. Project convention uses `formatNumber()` from `lib/format.ts`. File has no format imports.

**Files:**
- Modify: `app/app/hr/employees/page.tsx`

- [ ] **Step 1: Add `formatNumber` import**

At the top of the file, add to imports:
```typescript
import { formatNumber } from '@/lib/format';
```

- [ ] **Step 2: Fix count display (line ~76)**

Replace:
```tsx
{loading ? '—' : (data?.total ?? 0).toLocaleString('th-TH')} คน
```
with:
```tsx
{loading ? '—' : formatNumber(data?.total ?? 0)} คน
```

- [ ] **Step 3: Lint**

```bash
npm run lint
```
Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add app/app/hr/employees/page.tsx
git commit -m "fix(hr): employees page — toLocaleString → formatNumber"
```

---

## Task 6: Fix wrong import source and locale formatting in leave-requests page

**Root cause:** `lib/utils.ts` exports only `cn()` — it does NOT export `formatDate` or `formatNumber`. Line 8 currently imports both from `@/lib/utils`, making them `undefined` at runtime. Additionally, the record count uses `toLocaleString` instead of `formatNumber`.

**Files:**
- Modify: `app/app/hr/leave-requests/page.tsx`

- [ ] **Step 1: Fix import source (line 8)**

Replace:
```typescript
import { formatDate } from '@/lib/utils';
```
with:
```typescript
import { formatDate, formatNumber } from '@/lib/format';
```

- [ ] **Step 2: Fix count display (line ~59)**

Replace:
```tsx
{loading ? '—' : (data?.total ?? 0).toLocaleString('th-TH')} รายการ
```
with:
```tsx
{loading ? '—' : formatNumber(data?.total ?? 0)} รายการ
```

- [ ] **Step 3: Lint**

```bash
npm run lint
```
Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add app/app/hr/leave-requests/page.tsx
git commit -m "fix(hr): leave-requests page — fix wrong import source, toLocaleString → formatNumber"
```

---

## Task 7: Fix wrong import source and month dropdown in payroll page

**Root cause:** `lib/utils.ts` exports only `cn()`. Line 8 imports `formatCurrency` from `@/lib/utils` — undefined at runtime, breaking all currency display. Month dropdown uses `toLocaleString` instead of a static Thai month array.

**Files:**
- Modify: `app/app/hr/payroll/page.tsx`

- [ ] **Step 1: Fix import source (line 8)**

Replace:
```typescript
import { formatCurrency } from '@/lib/utils';
```
with:
```typescript
import { formatCurrency } from '@/lib/format';
```

- [ ] **Step 2: Add `THAI_MONTHS` constant**

Inside the component function (before the `return` statement), add:
```typescript
const THAI_MONTHS = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
```

- [ ] **Step 3: Fix month dropdown (line ~134)**

Replace:
```tsx
<option key={m} value={m}>{new Date(2024, m-1).toLocaleString('th-TH', {month: 'long'})}</option>
```
with:
```tsx
<option key={m} value={m}>{THAI_MONTHS[m - 1]}</option>
```

- [ ] **Step 4: Lint**

```bash
npm run lint
```
Expected: no new errors.

- [ ] **Step 5: Commit**

```bash
git add app/app/hr/payroll/page.tsx
git commit -m "fix(hr): payroll page — fix wrong import source, THAI_MONTHS for month dropdown"
```

---

## Final Verification

- [ ] **Run full lint**

```bash
npm run lint
```
Expected: exit 0, no errors.

- [ ] **Verify no `u.name` remains in HR API**

```bash
grep -rn "u\.name\b" app/api/hr/
```
Expected: no output.

- [ ] **Verify no `toLocaleDateString`/`toLocaleString` remains in HR UI**

```bash
grep -rn "toLocaleDateString\|toLocaleString" app/app/hr/
```
Expected: no output.

- [ ] **Verify no `@/lib/utils` format imports remain in HR UI**

```bash
grep -rn "from '@/lib/utils'" app/app/hr/
```
Expected: no output.

- [ ] **Verify no stale `manager_name` field (without `_th`/`_en` suffix)**

```bash
grep -rn "\bmanager_name\b" app/app/hr/ types/index.ts
```
Expected: no output.

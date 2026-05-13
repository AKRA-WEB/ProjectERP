# HR Bugfix Final — Design Spec

**Date:** 2026-05-13  
**Scope:** Fix 7 remaining bugs from Phase 6+7 QA rework in HR module  
**Track:** `conductor/tracks/hr-bugfix-final/`

---

## Summary

Three groups of surgical fixes. No new features. No migrations required.

---

## Group A — API: `u.name` → `name_th/name_en`

**Root cause:** `users` table has no `name` column. SQL alias `u.name` throws at runtime on any request to these endpoints.

### A1 — `app/api/hr/departments/route.ts`

Line 21 type block: replace `manager_name: string | null` with:
```ts
manager_name_th: string | null; manager_name_en: string | null;
```

Line 25 SQL: replace:
```sql
u.name AS manager_name
```
with:
```sql
u.name_th AS manager_name_th, u.name_en AS manager_name_en
```

### A2 — `app/api/hr/departments/[id]/route.ts`

Line 22 SQL only (return type is `object`): same replacement as A1 SQL.

### A3 — `app/api/hr/payroll-runs/[id]/slip/[employee_id]/route.tsx`

Line 32 type block: replace `employee_name: string` with:
```ts
employee_name_th: string; employee_name_en: string;
```

Line 37 SQL: replace:
```sql
u.name AS employee_name, u.employee_id AS employee_id_code
```
with:
```sql
u.name_th AS employee_name_th, u.name_en AS employee_name_en, u.employee_id AS employee_id_code
```

Line 62 PDF text: replace `line.employee_name` with:
```ts
line.employee_name_th || line.employee_name_en
```

Line 92 filename: replace `line.employee_name` with:
```ts
(line.employee_name_en || line.employee_name_th).replace(/\s+/g, '_')
```

---

## Group B — Type: `Department` interface

**Root cause:** `Department` type in `types/index.ts` has `manager_name?` which will no longer be returned by the API after Group A fixes. Must update type and all consumers.

### B1 — `types/index.ts` line 509

Replace:
```ts
manager_name?: string;
```
with:
```ts
manager_name_th?: string;
manager_name_en?: string;
```

### B2 — `app/app/hr/departments/page.tsx` line 118

Replace:
```tsx
{d.manager_name || '—'}
```
with:
```tsx
{d.manager_name_th || d.manager_name_en || '—'}
```

---

## Group C — UI: locale calls → lib/format utilities

**Root cause:** `toLocaleDateString` / `toLocaleString` do not enforce `Asia/Bangkok` timezone and diverge from project conventions. Must use `formatDate` / `formatNumber` from `@/lib/format`.

### C1 — `app/app/hr/attendance/my/page.tsx`

Add import: `import { formatDate } from '@/lib/format';` (file has no format imports currently).

Line 76: replace:
```tsx
new Date().toLocaleDateString('th-TH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
```
with:
```tsx
formatDate(new Date())
```

Line 139: replace:
```tsx
new Date(r.work_date).toLocaleDateString('th-TH', { day: '2-digit', month: 'short' })
```
with:
```tsx
formatDate(r.work_date)
```

Note: `toLocaleTimeString` calls for clock-in/out (lines ~84-85) are time-only display — no `formatTime` exists in `lib/format.ts` — leave unchanged.

### C2 — `app/app/hr/employees/page.tsx`

Add import: `import { formatNumber } from '@/lib/format';`

Line 76: replace:
```tsx
(data?.total ?? 0).toLocaleString('th-TH')
```
with:
```tsx
formatNumber(data?.total ?? 0)
```

### C3 — `app/app/hr/leave-requests/page.tsx`

**Import fix required:** Line 8 currently has `import { formatDate } from '@/lib/utils'` — wrong source.
`lib/utils.ts` only exports `cn()`. Replace line 8 with:
```ts
import { formatDate, formatNumber } from '@/lib/format';
```

Line 59: replace:
```tsx
(data?.total ?? 0).toLocaleString('th-TH')
```
with:
```tsx
formatNumber(data?.total ?? 0)
```

### C4 — `app/app/hr/payroll/page.tsx`

**Import fix required:** Line 8 currently has `import { formatCurrency } from '@/lib/utils'` — wrong source.
`lib/utils.ts` only exports `cn()`. Replace line 8 with:
```ts
import { formatCurrency } from '@/lib/format';
```

Add constant near top of component (before return):
```ts
const THAI_MONTHS = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
```

Line 134: replace:
```tsx
new Date(2024, m-1).toLocaleString('th-TH', {month: 'long'})
```
with:
```tsx
THAI_MONTHS[m - 1]
```

---

## Affected Files (8 total)

| File | Group |
|------|-------|
| `app/api/hr/departments/route.ts` | A1 |
| `app/api/hr/departments/[id]/route.ts` | A2 |
| `app/api/hr/payroll-runs/[id]/slip/[employee_id]/route.tsx` | A3 |
| `types/index.ts` | B1 |
| `app/app/hr/departments/page.tsx` | B2 |
| `app/app/hr/attendance/my/page.tsx` | C1 |
| `app/app/hr/employees/page.tsx` | C2 |
| `app/app/hr/leave-requests/page.tsx` | C3 |
| `app/app/hr/payroll/page.tsx` | C4 |

---

## Out of Scope

- `toLocaleTimeString` for clock-in/out times — no `formatTime` utility exists, leave unchanged
- No new migrations
- No new components

## Chen Review Notes (2026-05-13)

All HR pages live in `app/app/hr/` — NOT `app/(app)/hr/` (that directory has no HR module).

Verified by full grep against real files:
- `leave-requests/page.tsx` already uses `employee_name_th/en` — no `employee_name` issue
- `payroll/page.tsx` only uses `formatCurrency` — no `employee_name`/`manager_name`/`formatDate` without import
- `attendance/my/page.tsx` has NO existing format imports — C1 must ADD import
- `attendance/page.tsx`, `leave-requests/new/page.tsx`, `leave-requests/[id]/page.tsx`, `payroll-runs/[id]/page.tsx` — confirmed no `toLocaleDateString`/`toLocaleString` — out of scope
- `leave-requests/page.tsx` and `payroll/page.tsx` import from `@/lib/utils` (wrong source) — fixed in C3/C4

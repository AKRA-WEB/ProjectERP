---
track: pos-bugfix
status: Completed
owner: paku, puka
module: POS
updated: 2026-05-13
---

# POS Bugfix Plan

**Goal:** Fix 4 remaining issues in POS module found by Billy QA audit (2026-05-13).
Note: Billy's original 7 must-fix findings were verified against actual code and found to be already correctly implemented. Only the 4 items below require attention.

**Spec:** No separate spec — all fixes are surgical, self-contained.

---

## Task 1: Fix session close — missing warehouse ownership check

**File:** `app/api/pos/sessions/[id]/route.ts`

**Root cause:** `PATCH close_session` action fetches the session with no ownership/warehouse check. Any user with `pos:session_close` permission can close any session by UUID, including sessions from other warehouses they are not assigned to.

**Fix:** Add warehouse check before the UPDATE. Replace the current session fetch (line ~62):

```typescript
const current = await queryOne<{ status: string }>(
  'SELECT status FROM pos_sessions WHERE id = $1',
  [id]
);
```

with:

```typescript
const current = await queryOne<{ status: string; warehouse_id: string; opened_by: string }>(
  'SELECT status, warehouse_id, opened_by FROM pos_sessions WHERE id = $1',
  [id]
);
```

Then after the `assertPermission` check, add a warehouse access guard:

```typescript
try { assertWarehouseAccess(u, current.warehouse_id); } catch { return apiError('No access to this warehouse', 403); }
```

Also add `assertWarehouseAccess` to the imports at the top of the file.

- [x] Read file, make edits
- [x] `npm run lint` — expect no new errors
- [x] `git add "app/api/pos/sessions/[id]/route.ts" && git commit -m "fix(pos): add warehouse access check to close_session PATCH"`

---

## Task 2: Fix `toLocaleString` datetime formatting in POS UI

**Root cause:** POS pages use `new Date(x).toLocaleString('th-TH')` for datetime display. Project convention is `formatDatetime()` from `@/lib/format`.

**Files and exact locations:**

| File | Line | Current | Replace with |
|------|------|---------|-------------|
| `app/app/pos/page.tsx` | 118 | `new Date(s.opened_at).toLocaleString('th-TH')` | `formatDatetime(s.opened_at)` |
| `app/app/pos/sessions/page.tsx` | 112 | `new Date(s.opened_at).toLocaleString('th-TH')` | `formatDatetime(s.opened_at)` |
| `app/app/pos/sessions/page.tsx` | 115 | `new Date(s.closed_at).toLocaleString('th-TH')` | `formatDatetime(s.closed_at)` |
| `app/app/pos/sessions/[id]/page.tsx` | 127 | `new Date(sessionData.opened_at).toLocaleString('th-TH')` | `formatDatetime(sessionData.opened_at)` |
| `app/app/pos/sessions/[id]/page.tsx` | 132 | `new Date(sessionData.closed_at).toLocaleString('th-TH')` | `formatDatetime(sessionData.closed_at)` |
| `app/app/pos/sessions/[id]/page.tsx` | 282 | `new Date(t.voided_at).toLocaleString('th-TH')` | `formatDatetime(t.voided_at)` |

**Import check:**
- `app/app/pos/page.tsx` already imports from `@/lib/format` — add `formatDatetime` to existing import
- `app/app/pos/sessions/page.tsx` already imports from `@/lib/format` — add `formatDatetime`
- `app/app/pos/sessions/[id]/page.tsx` already imports from `@/lib/format` — add `formatDatetime`

`formatDatetime` signature: `formatDatetime(value: string | Date | null | undefined): string`

- [x] Edit all 3 files
- [x] `npm run lint`
- [x] `git add app/app/pos/page.tsx app/app/pos/sessions/page.tsx "app/app/pos/sessions/[id]/page.tsx" && git commit -m "fix(pos): toLocaleString → formatDatetime in POS UI pages"`

---

## Task 3: Fix hardcoded VAT calculation

**File:** `app/api/pos/transactions/route.ts`

**Line ~125:**

Current:
```typescript
const vatAmount = Math.round(total * 7 / 107 * 100) / 100;
```

Replace with:
```typescript
import { VAT_RATE } from '@/lib/constants';
// ...
const vatAmount = Math.round(total * VAT_RATE / (1 + VAT_RATE) * 100) / 100;
```

Note: Add `VAT_RATE` to the existing import from `@/lib/constants` at the top of the file.

- [x] Edit file
- [x] `npm run lint`
- [x] `git add app/api/pos/transactions/route.ts && git commit -m "fix(pos): replace hardcoded VAT 7/107 with VAT_RATE constant"`

---

## Task 4: Fix hardcoded LIMIT in sessions/[id] transaction sublist

**File:** `app/api/pos/sessions/[id]/route.ts`

**Line ~37:** `LIMIT 50` is hardcoded in the transaction sublist query.

Replace:
```sql
     LIMIT 50
```
with:
```typescript
     LIMIT $2`,
    [id, 100]
```

Or more cleanly, use `DEFAULT_PAGE_SIZE` from `@/lib/constants`:
```typescript
import { DEFAULT_PAGE_SIZE } from '@/lib/constants';
// ...
     LIMIT $2`,
    [id, DEFAULT_PAGE_SIZE]
```

Add `DEFAULT_PAGE_SIZE` to the import from `@/lib/constants` if not already present.

- [x] Edit file
- [x] `npm run lint`
- [x] `git add "app/api/pos/sessions/[id]/route.ts" && git commit -m "fix(pos): replace hardcoded LIMIT 50 with DEFAULT_PAGE_SIZE"`

---

## Final Verification

- [x] `npm run lint` — exit 0
- [x] `grep -rn "toLocaleString\|toLocaleDateString" app/app/pos/` — expect no output
- [x] `grep -rn "7 / 107\|7/107" app/api/pos/` — expect no output

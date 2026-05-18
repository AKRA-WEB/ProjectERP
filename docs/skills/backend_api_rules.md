---
type: skill
domain: backend
agent: paku
load-when: "API Route, NextAuth, Zod, middleware, auth"
---

# Backend API Rules

**ใช้เมื่อ:** สร้าง Next.js API Route, NextAuth v5 session, Zod validation, หรือ middleware

---

## Core Rules

1. **Auth check ทุก route** — `const session = await auth(); if (!session) return apiError('Unauthorized', 401);`
2. **Cast SessionUser เสมอ** — `const u = session.user as unknown as SessionUser;` ห้าม NextAuth type augmentation
3. **Zod validation ก่อนใช้ body** — parse ด้วย `schema.safeParse()` → return `apiValidationError(result.error)` ถ้า fail
4. **Response ด้วย `apiSuccess` / `apiError`** เท่านั้น — ห้าม `Response.json()` ตรง
5. **`buildWarehouseScopeClause`** บังคับทุก GET list endpoint
6. **Parameterized queries เท่านั้น** — ใช้ `$1, $2, ...` ห้าม string interpolation

## Standard Route Template

```typescript
import { NextRequest } from 'next/server';
import { auth } from '@/auth';
import { SessionUser } from '@/types';
import { apiSuccess, apiError, apiValidationError } from '@/lib/api-response';
import { query, queryOne } from '@/lib/db/client';
import { buildWarehouseScopeClause, assertRole } from '@/lib/authz';
import { z } from 'zod';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;

  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get('page') ?? '1');
  const pageSize = parseInt(searchParams.get('pageSize') ?? '20');
  const offset = (page - 1) * pageSize;

  const conditions: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  const scope = buildWarehouseScopeClause(u, 'alias.warehouse_id', idx);
  if (scope) {
    conditions.push(scope.clause);
    params.push(...scope.params);
    idx += scope.params.length;
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const rows = await query<T>(`SELECT ... FROM table alias ${where} ORDER BY ... LIMIT $${idx} OFFSET $${idx + 1}`, [...params, pageSize, offset]);
  const [{ count }] = await query<{ count: string }>(`SELECT COUNT(*) FROM table alias ${where}`, params);

  return apiSuccess({ data: rows, total: parseInt(count) });
}
```

## Role Enforcement

```typescript
try { assertRole(u, ['manager', 'admin']); } catch { return apiError('Forbidden', 403); }
```

## Transaction Pattern

```typescript
import { pool } from '@/lib/db/client';

const client = await pool.connect();
try {
  await client.query('BEGIN');
  // ... client.query(sql, params)
  await client.query('COMMIT');
  return apiSuccess(result, 201);
} catch (e) {
  await client.query('ROLLBACK');
  throw e;
} finally {
  client.release();
}
```

## PATCH Discriminant Pattern

```typescript
const PatchSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('approve') }),
  z.object({ action: z.literal('reject'), reason: z.string().min(1) }),
]);
```

## Constraints

- ห้าม string interpolation ใน SQL ทุกกรณี
- `users` table ใช้ `name_th`, `name_en` — ไม่มี `name` column
- Document numbers ผ่าน `next_doc_number(prefix, seq)` ใน PostgreSQL เท่านั้น — ห้ามสร้างใน app code

## ✅ Pattern — Thai-friendly Slugify
**Context:** Converting Thai product names or categories into URL-friendly/Code-friendly slugs.
**Correct way:**
```typescript
function slugify(text: string): string {
  if (!text) return '';
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-') 
    .replace(/[^\wก-๙-]+/g, '') // Keep alphanumeric + Thai characters
    .replace(/--+/g, '-') 
    .replace(/^-+/, '') 
    .replace(/-+$/, ''); 
}
```
**Found in:** task [2] of track [product-import] (2026-05-17)

---

## Patterns & Traps — Captured in Field

<!-- Claude and Gemini append here after each task. Format:
## ✅ Pattern — [name]   or   ## ❌ Trap — [name]
-->

## ✅ Pattern — Unified Activity Feed (UNION ALL)
**Context:** Creating a dashboard feed that aggregates events from multiple modules (e.g., GRN, Sales, POS).
**Correct way:**
```sql
SELECT * FROM (
  (SELECT 'grn' AS type, grn_number AS ref, status::text AS action, created_at FROM goods_receipt_notes WHERE status != 'draft' ORDER BY created_at DESC LIMIT 4)
  UNION ALL
  (SELECT 'so' AS type, so_number AS ref, status::text AS action, updated_at AS created_at FROM sales_orders WHERE status != 'draft' ORDER BY updated_at DESC LIMIT 4)
  UNION ALL
  (SELECT 'pos' AS type, receipt_number AS ref, 'sale' AS action, created_at FROM pos_transactions WHERE status = 'completed' ORDER BY created_at DESC LIMIT 4)
) AS activities ORDER BY created_at DESC LIMIT 8
```
**Found in:** task [T-9] of track [ui-improvement-dashboard]

## ✅ Pattern — Locale-Aware API Logic
**Context:** Handling language-specific formatting or logic in API responses.
**Correct way:**
Accept a `lang` parameter or header, and pass it to utility functions like `formatCurrency` or `formatDate` from `lib/format.ts`.
```typescript
const { searchParams } = new URL(req.url);
const lang = (searchParams.get('lang') as Locale) ?? 'th';
// ...
return apiSuccess({
  ...data,
  formatted_amount: formatCurrency(data.amount, lang)
});
```
**Found in:** track [i18n-language-switch]

## ❌ Trap — SessionUser defined in lib/authz.ts causes circular imports
**Symptom:** `Module declares 'SessionUser' locally, but it is not exported` — TypeScript loses track of exports during build optimization.
**Root cause:** Defining `SessionUser` and `UserRole` in `lib/authz.ts` creates circular dependency chains when other modules import from authz while authz imports from them.
**Fix:** Always define `SessionUser`, `UserRole`, and all shared interfaces in `types/index.ts`. Re-export from `lib/authz.ts` only for backward compat:
```typescript
// types/index.ts — define here
export type UserRole = 'admin' | 'manager' | 'staff';
export interface SessionUser { id: string; role: UserRole; assignedWarehouseIds: string[]; }

// lib/authz.ts — re-export only
export type { UserRole, SessionUser } from '@/types';
```
**Found in:** ROOT_CAUSE_REPORT.md (2026-05-16)

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

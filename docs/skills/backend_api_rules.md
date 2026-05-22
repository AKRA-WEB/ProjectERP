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

## ✅ Pattern — Parent + Child INSERT (PO / GRN / SO / Invoice)
**Context:** Any POST that creates a document header + line items. Use this exact structure every time.
**Correct way:**
```typescript
import pool from '@/lib/db/client';

// In POST handler:
const client = await pool.connect();
try {
  await client.query('BEGIN');

  // 1. Generate doc number
  const { rows: [{ next_doc_number: docNum }] } = await client.query(
    "SELECT next_doc_number('PO', 'po_seq') AS next_doc_number"
  );

  // 2. Compute total
  const totalAmount = items.reduce((sum, i) => sum + i.quantity * i.unit_price, 0);

  // 3. Insert header
  const { rows: [header] } = await client.query(
    `INSERT INTO purchase_orders (po_number, vendor_id, warehouse_id, total_amount, status, ordered_by, notes)
     VALUES ($1, $2, $3, $4, 'draft', $5, $6) RETURNING *`,
    [docNum, vendor_id, warehouse_id, totalAmount, u.id, notes ?? null]
  );

  // 4. Insert each child
  for (const item of items) {
    await client.query(
      `INSERT INTO purchase_order_items (po_id, product_id, quantity, unit_price, received_qty)
       VALUES ($1, $2, $3, $4, 0)`,
      [header.id, item.product_id, item.quantity, item.unit_price]
    );
  }

  await client.query('COMMIT');
  return apiSuccess({ ...header, items }, 201);
} catch (e) {
  await client.query('ROLLBACK');
  throw e;
} finally {
  client.release();
}
```
**Key rules:** doc number inside transaction, total_amount computed before INSERT, children use parent `id`, ROLLBACK on any error.
**Found in:** po-gr-audit track (2026-05-18)

## ✅ Pattern — Status Transition with Side Effects
**Context:** Any PATCH that changes document status AND must trigger downstream writes (stock, balances, AP, etc.)
**Correct way:**
```typescript
// 1. Validate transition
const TRANSITIONS: Record<string, string[]> = {
  draft: ['received'],
  received: ['qc_passed', 'qc_failed'],
  qc_passed: ['stocked'],
};
const { rows: [doc] } = await db.query('SELECT status FROM goods_receipts WHERE id = $1', [id]);
if (!TRANSITIONS[doc.status]?.includes(newStatus)) {
  return apiError('Invalid status transition', 400);
}

// 2. Role guard (if privileged)
try { assertRole(u, ['manager', 'admin']); } catch { return apiError('Forbidden', 403); }

// 3. Apply + side effects in ONE transaction
const client = await pool.connect();
await client.query('BEGIN');
await client.query('UPDATE goods_receipts SET status = $1 WHERE id = $2', [newStatus, id]);

if (newStatus === 'stocked') {
  const { rows: grnItems } = await client.query(
    'SELECT * FROM goods_receipt_items WHERE grn_id = $1', [id]
  );
  for (const item of grnItems) {
    await client.query(
      `INSERT INTO stock_ledger (product_id, warehouse_id, movement_type, quantity, reference_type, reference_id, created_by)
       VALUES ($1, $2, 'in', $3, 'grn', $4, $5)`,
      [item.product_id, grn.warehouse_id, item.quantity_received, id, u.id]
    );
    await client.query(
      'UPDATE purchase_order_items SET received_qty = received_qty + $1 WHERE id = $2',
      [item.quantity_received, item.po_item_id]
    );
  }
  // Recompute PO status
  const { rows: [counts] } = await client.query(
    `SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE received_qty >= quantity) AS done
     FROM purchase_order_items WHERE po_id = $1`,
    [grn.po_id]
  );
  const poStatus = counts.done >= counts.total ? 'fully_received' : 'partially_received';
  await client.query('UPDATE purchase_orders SET status = $1 WHERE id = $2', [poStatus, grn.po_id]);
}
await client.query('COMMIT');
```
**Key rule:** state machine check BEFORE transaction, all side effects INSIDE transaction.
**Found in:** po-gr-audit track (2026-05-18)

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

## ❌ Trap — Batch INSERT placeholder stride mismatch → 500
**Symptom:** `POST` returns 500 on any request with ≥1 line item. Works with zero rows (but schema requires min 1). Error: `invalid input syntax` or `column mismatch` from PostgreSQL.
**Root cause:** Batch INSERT uses loop-generated placeholders with stride `i * N`. When a new column is added to the INSERT, the params loop is updated but the stride constant is not. Result: params shift right by 1 for every row after the first.
**Broken pattern:**
```typescript
// 9 columns added to push, but stride still = 8
.map((_, i) => `($1, $${i * 8 + 2}, ..., $${i * 8 + 9}, ${i+1})`)
// row 1: $1, $2...$10 ← correct
// row 2: $1, $10...$18 ← WRONG, expected $1, $11...$19
```
**Fix:** stride must equal the number of params pushed per row (excluding shared $1 and hardcoded literals):
```typescript
// 10 dynamic params per row → stride = 10
.map((_, i) => `($1, $${i * 10 + 2}, ..., $${i * 10 + 11}, ${i+1})`)
for (const l of lines) {
  params.push(a, b, c, d, e, f, g, h, i, j); // exactly 10 values
}
```
**Verification:** count commas in one VALUES row → must equal `push()` call count.
**Found in:** `app/api/grn/route.ts` — io-grn-500 (2026-05-18)

## ❌ Trap — Explicit Enum Casting in Bulk Value Template
**Symptom:** "invalid input value for enum" error when executing bulk database inserts.
**Root cause:** PostgreSQL cannot infer the custom enum type of placeholder variables inside parameterized template strings.
**Fix:** Cast placeholders explicitly in the SQL statement, e.g., `($1, $2::grn_source_type)`.
**Found in:** task [2] of track [io-grn-500] (2026-05-19)

## ❌ Trap — Zod Regex Rejection of Empty Strings
**Symptom:** API returns 400 Validation Error on optional date inputs when submitted empty.
**Root cause:** Zod `.regex(/^\d{4}-\d{2}-\d{2}$/)` rejects `""` (empty string), which is the default HTML input value.
**Fix:** Extend schema with `.or(z.literal(''))` and normalize to `null` in the controller:
```typescript
date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).or(z.literal('')).optional()
const dbDate = parsed.data.date || null;
```
**Found in:** task [2.1] of track [po-fix-400]

## ❌ Trap — Duplicated Type Declarations (Merge Collision)
**Symptom:** Build fails with errors claiming missing fields in newly declared interfaces.
**Root cause:** Re-declaring the same interface name (e.g. `ApAgingRow`) in `types/index.ts` or multiple locations. TypeScript merges them, causing strict structural type errors.
**Fix:** Keep declarations unique and descriptive (e.g., `ApInvoiceAgingRow` vs `ApVendorAgingRow`). Declare all shared schemas/interfaces in `types/index.ts`.


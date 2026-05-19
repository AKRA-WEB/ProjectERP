---
date: 2026-05-15
type: decision
module: Core
track: po-gr-audit
status: closed
---

# Decision — DB Transaction Pattern (pool.connect + BEGIN/COMMIT)

**Date:** 2026-05-15
**Module:** Core (applies to all multi-write API routes)

## Decision

Any API route with 2+ DB writes uses `pool.connect()` + explicit BEGIN/COMMIT/ROLLBACK pattern. Never use bare `query()` for multi-write operations.

```typescript
const client = await pool.connect();
try {
  await client.query('BEGIN');
  // ... writes ...
  await client.query('COMMIT');
  return apiSuccess(result);
} catch (e) {
  await client.query('ROLLBACK');
  throw e;
} finally {
  client.release();
}
```

## Context

Partial writes leave DB in inconsistent state — e.g., PO header created but line items fail → orphan PO with no lines.

## Alternatives Considered

| Option | Pros | Cons |
|--------|------|------|
| ✅ `pool.connect()` + BEGIN/COMMIT | Full atomicity, rollback on error | Slightly more boilerplate |
| ❌ Sequential bare `query()` calls | Simpler code | Partial failure leaves orphaned rows |
| ❌ Savepoints | Fine-grained | Overkill for current use cases |

## Reason for Choice

- po-gr-audit track confirmed 3 routes had multi-writes without transaction causing data integrity risk
- `pool` is default export from `@/lib/db/client` — must import as `import pool from '@/lib/db/client'` not `import { pool }`

## Downstream Impact

- `pool` = default export. `query`, `queryOne` = named exports. Import both: `import pool, { query, queryOne } from '@/lib/db/client'`
- All state-changing UPDATEs must be BEFORE `COMMIT` and before `client.release()`
- Routes already correct: `receive`, `stock`, `confirm`, `approve` — do NOT refactor these

## Reversibility

- [x] R2 — easily changed (pattern change, no schema impact)

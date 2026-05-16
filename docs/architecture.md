# Architecture Reference — BUYMORE ERP

> Detail reference. Loaded on-demand. CLAUDE.md keeps only critical patterns.

## Route Layout

```
app/
  login/           # public auth page
  (app)/           # authenticated group — layout.tsx wraps all with Sidebar + TopBar
    dashboard/
    products/ · vendors/ · customers/
    purchase-requests/[id]/new/
    purchase-orders/[id]/new/
    grn/[id]/new/ · rma/[id]/new/ · claims/[id]/new/
    transfers/[id]/new/ · cycle-counts/[id]/new/
    inventory/ledger/ · admin/users/ · admin/warehouses/
    pos/session/[id]/ · sales-orders/ · hr/ · bom/
    accounting/chart-of-accounts/ · accounting/journal-entries/
  api/             # Next.js Route Handlers (all return JSON)
```

## Adding a New ERP Module

1. **Migrations** — `migrations/0NN_modulename.sql` with enums, tables, sequences, `next_doc_number` calls
2. **API routes** — `app/api/<module>/` + `app/api/<module>/[id]/` — pattern: auth → SessionUser cast → Zod → warehouse scope → execute
3. **Pages** — `app/(app)/<module>/` — `'use client'` + `get`/`post`/`patch` from `lib/api-client.ts`
4. **Sidebar** — add to `navItems` in `components/layout/Sidebar.tsx` with `roles` field
5. **Types** — add status enums + interfaces to `types/index.ts`
6. **Stock** — modules touching inventory write to `stock_ledger` only (never `stock_balances` directly). Add `ledger_entry_type` enum in new migration.

## Database Layer (`lib/db/client.ts`)

- `pool` — raw `pg.Pool` for transactions
- `query<T>(sql, params)` — returns `T[]`
- `queryOne<T>(sql, params)` — returns `T | null`

Transaction pattern:
```typescript
const client = await pool.connect();
try {
  await client.query('BEGIN');
  await client.query(sql, params);
  await client.query('COMMIT');
} catch {
  await client.query('ROLLBACK');
} finally { client.release(); }
```

## Migrations

Files run in filename order. `lib/db/migrate.ts` tracks applied in `schema_migrations`. Each runs in transaction. **Never edit applied migrations — add new files.**

## Document Numbering

PostgreSQL `next_doc_number(prefix, seq_name)` at INSERT time. Format: `PREFIX-YYYYMMDD-0001`.
Sequences: `seq_pr` · `seq_po` · `seq_grn` · `seq_rma` · `seq_clm` · `seq_trf` · `seq_cc`

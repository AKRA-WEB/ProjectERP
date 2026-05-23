---
track: pos-delta-slip-and-versioning
phase: V2.0-P1
sequence: 9
status: planned
owner: Chen
created: 2026-05-23
depends_on: [pos-draft-and-hybrid-flow]
estimate: M
assigned_to: [Paku, Puka]
tags: [v2-orion, pos, invoice, versioning, barcode]
---

# POS Delta Slip + Invoice Versioning

## Goal
Track invoice edits as versions so that the dispatch gate can hard-reject stale barcodes, and so the customer/warehouse receives a delta slip showing only the +/- changes from the previous version rather than a reprinted full invoice.

## Scope IN
- New table `invoice_versions(id, invoice_id, version_no INT, barcode TEXT UNIQUE, created_at, created_by, change_summary JSONB)`.
- On invoice PATCH that mutates lines or totals: bump `version_no`, generate new UUID-based barcode with Luhn check digit, persist the diff vs previous version into `change_summary`.
- New endpoint `GET /api/sales/invoices/[id]/delta-slip` returning the +/- variance for the latest version vs the previous one (PDF + JSON).
- Helper `lib/invoice/barcodes.ts: generateInvoiceBarcode(invoiceId, versionNo) -> string` plus `verifyInvoiceBarcode(barcode)`.

## Scope OUT
- Versioning of POS draft carts — only finalized invoices are versioned.
- Customer-facing app to view full version history. Audit-only in V2.0.

## Acceptance Criteria
1. Editing an invoice creates `invoice_versions` row with the previous barcode marked superseded.
2. `change_summary` accurately captures `+ added`, `- removed`, `± changed_price`, `± changed_qty` per line.
3. Only the newest barcode for a given `invoice_id` validates against `verifyInvoiceBarcode`.
4. Delta-slip endpoint returns lines that actually changed — never the full invoice.
5. `npm run lint` and `npx tsc --noEmit` pass.

## Migrations
- `048_invoice_versions.sql` — create table, add UNIQUE index on `barcode`, backfill v1 row + barcode for every existing invoice.

## API routes
- Touched: `app/api/sales/invoices/[id]/route.ts` PATCH path.
- New: `GET /api/sales/invoices/[id]/delta-slip`.
- New: `GET /api/sales/invoices/[id]/versions`.

## UI screens
- Touched: invoice detail page — version dropdown + "View delta slip".
- New: print template for delta slip (thermal-receipt friendly).

## Test plan
- Manual: edit invoice, confirm new barcode, scan old barcode, confirm rejection.
- Delta slip shows only changes.
- Lint + tsc.

## Risks
- Backfilling v1 barcodes for all existing invoices must be deterministic so reprints match.
- Race condition on concurrent edits — wrap version bump in a `SELECT ... FOR UPDATE` on the invoice row.

## Verified Facts (pre-plan)
- `sales_invoices.id` is UUID; `si_number` already follows `next_doc_number('SI','seq_si')`.
- No `current_version` / `current_barcode` columns yet.
- Invoice lines are derived from `do_line_items` via the linked DO; there is no direct `sales_invoice_lines` table.
- `app/api/sales-invoices/[id]/route.ts` is the PATCH route.

---

## Tasks

### T1 — Migration `048_invoice_versions.sql`
**File:** `migrations/048_invoice_versions.sql` (new)
**Operation:** add migration

**Details:**
- Wrap in `BEGIN; ... COMMIT;`:
  1. `CREATE TABLE IF NOT EXISTS invoice_versions ( id UUID PRIMARY KEY DEFAULT gen_random_uuid(), invoice_id UUID NOT NULL REFERENCES sales_invoices(id) ON DELETE CASCADE, version_no INT NOT NULL, barcode VARCHAR(64) NOT NULL UNIQUE, change_summary JSONB NOT NULL DEFAULT '{}'::jsonb, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), created_by UUID NOT NULL REFERENCES users(id), UNIQUE(invoice_id, version_no) );`
  2. `ALTER TABLE sales_invoices ADD COLUMN IF NOT EXISTS current_version INT NOT NULL DEFAULT 1;`
  3. `ALTER TABLE sales_invoices ADD COLUMN IF NOT EXISTS current_barcode VARCHAR(64) UNIQUE;`
  4. Backfill v1 for every existing invoice (deterministic barcode = SHA-256 of `si_number || ':1'` then base32-encoded — implement in plpgsql or run from app):
     ```sql
     INSERT INTO invoice_versions (invoice_id, version_no, barcode, created_by)
     SELECT si.id, 1, encode(digest(si.si_number || ':1','sha256'),'hex'), si.created_by
       FROM sales_invoices si
      WHERE NOT EXISTS (SELECT 1 FROM invoice_versions iv WHERE iv.invoice_id = si.id);
     UPDATE sales_invoices si SET current_barcode = iv.barcode
       FROM invoice_versions iv WHERE iv.invoice_id = si.id AND iv.version_no = 1 AND si.current_barcode IS NULL;
     ```
     (`pgcrypto` `digest` requires extension — `CREATE EXTENSION IF NOT EXISTS pgcrypto;` at top of migration.)
  5. `CREATE INDEX IF NOT EXISTS idx_invoice_versions_invoice ON invoice_versions(invoice_id, version_no DESC);`

**Quality Gate:**
- Transaction boundary: `BEGIN`/`COMMIT`.
- Doc number generation: invoice numbering unchanged (`SI`). Barcode generated via SHA256.
- Parent→child inserts: parent=`sales_invoices` (existing) → child=`invoice_versions` (backfill v1 row).
- Side effects: none.
- Response shape: N/A.

- [ ] T1 complete

### T2 — `lib/invoice/versioning.ts`
**File:** `lib/invoice/versioning.ts` (new)
**Operation:** create

**Details:**
- Export:
  ```ts
  export function generateInvoiceBarcode(invoiceNumber: string, versionNo: number): string;
  // SHA-256(invoiceNumber + ':' + versionNo) → hex with Luhn check digit appended
  export async function verifyInvoiceBarcode(barcode: string): Promise<{ invoice_id: string; version_no: number } | null>;
  // SELECT from invoice_versions where barcode=$1; returns latest match or null.
  export async function bumpInvoiceVersion(client: PoolClient, invoiceId: string, userId: string, changeSummary: object): Promise<{ version_no: number; barcode: string }>;
  ```
- `bumpInvoiceVersion` SQL (called inside an existing transaction with a passed `PoolClient`):
  1. `SELECT current_version FROM sales_invoices WHERE id=$1 FOR UPDATE` → `nextVer = current_version + 1`.
  2. Compute new barcode via `generateInvoiceBarcode(si_number, nextVer)` (fetch `si_number` from row).
  3. `INSERT INTO invoice_versions (invoice_id, version_no, barcode, change_summary, created_by) VALUES (...)`.
  4. `UPDATE sales_invoices SET current_version=$1, current_barcode=$2 WHERE id=$3`.
  5. Return `{ version_no, barcode }`.

**Quality Gate:**
- Transaction boundary: must run inside caller's `BEGIN`/`COMMIT`; helper accepts `PoolClient` to share connection.
- Doc number generation: barcode generation deterministic from `si_number + ':' + version_no`.
- Parent→child inserts: SELECT FOR UPDATE → INSERT child invoice_versions → UPDATE parent sales_invoices.
- Side effects: parent invoice row updated.
- Response shape: `{ version_no, barcode }`.

- [ ] T2 complete

### T3 — Extend `PATCH /api/sales-invoices/[id]`
**File:** `app/api/sales-invoices/[id]/route.ts`
**Operation:** extend

**Details:**
- For each PATCH action that mutates totals or lines (per `body.action` discriminant — list: `update_lines`, `update_totals`, `add_line`, `remove_line` — Grep to enumerate actual actions), call `bumpInvoiceVersion(client, id, u.id, changeSummary)` inside the existing transaction.
- `changeSummary` must capture `+ added`, `- removed`, `± changed_price`, `± changed_qty` by diffing the prior line state vs new state.

**Quality Gate:**
- Transaction boundary: existing `BEGIN`/`COMMIT`/`ROLLBACK` extended with version bump.
- Doc number generation: N/A.
- Parent→child inserts: SELECT FOR UPDATE → INSERT invoice_versions → UPDATE sales_invoices.
- Side effects: invoice_versions insert + sales_invoices update.
- Response shape: `apiSuccess({ sales_invoice, version_no, barcode })`.

- [ ] T3 complete

### T4 — `GET /api/sales-invoices/[id]/delta-slip`
**File:** `app/api/sales-invoices/[id]/delta-slip/route.ts` (new)
**Operation:** create

**Details:**
- Auth; `assertPermission(u, 'si:view')`.
- Query: latest 2 `invoice_versions.change_summary` for invoice → compute lines that differ.
- Return JSON: `apiSuccess({ delta_lines: [...] })`.

**Quality Gate:** Response shape: `apiSuccess({ delta_lines: { product_id, change_type, qty_delta, price_delta }[] })`. Others N/A.

- [ ] T4 complete

### T5 — `GET /api/sales-invoices/[id]/versions`
**File:** `app/api/sales-invoices/[id]/versions/route.ts` (new)
**Operation:** create

**Details:**
- List all `invoice_versions` for the invoice ordered by `version_no DESC`.
- `apiSuccess({ versions })`.

**Quality Gate:** Response shape: `apiSuccess({ versions: InvoiceVersion[] })`. Others N/A.

- [ ] T5 complete

### T6 — UI: version dropdown + delta-slip print
**File:** `app/app/sales-invoices/[id]/page.tsx`
**Operation:** extend

**Details:**
- Version dropdown listing versions; "View delta slip" button calling T4.
- Print template optimised for thermal receipt (CSS-only; no PDF lib).

**Quality Gate:** N/A (UI).

- [ ] T6 complete

### T7 — Update `current-state.md`
**File:** `_notes/02_Agent_Memory/current-state.md`
**Operation:** extend

**Details:** `invoice_versions(invoice_id, version_no, barcode UNIQUE, change_summary)`, `sales_invoices.current_version`, `sales_invoices.current_barcode UNIQUE`. Migration → 048.

- [ ] T7 complete

## Definition of Done

- [ ] T1..T7 ticked
- [ ] `npm run lint` + `npx tsc --noEmit` pass
- [ ] Migration idempotent (existing invoices get a v1 row + barcode)
- [ ] Manual smoke: edit invoice → new version → old barcode rejected by `verifyInvoiceBarcode`
- [ ] `_notes/02_Agent_Memory/current-state.md` updated
- [ ] Status set to `Completed`

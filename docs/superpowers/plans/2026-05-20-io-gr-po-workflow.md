# IO → GR → PO Workflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build IO-first receiving workflow — Supervisor creates IO card → Staff receives goods (GRN) → Supervisor confirms (triggers stock) → Purchaser creates PO with pricing.

**Architecture:** DB migration adds new columns/statuses → backend routes modified/created → frontend pages redesigned. Backend tasks 1–6 before frontend tasks 7–11. Existing `/api/grn/[id]/confirm` modified (IO branch added); two new GRN routes (`reject`, `resubmit`) created.

**Tech Stack:** Next.js 15 App Router · PostgreSQL raw `pg` · TypeScript strict · Zod · Tailwind CSS · `lib/api-response` helpers

---

## Existing Enum Values (DO NOT re-derive)

```
inbound_order_status: open, receiving, pending_verification, verified, closed
grn_status:           draft, received, qc_pending, qc_passed, qc_failed, stocked, verified
```

New values this plan adds:
- `inbound_order_status`: `rejected`, `converted_to_po`
- `grn_status`: `rejected`

Status mapping for IO workflow:
- Staff saves draft → GRN = `draft`, IO stays `receiving`
- Staff submits → GRN = `received`, IO = `pending_verification`
- Supervisor confirms → GRN = `stocked`, IO = `verified` (stock_ledger inserted)
- Supervisor rejects → GRN = `rejected`, IO = `receiving`
- PO created → IO = `converted_to_po`

---

## Task 1: DB Migration

**Files:**
- Create: `migrations/038_io_gr_po_workflow.sql`

- [ ] **Step 1: Create migration file**

```sql
-- migrations/038_io_gr_po_workflow.sql

-- 1. New IO status values
ALTER TYPE inbound_order_status ADD VALUE IF NOT EXISTS 'rejected';
ALTER TYPE inbound_order_status ADD VALUE IF NOT EXISTS 'converted_to_po';

-- 2. New GRN status value
ALTER TYPE grn_status ADD VALUE IF NOT EXISTS 'rejected';

-- 3. IO: order_date + parent_io_id (for partial delivery split)
ALTER TABLE inbound_orders
  ADD COLUMN IF NOT EXISTS order_date    DATE NOT NULL DEFAULT CURRENT_DATE,
  ADD COLUMN IF NOT EXISTS parent_io_id UUID REFERENCES inbound_orders(id);

-- 4. GRN: received_by_names + lift fee
ALTER TABLE goods_receipt_notes
  ADD COLUMN IF NOT EXISTS received_by_names TEXT,
  ADD COLUMN IF NOT EXISTS lift_fee_rounds   INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS lift_fee_amount   NUMERIC(10,2) GENERATED ALWAYS AS (lift_fee_rounds * 50.00) STORED;

-- 5. GRN lines: date_type + mfg_date
ALTER TABLE grn_line_items
  ADD COLUMN IF NOT EXISTS date_type VARCHAR(10) NOT NULL DEFAULT 'expiry'
    CHECK (date_type IN ('expiry', 'mfg')),
  ADD COLUMN IF NOT EXISTS mfg_date DATE;

-- 6. IO-PO link table (many-to-many)
CREATE TABLE IF NOT EXISTS io_po_links (
  io_id UUID NOT NULL REFERENCES inbound_orders(id),
  po_id UUID NOT NULL REFERENCES purchase_orders(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (io_id, po_id)
);

CREATE INDEX IF NOT EXISTS idx_io_po_links_po ON io_po_links(po_id);

-- 7. GRN: rejection tracking
ALTER TABLE goods_receipt_notes
  ADD COLUMN IF NOT EXISTS rejected_by     UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS rejected_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rejection_notes TEXT;
```

- [ ] **Step 2: Run migration**

```powershell
npm run migrate
```

Expected: no errors. If `GENERATED ALWAYS AS` errors → PostgreSQL < 12, replace with regular column and add trigger.

- [ ] **Step 3: Verify columns exist**

```powershell
# Connect to DB and run:
# SELECT column_name FROM information_schema.columns WHERE table_name = 'inbound_orders';
# Should see: order_date, parent_io_id
# SELECT column_name FROM information_schema.columns WHERE table_name = 'goods_receipt_notes';
# Should see: received_by_names, lift_fee_rounds, lift_fee_amount, rejected_by, rejected_at, rejection_notes
# SELECT column_name FROM information_schema.columns WHERE table_name = 'grn_line_items';
# Should see: date_type, mfg_date
```

- [ ] **Step 4: Commit**

```bash
git add migrations/038_io_gr_po_workflow.sql
git commit -m "feat(migration): add IO-GR-PO workflow schema — order_date, lift_fee, date_type, rejected status, io_po_links"
```

---

## Task 2: IO API — order_date + edit lines

**Files:**
- Modify: `app/api/inbound-orders/route.ts`
- Modify: `app/api/inbound-orders/[id]/route.ts`

- [ ] **Step 1: Add `order_date` to POST /api/inbound-orders**

In `app/api/inbound-orders/route.ts`, find the `createSchema` Zod object and add:

```typescript
const createSchema = z.object({
  vendor_id: z.string().uuid(),
  warehouse_id: z.string().uuid(),
  order_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  notes: z.string().optional(),
  lines: z.array(lineSchema).min(1),
});
```

In the POST handler INSERT query, add `order_date` column:

```typescript
// Find the INSERT INTO inbound_orders query and add order_date:
const io = await queryOne<{ id: string; io_number: string }>(
  `INSERT INTO inbound_orders (vendor_id, warehouse_id, order_date, notes, created_by)
   VALUES ($1, $2, $3, $4, $5)
   RETURNING id, io_number`,
  [
    parsed.data.vendor_id,
    parsed.data.warehouse_id,
    parsed.data.order_date ?? new Date().toISOString().slice(0, 10),
    parsed.data.notes ?? null,
    u.id,
  ]
);
```

- [ ] **Step 2: Add `order_date` to GET /api/inbound-orders response**

In the SELECT query in GET handler, add `io.order_date` to the selected columns.

- [ ] **Step 3: Add `update_lines` PATCH action to /api/inbound-orders/[id]**

In `app/api/inbound-orders/[id]/route.ts`, extend the `patchSchema` discriminated union:

```typescript
const patchSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('change_warehouse'),
    warehouse_id: z.string().uuid(),
  }),
  z.object({
    action: z.literal('update_costs'),
    lines: z.array(z.object({
      id: z.string().uuid(),
      unit_cost: z.number().nonnegative(),
    })).min(1),
  }),
  z.object({
    action: z.literal('update_header'),
    order_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    notes: z.string().optional(),
  }),
  z.object({
    action: z.literal('update_lines'),
    lines: z.array(z.object({
      id: z.string().uuid(),
      qty_ordered: z.number().positive(),
      notes: z.string().optional(),
    })).min(1),
  }),
]);
```

Add handlers for `update_header` and `update_lines` in the PATCH function body. Place before the final `return apiError('Unknown action', 400)`:

```typescript
if (parsed.data.action === 'update_header') {
  // Only allow editing open IOs
  const io = await queryOne<{ status: string }>(
    'SELECT status FROM inbound_orders WHERE id = $1',
    [id]
  );
  if (!io) return apiError('IO not found', 404);
  if (io.status !== 'open') return apiError('Only open IOs can be edited', 409);

  const fields: string[] = [];
  const params: unknown[] = [];
  let idx = 1;
  if (parsed.data.order_date !== undefined) {
    fields.push(`order_date = $${idx++}`); params.push(parsed.data.order_date);
  }
  if (parsed.data.notes !== undefined) {
    fields.push(`notes = $${idx++}`); params.push(parsed.data.notes);
  }
  if (fields.length === 0) return apiError('No fields to update', 400);
  params.push(id);
  await query(`UPDATE inbound_orders SET ${fields.join(', ')} WHERE id = $${idx}`, params);
  return apiSuccess({ id });
}

if (parsed.data.action === 'update_lines') {
  const io = await queryOne<{ status: string }>(
    'SELECT status FROM inbound_orders WHERE id = $1',
    [id]
  );
  if (!io) return apiError('IO not found', 404);
  if (io.status !== 'open') return apiError('Only open IOs can be edited', 409);

  for (const line of parsed.data.lines) {
    await query(
      'UPDATE inbound_order_lines SET qty_ordered = $1, notes = $2 WHERE id = $3 AND io_id = $4',
      [line.qty_ordered, line.notes ?? null, line.id, id]
    );
  }
  return apiSuccess({ id });
}
```

- [ ] **Step 4: TypeScript check**

```powershell
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add app/api/inbound-orders/route.ts app/api/inbound-orders/[id]/route.ts
git commit -m "feat(api): IO order_date field + update_header + update_lines PATCH actions"
```

---

## Task 3: GRN API — new fields

**Files:**
- Modify: `app/api/grn/route.ts`

- [ ] **Step 1: Extend GRN Zod line schema with `date_type` and `mfg_date`**

In `app/api/grn/route.ts`, find the line item schema and add:

```typescript
// Find: const lineSchema (or equivalent) for GRN line items
// Add date_type and mfg_date:
date_type: z.enum(['expiry', 'mfg']).default('expiry'),
mfg_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
```

- [ ] **Step 2: Extend GRN header schema with `received_by_names` and `lift_fee_rounds`**

In the GRN POST body schema, add:

```typescript
received_by_names: z.string().optional(),
lift_fee_rounds: z.number().int().min(0).default(0),
```

- [ ] **Step 3: Include new columns in GRN INSERT (IO/PO path)**

In the IO/PO-based GRN POST path, update the INSERT for `goods_receipt_notes`:

```typescript
// Add received_by_names and lift_fee_rounds to INSERT:
const grnResult = await client2.query<{ id: string; grn_number: string; status: string }>(
  `INSERT INTO goods_receipt_notes
     (po_id, inbound_order_id, warehouse_id, received_by, received_date, notes,
      source_type, received_by_names, lift_fee_rounds)
   VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
   RETURNING id, grn_number, status`,
  [
    parsed.data.po_id ?? null,
    parsed.data.inbound_order_id ?? null,
    parsed.data.warehouse_id,
    u.id,
    parsed.data.received_date,
    parsed.data.notes ?? null,
    sourceType,
    parsed.data.received_by_names ?? null,
    parsed.data.lift_fee_rounds ?? 0,
  ]
);
```

- [ ] **Step 4: Include `date_type` and `mfg_date` in GRN line items INSERT**

Find the `grn_line_items` INSERT in the IO/PO path. Add `date_type` and `mfg_date` columns. The line values template becomes (add 2 more params per line):

```typescript
// Update line INSERT to include date_type and mfg_date
// Update parameterized values template — add $${i*N+?} for date_type and mfg_date
// In lineParams loop, add:
lineParams.push(
  l.po_line_item_id ?? null,
  l.inbound_order_line_id ?? null,
  l.product_id,
  l.qty_received,
  l.lot_number ?? null,
  l.serial_number ?? null,
  l.expiry_date ?? null,
  l.storage_location ?? null,
  sourceType,
  cost,
  l.date_type ?? 'expiry',   // ← new
  l.mfg_date ?? null,         // ← new
);

// UPDATE the INSERT SQL to match:
`INSERT INTO grn_line_items
  (grn_id, po_line_item_id, inbound_order_line_id, product_id, qty_received,
   lot_number, serial_number, expiry_date, storage_location, source_type,
   unit_cost, date_type, mfg_date, line_number)
 VALUES ${lineValues}`
// lineValues template: ($1, $${i*12+2}, ..., $${i*12+12}, $${i*12+13}, ${i+1})
// (12 params per line, starting offset 2)
```

- [ ] **Step 5: TypeScript check + lint**

```powershell
npx tsc --noEmit && npm run lint
```

Expected: 0 errors.

- [ ] **Step 6: Manual test**

Start dev server (`npm run dev`). POST to `/api/grn` with `io_id`, include `received_by_names: "สมชาย"`, `lift_fee_rounds: 3`, and per-line `date_type: "mfg"`, `mfg_date: "2026-01-15"`. Verify 201 response with `grn_number`.

- [ ] **Step 7: Commit**

```bash
git add app/api/grn/route.ts
git commit -m "feat(api): GRN received_by_names, lift_fee_rounds, date_type, mfg_date fields"
```

---

## Task 4: GRN confirm — IO branch + partial split

**Files:**
- Modify: `app/api/grn/[id]/confirm/route.ts`

- [ ] **Step 1: Add IO status update after stock insert**

In `app/api/grn/[id]/confirm/route.ts`, after the GRN status UPDATE to `stocked` (around line 109), add:

```typescript
// After: UPDATE goods_receipt_notes SET status = 'stocked'...
// Add IO status update when source is inbound_order:
const grnFull = await client.query<{
  source_type: string;
  inbound_order_id: string | null;
}>(
  'SELECT source_type, inbound_order_id FROM goods_receipt_notes WHERE id = $1',
  [id]
);
const grnInfo = grnFull.rows[0];

if (grnInfo?.source_type === 'inbound_order' && grnInfo.inbound_order_id) {
  const ioId = grnInfo.inbound_order_id;

  // Get IO details for partial split
  const ioData = await client.query<{
    vendor_id: string; warehouse_id: string; notes: string | null; created_by: string;
  }>(
    'SELECT vendor_id, warehouse_id, notes, created_by FROM inbound_orders WHERE id = $1',
    [ioId]
  );
  const io = ioData.rows[0];

  // Compare received vs ordered for each line
  const lineComp = await client.query<{
    io_line_id: string; product_id: string; qty_ordered: number;
    qty_received_now: number; line_number: number; notes: string | null;
  }>(
    `SELECT iol.id AS io_line_id, iol.product_id,
            iol.qty_ordered, iol.notes, iol.line_number,
            COALESCE(gli.qty_received, 0) AS qty_received_now
     FROM inbound_order_lines iol
     LEFT JOIN grn_line_items gli
       ON gli.inbound_order_line_id = iol.id AND gli.grn_id = $1
     WHERE iol.io_id = $2`,
    [id, ioId]
  );

  const remainingLines = lineComp.rows.filter(
    (r) => Number(r.qty_received_now) < Number(r.qty_ordered)
  );

  if (remainingLines.length > 0 && io) {
    // Auto-create partial IO
    const newIO = await client.query<{ id: string; io_number: string }>(
      `INSERT INTO inbound_orders
         (vendor_id, warehouse_id, notes, parent_io_id, created_by)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, io_number`,
      [io.vendor_id, io.warehouse_id, io.notes, ioId, u.id]
    );
    const newIoId = newIO.rows[0].id;

    for (let i = 0; i < remainingLines.length; i++) {
      const r = remainingLines[i];
      const remaining = Number(r.qty_ordered) - Number(r.qty_received_now);
      await client.query(
        `INSERT INTO inbound_order_lines
           (io_id, product_id, qty_ordered, notes, line_number)
         VALUES ($1, $2, $3, $4, $5)`,
        [newIoId, r.product_id, remaining, r.notes, i + 1]
      );
    }
  }

  // Update original IO to verified
  await client.query(
    `UPDATE inbound_orders SET status = 'verified', verified_by = $1, verified_at = NOW()
     WHERE id = $2`,
    [u.id, ioId]
  );
}
```

- [ ] **Step 2: TypeScript check**

```powershell
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Manual test — full confirm**

1. Create IO with 2 lines (50 kg each)
2. Create GRN from IO, receive line 1: 50 kg, line 2: 30 kg
3. POST /api/grn/[grn_id]/receive
4. POST /api/grn/[grn_id]/confirm
5. Verify: GRN status = `stocked`, IO status = `verified`
6. Verify: new IO auto-created with 1 line (20 kg remaining), `parent_io_id` set

- [ ] **Step 4: Commit**

```bash
git add app/api/grn/[id]/confirm/route.ts
git commit -m "feat(api): GRN confirm — IO status update + partial delivery auto-split"
```

---

## Task 5: GRN reject + resubmit routes

**Files:**
- Create: `app/api/grn/[id]/reject/route.ts`
- Create: `app/api/grn/[id]/resubmit/route.ts`

- [ ] **Step 1: Create reject route**

```typescript
// app/api/grn/[id]/reject/route.ts
import { auth } from '@/auth';
import { apiSuccess, apiError, apiValidationError } from '@/lib/api-response';
import { assertRole } from '@/lib/authz';
import pool, { queryOne } from '@/lib/db/client';
import { z } from 'zod';
import type { SessionUser } from '@/lib/authz';

const schema = z.object({ reason: z.string().min(1) });

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;
  try { assertRole(u, ['manager', 'admin']); } catch { return apiError('Forbidden', 403); }

  const { id } = await params;
  const body = await req.json().catch(() => null);
  if (!body) return apiError('Invalid JSON', 400);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return apiValidationError(parsed.error);

  const grn = await queryOne<{ status: string; inbound_order_id: string | null; source_type: string }>(
    'SELECT status, inbound_order_id, source_type FROM goods_receipt_notes WHERE id = $1',
    [id]
  );
  if (!grn) return apiError('GRN not found', 404);
  if (grn.status !== 'received') return apiError('Only received GRNs can be rejected', 409);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(
      `UPDATE goods_receipt_notes
       SET status = 'rejected', rejected_by = $1, rejected_at = NOW(), rejection_notes = $2, updated_at = NOW()
       WHERE id = $3`,
      [u.id, parsed.data.reason, id]
    );

    if (grn.source_type === 'inbound_order' && grn.inbound_order_id) {
      await client.query(
        `UPDATE inbound_orders SET status = 'receiving', updated_at = NOW() WHERE id = $1`,
        [grn.inbound_order_id]
      );
    }

    await client.query('COMMIT');
    return apiSuccess({ id, status: 'rejected' });
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('[POST /api/grn/[id]/reject]', e);
    throw e;
  } finally {
    client.release();
  }
}
```

- [ ] **Step 2: Create resubmit route**

```typescript
// app/api/grn/[id]/resubmit/route.ts
import { auth } from '@/auth';
import { apiSuccess, apiError } from '@/lib/api-response';
import pool, { queryOne } from '@/lib/db/client';
import type { SessionUser } from '@/lib/authz';

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;
  // warehouse_staff or above can resubmit
  if (!['warehouse_staff', 'manager', 'admin'].includes(u.role)) {
    return apiError('Forbidden', 403);
  }

  const { id } = await params;
  const grn = await queryOne<{ status: string; inbound_order_id: string | null; source_type: string }>(
    'SELECT status, inbound_order_id, source_type FROM goods_receipt_notes WHERE id = $1',
    [id]
  );
  if (!grn) return apiError('GRN not found', 404);
  if (grn.status !== 'rejected') return apiError('Only rejected GRNs can be resubmitted', 409);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(
      `UPDATE goods_receipt_notes
       SET status = 'received', rejected_by = NULL, rejected_at = NULL, rejection_notes = NULL, updated_at = NOW()
       WHERE id = $1`,
      [id]
    );

    if (grn.source_type === 'inbound_order' && grn.inbound_order_id) {
      await client.query(
        `UPDATE inbound_orders SET status = 'pending_verification', updated_at = NOW() WHERE id = $1`,
        [grn.inbound_order_id]
      );
    }

    await client.query('COMMIT');
    return apiSuccess({ id, status: 'received' });
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('[POST /api/grn/[id]/resubmit]', e);
    throw e;
  } finally {
    client.release();
  }
}
```

- [ ] **Step 3: TypeScript check**

```powershell
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 4: Manual test**

1. Create GRN from IO, POST /api/grn/[id]/receive (status → received)
2. POST /api/grn/[id]/reject `{ "reason": "จำนวนไม่ถูกต้อง" }` with manager token → 200, GRN = rejected, IO = receiving
3. POST /api/grn/[id]/resubmit with staff token → 200, GRN = received, IO = pending_verification
4. POST /api/grn/[id]/reject with staff token → 403

- [ ] **Step 5: Commit**

```bash
git add app/api/grn/[id]/reject/route.ts app/api/grn/[id]/resubmit/route.ts
git commit -m "feat(api): GRN reject + resubmit routes for supervisor rejection flow"
```

---

## Task 6: PO API — create from IO ids

**Files:**
- Modify: `app/api/purchase-orders/route.ts`

- [ ] **Step 1: Add `io_ids` to PO POST schema**

In `app/api/purchase-orders/route.ts`, find the Zod schema for PO creation. Add `io_ids` as an alternative to `pr_ids`:

```typescript
// In the Zod schema, add:
io_ids: z.array(z.string().uuid()).optional(),
```

- [ ] **Step 2: Add IO-based PO creation logic in POST handler**

After the existing PR-based PO creation transaction (or alongside it), add IO path. After `await client.query('COMMIT')` in the existing transaction but before it, add:

```typescript
// After INSERT purchase_orders and po_line_items in transaction:
if (parsed.data.io_ids?.length) {
  // Validate all IOs are verified and same vendor
  const ios = await client.query<{ id: string; vendor_id: string; status: string }>(
    `SELECT id, vendor_id, status FROM inbound_orders WHERE id = ANY($1::uuid[])`,
    [parsed.data.io_ids]
  );
  const notVerified = ios.rows.filter((io) => io.status !== 'verified');
  if (notVerified.length > 0) throw new Error('All IOs must be verified before creating PO');

  // Insert io_po_links
  for (const ioId of parsed.data.io_ids) {
    await client.query(
      `INSERT INTO io_po_links (io_id, po_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [ioId, poRow.id]
    );
  }

  // Update IO status to converted_to_po
  await client.query(
    `UPDATE inbound_orders SET status = 'converted_to_po', updated_at = NOW()
     WHERE id = ANY($1::uuid[])`,
    [parsed.data.io_ids]
  );

  // Update unit_cost on GRN line items (so stock ledger cost is correct)
  // lines array contains unit_price per product; match by product_id
  for (const line of parsed.data.lines) {
    await client.query(
      `UPDATE grn_line_items gli
       SET unit_cost = $1
       FROM goods_receipt_notes g
       JOIN io_po_links ipl ON ipl.io_id = g.inbound_order_id
       WHERE gli.grn_id = g.id
         AND gli.product_id = $2
         AND ipl.po_id = $3`,
      [line.unit_price, line.product_id, poRow.id]
    );
  }
}
```

- [ ] **Step 3: TypeScript check**

```powershell
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add app/api/purchase-orders/route.ts
git commit -m "feat(api): PO creation from IO ids — io_po_links + convert_to_po status"
```

---

## Task 7: IO List page — row card redesign

**Files:**
- Modify: `app/app/inbound-orders/page.tsx`

- [ ] **Step 1: Replace table with full-width row cards**

Replace the `<Table>` section in `app/app/inbound-orders/page.tsx` with card list. Replace from `<div className="rounded-xl bg-white ...">` to the end of the table:

```tsx
{/* Replace entire table div with: */}
<div className="space-y-2">
  {loading ? (
    <div className="py-16 text-center text-sm text-gray-400">กำลังโหลด...</div>
  ) : !data?.data.length ? (
    <div className="py-16 text-center text-sm text-gray-400">ไม่มีรายการ</div>
  ) : (
    data.data.map((io) => {
      const borderColor: Record<string, string> = {
        open: 'border-l-emerald-400',
        receiving: 'border-l-blue-400',
        pending_verification: 'border-l-amber-400',
        verified: 'border-l-violet-400',
        converted_to_po: 'border-l-gray-400',
        rejected: 'border-l-red-400',
        closed: 'border-l-gray-300',
      };
      const statusLabel: Record<string, string> = {
        open: 'รอรับสินค้า',
        receiving: 'กำลังรับ',
        pending_verification: 'รอยืนยัน',
        verified: 'ยืนยันแล้ว',
        converted_to_po: 'เปิด PO แล้ว',
        rejected: 'ถูกตีกลับ',
        closed: 'ปิดแล้ว',
      };
      return (
        <Link
          key={io.id}
          href={`/app/inbound-orders/${io.id}`}
          transitionTypes={['nav-forward']}
        >
          <div className={`bg-white rounded-xl border border-gray-100 border-l-4 ${borderColor[io.status] ?? 'border-l-gray-200'} px-4 py-3 shadow-sm hover:shadow-md transition-shadow`}>
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold text-gray-900 text-sm">{(io as Record<string, string>).io_number}</span>
                  <span className="text-sm text-blue-600 truncate">{(io as Record<string, string>).vendor_name}</span>
                </div>
                <div className="flex items-center gap-4 text-xs text-gray-500">
                  <span>📅 {formatDate((io as Record<string, string>).order_date ?? (io as Record<string, string>).created_at)}</span>
                  <span>🏭 {(io as Record<string, string>).warehouse_code}</span>
                  <span>📦 {(io as Record<string, string>).line_count} รายการ</span>
                </div>
              </div>
              <StatusBadge status={io.status} label={statusLabel[io.status]} />
            </div>
          </div>
        </Link>
      );
    })
  )}
</div>
```

- [ ] **Step 2: Update filter status options to match new enum values**

Replace the `<select>` status options:

```tsx
<option value="">ทุกสถานะ</option>
<option value="open">รอรับสินค้า</option>
<option value="receiving">กำลังรับ</option>
<option value="pending_verification">รอยืนยัน</option>
<option value="verified">ยืนยันแล้ว</option>
<option value="converted_to_po">เปิด PO แล้ว</option>
<option value="rejected">ถูกตีกลับ</option>
<option value="closed">ปิดแล้ว</option>
```

- [ ] **Step 3: TypeScript check + visual test**

```powershell
npx tsc --noEmit
```

Open browser → `/app/inbound-orders` → verify row card layout shows. Each card should show IO number, vendor, date, warehouse, line count, and status badge.

- [ ] **Step 4: Commit**

```bash
git add app/app/inbound-orders/page.tsx
git commit -m "feat(ui): IO list — full-width row card layout with new status labels"
```

---

## Task 8: IO Create page — add order_date

**Files:**
- Modify: `app/app/inbound-orders/new/page.tsx`

- [ ] **Step 1: Add order_date state and input**

In `app/app/inbound-orders/new/page.tsx`, add state:

```typescript
const [orderDate, setOrderDate] = useState(new Date().toISOString().slice(0, 10));
```

In the form JSX, add an `order_date` field after the vendor dropdown:

```tsx
<div>
  <label className="block text-sm font-medium text-gray-700 mb-1">วันที่สั่ง</label>
  <Input
    type="date"
    value={orderDate}
    onChange={(e) => setOrderDate(e.target.value)}
  />
</div>
```

- [ ] **Step 2: Include order_date in POST payload**

In the submit handler, add to payload:

```typescript
order_date: orderDate,
```

- [ ] **Step 3: Visual test**

Open `/app/inbound-orders/new` → verify `วันที่สั่ง` date picker appears, default = today. Submit → check response has `order_date` stored.

- [ ] **Step 4: Commit**

```bash
git add app/app/inbound-orders/new/page.tsx
git commit -m "feat(ui): IO create — add order_date field"
```

---

## Task 9: IO Detail page — Supervisor confirm/reject UI

**Files:**
- Modify: `app/app/inbound-orders/[id]/page.tsx`

- [ ] **Step 1: Add `rejection_reason` state and action buttons**

In `app/app/inbound-orders/[id]/page.tsx`, add state:

```typescript
const [rejecting, setRejecting] = useState(false);
const [rejectReason, setRejectReason] = useState('');
const [actionLoading, setActionLoading] = useState(false);
const [actionError, setActionError] = useState('');
```

- [ ] **Step 2: Add confirm handler**

```typescript
async function handleConfirmGRN(grnId: string) {
  setActionLoading(true);
  setActionError('');
  try {
    await post(`/api/grn/${grnId}/confirm`, {});
    await fetchIO();
  } catch (e: unknown) {
    setActionError(e instanceof Error ? e.message : 'เกิดข้อผิดพลาด');
  } finally {
    setActionLoading(false);
  }
}
```

- [ ] **Step 3: Add reject handler**

```typescript
async function handleRejectGRN(grnId: string) {
  if (!rejectReason.trim()) { setActionError('กรุณาระบุเหตุผล'); return; }
  setActionLoading(true);
  setActionError('');
  try {
    await post(`/api/grn/${grnId}/reject`, { reason: rejectReason });
    setRejecting(false);
    setRejectReason('');
    await fetchIO();
  } catch (e: unknown) {
    setActionError(e instanceof Error ? e.message : 'เกิดข้อผิดพลาด');
  } finally {
    setActionLoading(false);
  }
}
```

- [ ] **Step 4: Add supervisor action panel in JSX**

In the GRN list section, add action buttons when GRN status = `received`:

```tsx
{io.grns.map((grn) => (
  <div key={grn.id} className="border rounded-lg p-4">
    <div className="flex items-center justify-between">
      <div>
        <span className="font-medium">{grn.grn_number}</span>
        <span className="ml-2 text-sm text-gray-500">{formatDate(grn.received_date)}</span>
        <span className="ml-2 text-sm text-gray-500">{grn.received_by_name}</span>
      </div>
      <StatusBadge status={grn.status} />
    </div>

    {grn.status === 'received' && (
      <div className="mt-3 space-y-2">
        {actionError && <p className="text-sm text-red-500">{actionError}</p>}
        {!rejecting ? (
          <div className="flex gap-2">
            <Button
              onClick={() => handleConfirmGRN(grn.id)}
              disabled={actionLoading}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              ✅ ยืนยันการรับสินค้า
            </Button>
            <Button
              onClick={() => setRejecting(true)}
              disabled={actionLoading}
              variant="outline"
              className="border-red-300 text-red-600 hover:bg-red-50"
            >
              ↩ ตีกลับ
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            <Input
              placeholder="เหตุผลที่ตีกลับ..."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
            />
            <div className="flex gap-2">
              <Button
                onClick={() => handleRejectGRN(grn.id)}
                disabled={actionLoading}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                ยืนยันการตีกลับ
              </Button>
              <Button
                onClick={() => { setRejecting(false); setRejectReason(''); setActionError(''); }}
                variant="outline"
              >
                ยกเลิก
              </Button>
            </div>
          </div>
        )}
      </div>
    )}

    {grn.status === 'rejected' && grn.rejection_notes && (
      <div className="mt-2 text-sm text-red-600 bg-red-50 rounded p-2">
        ⚠️ ตีกลับ: {grn.rejection_notes}
      </div>
    )}
  </div>
))}
```

Note: `grn.rejection_notes` requires updating the GRN list query in `/api/inbound-orders/[id]/route.ts` to include `g.rejection_notes` in the SELECT.

- [ ] **Step 5: Update GRN query in IO detail API to include rejection_notes**

In `app/api/inbound-orders/[id]/route.ts`, update the grns query:

```typescript
const grns = await query(
  `SELECT g.id, g.grn_number, g.status, g.received_date,
          g.rejection_notes, g.received_by_names,
          u.name_en AS received_by_name
   FROM goods_receipt_notes g
   JOIN users u ON u.id = g.received_by
   WHERE g.inbound_order_id = $1
   ORDER BY g.created_at`,
  [id]
);
```

- [ ] **Step 6: TypeScript check + visual test**

```powershell
npx tsc --noEmit
```

Open an IO with a `received` GRN → verify confirm and ตีกลับ buttons appear. Test confirm flow → IO status updates. Test reject flow → rejection reason stored, IO goes back to `receiving`.

- [ ] **Step 7: Commit**

```bash
git add app/app/inbound-orders/[id]/page.tsx app/api/inbound-orders/[id]/route.ts
git commit -m "feat(ui): IO detail — supervisor confirm/reject GRN with rejection reason"
```

---

## Task 10: GRN Receive Form — new fields

**Files:**
- Modify: `app/app/grn/new/page.tsx`

- [ ] **Step 1: Add new state variables**

In `app/app/grn/new/page.tsx`, add:

```typescript
const [receivedByNames, setReceivedByNames] = useState('');
const [liftFeeEnabled, setLiftFeeEnabled] = useState(false);
const [liftFeeRounds, setLiftFeeRounds] = useState(0);
const [isW2Warehouse, setIsW2Warehouse] = useState(false);
```

- [ ] **Step 2: Update GRNLine interface to include date_type and mfg_date**

```typescript
interface GRNLine {
  // ... existing fields ...
  date_type: 'expiry' | 'mfg';
  mfg_date: string;
}
```

Update all `setLines` calls that create initial lines to include:
```typescript
date_type: 'expiry',
mfg_date: '',
```

- [ ] **Step 3: Detect W2 warehouse on warehouse change**

Fetch warehouse list with `code` included. When warehouse changes, check if code = 'W2':

```typescript
// In warehouses fetch, store full warehouse objects:
const [warehouseList, setWarehouseList] = useState<{ id: string; code: string; name_th: string }[]>([]);

// Update fetch:
get<{ id: string; code: string; name_th: string }[]>('/api/admin/warehouses').then((data) => {
  setWarehouseList(data);
  setWarehouses(data.map((w) => ({ value: w.id, label: `${w.code} — ${w.name_th}` })));
});

// When warehouseId changes:
useEffect(() => {
  const w = warehouseList.find((wh) => wh.id === warehouseId);
  setIsW2Warehouse(w?.code === 'W2');
  if (w?.code !== 'W2') { setLiftFeeEnabled(false); setLiftFeeRounds(0); }
}, [warehouseId, warehouseList]);
```

- [ ] **Step 4: Add received_by_names input and lift fee section to JSX**

In the header section of the form (before line items), add:

```tsx
{/* ผู้รับลงสินค้า */}
<div className="mb-4">
  <label className="block text-sm font-medium text-gray-700 mb-1">
    ผู้รับลงสินค้า <span className="text-red-500">*</span>
  </label>
  <Input
    placeholder="ชื่อผู้รับลง (คั่นด้วยจุลภาค เช่น สมชาย, วิภา)"
    value={receivedByNames}
    onChange={(e) => setReceivedByNames(e.target.value)}
  />
</div>

{/* ค่าลิฟท์ — W2 only */}
{isW2Warehouse && (
  <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3">
    <label className="flex items-center gap-2 cursor-pointer">
      <input
        type="checkbox"
        checked={liftFeeEnabled}
        onChange={(e) => {
          setLiftFeeEnabled(e.target.checked);
          if (!e.target.checked) setLiftFeeRounds(0);
        }}
        className="w-4 h-4 rounded"
      />
      <span className="text-sm font-medium text-amber-800">มีค่าลิฟท์</span>
    </label>
    {liftFeeEnabled && (
      <div className="mt-2 flex items-center gap-2">
        <span className="text-sm text-amber-700">จำนวนรอบ</span>
        <Input
          type="number"
          min="0"
          value={liftFeeRounds || ''}
          onChange={(e) => setLiftFeeRounds(Math.max(0, parseInt(e.target.value) || 0))}
          className="w-20 text-center"
        />
        <span className="text-sm text-amber-700">รอบ = </span>
        <span className="font-semibold text-emerald-700">
          ฿{(liftFeeRounds * 50).toLocaleString()}
        </span>
      </div>
    )}
  </div>
)}
```

- [ ] **Step 5: Add date_type toggle to each line item**

In the line item render, replace the `expiry_date` field section with:

```tsx
{/* Date type toggle + input */}
<div>
  <div className="flex items-center gap-2 mb-1">
    {lines[activeLine]?.date_type === 'expiry' ? (
      <>
        <span className="text-xs font-semibold text-red-600">📅 วันหมดอายุ</span>
        <button
          type="button"
          onClick={() => updateLine(activeLine, 'date_type', 'mfg')}
          className="text-xs text-blue-500 underline underline-offset-2"
        >
          → เปลี่ยนเป็น MFG
        </button>
      </>
    ) : (
      <>
        <span className="text-xs font-semibold text-blue-600">🏭 วันที่ผลิต</span>
        <button
          type="button"
          onClick={() => updateLine(activeLine, 'date_type', 'expiry')}
          className="text-xs text-blue-500 underline underline-offset-2"
        >
          → เปลี่ยนเป็น EXP
        </button>
      </>
    )}
  </div>
  <Input
    type="date"
    value={lines[activeLine]?.date_type === 'expiry'
      ? lines[activeLine]?.expiry_date
      : lines[activeLine]?.mfg_date}
    onChange={(e) => {
      const field = lines[activeLine]?.date_type === 'expiry' ? 'expiry_date' : 'mfg_date';
      updateLine(activeLine, field, e.target.value);
    }}
  />
</div>
```

- [ ] **Step 6: Add [พักบิล] button and update submit handler**

Find the existing submit button area. Add a park (draft) button and update the payload:

```tsx
{/* Buttons */}
<div className="flex gap-2">
  <button
    type="button"
    onClick={() => handleSubmit('draft')}
    disabled={saving}
    className="flex-1 rounded-xl border border-gray-300 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50"
  >
    ⏸ พักบิล
  </button>
  <button
    type="button"
    onClick={() => handleSubmit('submit')}
    disabled={saving || !allDone}
    className="flex-3 flex-[3] rounded-xl bg-emerald-600 py-3 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-40"
  >
    ✅ รับลงสินค้าเรียบร้อย
  </button>
</div>
```

Update `handleSubmit` to accept mode:

```typescript
async function handleSubmit(mode: 'draft' | 'submit') {
  // ... existing validation (skip allDone check for draft) ...
  const activeLines = mode === 'draft'
    ? lines.filter((l) => l.qty_received > 0)
    : lines.filter((l) => l.qty_received > 0);

  const payload: Record<string, unknown> = {
    warehouse_id: warehouseId,
    received_date: receivedDate,
    notes: notes || undefined,
    received_by_names: receivedByNames || undefined,
    lift_fee_rounds: liftFeeEnabled ? liftFeeRounds : 0,
    lines: activeLines.map((l) => ({
      po_line_item_id: l.po_line_item_id,
      inbound_order_line_id: l.inbound_order_line_id,
      product_id: l.product_id,
      qty_received: l.qty_received,
      lot_number: l.lot_number || undefined,
      expiry_date: l.date_type === 'expiry' ? (l.expiry_date || undefined) : undefined,
      mfg_date: l.date_type === 'mfg' ? (l.mfg_date || undefined) : undefined,
      date_type: l.date_type,
      storage_location: l.storage_location || undefined,
    })),
  };

  if (mode === 'io') payload.inbound_order_id = ioIdParam;
  else payload.po_id = selectedPoId;

  const result = await post<{ id: string }>('/api/grn', payload);

  if (mode === 'submit') {
    // Immediately mark as received
    await post(`/api/grn/${result.id}/receive`, {});
  }

  router.push(`/app/grn/${result.id}`);
}
```

- [ ] **Step 7: TypeScript check + visual test**

```powershell
npx tsc --noEmit
```

Open `/app/grn/new?io_id=<id>` → verify:
- ผู้รับลงสินค้า input appears
- Date type toggle works per line (EXP ↔ MFG)
- Selecting W2 warehouse shows lift fee section; other warehouses hide it
- [พักบิล] saves as draft (GRN created, no receive call)
- [รับลงสินค้าเรียบร้อย] creates GRN and calls receive

- [ ] **Step 8: Commit**

```bash
git add app/app/grn/new/page.tsx
git commit -m "feat(ui): GRN receive form — received_by_names, lift fee (W2), date toggle, พักบิล button"
```

---

## Task 11: PO Create — IO multi-select path

**Files:**
- Modify: `app/app/purchase-orders/new/page.tsx`

- [ ] **Step 1: Add IO source selector to PO new page**

At the top of the PO create form, add a source selector. The user picks "จาก IO ที่ยืนยันแล้ว" or "ปกติ (PR-based)".

Add state:

```typescript
const [poSource, setPoSource] = useState<'normal' | 'from_io'>('from_io');
const [confirmedIOs, setConfirmedIOs] = useState<{
  id: string; io_number: string; vendor_name: string; warehouse_name: string;
  line_count: number;
}[]>([]);
const [selectedIOIds, setSelectedIOIds] = useState<string[]>([]);
const [ioLines, setIoLines] = useState<{
  product_id: string; sku: string; name_th: string; qty_received: number; uom_code: string; unit_price: number;
}[]>([]);
```

- [ ] **Step 2: Fetch confirmed IOs and their lines**

```typescript
useEffect(() => {
  if (poSource !== 'from_io') return;
  get<{ data: typeof confirmedIOs }>('/api/inbound-orders?status=verified&limit=100')
    .then((r) => setConfirmedIOs(r.data ?? []));
}, [poSource]);

async function loadIOLines(ioIds: string[]) {
  if (!ioIds.length) { setIoLines([]); return; }
  // Fetch GRN lines for each IO (stocked GRNs)
  const results = await Promise.all(
    ioIds.map((id) => get<{ lines: typeof ioLines }>(`/api/inbound-orders/${id}`))
  );
  // Merge lines, aggregate by product_id
  const merged: Map<string, typeof ioLines[0]> = new Map();
  for (const r of results) {
    for (const l of (r as { lines?: { product_id: string; sku: string; name_th: string; qty_received: number; uom_code: string }[] }).lines ?? []) {
      const key = l.product_id;
      if (merged.has(key)) {
        merged.get(key)!.qty_received += Number(l.qty_received);
      } else {
        merged.set(key, { ...l, qty_received: Number(l.qty_received), unit_price: 0 });
      }
    }
  }
  setIoLines(Array.from(merged.values()));
}

useEffect(() => { loadIOLines(selectedIOIds); }, [selectedIOIds]);
```

- [ ] **Step 3: Add IO selection UI and lines table**

In the JSX form, add IO source section:

```tsx
{poSource === 'from_io' && (
  <div>
    <label className="block text-sm font-medium text-gray-700 mb-2">เลือก IO ที่ยืนยันแล้ว</label>
    <div className="space-y-2 max-h-64 overflow-y-auto border rounded-lg p-2">
      {confirmedIOs.map((io) => (
        <label key={io.id} className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded cursor-pointer">
          <input
            type="checkbox"
            checked={selectedIOIds.includes(io.id)}
            onChange={(e) => {
              setSelectedIOIds((prev) =>
                e.target.checked ? [...prev, io.id] : prev.filter((x) => x !== io.id)
              );
            }}
          />
          <span className="text-sm font-medium">{io.io_number}</span>
          <span className="text-sm text-blue-600">{io.vendor_name}</span>
          <span className="text-xs text-gray-400">{io.line_count} รายการ</span>
        </label>
      ))}
    </div>

    {ioLines.length > 0 && (
      <div className="mt-4">
        <p className="text-sm font-medium text-gray-700 mb-2">ใส่ราคาต่อหน่วย</p>
        <div className="space-y-2">
          {ioLines.map((line, i) => (
            <div key={line.product_id} className="flex items-center gap-3 bg-gray-50 rounded-lg p-2">
              <div className="flex-1 text-sm">{line.sku} — {line.name_th}</div>
              <div className="text-sm text-gray-500">รับ {line.qty_received} {line.uom_code}</div>
              <div className="flex items-center gap-1">
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="ราคา/หน่วย"
                  value={line.unit_price || ''}
                  onChange={(e) => {
                    const updated = [...ioLines];
                    updated[i] = { ...updated[i], unit_price: parseFloat(e.target.value) || 0 };
                    setIoLines(updated);
                  }}
                  className="w-28"
                />
                <span className="text-xs text-gray-500">บาท</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    )}
  </div>
)}
```

- [ ] **Step 4: Include io_ids in PO POST payload**

In the submit handler for `from_io` mode:

```typescript
if (poSource === 'from_io') {
  if (!selectedIOIds.length) { setError('กรุณาเลือก IO อย่างน้อย 1 ใบ'); return; }
  const firstIO = confirmedIOs.find((io) => selectedIOIds.includes(io.id));
  payload.vendor_id = firstIO?.vendor_id ?? vendorId; // vendor from IO
  payload.io_ids = selectedIOIds;
  payload.lines = ioLines.map((l) => ({
    product_id: l.product_id,
    qty_ordered: l.qty_received,
    unit_price: l.unit_price,
  }));
}
```

- [ ] **Step 5: TypeScript check + visual test**

```powershell
npx tsc --noEmit
```

Open `/app/purchase-orders/new` → select `จาก IO` → pick 1-2 verified IOs → IO lines appear → fill unit prices → submit → verify PO created, IO status = `converted_to_po`.

- [ ] **Step 6: Commit**

```bash
git add app/app/purchase-orders/new/page.tsx
git commit -m "feat(ui): PO create — IO multi-select path with unit price entry"
```

---

## Self-Review Checklist

- [x] DB migration covers all new columns/statuses/tables
- [x] IO status uses existing enum values (`pending_verification`, `verified`) + new (`rejected`, `converted_to_po`)
- [x] GRN confirm route modified (not new) — IO branch coexists with PO branch
- [x] Partial split triggered on confirm (not on receive — supervisor verifies qty first)
- [x] Lift fee = W2 only (frontend detects via `warehouses.code = 'W2'`)
- [x] Stock ledger insert uses existing confirm route patterns (`entry_type = 'grn_receipt'`)
- [x] Reject route: only `received` GRNs, manager/admin only
- [x] Resubmit route: only `rejected` GRNs, warehouse_staff+
- [x] io_po_links created when PO made from IOs
- [x] IO detail API updated to return `rejection_notes` in GRN list

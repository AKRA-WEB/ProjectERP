---
track: io-gr-po-workflow
status: Active
owner: paku, puka
module: WMS, Purchasing
updated: 2026-05-20
spec: docs/superpowers/specs/2026-05-20-io-gr-po-workflow-design.md
---

# Track: io-gr-po-workflow — IO → GR → PO Workflow

## Objective

สร้าง warehouse-first workflow ใหม่:
**Supervisor เปิด IO card → Staff รับสินค้า (GRN) → Supervisor ยืนยัน (stock เข้าอัตโนมัติ) → จัดซื้อเปิด PO ใส่ราคา**

แทนที่ flow เดิม PR → PO → GRN

---

## Pre-verified Facts (DO NOT re-derive)

```
inbound_order_status enum (existing): open, receiving, pending_verification, verified, closed
grn_status enum (existing):           draft, received, qc_pending, qc_passed, qc_failed, stocked, verified

Status mapping for this workflow:
  Staff saves draft        → GRN = draft,               IO = receiving
  Staff submits            → GRN = received,             IO = pending_verification
  Supervisor confirms      → GRN = stocked (auto stock), IO = verified
  Supervisor rejects       → GRN = rejected (NEW),       IO = receiving
  PO created               → IO = converted_to_po (NEW)

stock_ledger columns: id, warehouse_id, product_id, lot_id, entry_type, qty_change, qty_after,
                      reference_id, reference_type, notes, created_by, created_at
grn_line_items.line_total = GENERATED ALWAYS AS (qty_received * unit_cost) STORED — never INSERT it
next_doc_number('IO', 'seq_io') — doc numbers auto via DB DEFAULT
chk_grn_source + chk_grn_line_source — already DROPPED in migration 035
source_type column already exists on goods_receipt_notes and grn_line_items
Latest migration: 037_repack_system.sql → next = 038_io_gr_po_workflow.sql
W2 detection: warehouses.code = 'W2' (frontend check)
Lift fee rate: ฿50 per round (fixed constant)
```

---

## Task 1 — DB Migration [paku]

**File:** `migrations/038_io_gr_po_workflow.sql` (CREATE)

- [ ] Create migration file:

```sql
-- migrations/038_io_gr_po_workflow.sql

-- 1. New IO status values
ALTER TYPE inbound_order_status ADD VALUE IF NOT EXISTS 'rejected';
ALTER TYPE inbound_order_status ADD VALUE IF NOT EXISTS 'converted_to_po';

-- 2. New GRN status value
ALTER TYPE grn_status ADD VALUE IF NOT EXISTS 'rejected';

-- 3. IO: order_date + parent_io_id
ALTER TABLE inbound_orders
  ADD COLUMN IF NOT EXISTS order_date    DATE NOT NULL DEFAULT CURRENT_DATE,
  ADD COLUMN IF NOT EXISTS parent_io_id UUID REFERENCES inbound_orders(id);

-- 4. GRN: received_by_names + lift fee
ALTER TABLE goods_receipt_notes
  ADD COLUMN IF NOT EXISTS received_by_names TEXT,
  ADD COLUMN IF NOT EXISTS lift_fee_rounds   INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS lift_fee_amount   NUMERIC(10,2)
    GENERATED ALWAYS AS (lift_fee_rounds * 50.00) STORED;

-- 5. GRN lines: date_type + mfg_date
ALTER TABLE grn_line_items
  ADD COLUMN IF NOT EXISTS date_type VARCHAR(10) NOT NULL DEFAULT 'expiry'
    CHECK (date_type IN ('expiry', 'mfg')),
  ADD COLUMN IF NOT EXISTS mfg_date DATE;

-- 6. IO-PO link table
CREATE TABLE IF NOT EXISTS io_po_links (
  io_id      UUID NOT NULL REFERENCES inbound_orders(id),
  po_id      UUID NOT NULL REFERENCES purchase_orders(id),
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

- [ ] Run: `npm run migrate` → expect no errors
- [ ] Commit: `feat(migration): IO-GR-PO workflow schema — lift_fee, date_type, rejected status, io_po_links`

---

## Task 2 — IO API: order_date + edit lines [paku]

**Files:**
- Modify: `app/api/inbound-orders/route.ts`
- Modify: `app/api/inbound-orders/[id]/route.ts`

### 2A — POST /api/inbound-orders: add order_date

In `route.ts` `createSchema`, add:
```typescript
order_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
```

Update INSERT query to include `order_date` column:
```sql
INSERT INTO inbound_orders (vendor_id, warehouse_id, order_date, notes, created_by)
VALUES ($1, $2, $3, $4, $5)
```
Param: `parsed.data.order_date ?? new Date().toISOString().slice(0, 10)`

Add `io.order_date` to GET list SELECT columns.

- [ ] Done

### 2B — PATCH /api/inbound-orders/[id]: add update_header + update_lines actions

Extend `patchSchema` discriminated union with 2 new cases:

```typescript
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
```

Both actions: check IO status = `open` first, return 409 if not. Edit lock prevents modifying IOs already in receiving.

`update_header` handler:
```typescript
if (parsed.data.action === 'update_header') {
  const io = await queryOne<{ status: string }>('SELECT status FROM inbound_orders WHERE id = $1', [id]);
  if (!io) return apiError('IO not found', 404);
  if (io.status !== 'open') return apiError('Only open IOs can be edited', 409);
  const fields: string[] = [];
  const params: unknown[] = [];
  let idx = 1;
  if (parsed.data.order_date !== undefined) { fields.push(`order_date = $${idx++}`); params.push(parsed.data.order_date); }
  if (parsed.data.notes !== undefined) { fields.push(`notes = $${idx++}`); params.push(parsed.data.notes); }
  if (!fields.length) return apiError('No fields to update', 400);
  params.push(id);
  await query(`UPDATE inbound_orders SET ${fields.join(', ')} WHERE id = $${idx}`, params);
  return apiSuccess({ id });
}
```

`update_lines` handler:
```typescript
if (parsed.data.action === 'update_lines') {
  const io = await queryOne<{ status: string }>('SELECT status FROM inbound_orders WHERE id = $1', [id]);
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

- [ ] Done
- [ ] `npx tsc --noEmit` → 0 errors
- [ ] Commit: `feat(api): IO order_date + update_header + update_lines PATCH`

---

## Task 3 — GRN API: new fields [paku]

**File:** `app/api/grn/route.ts` (Modify)

### Changes to GRN POST (IO/PO path):

Add to GRN body Zod schema:
```typescript
received_by_names: z.string().optional(),
lift_fee_rounds: z.number().int().min(0).default(0),
```

Add to GRN line item Zod schema:
```typescript
date_type: z.enum(['expiry', 'mfg']).default('expiry'),
mfg_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
```

Update `goods_receipt_notes` INSERT to include new columns:
```sql
INSERT INTO goods_receipt_notes
  (po_id, inbound_order_id, warehouse_id, received_by, received_date, notes,
   source_type, received_by_names, lift_fee_rounds)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
```

Update `grn_line_items` INSERT to include `date_type` and `mfg_date`. Add 2 extra params per line. Column list:
```sql
INSERT INTO grn_line_items
  (grn_id, po_line_item_id, inbound_order_line_id, product_id, qty_received,
   lot_number, serial_number, expiry_date, storage_location, source_type,
   unit_cost, date_type, mfg_date, line_number)
VALUES ...
```

Each line pushes: `..., l.date_type ?? 'expiry', l.mfg_date ?? null`

- [ ] Done
- [ ] `npx tsc --noEmit` → 0 errors
- [ ] Commit: `feat(api): GRN received_by_names, lift_fee_rounds, date_type, mfg_date`

---

## Task 4 — GRN confirm: IO branch + partial split [paku]

**File:** `app/api/grn/[id]/confirm/route.ts` (Modify — DO NOT rewrite, only add)

After the `UPDATE goods_receipt_notes SET status = 'stocked'...` at the end of the transaction (before `COMMIT`), add the following IO-specific logic:

```typescript
// Fetch source info
const grnFull = await client.query<{ source_type: string; inbound_order_id: string | null }>(
  'SELECT source_type, inbound_order_id FROM goods_receipt_notes WHERE id = $1', [id]
);
const grnInfo = grnFull.rows[0];

if (grnInfo?.source_type === 'inbound_order' && grnInfo.inbound_order_id) {
  const ioId = grnInfo.inbound_order_id;

  // Fetch IO metadata for partial split
  const ioData = await client.query<{
    vendor_id: string; warehouse_id: string; notes: string | null; created_by: string;
  }>('SELECT vendor_id, warehouse_id, notes, created_by FROM inbound_orders WHERE id = $1', [ioId]);
  const io = ioData.rows[0];

  // Compare received vs ordered per line
  const lineComp = await client.query<{
    io_line_id: string; product_id: string; qty_ordered: number;
    qty_received_now: number; line_number: number; notes: string | null;
  }>(
    `SELECT iol.id AS io_line_id, iol.product_id, iol.qty_ordered, iol.notes, iol.line_number,
            COALESCE(gli.qty_received, 0) AS qty_received_now
     FROM inbound_order_lines iol
     LEFT JOIN grn_line_items gli ON gli.inbound_order_line_id = iol.id AND gli.grn_id = $1
     WHERE iol.io_id = $2`,
    [id, ioId]
  );

  const remainingLines = lineComp.rows.filter(
    (r) => Number(r.qty_received_now) < Number(r.qty_ordered)
  );

  // Auto-create partial IO for remaining quantities
  if (remainingLines.length > 0 && io) {
    const newIO = await client.query<{ id: string }>(
      `INSERT INTO inbound_orders (vendor_id, warehouse_id, notes, parent_io_id, created_by)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [io.vendor_id, io.warehouse_id, io.notes, ioId, u.id]
    );
    const newIoId = newIO.rows[0].id;
    for (let i = 0; i < remainingLines.length; i++) {
      const r = remainingLines[i];
      const remaining = Number(r.qty_ordered) - Number(r.qty_received_now);
      await client.query(
        `INSERT INTO inbound_order_lines (io_id, product_id, qty_ordered, notes, line_number)
         VALUES ($1, $2, $3, $4, $5)`,
        [newIoId, r.product_id, remaining, r.notes, i + 1]
      );
    }
  }

  // Mark original IO as verified
  await client.query(
    `UPDATE inbound_orders SET status = 'verified', verified_by = $1, verified_at = NOW()
     WHERE id = $2`,
    [u.id, ioId]
  );
}
```

- [ ] Done
- [ ] `npx tsc --noEmit` → 0 errors
- [ ] Commit: `feat(api): GRN confirm — IO status + partial delivery auto-split`

---

## Task 5 — GRN reject + resubmit [paku]

### 5A — `app/api/grn/[id]/reject/route.ts` (CREATE)

```typescript
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
    'SELECT status, inbound_order_id, source_type FROM goods_receipt_notes WHERE id = $1', [id]
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

- [ ] File created

### 5B — `app/api/grn/[id]/resubmit/route.ts` (CREATE)

```typescript
import { auth } from '@/auth';
import { apiSuccess, apiError } from '@/lib/api-response';
import pool, { queryOne } from '@/lib/db/client';
import type { SessionUser } from '@/lib/authz';

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;
  if (!['warehouse_staff', 'manager', 'admin'].includes(u.role)) return apiError('Forbidden', 403);

  const { id } = await params;
  const grn = await queryOne<{ status: string; inbound_order_id: string | null; source_type: string }>(
    'SELECT status, inbound_order_id, source_type FROM goods_receipt_notes WHERE id = $1', [id]
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

- [ ] File created
- [ ] `npx tsc --noEmit` → 0 errors
- [ ] Commit: `feat(api): GRN reject + resubmit routes`

---

## Task 6 — PO API: create from IO ids [paku]

**File:** `app/api/purchase-orders/route.ts` (Modify)

Add `io_ids` to PO POST Zod schema:
```typescript
io_ids: z.array(z.string().uuid()).optional(),
```

Inside the existing transaction (after PO header + line items INSERT, before COMMIT), add IO path:

```typescript
if (parsed.data.io_ids?.length) {
  const ios = await client.query<{ id: string; vendor_id: string; status: string }>(
    'SELECT id, vendor_id, status FROM inbound_orders WHERE id = ANY($1::uuid[])',
    [parsed.data.io_ids]
  );
  const notVerified = ios.rows.filter((io) => io.status !== 'verified');
  if (notVerified.length > 0) throw new Error('All IOs must be verified before creating PO');

  for (const ioId of parsed.data.io_ids) {
    await client.query(
      'INSERT INTO io_po_links (io_id, po_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [ioId, poRow.id]
    );
  }
  await client.query(
    `UPDATE inbound_orders SET status = 'converted_to_po', updated_at = NOW()
     WHERE id = ANY($1::uuid[])`,
    [parsed.data.io_ids]
  );
  // Update unit_cost on GRN lines so stock cost is correct
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

- [ ] Done
- [ ] `npx tsc --noEmit` → 0 errors
- [ ] Commit: `feat(api): PO creation from IO ids — io_po_links + converted_to_po`

---

## Task 7 — IO List page: row card redesign [puka]

**File:** `app/app/inbound-orders/page.tsx` (Modify)

Replace the `<Table>` block with full-width row cards. Each card:
- Border-left color by status
- Shows: io_number · vendor_name · order_date · warehouse_code · line_count · StatusBadge

Status → border color map:
```typescript
const borderColor: Record<string, string> = {
  open: 'border-l-emerald-400',
  receiving: 'border-l-blue-400',
  pending_verification: 'border-l-amber-400',
  verified: 'border-l-violet-400',
  converted_to_po: 'border-l-gray-400',
  rejected: 'border-l-red-400',
  closed: 'border-l-gray-300',
};
```

Status → Thai label map:
```typescript
const statusLabel: Record<string, string> = {
  open: 'รอรับสินค้า',
  receiving: 'กำลังรับ',
  pending_verification: 'รอยืนยัน',
  verified: 'ยืนยันแล้ว',
  converted_to_po: 'เปิด PO แล้ว',
  rejected: 'ถูกตีกลับ',
  closed: 'ปิดแล้ว',
};
```

Update filter `<select>` options to include all 7 statuses above.

Card links to `/app/inbound-orders/[id]` with `transitionTypes={['nav-forward']}`.

- [ ] Done
- [ ] Visual check: `/app/inbound-orders` shows row cards
- [ ] Commit: `feat(ui): IO list — row card layout + new status labels`

---

## Task 8 — IO Create page: order_date field [puka]

**File:** `app/app/inbound-orders/new/page.tsx` (Modify)

Add state: `const [orderDate, setOrderDate] = useState(new Date().toISOString().slice(0, 10))`

Add `วันที่สั่ง` date input in form (after vendor dropdown):
```tsx
<div>
  <label className="block text-sm font-medium text-gray-700 mb-1">วันที่สั่ง</label>
  <Input type="date" value={orderDate} onChange={(e) => setOrderDate(e.target.value)} />
</div>
```

Include `order_date: orderDate` in POST payload.

- [ ] Done
- [ ] Commit: `feat(ui): IO create — add order_date field`

---

## Task 9 — IO Detail page: supervisor confirm/reject UI [puka]

**File:** `app/app/inbound-orders/[id]/page.tsx` (Modify)
**File:** `app/api/inbound-orders/[id]/route.ts` (Modify — GRN query)

### 9A — Update GRN query in IO detail API

In `app/api/inbound-orders/[id]/route.ts`, update the GRN SELECT to include rejection data:
```sql
SELECT g.id, g.grn_number, g.status, g.received_date,
       g.rejection_notes, g.received_by_names,
       u.name_en AS received_by_name
FROM goods_receipt_notes g
JOIN users u ON u.id = g.received_by
WHERE g.inbound_order_id = $1
ORDER BY g.created_at
```

### 9B — Supervisor action panel in UI

Add states: `rejecting`, `rejectReason`, `actionLoading`, `actionError`

Add handlers:
```typescript
async function handleConfirmGRN(grnId: string) {
  setActionLoading(true); setActionError('');
  try { await post(`/api/grn/${grnId}/confirm`, {}); await fetchIO(); }
  catch (e: unknown) { setActionError(e instanceof Error ? e.message : 'เกิดข้อผิดพลาด'); }
  finally { setActionLoading(false); }
}

async function handleRejectGRN(grnId: string) {
  if (!rejectReason.trim()) { setActionError('กรุณาระบุเหตุผล'); return; }
  setActionLoading(true); setActionError('');
  try {
    await post(`/api/grn/${grnId}/reject`, { reason: rejectReason });
    setRejecting(false); setRejectReason(''); await fetchIO();
  }
  catch (e: unknown) { setActionError(e instanceof Error ? e.message : 'เกิดข้อผิดพลาด'); }
  finally { setActionLoading(false); }
}
```

For each GRN card, when `grn.status === 'received'`, show action panel:
- Button `[✅ ยืนยันการรับสินค้า]` → `handleConfirmGRN(grn.id)` (emerald)
- Button `[↩ ตีกลับ]` → `setRejecting(true)` (red outline)
- When `rejecting`: show Input for reason + `[ยืนยันการตีกลับ]` + `[ยกเลิก]`

When `grn.status === 'rejected'` and `grn.rejection_notes` exists, show red info box:
```tsx
<div className="mt-2 text-sm text-red-600 bg-red-50 rounded p-2">
  ⚠️ ตีกลับ: {grn.rejection_notes}
</div>
```

- [ ] Done
- [ ] Visual check: IO with received GRN shows confirm/reject buttons
- [ ] Commit: `feat(ui): IO detail — supervisor confirm/reject panel`

---

## Task 10 — GRN Receive Form: new fields [puka]

**File:** `app/app/grn/new/page.tsx` (Modify)

### New states to add:
```typescript
const [receivedByNames, setReceivedByNames] = useState('');
const [liftFeeEnabled, setLiftFeeEnabled] = useState(false);
const [liftFeeRounds, setLiftFeeRounds] = useState(0);
const [isW2Warehouse, setIsW2Warehouse] = useState(false);
const [warehouseList, setWarehouseList] = useState<{ id: string; code: string; name_th: string }[]>([]);
```

### GRNLine interface: add `date_type` and `mfg_date`:
```typescript
date_type: 'expiry' | 'mfg';
mfg_date: string;
```
Default when creating lines: `date_type: 'expiry', mfg_date: ''`

### W2 detection:
Update warehouse fetch to store full objects with `code`. When `warehouseId` changes:
```typescript
useEffect(() => {
  const w = warehouseList.find((wh) => wh.id === warehouseId);
  setIsW2Warehouse(w?.code === 'W2');
  if (w?.code !== 'W2') { setLiftFeeEnabled(false); setLiftFeeRounds(0); }
}, [warehouseId, warehouseList]);
```

### Add to header section (before line items):

**ผู้รับลงสินค้า field:**
```tsx
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
```

**Lift fee section (W2 only):**
```tsx
{isW2Warehouse && (
  <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3">
    <label className="flex items-center gap-2 cursor-pointer">
      <input type="checkbox" checked={liftFeeEnabled}
        onChange={(e) => { setLiftFeeEnabled(e.target.checked); if (!e.target.checked) setLiftFeeRounds(0); }}
        className="w-4 h-4 rounded" />
      <span className="text-sm font-medium text-amber-800">มีค่าลิฟท์</span>
    </label>
    {liftFeeEnabled && (
      <div className="mt-2 flex items-center gap-2">
        <span className="text-sm text-amber-700">จำนวนรอบ</span>
        <Input type="number" min="0" value={liftFeeRounds || ''}
          onChange={(e) => setLiftFeeRounds(Math.max(0, parseInt(e.target.value) || 0))}
          className="w-20 text-center" />
        <span className="text-sm text-amber-700">รอบ =</span>
        <span className="font-semibold text-emerald-700">฿{(liftFeeRounds * 50).toLocaleString()}</span>
      </div>
    )}
  </div>
)}
```

### Per-line date type toggle (replace existing expiry_date field):
```tsx
<div>
  <div className="flex items-center gap-2 mb-1">
    {activeL.date_type === 'expiry' ? (
      <>
        <span className="text-xs font-semibold text-red-600">📅 วันหมดอายุ</span>
        <button type="button" onClick={() => updateLine(activeLine, 'date_type', 'mfg')}
          className="text-xs text-blue-500 underline underline-offset-2">→ เปลี่ยนเป็น MFG</button>
      </>
    ) : (
      <>
        <span className="text-xs font-semibold text-blue-600">🏭 วันที่ผลิต</span>
        <button type="button" onClick={() => updateLine(activeLine, 'date_type', 'expiry')}
          className="text-xs text-blue-500 underline underline-offset-2">→ เปลี่ยนเป็น EXP</button>
      </>
    )}
  </div>
  <Input type="date"
    value={activeL.date_type === 'expiry' ? activeL.expiry_date : activeL.mfg_date}
    onChange={(e) => updateLine(activeLine, activeL.date_type === 'expiry' ? 'expiry_date' : 'mfg_date', e.target.value)} />
</div>
```

### Add [พักบิล] button + update handleSubmit:

Replace single submit button with two:
```tsx
<div className="flex gap-2 fixed bottom-4 left-4 right-4">
  <button type="button" onClick={() => handleSubmit('draft')} disabled={saving}
    className="flex-1 rounded-xl border border-gray-300 py-3 text-sm font-medium text-gray-700 bg-white hover:bg-gray-50">
    ⏸ พักบิล
  </button>
  <button type="button" onClick={() => handleSubmit('submit')} disabled={saving}
    className="flex-[3] rounded-xl bg-emerald-600 py-3 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-40">
    ✅ รับลงสินค้าเรียบร้อย
  </button>
</div>
```

Update `handleSubmit` signature to `(mode: 'draft' | 'submit')`. Add `received_by_names` and `lift_fee_rounds` to payload:
```typescript
received_by_names: receivedByNames || undefined,
lift_fee_rounds: liftFeeEnabled ? liftFeeRounds : 0,
```

Per-line payload: include `date_type`, `mfg_date`, and conditionally `expiry_date`:
```typescript
date_type: l.date_type,
expiry_date: l.date_type === 'expiry' ? (l.expiry_date || undefined) : undefined,
mfg_date: l.date_type === 'mfg' ? (l.mfg_date || undefined) : undefined,
```

For `submit` mode, after `post('/api/grn', payload)`, call:
```typescript
await post(`/api/grn/${result.id}/receive`, {});
```

- [ ] Done
- [ ] Visual check: W2 warehouse shows lift fee; other warehouses don't. Date toggle works per line. พักบิล saves draft.
- [ ] Commit: `feat(ui): GRN receive form — received_by_names, lift fee W2, date toggle, พักบิล`

---

## Task 11 — PO Create: IO multi-select path [puka]

**File:** `app/app/purchase-orders/new/page.tsx` (Modify)

Add states:
```typescript
const [confirmedIOs, setConfirmedIOs] = useState<{
  id: string; vendor_id: string; io_number: string; vendor_name: string; line_count: number;
}[]>([]);
const [selectedIOIds, setSelectedIOIds] = useState<string[]>([]);
const [ioLines, setIoLines] = useState<{
  product_id: string; sku: string; name_th: string;
  qty_received: number; uom_code: string; unit_price: number;
}[]>([]);
```

On mount, fetch verified IOs:
```typescript
useEffect(() => {
  get<{ data: typeof confirmedIOs }>('/api/inbound-orders?status=verified&limit=100')
    .then((r) => setConfirmedIOs((r as { data: typeof confirmedIOs }).data ?? []));
}, []);
```

When `selectedIOIds` changes, merge IO lines (aggregate by product_id):
```typescript
useEffect(() => {
  if (!selectedIOIds.length) { setIoLines([]); return; }
  Promise.all(selectedIOIds.map((id) => get<{ lines: { product_id: string; sku: string; name_th: string; qty_received: number; uom_code: string }[] }>(`/api/inbound-orders/${id}`)))
    .then((results) => {
      const merged = new Map<string, typeof ioLines[0]>();
      for (const r of results) {
        for (const l of (r as { lines?: typeof ioLines }).lines ?? []) {
          if (merged.has(l.product_id)) { merged.get(l.product_id)!.qty_received += Number(l.qty_received); }
          else { merged.set(l.product_id, { ...l, qty_received: Number(l.qty_received), unit_price: 0 }); }
        }
      }
      setIoLines(Array.from(merged.values()));
    });
}, [selectedIOIds]);
```

Add IO selector UI at top of form (before existing fields):
```tsx
<div className="mb-6">
  <label className="block text-sm font-medium text-gray-700 mb-2">เลือก IO ที่ยืนยันแล้ว</label>
  <div className="space-y-1 max-h-52 overflow-y-auto border rounded-lg p-2 bg-gray-50">
    {confirmedIOs.length === 0 && <p className="text-sm text-gray-400 p-2">ไม่มี IO ที่รอเปิด PO</p>}
    {confirmedIOs.map((io) => (
      <label key={io.id} className="flex items-center gap-3 p-2 hover:bg-white rounded cursor-pointer">
        <input type="checkbox" checked={selectedIOIds.includes(io.id)}
          onChange={(e) => setSelectedIOIds((prev) =>
            e.target.checked ? [...prev, io.id] : prev.filter((x) => x !== io.id))} />
        <span className="text-sm font-medium">{io.io_number}</span>
        <span className="text-sm text-blue-600">{io.vendor_name}</span>
        <span className="text-xs text-gray-400">{io.line_count} รายการ</span>
      </label>
    ))}
  </div>
</div>

{ioLines.length > 0 && (
  <div className="mb-6">
    <p className="text-sm font-medium text-gray-700 mb-2">ใส่ราคาต่อหน่วย</p>
    <div className="space-y-2">
      {ioLines.map((line, i) => (
        <div key={line.product_id} className="flex items-center gap-3 bg-gray-50 rounded-lg p-3">
          <div className="flex-1 text-sm">{line.sku} — {line.name_th}</div>
          <div className="text-sm text-gray-500">รับ {line.qty_received} {line.uom_code}</div>
          <Input type="number" min="0" step="0.01" placeholder="ราคา/หน่วย"
            value={line.unit_price || ''}
            onChange={(e) => {
              const updated = [...ioLines];
              updated[i] = { ...updated[i], unit_price: parseFloat(e.target.value) || 0 };
              setIoLines(updated);
            }}
            className="w-28" />
          <span className="text-xs text-gray-500">บาท</span>
        </div>
      ))}
    </div>
  </div>
)}
```

Include in submit payload when IOs selected:
```typescript
if (selectedIOIds.length > 0) {
  payload.io_ids = selectedIOIds;
  payload.vendor_id = confirmedIOs.find((io) => selectedIOIds.includes(io.id))?.vendor_id ?? vendorId;
  payload.lines = ioLines.map((l) => ({
    product_id: l.product_id,
    qty_ordered: l.qty_received,
    unit_price: l.unit_price,
  }));
}
```

- [ ] Done
- [ ] Visual check: Verified IOs appear in list, select 2 → lines merge → enter prices → submit → IO status = `converted_to_po`
- [ ] Commit: `feat(ui): PO create — IO multi-select + unit price entry`

---

## Acceptance Criteria

- [ ] Migration 038 runs without error
- [ ] IO created with `order_date` — visible in list
- [ ] IO edit (update_header, update_lines) returns 409 when IO not `open`
- [ ] GRN from IO stores `received_by_names` and `lift_fee_rounds` — W2 only sends lift fee
- [ ] GRN confirm: IO status → `verified`, partial delivery auto-creates new IO with remaining qty
- [ ] GRN reject (manager): GRN → `rejected`, IO → `receiving`, reason stored
- [ ] GRN resubmit (staff): `rejected` → `received`, IO → `pending_verification`
- [ ] IO list shows row cards with correct status labels in Thai
- [ ] IO detail shows supervisor confirm/reject panel when GRN status = `received`
- [ ] GRN receive form: date toggle per line, lift fee W2 only, พักบิล button
- [ ] PO create: IO multi-select, prices entered, io_po_links created

## QA Checklist (Billy)

- [ ] `npx tsc --noEmit` → 0 errors
- [ ] `npm run lint` → 0 warnings
- [ ] `npm run build` → no build errors
- [ ] Grep `pool.connect()` in reject/resubmit routes → found (transactions wrapped)
- [ ] Grep `GENERATED ALWAYS AS` in migration → found for `lift_fee_amount`
- [ ] Grep `io_po_links` → exists in migration + PO route
- [ ] IO list page: no `<Table>` component remaining (replaced by cards)
- [ ] GRN receive form: `isW2Warehouse` state exists, `liftFeeEnabled` controls section visibility
- [ ] Confirm route: `parent_io_id` used in new IO INSERT (partial split)

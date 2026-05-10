# Track: Inbound Order Workflow (LINE-Based Purchasing)

**Goal:** Build a parallel receiving path alongside the formal PR→PO chain. Vendors are ordered via LINE; staff manually enter an "Inbound Order" (task card), the goods arrive and are received via GR, a supervisor verifies the receipt against the delivery bill, and the vendor's reference number is recorded last.

---

## Workflow Comparison

```
FORMAL FLOW (existing, unchanged):
  PR (draft→approved) → PO (sent) → GRN → QC → Stocked

NEW LINE-BASED FLOW:
  LINE Order → Staff creates Inbound Order (IO) →
  IO appears in GR Receiving Queue →
  Staff records receipt via GRN →
  GRN: draft → received →
  Supervisor verifies GRN vs delivery bill →
  GRN: received → verified → stocked →
  Staff records vendor reference on IO →
  IO: closed
```

---

## Gap Analysis (Current Schema)

| Item | Current State | Required Change |
|---|---|---|
| `goods_receipt_notes.po_id` | `NOT NULL` | Make **nullable** (IO-based GRNs have no PO) |
| `grn_line_items.po_line_item_id` | `NOT NULL` | Make **nullable** (IO lines don't reference PO lines) |
| `grn_status` enum | No `verified` value | Add `'verified'` after `'received'` |
| Inbound Order document | Does not exist | New table `inbound_orders` + `inbound_order_lines` |
| Supervisor verification step | Only QC exists | New `POST /api/grn/:id/verify` action |

---

## Task 1 — Database Migration: Inbound Orders

**File:** `migrations/014_inbound_orders.sql`

Run all statements in order. No transaction wrapper needed — enum `ADD VALUE` cannot run inside a transaction in PostgreSQL.

```sql
-- 1. New enum for IO status
DO $$ BEGIN
  CREATE TYPE inbound_order_status AS ENUM (
    'open',                  -- task card created, awaiting delivery
    'receiving',             -- at least one GRN created
    'pending_verification',  -- GRN marked received, awaiting supervisor sign-off
    'verified',              -- supervisor confirmed receipt matches delivery bill
    'closed'                 -- vendor reference recorded; complete
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. Sequence for IO document numbers (IO-YYYYMMDD-0001)
CREATE SEQUENCE IF NOT EXISTS seq_io START 1;

-- 3. Inbound orders table (the "task card")
CREATE TABLE IF NOT EXISTS inbound_orders (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  io_number           VARCHAR(50) NOT NULL UNIQUE DEFAULT next_doc_number('IO', 'seq_io'),
  vendor_id           UUID NOT NULL REFERENCES vendors(id),
  warehouse_id        UUID NOT NULL REFERENCES warehouses(id),
  status              inbound_order_status NOT NULL DEFAULT 'open',
  notes               TEXT,         -- e.g. screenshots/context from LINE
  vendor_ref          VARCHAR(100), -- vendor's delivery bill / PO ref (recorded last)
  verified_by         UUID REFERENCES users(id),
  verified_at         TIMESTAMPTZ,
  verification_notes  TEXT,
  created_by          UUID NOT NULL REFERENCES users(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_io_vendor    ON inbound_orders(vendor_id);
CREATE INDEX IF NOT EXISTS idx_io_warehouse ON inbound_orders(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_io_status    ON inbound_orders(status);

-- 4. Inbound order line items
CREATE TABLE IF NOT EXISTS inbound_order_lines (
  id           UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  io_id        UUID          NOT NULL REFERENCES inbound_orders(id) ON DELETE CASCADE,
  product_id   UUID          NOT NULL REFERENCES products(id),
  qty_ordered  NUMERIC(15,4) NOT NULL CHECK (qty_ordered > 0),
  qty_received NUMERIC(15,4) NOT NULL DEFAULT 0,
  unit_cost    NUMERIC(15,2) NOT NULL DEFAULT 0,
  notes        TEXT,
  line_number  INTEGER       NOT NULL,
  UNIQUE(io_id, line_number)
);

CREATE INDEX IF NOT EXISTS idx_io_lines_io      ON inbound_order_lines(io_id);
CREATE INDEX IF NOT EXISTS idx_io_lines_product ON inbound_order_lines(product_id);

-- 5. updated_at trigger for inbound_orders
CREATE OR REPLACE TRIGGER trg_io_updated_at
  BEFORE UPDATE ON inbound_orders
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 6. Alter GRN: make po_id nullable; add inbound_order_id; add verification fields
ALTER TABLE goods_receipt_notes
  ALTER COLUMN po_id DROP NOT NULL;

ALTER TABLE goods_receipt_notes
  ADD COLUMN IF NOT EXISTS inbound_order_id  UUID REFERENCES inbound_orders(id),
  ADD COLUMN IF NOT EXISTS verified_by       UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS verified_at       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS verification_notes TEXT;

-- Exactly one of po_id or inbound_order_id must be set
ALTER TABLE goods_receipt_notes
  ADD CONSTRAINT chk_grn_source CHECK (
    (po_id IS NOT NULL AND inbound_order_id IS NULL) OR
    (po_id IS NULL AND inbound_order_id IS NOT NULL)
  );

-- 7. Alter GRN lines: make po_line_item_id nullable; add IO line FK
ALTER TABLE grn_line_items
  ALTER COLUMN po_line_item_id DROP NOT NULL;

ALTER TABLE grn_line_items
  ADD COLUMN IF NOT EXISTS inbound_order_line_id UUID REFERENCES inbound_order_lines(id);

-- Exactly one source per GRN line
ALTER TABLE grn_line_items
  ADD CONSTRAINT chk_grn_line_source CHECK (
    (po_line_item_id IS NOT NULL AND inbound_order_line_id IS NULL) OR
    (po_line_item_id IS NULL AND inbound_order_line_id IS NOT NULL)
  );

-- 8. Add 'verified' to grn_status enum (must run OUTSIDE a transaction)
ALTER TYPE grn_status ADD VALUE IF NOT EXISTS 'verified' AFTER 'received';
```

> **IMPORTANT for the migration runner:** Step 8 (`ALTER TYPE … ADD VALUE`) cannot run inside a transaction block. If the migration runner wraps each file in `BEGIN/COMMIT`, split step 8 into a separate migration file (`migrations/014b_grn_status_verified.sql`) and run it outside a transaction. Alternatively, use `DO $$ BEGIN … EXCEPTION … END $$` guard pattern.

- [x] Create `migrations/014_inbound_orders.sql` with steps 1–7
- [x] Create `migrations/014b_grn_status_verified.sql` with step 8 (enum add, no transaction)
- [x] Run `npm run migrate`

---

## Task 2 — API: Inbound Orders List + Create

**File:** `app/api/inbound-orders/route.ts`

### GET `/api/inbound-orders`

Query params: `page`, `limit`, `status`, `warehouse_id`
Warehouse-scoped for staff/manager using `buildWarehouseScopeClause`.

```sql
SELECT
  io.id, io.io_number, io.status, io.notes, io.vendor_ref, io.created_at,
  v.name_th AS vendor_name, v.code AS vendor_code,
  w.code AS warehouse_code, w.name_th AS warehouse_name,
  u.name_en AS created_by_name,
  COUNT(iol.id) AS line_count
FROM inbound_orders io
JOIN vendors v ON v.id = io.vendor_id
JOIN warehouses w ON w.id = io.warehouse_id
JOIN users u ON u.id = io.created_by
LEFT JOIN inbound_order_lines iol ON iol.io_id = io.id
[WHERE warehouse_scope AND status filter]
GROUP BY io.id, v.name_th, v.code, w.code, w.name_th, u.name_en
ORDER BY io.created_at DESC
LIMIT $n OFFSET $m
```

### POST `/api/inbound-orders`

Zod schema:
```typescript
const lineSchema = z.object({
  product_id: z.string().uuid(),
  qty_ordered: z.number().positive(),
  unit_cost: z.number().nonnegative().default(0),
  notes: z.string().optional(),
});

const createSchema = z.object({
  vendor_id: z.string().uuid(),
  warehouse_id: z.string().uuid(),
  notes: z.string().optional(),
  lines: z.array(lineSchema).min(1),
});
```

Insert into `inbound_orders` then insert lines with `line_number` from array index.
Returns `{ id, io_number }` with 201.

- [x] Create `app/api/inbound-orders/route.ts` with GET + POST handlers
- [x] Apply warehouse scope on GET
- [x] Apply warehouse access check on POST (staff can only create for their warehouses)

---

## Task 3 — API: Inbound Order Detail + Actions

**File:** `app/api/inbound-orders/[id]/route.ts`

### GET `/api/inbound-orders/:id`

```sql
SELECT io.*, v.name_th AS vendor_name, v.code AS vendor_code,
       w.code AS warehouse_code, w.name_th AS warehouse_name,
       u.name_en AS created_by_name,
       vb.name_en AS verified_by_name
FROM inbound_orders io
JOIN vendors v ON v.id = io.vendor_id
JOIN warehouses w ON w.id = io.warehouse_id
JOIN users u ON u.id = io.created_by
LEFT JOIN users vb ON vb.id = io.verified_by
WHERE io.id = $1
```

Lines:
```sql
SELECT iol.*, p.sku, p.name_th, p.name_en, u.code AS uom_code,
       COALESCE(sb.qty_available, 0) AS qty_available
FROM inbound_order_lines iol
JOIN products p ON p.id = iol.product_id
JOIN units_of_measure u ON u.id = p.uom_id
LEFT JOIN stock_balances sb ON sb.product_id = iol.product_id AND sb.warehouse_id = $2
WHERE iol.io_id = $1
ORDER BY iol.line_number
```

Also fetch linked GRNs:
```sql
SELECT g.id, g.grn_number, g.status, g.received_date, u.name_en AS received_by_name
FROM goods_receipt_notes g
JOIN users u ON u.id = g.received_by
WHERE g.inbound_order_id = $1
ORDER BY g.created_at
```

**File:** `app/api/inbound-orders/[id]/close/route.ts`

### POST `/api/inbound-orders/:id/close`

Records the vendor reference and closes the IO. Requires IO status = `verified`.

```typescript
const schema = z.object({
  vendor_ref: z.string().min(1).max(100),
});
// Only allowed when status = 'verified'
// Updates: vendor_ref, status = 'closed'
```

- [x] Create `app/api/inbound-orders/[id]/route.ts` with GET handler
- [x] Create `app/api/inbound-orders/[id]/close/route.ts` with POST handler
- [x] Enforce role: any role can create IOs; only `manager`/`admin` can close (or same staff — keep it flexible)

---

## Task 4 — Modify GRN Create API: Support IO Source

**File:** `app/api/grn/route.ts`

### Changes to `lineSchema`:
```typescript
const lineSchema = z.object({
  po_line_item_id: z.string().uuid().optional(),         // PO flow
  inbound_order_line_id: z.string().uuid().optional(),   // IO flow
  product_id: z.string().uuid(),
  qty_received: z.number().positive(),
  storage_location: z.string().max(100).optional(),
  lot_number: z.string().max(100).optional(),
  serial_number: z.string().max(100).optional(),
  expiry_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  notes: z.string().optional(),
});
```

### Changes to `createSchema`:
```typescript
const createSchema = z.object({
  po_id: z.string().uuid().optional(),
  inbound_order_id: z.string().uuid().optional(),
  warehouse_id: z.string().uuid(),
  received_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  notes: z.string().optional(),
  lines: z.array(lineSchema).min(1),
}).refine(
  (d) => (d.po_id != null) !== (d.inbound_order_id != null),
  { message: 'Provide exactly one of po_id or inbound_order_id' }
);
```

### Logic changes in POST handler:

**IO-based path** (when `inbound_order_id` is set):
1. Fetch IO, verify status is `open` or `receiving`
2. Fetch `inbound_order_lines` for over-receipt check (line `qty_ordered - qty_received`)
3. Skip the PO status/warehouse check (IO has its own warehouse)
4. INSERT into `grn_line_items` using `inbound_order_line_id` (not `po_line_item_id`)
5. After INSERT, update IO status to `'receiving'`

**INSERT into grn_line_items** now has one more column:
```sql
INSERT INTO grn_line_items
  (grn_id, po_line_item_id, inbound_order_line_id, product_id,
   qty_received, storage_location, lot_number, serial_number, expiry_date, line_number)
VALUES ...
```

- [x] Update `lineSchema` and `createSchema` with IO fields
- [x] Add IO validation branch in POST handler
- [x] Update INSERT to include `inbound_order_line_id` column
- [x] After creating GRN from IO, UPDATE `inbound_orders SET status = 'receiving'` if currently `open`

---

## Task 5 — New API: Supervisor Verification

**File:** `app/api/grn/[id]/verify/route.ts`

Role: `manager` or `admin` only.

```typescript
const schema = z.object({
  verification_notes: z.string().optional(),
});

// POST /api/grn/:id/verify
// 1. Assert role manager/admin
// 2. Check GRN status = 'received'
// 3. Check GRN is IO-based (inbound_order_id IS NOT NULL)
//    - PO-based GRNs use the QC flow, not this endpoint
// 4. UPDATE goods_receipt_notes SET status = 'verified', verified_by = $userId, verified_at = NOW(), verification_notes = $notes
// 5. UPDATE inbound_orders SET status = 'verified' WHERE id = GRN.inbound_order_id
// 6. Return { id, status: 'verified' }
```

- [x] Create `app/api/grn/[id]/verify/route.ts`
- [x] Enforce `manager`/`admin` role
- [x] Transition both GRN and IO to `verified`

---

## Task 6 — Modify GRN Receive API: Update IO Status

**File:** `app/api/grn/[id]/receive/route.ts`

After setting GRN to `received`, if it is IO-linked, update IO status to `pending_verification`.

```typescript
// After: UPDATE goods_receipt_notes SET status = 'received'
// Add:
const grnFull = await queryOne<{ inbound_order_id: string | null }>(
  'SELECT inbound_order_id FROM goods_receipt_notes WHERE id = $1', [id]
);
if (grnFull?.inbound_order_id) {
  await queryOne(
    "UPDATE inbound_orders SET status = 'pending_verification' WHERE id = $1 AND status = 'receiving'",
    [grnFull.inbound_order_id]
  );
}
```

- [x] Read and update `app/api/grn/[id]/receive/route.ts`

---

## Task 7 — Modify GRN Stock API: Accept `verified` Status + IO Logic

**File:** `app/api/grn/[id]/stock/route.ts`

Two changes:

**1. Accept `verified` status** (in addition to `qc_passed`):
```typescript
// BEFORE:
if (grn.rows[0].status !== 'qc_passed') { ... error ... }

// AFTER:
if (!['qc_passed', 'verified'].includes(grn.rows[0].status)) {
  return apiError('GRN must be qc_passed or verified before stocking', 409);
}
```

**2. IO-based GRN post-stock logic** — instead of updating `po_line_items.qty_received` and PO status:
```typescript
if (grn.rows[0].inbound_order_id) {
  // Update IO line qty_received
  for (const line of lines.rows) {
    await client.query(
      'UPDATE inbound_order_lines SET qty_received = qty_received + $1 WHERE id = $2',
      [line.qty_accepted, line.inbound_order_line_id]
    );
  }
  // IO status stays 'verified' — user records vendor_ref separately to close it
} else {
  // Existing PO flow: update po_line_items + PO status (unchanged)
}
```

- [x] Update status guard to accept `verified`
- [x] Add IO branch for post-stock updates
- [x] Preserve existing PO branch unchanged

---

## Task 8 — Modify Receiving Queue API: Include IOs

**File:** `app/api/grn/receiving-queue/route.ts` (created in previous track)

Add a second query returning IOs with status `open` or `receiving`. Return both PO-pending and IO-pending in a unified response.

```typescript
// Response shape:
{
  pending_pos: [...],  // POs with sent/partially_received status
  inbound_orders: [...] // IOs with open/receiving status
}
```

IO query:
```sql
SELECT io.id, io.io_number, io.status, io.created_at,
       v.name_th AS vendor_name, v.code AS vendor_code,
       w.id AS warehouse_id, w.code AS warehouse_code, w.name_th AS warehouse_name,
       COUNT(iol.id) AS total_lines,
       SUM(iol.qty_ordered - iol.qty_received) AS total_qty_remaining
FROM inbound_orders io
JOIN vendors v ON v.id = io.vendor_id
JOIN warehouses w ON w.id = io.warehouse_id
JOIN inbound_order_lines iol ON iol.io_id = io.id
WHERE io.status IN ('open', 'receiving')
  [+ warehouse scope]
GROUP BY io.id, v.name_th, v.code, w.id, w.code, w.name_th
ORDER BY io.created_at DESC
LIMIT 50
```

- [x] Update `app/api/grn/receiving-queue/route.ts` to return both `pending_pos` and `inbound_orders`

---

## Task 9 — New Pages: Inbound Orders

### 9a. List page: `app/app/inbound-orders/page.tsx`

Pattern identical to other list pages. Columns:
- เลข IO (font-mono)
- Vendor
- คลังสินค้า (hidden sm:table-cell)
- รายการ / Lines (hidden sm:table-cell)
- สถานะ (StatusBadge)
- Action: "ดู" link

Filter: status dropdown + warehouse select.

### 9b. New IO page: `app/app/inbound-orders/new/page.tsx`

Form fields:
```
┌──────────────────────────────────────────┐
│ สร้างใบรับสินค้า (IO) / New Inbound Order │
├──────────────────────────────────────────┤
│ Vendor *         │ Warehouse *           │
│ [dropdown]       │ [dropdown]            │
├──────────────────────────────────────────┤
│ หมายเหตุ / Notes (context from LINE)     │
│ [textarea]                               │
├──────────────────────────────────────────┤
│ รายการสินค้า / Items                     │
│ [Product dropdown] [Qty] [Unit Cost] [+] │
│ ...                                      │
│                          [สร้าง IO]      │
└──────────────────────────────────────────┘
```

- Fetch vendors from `GET /api/vendors?limit=200`
- Fetch warehouses from `GET /api/admin/warehouses`
- Fetch products for the item dropdown from `GET /api/products?limit=500`
- Dynamic add/remove lines
- POST to `POST /api/inbound-orders`
- On success, redirect to `/app/inbound-orders/:id`

### 9c. IO Detail page: `app/app/inbound-orders/[id]/page.tsx`

Layout:
```
IO-20260510-0001                    [StatusBadge]
──────────────────────────────────────────────────
Vendor: ABC Supply   Warehouse: WH-01
Created by: Staff A  Date: 10/05/2026
Notes: "...LINE context..."

รายการสินค้า / Items
┌─────────┬────────────────┬──────────┬──────────┬─────────────┐
│ SKU     │ สินค้า         │ สั่ง    │ รับแล้ว  │ สต็อกปัจจุบัน│
└─────────┴────────────────┴──────────┴──────────┴─────────────┘

GRN ที่เชื่อมโยง / Linked GRNs
┌──────────────┬──────────┬───────────┐
│ GRN Number   │ Status   │ Link      │
└──────────────┴──────────┴───────────┘

[Actions]
• status = 'open'/'receiving'/'pending_verification':
    → [สร้าง GRN / Create GRN] button → /app/grn/new?io_id={id}
• status = 'verified':
    → [บันทึกเลขอ้างอิง Vendor / Record Vendor Ref] form
      input: vendor_ref (required)
      → POST /api/inbound-orders/:id/close
• status = 'closed':
    → Show vendor_ref, verified_by, verified_at
```

- [x] Create `app/app/inbound-orders/page.tsx`
- [x] Create `app/app/inbound-orders/new/page.tsx`
- [x] Create `app/app/inbound-orders/[id]/page.tsx`

---

## Task 10 — Modify GRN New Page: Support IO Mode

**File:** `app/app/grn/new/page.tsx`

Detect `?io_id=` vs `?po_id=` URL param. Two modes:

**IO mode** (`io_id` in URL):
- Skip PO dropdown entirely
- Load IO detail via `GET /api/inbound-orders/:io_id`
- Pre-fill `warehouse_id` from IO
- Show read-only IO info header: IO number, vendor name
- Build `lines` from `io.lines` (using `inbound_order_line_id`, `product_id`, `qty_ordered - qty_received`)
- POST body: `{ inbound_order_id, warehouse_id, received_date, lines: [...] }`
  - Each line: `{ inbound_order_line_id, product_id, qty_received, storage_location, lot_number, expiry_date }`

**PO mode** (existing, unchanged):
- As-is: PO dropdown, line from PO

The form should auto-detect which mode based on `searchParams.get('io_id')`.

```tsx
const ioId = searchParams.get('io_id');
const poId = searchParams.get('po_id');
const mode = ioId ? 'io' : 'po';
```

- [x] Read `app/app/grn/new/page.tsx` and add IO mode detection
- [x] Add IO header info section (shown only in IO mode)
- [x] Load IO lines when in IO mode
- [x] POST correct body depending on mode

---

## Task 11 — Modify GRN Detail Page: Supervisor Verify + IO Info

**File:** `app/app/grn/[id]/page.tsx`

**Two additions:**

### 11a. Show IO info if IO-linked

Add to `GRNDetail` interface:
```typescript
inbound_order_id: string | null;
io_number: string | null;
```

If `grn.inbound_order_id`, show an info card:
```
ใบรับสินค้า (IO): IO-20260510-0001  [ดู IO →]
```

Fetch from API: include `io_number` in the GRN detail query (LEFT JOIN `inbound_orders`).

### 11b. Supervisor verification action

For IO-linked GRNs in `received` status, show a "ตรวจสอบ / Verify" button (manager/admin only).

Replace the existing "เริ่ม QC" button logic:
```tsx
{grn.status === 'received' && grn.inbound_order_id && (
  <Button onClick={() => setShowVerify(true)}>✓ ตรวจสอบ / Verify Receipt</Button>
)}
{grn.status === 'received' && !grn.inbound_order_id && (
  <Button onClick={() => setShowQC(true)}>เริ่ม QC</Button>  // unchanged
)}
{grn.status === 'verified' && (
  <Button onClick={() => action('stock')} loading={acting}>นำเข้าคลัง</Button>
)}
```

Verify form (modal or inline):
```
ตรวจสอบการรับสินค้า — กรุณายืนยันว่าของที่ได้รับตรงกับใบส่งของ
[หมายเหตุ supervisor (ไม่บังคับ)]
[ยกเลิก] [ยืนยัน]
```
→ POST `/api/grn/:id/verify` with `{ verification_notes }`

### 11c. Update GRN detail API to include IO info

In `app/api/grn/[id]/route.ts`, add LEFT JOIN:
```sql
LEFT JOIN inbound_orders io ON io.id = g.inbound_order_id
-- Add to SELECT:
io.io_number
```

- [x] Update `app/api/grn/[id]/route.ts` SELECT to include `io.io_number`
- [x] Add `inbound_order_id` and `io_number` to `GRNDetail` interface in the page
- [x] Add IO info card when IO-linked
- [x] Add verify button/form for IO-linked GRNs in `received` status
- [x] Add "นำเข้าคลัง" button for `verified` status (parallel to existing `qc_passed` button)

---

## Task 12 — Modify Receiving Queue Page: Show IOs

**File:** `app/app/grn/receiving-queue/page.tsx`

The API now returns `{ pending_pos, inbound_orders }`. Update the page to show both sections:

```
┌─────────────────────────────────────┐
│ รายการรอรับสินค้า / Pending Deliveries│
├─────────────────────────────────────┤
│ 📋 Inbound Orders (LINE-Based)      │
│ [IO table: IO#, Vendor, Warehouse,  │
│  Status, Lines, Receive button]      │
├─────────────────────────────────────┤
│ 📦 Purchase Orders (Formal)         │
│ [PO table: PO#, Vendor, Warehouse,  │
│  Status, Receive button]             │
└─────────────────────────────────────┘
```

IO rows link to `/app/grn/new?io_id={io.id}`.
PO rows link to `/app/grn/new?po_id={po.id}`.

- [x] Update page to destructure `{ pending_pos, inbound_orders }` from API
- [x] Render two sections with distinct headers
- [x] IO rows link to `?io_id=` GRN form

---

## Task 13 — Sidebar + Types + StatusBadge

### `types/index.ts`

Add:
```typescript
export type InboundOrderStatus =
  'open' | 'receiving' | 'pending_verification' | 'verified' | 'closed';

// Extend GrnStatus to include 'verified':
export type GrnStatus =
  'draft' | 'received' | 'verified' | 'qc_pending' | 'qc_passed' | 'qc_failed' | 'stocked';

export interface InboundOrder {
  id: string;
  io_number: string;
  vendor_id: string;
  vendor_name: string;
  vendor_code: string;
  warehouse_id: string;
  warehouse_code: string;
  warehouse_name: string;
  status: InboundOrderStatus;
  notes: string | null;
  vendor_ref: string | null;
  verified_by: string | null;
  verified_by_name: string | null;
  verified_at: string | null;
  verification_notes: string | null;
  created_by: string;
  created_by_name: string;
  created_at: string;
  updated_at: string;
}
```

### `components/layout/Sidebar.tsx`

Add nav item between Purchase Orders and Goods Receive:
```typescript
{ href: '/app/inbound-orders', label: 'Inbound Orders', icon: '📩' },
```

### `components/ui/StatusBadge.tsx`

Read the existing StatusBadge to find the color map. Add IO status values:
```
open              → blue / 'รอรับสินค้า'
receiving         → yellow / 'กำลังรับ'
pending_verification → orange / 'รอตรวจสอบ'
verified          → green / 'ตรวจสอบแล้ว'
closed            → gray / 'ปิดแล้ว'
verified (GRN)    → teal/green / 'ตรวจสอบแล้ว'
```

- [x] Update `types/index.ts`
- [x] Add Inbound Orders nav item to `components/layout/Sidebar.tsx`
- [x] Update `components/ui/StatusBadge.tsx` with IO + GRN `verified` colors

---

## Verification Checklist

- [ ] Migration runs cleanly: `npm run migrate`
- [ ] `npm run build` passes — no TypeScript errors
- [ ] Create IO: staff can select vendor, warehouse, items → IO created with `open` status
- [ ] IO appears in Receiving Queue
- [ ] Click "รับสินค้า" on IO → GRN new form loads with IO lines, current stock visible
- [ ] GRN created from IO → IO status changes to `receiving`; `po_line_item_id` is null on GRN lines
- [ ] Confirm receipt → GRN status `received`; IO status `pending_verification`
- [ ] Supervisor (manager/admin) clicks "ตรวจสอบ" → GRN `verified`; IO `verified`
- [ ] "นำเข้าคลัง" on `verified` GRN → stock ledger updated; GRN `stocked`
- [ ] On IO detail page, "บันทึกเลขอ้างอิง" → enter vendor ref → IO `closed`
- [ ] Existing PO-based GRN flow is unaffected (PO mode in GRN new form still works)
- [ ] QC flow on PO-based GRNs is unaffected
- [ ] Staff warehouse scope enforced on IO list and creation

---
track: po-immediate-approval
status: Verified
owner: puka, paku
module: WMS
updated: 2026-05-18
aliases: ["PO Immediate Approval — Discount Fields + Financial Summary + Auto-GRN"]
---

# Track: PO Immediate Approval — Discount Fields + Financial Summary + Auto-GRN

## Objective

Overhaul the PO module to support:
1. Immediate approval (create PO → instantly stock goods without a separate GRN step)
2. Per-line and bill-level discount columns
3. Two-tab PO form redesign with right-panel financial summary

Real shop workflow this replaces: vendor delivers → delivery note arrives → authorized person creates PO and stocks it directly.

## Pre-verified Schema Facts (Gemini must NOT re-derive)

- `line_total` in `po_line_items` is `GENERATED ALWAYS AS (qty_ordered * unit_price) STORED` — never INSERT/UPDATE it directly.
- `grn_status` enum already includes `'stocked'` — no enum migration needed.
- `chk_grn_source` constraint on `goods_receipt_notes` requires exactly one of `po_id` or `inbound_order_id` to be non-null. Approve API **MUST** pass `po_id` to GRN INSERT.
- `stock_ledger` columns: `id, product_id, warehouse_id, direction, qty, unit_cost, reference_type, reference_id, notes, created_by, created_at`. No `reference_number` column.
- `grn_line_items` columns: `id, grn_id, po_line_item_id, product_id, qty_received, unit_cost, line_total(GENERATED)`.
- Existing `PurchaseOrder` and `POLineItem` types exist in `types/index.ts` — extend with optional fields, do not replace.
- UI components available in `components/ui/index.ts`: `Dialog, Button, Badge, Input, Select, Textarea, Table, Tabs` — use these.
- Latest migration: `033_grn_extra_line_constraint_fix.sql`. New migration must be `034_po_discount_fields.sql`.

## Amount Calculation Formula (authoritative — use in both frontend and backend)

```
subtotal            = sum(qty_ordered * unit_price)       -- gross, before discounts
total_line_discount = sum(line_discount per line)
after_line_discount = subtotal - total_line_discount
pre_vat_amount      = after_line_discount - bill_discount - non_vat_amount
vat_amount          = pre_vat_amount * VAT_RATE           -- import VAT_RATE from lib/constants.ts
total_amount        = pre_vat_amount + vat_amount + non_vat_amount
```

Never hardcode `0.07`. Import `VAT_RATE` from `lib/constants.ts`.

---

## Task 1 — Migration: 034_po_discount_fields.sql
**Owner:** paku
**File:** `migrations/034_po_discount_fields.sql`

### SQL

```sql
-- po_line_items: per-line discount
ALTER TABLE po_line_items
  ADD COLUMN IF NOT EXISTS line_discount NUMERIC(15,2) NOT NULL DEFAULT 0;

-- purchase_orders: financial fields
ALTER TABLE purchase_orders
  ADD COLUMN IF NOT EXISTS bill_discount    NUMERIC(15,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS non_vat_amount   NUMERIC(15,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pre_vat_amount   NUMERIC(15,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS include_vat      BOOLEAN       NOT NULL DEFAULT FALSE,
  -- detail tab fields
  ADD COLUMN IF NOT EXISTS doc_date         DATE,
  ADD COLUMN IF NOT EXISTS expiry_date      DATE,
  ADD COLUMN IF NOT EXISTS delivery_date    DATE,
  ADD COLUMN IF NOT EXISTS from_address     TEXT,
  ADD COLUMN IF NOT EXISTS to_address       TEXT,
  ADD COLUMN IF NOT EXISTS reference        TEXT,
  -- approval tracking
  ADD COLUMN IF NOT EXISTS approved_by      UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS approved_at      TIMESTAMPTZ;
```

**Acceptance criteria:**
- [x] `npm run migrate` completes without error
- [x] `po_line_items` has `line_discount` with `DEFAULT 0`
- [x] `purchase_orders` has all 12 new columns
- [x] Existing PO rows unaffected (defaults apply)

---

## Task 2 — Backend: POST /api/purchase-orders/[id]/approve
**Owner:** paku
**File:** `app/api/purchase-orders/[id]/approve/route.ts`

### Implementation

```typescript
import { auth } from '@/auth';
import { apiSuccess, apiError } from '@/lib/api-response';
import { assertRole } from '@/lib/authz';
import { pool } from '@/lib/db/client';
import type { SessionUser } from '@/types';

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;
  try { assertRole(u, ['manager', 'admin']); } catch { return apiError('Forbidden', 403); }

  const { id } = await params;
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Fetch PO
    const poRes = await client.query(
      `SELECT id, warehouse_id, status FROM purchase_orders WHERE id = $1`,
      [id]
    );
    if (!poRes.rows[0]) { await client.query('ROLLBACK'); return apiError('PO not found', 404); }
    const po = poRes.rows[0];
    if (po.status !== 'draft') { await client.query('ROLLBACK'); return apiError('Only draft POs can be approved', 409); }

    // 2. Fetch lines
    const linesRes = await client.query(
      `SELECT id, product_id, qty_ordered, unit_price FROM po_line_items WHERE po_id = $1 ORDER BY line_number`,
      [id]
    );
    const lines = linesRes.rows;
    if (!lines.length) { await client.query('ROLLBACK'); return apiError('PO has no line items', 400); }

    // 3. Generate GRN number
    const grnNumRes = await client.query(`SELECT next_doc_number('GRN', 'seq_grn') AS grn_number`);
    const grnNumber: string = grnNumRes.rows[0].grn_number;

    // 4. Create GRN header — po_id satisfies chk_grn_source constraint
    const grnRes = await client.query(
      `INSERT INTO goods_receipt_notes (grn_number, po_id, warehouse_id, status, received_date, created_by)
       VALUES ($1, $2, $3, 'stocked', NOW(), $4) RETURNING id`,
      [grnNumber, id, po.warehouse_id, u.id]
    );
    const grnId: string = grnRes.rows[0].id;

    // 5. Create GRN lines + stock ledger entries
    for (const line of lines) {
      await client.query(
        `INSERT INTO grn_line_items (grn_id, po_line_item_id, product_id, qty_received, unit_cost)
         VALUES ($1, $2, $3, $4, $5)`,
        [grnId, line.id, line.product_id, line.qty_ordered, line.unit_price]
      );
      await client.query(
        `INSERT INTO stock_ledger (product_id, warehouse_id, direction, qty, unit_cost, reference_type, reference_id, created_by)
         VALUES ($1, $2, 'in', $3, $4, 'grn', $5, $6)`,
        [line.product_id, po.warehouse_id, line.qty_ordered, line.unit_price, grnId, u.id]
      );
    }

    // 6. Update PO lines: qty_received = qty_ordered
    await client.query(`UPDATE po_line_items SET qty_received = qty_ordered WHERE po_id = $1`, [id]);

    // 7. Update PO status
    await client.query(
      `UPDATE purchase_orders SET status = 'fully_received', approved_by = $2, approved_at = NOW() WHERE id = $1`,
      [id, u.id]
    );

    await client.query('COMMIT');
    return apiSuccess({ po_id: id, grn_id: grnId, grn_number: grnNumber });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[po-approve]', err);
    return apiError('Internal server error', 500);
  } finally {
    client.release();
  }
}
```

**Note on DB client:** Read `lib/db/client.ts` before writing — check whether the module exports `pool` (pg Pool) or `query`/`queryOne` helpers. If only `query`/`queryOne` are exported (no `pool`), use a transaction helper or restructure using raw client from pool. The transaction MUST be atomic.

**Acceptance criteria:**
- [x] POST with manager/admin on draft PO → `{ po_id, grn_id, grn_number }` returned
- [x] GRN row has `status='stocked'` and `po_id` set
- [x] `stock_ledger` has one row per line with `direction='in'`
- [x] PO status becomes `fully_received`, `approved_by` and `approved_at` set
- [x] Second call on same PO returns 409
- [x] Staff role returns 403
- [x] `client.release()` in finally block

---

## Task 3 — Backend: Update POST + PATCH PO APIs
**Owner:** paku

### 3a. `app/api/purchase-orders/route.ts` — POST

Read the current file first. Then:

1. Extend Zod `lineSchema` with `line_discount: z.number().min(0).default(0)`.
2. Extend `createSchema` with: `bill_discount`, `non_vat_amount`, `include_vat`, `doc_date`, `expiry_date`, `delivery_date`, `from_address`, `to_address`, `reference` (all optional).
3. Replace amount calculation with authoritative formula (see top of plan).
4. Add `line_discount` to `INSERT INTO po_line_items` — never insert `line_total`.
5. Add all new columns to `INSERT INTO purchase_orders`.

### 3b. `app/api/purchase-orders/[id]/route.ts` — PATCH

Read the current file first. Extend Zod schema and update handler to accept all new fields. Recalculate amounts when lines change.

**Acceptance criteria:**
- [x] `line_discount` persisted per line
- [x] `pre_vat_amount`, `bill_discount`, `non_vat_amount` persisted on PO header
- [x] `line_total` never in any INSERT or UPDATE
- [x] `VAT_RATE` imported from `lib/constants.ts`
- [x] All parameters use `$N` placeholders — no string interpolation

---

## Task 4 — Frontend: Redesign `app/app/purchase-orders/new/page.tsx`
**Owner:** puka

### Layout (two-column on md+, stacked on mobile)

```
┌────────────────────────────────┬──────────────────────────────────┐
│ Tab: [สินค้านำเข้า][รายละเอียด] │  Financial Summary Panel (sticky) │
│                                │                                    │
│ Product search input           │  ยอด (ก่อนหัก):      XX,XXX.00   │
│ ─────────────────────────────  │  ส่วนลดรวม:         -X,XXX.00   │
│ Table: lines                   │  ยอด (หักส่วนลด):   XX,XXX.00   │
│ SKU | ชื่อ | ราคาขาย | จำนวน  │  ส่วนลดท้ายบิล: [______]         │
│ ราคา/หน่วย | ส่วนลดรวม | เงิน │  ยอด (ไม่เสียภาษี): [______]     │
│                                │  ยอด (ก่อน VAT):   XX,XXX.00   │
│                                │  ภาษี (7%):         X,XXX.00   │
│                                │  ยอดสุทธิ:          XX,XXX.00   │
│                                │  ☐ ราคารวม VAT                   │
│                                │                                    │
│                                │  [ขอบบิล]  [อนุมัติกัน]          │
└────────────────────────────────┴──────────────────────────────────┘
```

### State interfaces

```typescript
interface LineItem {
  product_id: string;
  sku: string;
  name_th: string;
  selling_price: number;    // read-only, from product master
  qty_ordered: number;
  unit_price: number;
  line_discount: number;    // THB, not %
  // computed: qty_ordered * unit_price - line_discount
}

interface POForm {
  vendor_id: string;
  warehouse_id: string;
  items: LineItem[];
  bill_discount: number;
  non_vat_amount: number;
  include_vat: boolean;
  // detail tab
  doc_date: string;
  expiry_date: string;
  delivery_date: string;
  from_address: string;
  to_address: string;
  reference: string;
  payment_terms_days: number;
  notes: string;
  expected_date: string;
}
```

### Tab 1: สินค้านำเข้า
- Product search: `GET /api/products?search={q}&limit=10` — display dropdown
- On product select: add line with defaults (`unit_price = product.unit_cost`, `line_discount = 0`, `qty_ordered = 1`)
- Table columns: SKU (read-only) | ชื่อสินค้า (read-only) | ราคาขาย (read-only, `formatCurrency`) | จำนวน (input) | ราคา/หน่วย (input) | ส่วนลดรวม (input) | จำนวนเงิน (computed, `formatCurrency`) | [✕]
- All quantity/price inputs: `type="number" min="0" step="any"`

### Tab 2: รายละเอียด
- Fields: `doc_date` (date, default today), `expiry_date` (date), `delivery_date` (date), `from_address` (textarea), `to_address` (textarea), `reference` (text), `payment_terms_days` (number, default 0), `notes` (textarea), `expected_date` (date)

### Buttons

**ขอบบิล (save draft):**
- Validate: vendor_id, warehouse_id, ≥1 line item
- POST `/api/purchase-orders` → navigate to `/app/purchase-orders`

**อนุมัติกัน (immediate approve):**
- Same validation
- Open `ApprovalDialog`
- On dialog confirm:
  1. POST `/api/purchase-orders` → `{ id: po_id }`
  2. POST `/api/purchase-orders/{po_id}/approve` → `{ grn_number }`
  3. Navigate to `/app/purchase-orders` + show success

### ApprovalDialog component
**File:** `components/purchase-orders/ApprovalDialog.tsx`

```typescript
interface ApprovalDialogProps {
  open: boolean;
  onClose: () => void;
  vendorName: string;
  lines: LineItem[];
  summary: {
    subtotal: number;
    totalLineDiscount: number;
    afterLineDiscount: number;
    billDiscount: number;
    nonVatAmount: number;
    preVat: number;
    vat: number;
    netTotal: number;
  };
  onConfirm: () => Promise<void>;
}
```

Dialog body: line items table (name_th, qty_ordered, unit_price, line_discount, line_amount) + financial summary + "ยกเลิก" / "ยืนยัน" buttons.

**Acceptance criteria:**
- [x] Two tabs render correctly
- [x] Financial summary recalculates on every input change (real-time)
- [x] "ขอบบิล" submits and navigates
- [x] "อนุมัติกัน" opens dialog with correct summary → confirm creates PO + approves
- [x] `ApprovalDialog` in `components/purchase-orders/ApprovalDialog.tsx`
- [x] No `any` types
- [x] `npx tsc --noEmit` passes
- [x] `npm run lint` passes

---

## Task 5 — Frontend: Update `app/app/purchase-orders/[id]/page.tsx`
**Owner:** puka

Read the current file before editing.

### Changes

1. **"อนุมัติกัน" button** — visible only when `po.status === 'draft'` AND user role is `manager` or `admin`.
   - Place beside existing action buttons.
   - On click: open `ApprovalDialog` (import from `components/purchase-orders/ApprovalDialog.tsx`).
   - Pass existing `po.lines` as `lines` prop.
   - On confirm: `POST /api/purchase-orders/{po.id}/approve` → refresh page.

2. **Approval info row** — when `po.approved_at` is present, show:
   ```
   อนุมัติโดย: {po.approved_by_name}   อนุมัติเมื่อ: {formatDate(po.approved_at)}
   ```
   Add `approved_by_name` to the GET query in `[id]/route.ts` (JOIN users on approved_by).

3. **Extend `PurchaseOrder` type** in `types/index.ts`:
   ```typescript
   // Add to PurchaseOrder interface (optional, backward-compatible)
   bill_discount?: number;
   non_vat_amount?: number;
   pre_vat_amount?: number;
   include_vat?: boolean;
   doc_date?: string;
   expiry_date?: string;
   delivery_date?: string;
   from_address?: string;
   to_address?: string;
   reference?: string;
   approved_by?: string;
   approved_at?: string;
   approved_by_name?: string;
   // Add to POLineItem interface
   // line_discount?: number;
   ```

4. **Financial breakdown** — extend existing summary panel to show `bill_discount`, `non_vat_amount`, `pre_vat_amount` when non-zero.

**Acceptance criteria:**
- [x] "อนุมัติกัน" visible only for draft + manager/admin
- [x] Approval updates page to `fully_received` + approval info shown
- [x] `approved_at` uses `formatDate()`
- [x] `npx tsc --noEmit` passes

---

## Execution Order

1. Task 1 — run `npm run migrate` immediately after
2. Tasks 2, 3 — parallel (both need Task 1 done)
3. Tasks 4, 5 — parallel (need Tasks 2, 3 done)

After all tasks: run `npm run lint` and `npx tsc --noEmit`. Fix all errors before marking Completed.

---

## QA Checklist

### Migration
- [x] File name exactly `034_po_discount_fields.sql`
- [x] `IF NOT EXISTS` guards on all `ADD COLUMN`
- [x] `line_discount` on `po_line_items` with `DEFAULT 0`
- [x] All 12 columns on `purchase_orders`
- [x] `approved_by` is nullable (no NOT NULL)

### Approve API
- [x] Auth + assertRole present
- [x] Transaction: BEGIN/COMMIT/ROLLBACK in finally
- [x] GRN INSERT includes `po_id`
- [x] Stock ledger uses `reference_type='grn'`, `reference_id=grnId` (no `reference_number`)
- [x] `line_total` never referenced
- [x] 409 on non-draft PO
- [x] 403 for staff role
- [x] `client.release()` in finally

### POST/PATCH APIs
- [x] `line_total` not in any INSERT or UPDATE on `po_line_items`
- [x] `line_discount` stored per line
- [x] `pre_vat_amount`, `bill_discount`, `non_vat_amount` stored on PO
- [x] `VAT_RATE` from `lib/constants.ts`
- [x] All SQL uses `$N` params

### new/page.tsx
- [x] Two tabs render
- [x] Summary recalculates real-time
- [x] ขอบบิล submits draft
- [x] อนุมัติกัน opens dialog → confirm creates + approves
- [x] GRN number shown in success message
- [x] `ApprovalDialog.tsx` extracted to `components/purchase-orders/`
- [x] No `any` types, tsc passes, lint passes

### [id]/page.tsx
- [x] อนุมัติกัน visible only for draft + manager/admin
- [x] Approval info shown using `formatDate()`
- [x] No `any` types, tsc passes

---
## Execution Logs
- [[execution-summary]]



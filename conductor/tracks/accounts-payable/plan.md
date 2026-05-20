---
track: accounts-payable
status: Verified
aliases: ["Accounts Payable (AP) System + Vendor Banking"]
owner: paku, puka
module: Accounting
updated: 2026-05-15
---

# Track: Accounts Payable (AP) System + Vendor Banking

**Status:** Completed  
**Created:** 2026-05-15  
**Goal:** Full AP lifecycle — GRN-triggered invoices, aging report, payment recording with partial allocation.

---

## Schema Context (before this track)

- `vendors` has `payment_terms_days INTEGER DEFAULT 30` — already the credit term field. Missing bank fields.
- `po_invoices` already exists with: `id, po_id, invoice_number, invoice_date, due_date, amount, is_paid, paid_at, paid_by, notes, created_at, updated_at`. Missing: `vendor_id`, `grn_id`, `paid_amount`.
- Two GRN stocking routes: `app/api/grn/[id]/stock/route.ts` and `app/api/grn/[id]/confirm/route.ts`.

---

## Phase 1 — Migration

### Task 1.1 — Create `031_ap_system.sql`

File: `migrations/031_ap_system.sql`

```sql
-- 1. Extend vendors with bank info
ALTER TABLE vendors
  ADD COLUMN IF NOT EXISTS bank_name           VARCHAR(255),
  ADD COLUMN IF NOT EXISTS bank_account_number VARCHAR(100),
  ADD COLUMN IF NOT EXISTS bank_account_name   VARCHAR(255);

-- 2. Extend po_invoices for AP tracking
ALTER TABLE po_invoices
  ADD COLUMN IF NOT EXISTS vendor_id    UUID REFERENCES vendors(id),
  ADD COLUMN IF NOT EXISTS grn_id       UUID REFERENCES goods_receipt_notes(id),
  ADD COLUMN IF NOT EXISTS paid_amount  NUMERIC(15,2) NOT NULL DEFAULT 0;

-- Backfill vendor_id from PO for existing rows
UPDATE po_invoices pi
   SET vendor_id = po.vendor_id
  FROM purchase_orders po
 WHERE po.id = pi.po_id
   AND pi.vendor_id IS NULL;

-- 3. AP Payments table
CREATE SEQUENCE IF NOT EXISTS seq_ap_pmt START 1;

CREATE TABLE IF NOT EXISTS ap_payments (
  id             UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_number VARCHAR(50)   NOT NULL UNIQUE DEFAULT next_doc_number('PMT', 'seq_ap_pmt'),
  vendor_id      UUID          NOT NULL REFERENCES vendors(id),
  payment_date   DATE          NOT NULL DEFAULT CURRENT_DATE,
  total_amount   NUMERIC(15,2) NOT NULL CHECK (total_amount > 0),
  bank_ref       VARCHAR(255),
  notes          TEXT,
  paid_by        UUID          NOT NULL REFERENCES users(id),
  created_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- 4. Payment allocations (maps payment → invoice)
CREATE TABLE IF NOT EXISTS ap_payment_allocations (
  id               UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id       UUID          NOT NULL REFERENCES ap_payments(id) ON DELETE CASCADE,
  invoice_id       UUID          NOT NULL REFERENCES po_invoices(id),
  allocated_amount NUMERIC(15,2) NOT NULL CHECK (allocated_amount > 0),
  created_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  UNIQUE(payment_id, invoice_id)
);

-- 5. Indexes
CREATE INDEX IF NOT EXISTS idx_po_invoices_vendor  ON po_invoices(vendor_id);
CREATE INDEX IF NOT EXISTS idx_po_invoices_grn     ON po_invoices(grn_id);
CREATE INDEX IF NOT EXISTS idx_po_invoices_is_paid ON po_invoices(is_paid) WHERE is_paid = FALSE;
CREATE INDEX IF NOT EXISTS idx_ap_payments_vendor  ON ap_payments(vendor_id);
CREATE INDEX IF NOT EXISTS idx_ap_payments_date    ON ap_payments(payment_date DESC);

-- 6. Trigger: auto-update is_paid when paid_amount >= amount
CREATE OR REPLACE FUNCTION sync_invoice_paid_status()
RETURNS TRIGGER AS $$
BEGIN
  NEW.is_paid := (NEW.paid_amount >= NEW.amount);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_po_invoices_paid_status
  BEFORE INSERT OR UPDATE OF paid_amount, amount ON po_invoices
  FOR EACH ROW EXECUTE FUNCTION sync_invoice_paid_status();

-- 7. updated_at trigger for ap_payments
CREATE OR REPLACE TRIGGER trg_ap_payments_updated_at
  BEFORE UPDATE ON ap_payments
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
```

Acceptance: `npm run migrate` runs without error.

---

## Phase 2 — GRN Integration

### Task 2.1 — Auto-create AP Invoice on stocking (`stock/route.ts`)

File: `app/api/grn/[id]/stock/route.ts`

After the `UPDATE goods_receipt_notes SET status = 'stocked'` query (line ~109), inside the same transaction, add:

```typescript
// Fetch PO vendor + payment terms
const poInfo = await client.query<{ vendor_id: string; payment_terms_days: number; po_number: string }>(
  `SELECT po.vendor_id, po.payment_terms_days, po.po_number
     FROM goods_receipt_notes g
     JOIN purchase_orders po ON po.id = g.po_id
    WHERE g.id = $1`,
  [id]
);
if (poInfo.rows.length > 0) {
  const { vendor_id, payment_terms_days, po_number } = poInfo.rows[0];
  // Calculate invoice amount from accepted lines
  const amtResult = await client.query<{ total: string }>(
    `SELECT COALESCE(SUM(gl.qty_accepted * pl.unit_price), 0) AS total
       FROM grn_line_items gl
       JOIN po_line_items pl ON pl.id = gl.po_line_item_id
      WHERE gl.grn_id = $1 AND gl.qty_accepted > 0`,
    [id]
  );
  const invoiceAmount = parseFloat(amtResult.rows[0].total);
  if (invoiceAmount > 0) {
    // Check if AP invoice already exists for this GRN to prevent duplicates
    const existing = await client.query(
      `SELECT id FROM po_invoices WHERE grn_id = $1`,
      [id]
    );
    if (existing.rows.length === 0) {
      await client.query(
        `INSERT INTO po_invoices
           (po_id, vendor_id, grn_id, invoice_number, invoice_date, due_date, amount, paid_amount)
         VALUES ($1, $2, $3, $4, CURRENT_DATE, CURRENT_DATE + ($5 || ' days')::INTERVAL, $6, 0)`,
        [grn.po_id, vendor_id, id, po_number, payment_terms_days, invoiceAmount]
      );
    }
  }
}
```

Note: `grn.po_id` is already fetched at the top of the handler.

### Task 2.2 — Same logic in `confirm/route.ts`

File: `app/api/grn/[id]/confirm/route.ts`

Apply identical AP invoice insertion logic inside the transaction, before `COMMIT`. The confirm route also sets `status = 'stocked'`, so it must also generate the AP invoice.

Acceptance: Stocking a GRN creates exactly one row in `po_invoices` with correct `vendor_id`, `grn_id`, `amount`, and `due_date = stocked_date + payment_terms_days`.

---

## Phase 3 — API Routes

### Task 3.1 — Vendor bank fields PATCH

File: `app/api/vendors/[id]/route.ts`

Check if this file exists. If not, create it. If it exists, add PATCH handler.

```typescript
// PATCH /api/vendors/[id]
// Body: { bank_name?, bank_account_number?, bank_account_name?, payment_terms_days? }
const patchSchema = z.object({
  bank_name:           z.string().max(255).optional(),
  bank_account_number: z.string().max(100).optional(),
  bank_account_name:   z.string().max(255).optional(),
  payment_terms_days:  z.number().int().min(0).max(365).optional(),
});
```

Build a dynamic SET clause from provided fields. Require `manager` or `admin` role.

### Task 3.2 — AP Invoices list

File: `app/api/ap/invoices/route.ts` (CREATE)

```
GET /api/ap/invoices
  Query params: vendor_id?, is_paid? (true/false), page?, limit?
  Returns: { invoices: [...], total, page, limit }
  
  Each row:
    id, invoice_number, invoice_date, due_date,
    amount, paid_amount, outstanding_amount (amount - paid_amount),
    is_paid, overdue_days (TODAY - due_date if not paid),
    vendor_id, vendor_name_th, vendor_name_en, vendor_code,
    po_id, po_number, grn_id, grn_number,
    created_at
```

Auth: any authenticated user.

### Task 3.3 — AP Invoice detail

File: `app/api/ap/invoices/[id]/route.ts` (CREATE)

```
GET /api/ap/invoices/[id]
  Returns invoice + allocations with payment info
  
PATCH /api/ap/invoices/[id]
  Body: { invoice_number?, notes? }  -- manual correction only
  Require manager+
```

### Task 3.4 — AP Aging Report

File: `app/api/ap/aging/route.ts` (CREATE)

```
GET /api/ap/aging
  Returns aging by vendor:
  [
    {
      vendor_id, vendor_code, vendor_name_th, vendor_name_en,
      total_outstanding,
      current_amount,        -- not yet due
      days_1_30,
      days_31_60,
      days_61_90,
      days_over_90,
      invoice_count,         -- unpaid invoice count
      oldest_due_date
    }
  ]
  
SQL: GROUP BY vendor, use CASE WHEN (CURRENT_DATE - due_date) BETWEEN ...
Only include invoices where is_paid = FALSE.
```

No pagination — aging report is always full list.

### Task 3.5 — AP Payments list

File: `app/api/ap/payments/route.ts` (CREATE)

```
GET /api/ap/payments
  Query: vendor_id?, page?, limit?
  Returns: { payments: [...], total, page, limit }
  
  Each row: id, payment_number, vendor_name_th, payment_date, total_amount, bank_ref, paid_by_name

POST /api/ap/payments
  Body:
  {
    vendor_id: uuid,
    payment_date: "YYYY-MM-DD",
    bank_ref?: string,
    notes?: string,
    allocations: [
      { invoice_id: uuid, allocated_amount: number }
    ]
  }
  
  Validation:
  - Each invoice_id must belong to vendor_id and be unpaid (outstanding_amount > 0)
  - SUM(allocations.allocated_amount) must equal total_amount (computed from sum)
  - allocated_amount per invoice must not exceed outstanding_amount
  
  Transaction:
  1. INSERT ap_payments → get payment_id
  2. For each allocation:
     a. INSERT ap_payment_allocations
     b. UPDATE po_invoices SET paid_amount = paid_amount + allocated_amount WHERE id = invoice_id
        (trigger auto-updates is_paid)
  
  Require manager+ role.
```

### Task 3.6 — AP Payment detail

File: `app/api/ap/payments/[id]/route.ts` (CREATE)

```
GET /api/ap/payments/[id]
  Returns payment + allocations with invoice info
```

---

## Phase 4 — UI Pages

### Task 4.1 — AP Invoices List Page

File: `app/app/ap/page.tsx` (CREATE)

- Title: `เจ้าหนี้การค้า / Accounts Payable`
- Table columns: เลขที่ใบแจ้งหนี้, Vendor, วันที่รับ, วันครบกำหนด, ยอดรวม, ชำระแล้ว, คงเหลือ, สถานะ
- Filter: vendor (search input), status (paid/unpaid/all), date range
- Status badge: `ชำระแล้ว` (green), `ค้างชำระ` (red for overdue), `ยังไม่ครบกำหนด` (yellow)
- Row click → `/app/ap/[id]`
- Pagination

### Task 4.2 — AP Invoice Detail Page

File: `app/app/ap/[id]/page.tsx` (CREATE)

- Show: invoice info, PO link, GRN link, vendor info
- Show payment history (allocations table): payment_number, date, amount
- Show outstanding balance prominently
- No payment action here — link to `/app/ap/payments/new?vendor_id=X`

### Task 4.3 — AP Aging Report Page

File: `app/app/ap/aging/page.tsx` (CREATE)

- Title: `รายงานอายุลูกหนี้เจ้าหนี้ / AP Aging Report`
- Table: Vendor | คงเหลือรวม | ยังไม่ครบกำหนด | 1-30 วัน | 31-60 วัน | 61-90 วัน | >90 วัน | จำนวนใบ
- Summary row at bottom: totals per column
- Export or print: not required in v1
- Color: overdue columns in red/amber gradient

### Task 4.4 — Record Payment Page

File: `app/app/ap/payments/new/page.tsx` (CREATE)

Flow:
1. Select vendor (search dropdown)
2. Load unpaid invoices for that vendor (GET /api/ap/invoices?vendor_id=X&is_paid=false)
3. User checks invoices to pay + enters amount per invoice
4. Enter bank_ref, payment_date, notes
5. Submit → POST /api/ap/payments
6. On success → redirect to `/app/ap/payments/[id]`

Validation client-side: allocated amounts must not exceed outstanding per invoice.

### Task 4.5 — Payments List Page

File: `app/app/ap/payments/page.tsx` (CREATE)

- Title: `รายการชำระเจ้าหนี้ / AP Payments`
- Table: เลขที่ชำระ, Vendor, วันที่, ยอดชำระ, อ้างอิงธนาคาร, ผู้บันทึก
- Click row → `/app/ap/payments/[id]`

### Task 4.6 — Payment Detail Page

File: `app/app/ap/payments/[id]/page.tsx` (CREATE)

- Show payment info
- Show allocations: which invoices were paid and how much

### Task 4.7 — Vendor Bank Fields (Edit Modal)

File: `app/app/vendors/[id]/page.tsx` — add bank fields section to existing vendor detail page OR add edit form if vendor detail page doesn't have one.

Check if `app/app/vendors/[id]/page.tsx` exists. If it does, add bank fields. If not, skip — only the API (Task 3.1) is required.

### Task 4.8 — Sidebar Navigation

File: `components/layout/Sidebar.tsx`

Add AP group under Finance section (or create Finance section if it doesn't exist):

```
เจ้าหนี้การค้า (AP)
  ├── ใบแจ้งหนี้ AP   → /app/ap
  ├── รายงานอายุหนี้  → /app/ap/aging
  └── บันทึกชำระ     → /app/ap/payments
```

---

## Phase 5 — Types

### Task 5.1 — Add types to `types/index.ts`

```typescript
export type ApInvoiceStatus = 'unpaid' | 'overdue' | 'paid';

export interface ApInvoice {
  id: string;
  invoice_number: string;
  invoice_date: string;
  due_date: string;
  amount: number;
  paid_amount: number;
  outstanding_amount: number;
  is_paid: boolean;
  overdue_days: number;
  vendor_id: string;
  vendor_name_th: string;
  vendor_name_en: string;
  vendor_code: string;
  po_id: string;
  po_number: string;
  grn_id: string | null;
  grn_number: string | null;
  created_at: string;
}

export interface ApPayment {
  id: string;
  payment_number: string;
  vendor_id: string;
  vendor_name_th: string;
  payment_date: string;
  total_amount: number;
  bank_ref: string | null;
  notes: string | null;
  paid_by: string;
  paid_by_name: string;
  created_at: string;
}

export interface ApAgingRow {
  vendor_id: string;
  vendor_code: string;
  vendor_name_th: string;
  vendor_name_en: string;
  total_outstanding: number;
  current_amount: number;
  days_1_30: number;
  days_31_60: number;
  days_61_90: number;
  days_over_90: number;
  invoice_count: number;
  oldest_due_date: string | null;
}
```

---

## Checklist

### Phase 1 — Migration
- [x] 1.1 Create `migrations/031_ap_system.sql`

### Phase 2 — GRN Integration
- [x] 2.1 Auto-create AP invoice in `app/api/grn/[id]/stock/route.ts`
- [x] 2.2 Auto-create AP invoice in `app/api/grn/[id]/confirm/route.ts`

### Phase 3 — API
- [x] 3.1 PATCH `app/api/vendors/[id]/route.ts` — bank fields + payment_terms_days
- [x] 3.2 Create `app/api/ap/invoices/route.ts` — GET list
- [x] 3.3 Create `app/api/ap/invoices/[id]/route.ts` — GET detail + PATCH
- [x] 3.4 Create `app/api/ap/aging/route.ts` — GET aging report
- [x] 3.5 Create `app/api/ap/payments/route.ts` — GET list + POST
- [x] 3.6 Create `app/api/ap/payments/[id]/route.ts` — GET detail

### Phase 4 — UI
- [x] 4.1 Create `app/app/ap/page.tsx` — invoices list
- [x] 4.2 Create `app/app/ap/[id]/page.tsx` — invoice detail
- [x] 4.3 Create `app/app/ap/aging/page.tsx` — aging report
- [x] 4.4 Create `app/app/ap/payments/new/page.tsx` — record payment
- [x] 4.5 Create `app/app/ap/payments/page.tsx` — payments list
- [x] 4.6 Create `app/app/ap/payments/[id]/page.tsx` — payment detail
- [x] 4.7 Extend vendor detail page with bank fields (if exists)
- [x] 4.8 Add AP section to `components/layout/Sidebar.tsx`

### Phase 5 — Types
- [x] 5.1 Add `ApInvoice`, `ApPayment`, `ApAgingRow` to `types/index.ts`

---
## Execution Logs
- [[execution-summary]]


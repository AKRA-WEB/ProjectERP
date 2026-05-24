---
track: grn-simplified-workflow
status: Completed
owner: puka, paku
module: WMS
updated: 2026-05-20
---

# GRN Simplified Workflow — ตามแบบ HTML Reference

## Goal

Simplify GRN receiving UX to match the user's HTML reference app. Replace the current multi-step mobile stepper with a single scrollable form. Add ของแถม/bonus items support. Keep 3-button sticky bottom bar.

## What grn-receiving-fix Covers (DO NOT DUPLICATE)

- Changing date inputs to `type="text"` with Thai BE format
- Removing IO over-receiving 422 block

Execute `grn-receiving-fix` before this track. Reference `parseBuddhistDate` / `formatBuddhistDate` from `lib/date-utils.ts` (created by that track).

---

## Confirmed Schema (from migrations)

**`goods_receipt_notes`:**
- id, grn_number, po_id, inbound_order_id, warehouse_id, vendor_id
- status (enum: draft, received, qc_passed, qc_failed, stocked, verified, rejected)
- received_by UUID, received_date DATE
- notes TEXT
- receiver_name VARCHAR(255) — migration 027
- split_from_grn_id UUID — migration 027
- source_type grn_source_type — migration 035
- received_by_names TEXT — migration 038 ✓ (staff names, comma-separated)
- lift_fee_rounds INTEGER DEFAULT 0 — migration 038 ✓
- lift_fee_amount NUMERIC GENERATED ALWAYS AS (lift_fee_rounds * 50.00) STORED — auto-calc
- rejected_by, rejected_at, rejection_notes — migration 038

**`grn_line_items`:**
- id, grn_id, po_line_item_id, inbound_order_line_id, product_id
- qty_received, qty_accepted, qty_rejected, qty_expected
- lot_number, serial_number
- expiry_date DATE, mfg_date DATE, date_type ('expiry'|'mfg')
- storage_location VARCHAR(100) — migration 013 ✓
- unit_cost, line_total (generated)
- source_type, line_number

**`grn_bonus_items`** — DOES NOT EXIST yet. Must create via migration 039.

**lift_fee_payment_method** — DOES NOT EXIST in DB. Add to migration 039.

---

## Feature Gap Analysis

| HTML Reference Feature | DB Support | API Writes It | Notes |
|---|---|---|---|
| ATA date (วันที่มาส่ง) | `received_date` ✓ | ✓ already | already in POST |
| ชื่อผู้รับสินค้า | `received_by_names` ✓ | ✓ already | already in POST |
| Lift fee rounds | `lift_fee_rounds` ✓ | ✓ already | already in POST |
| Lift fee payment (จ่ายสด/เชื่อ) | MISSING | ✗ | need migration 039 |
| หมายเหตุ | `notes` ✓ | ✓ already | already in POST |
| EXP date (text, BE) | `expiry_date` ✓ | ✓ already | **fix in grn-receiving-fix** |
| Loc.IN per line | `storage_location` ✓ | ✓ already | already in POST lines |
| สต็อคเก่า display | `stock_balances` ✓ | GET doesn't join | extend GET /api/grn/[id] |
| ของแถม items | MISSING | ✗ | need migration 039 + API |
| Single scroll form (no stepper) | — | — | UI rewrite only |
| 3 sticky buttons | — | — | UI rewrite only |

---

## Tasks

### Task 1 — Migration 039: grn_bonus_items + lift_fee_payment_method
**Assignee:** paku
**File:** `migrations/039_grn_bonus_items.sql`

```sql
BEGIN;

-- Bonus/extra items (ของแถม/สินค้านอกบิล)
CREATE TABLE IF NOT EXISTS grn_bonus_items (
  id           UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  grn_id       UUID          NOT NULL REFERENCES goods_receipt_notes(id) ON DELETE CASCADE,
  product_id   UUID          REFERENCES products(id),
  product_name VARCHAR(255),      -- free-text fallback when no product_id
  qty          NUMERIC(15,4) NOT NULL CHECK (qty > 0),
  unit         VARCHAR(50),
  expiry_date  DATE,
  notes        TEXT,
  line_number  INTEGER       NOT NULL,
  created_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_grn_bonus_grn ON grn_bonus_items(grn_id);

-- Lift fee payment method
ALTER TABLE goods_receipt_notes
  ADD COLUMN IF NOT EXISTS lift_fee_payment_method VARCHAR(10)
    CHECK (lift_fee_payment_method IN ('cash', 'credit'));

COMMIT;
```

**Why `product_name` fallback:** HTML reference allows typing a product name not in the catalog. Support both: if product selected from search → `product_id` set; if typed manually → `product_name` set, `product_id` null.

#### Verify:
- [x] `grn_bonus_items` table created with correct columns
- [x] `lift_fee_payment_method` column added to `goods_receipt_notes`
- [x] `npm run migrate` runs without error

---

### Task 2 — Extend POST /api/grn to accept bonus_items + lift_fee_payment_method
**Assignee:** paku
**File:** `app/api/grn/route.ts`
**Depends on:** Task 1

Add to Zod `lineSchema` and `createSchema`:

```typescript
// Add to createSchema:
lift_fee_payment_method: z.enum(['cash', 'credit']).optional().nullable(),
bonus_items: z.array(z.object({
  product_id: z.string().uuid().optional(),
  product_name: z.string().max(255).optional(),
  qty: z.number().positive(),
  unit: z.string().max(50).optional(),
  expiry_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  notes: z.string().optional(),
})).optional().default([]),
```

In the INSERT for `goods_receipt_notes`, add `lift_fee_payment_method`:
```typescript
// Add to INSERT columns:
lift_fee_payment_method = $N
```

After GRN header INSERT (inside the same BEGIN/COMMIT), loop bonus_items and INSERT into `grn_bonus_items`:
```typescript
for (let i = 0; i < parsed.data.bonus_items.length; i++) {
  const b = parsed.data.bonus_items[i];
  await client2.query(
    `INSERT INTO grn_bonus_items (grn_id, product_id, product_name, qty, unit, expiry_date, notes, line_number)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [grn.id, b.product_id ?? null, b.product_name ?? null, b.qty, b.unit ?? null, b.expiry_date ?? null, b.notes ?? null, i + 1]
  );
}
```

**Transaction:** already wrapped in BEGIN/COMMIT — add bonus_items INSERT inside existing transaction.

#### Verify:
- [x] Re-read `app/api/grn/route.ts` — `lift_fee_payment_method` in INSERT column list
- [x] Re-read `app/api/grn/route.ts` — bonus_items INSERT loop present inside transaction
- [x] `npx tsc --noEmit` passes

---

### Task 3 — Extend GET /api/grn/[id] to return bonus_items + stock balance
**Assignee:** paku
**File:** `app/api/grn/[id]/route.ts`
**Depends on:** Task 1

Add two queries after the main GRN SELECT:

**1. Fetch bonus_items:**
```sql
SELECT id, product_id, product_name, qty, unit, expiry_date, notes, line_number
FROM grn_bonus_items
WHERE grn_id = $1
ORDER BY line_number
```

**2. Add stock_balance to each GRN line:**
Join `stock_balances` in the existing grn_line_items SELECT:
```sql
LEFT JOIN stock_balances sb ON sb.product_id = gli.product_id AND sb.warehouse_id = g.warehouse_id
```
Select `COALESCE(sb.qty_on_hand, 0) AS stock_on_hand`.

Add `lift_fee_payment_method` to the GRN header SELECT.

**Response shape additions:**
```typescript
lift_fee_payment_method: string | null;
bonus_items: Array<{
  id: string;
  product_id: string | null;
  product_name: string | null;
  qty: number;
  unit: string | null;
  expiry_date: string | null;
  notes: string | null;
  line_number: number;
}>;
// In each line:
stock_on_hand: number;
```

#### Verify:
- [x] Re-read `app/api/grn/[id]/route.ts` — `bonus_items` array in response
- [x] Re-read `app/api/grn/[id]/route.ts` — `stock_on_hand` in each line
- [x] `npx tsc --noEmit` passes

---

### Task 4 — Rewrite app/app/grn/new/page.tsx as single scrollable form
**Assignee:** puka
**File:** `app/app/grn/new/page.tsx`
**Depends on:** Tasks 2, 3; run after grn-receiving-fix

**Complete rewrite.** Remove all stepper state (`activeLine`, `saveLine`, `skipLine`). Single scrollable page for both mobile and desktop.

**Layout top-to-bottom:**

```
┌─ Header bar ──────────────────────────────────────┐
│ ← Back  |  IO#/PO#  |  Vendor  |  [W2 badge]      │
└───────────────────────────────────────────────────┘

┌─ Info card ───────────────────────────────────────┐
│ วันที่มาส่ง (ATA):  [text input  วว/ดด/ปปปป]      │
│ ผู้รับลงสินค้า:     [text input]                   │
└───────────────────────────────────────────────────┘

┌─ รายการสินค้า ────────────────────────────────────┐
│ For each PO/IO line:                              │
│  ┌─ Line card ──────────────────────────────────┐ │
│  │ [1] SKU — Product name          สั่งมา: 20  │ │
│  │ จำนวนรับ: [________]  หน่วย: กล่อง           │ │
│  │ วันหมดอายุ: [วว/ดด/ปปปป]  Loc.IN: [_____]   │ │
│  │ สต็อคเดิม: 145 กล่อง (read-only)             │ │
│  └──────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────┘

┌─ ของแถม / สินค้านอกบิล ────────────────────────────┐
│ [+ เพิ่มของแถม]                                    │
│ For each bonus item:                              │
│  Product: [autocomplete search]   qty: [___]     │
│  หน่วย: [____]  EXP: [วว/ดด/ปปปป]   [×]         │
└───────────────────────────────────────────────────┘

┌─ ค่าลิฟท์ (W2 only) ──────────────────────────────┐
│ จำนวนรอบ: [__]  |  รวม: ฿___                      │
│ ● จ่ายสด  ○ เชื่อ                                 │
└───────────────────────────────────────────────────┘

┌─ หมายเหตุ ────────────────────────────────────────┐
│ [textarea]                                        │
└───────────────────────────────────────────────────┘

┌─ Sticky bottom ────────────────────────────────────┐
│  [พักบิล]  [รับสินค้าเสร็จแล้ว]  (ยืนยัน hidden) │
└───────────────────────────────────────────────────┘
```

**State variables:**
```typescript
const [receivedDate, setReceivedDate] = useState(todayBE()); // Thai BE format
const [receivedByNames, setReceivedByNames] = useState('');
const [notes, setNotes] = useState('');
const [liftFeeRounds, setLiftFeeRounds] = useState(0);
const [liftFeePayment, setLiftFeePayment] = useState<'cash'|'credit'>('cash');
const [lines, setLines] = useState<GRNLine[]>([]);
const [bonusItems, setBonusItems] = useState<BonusItem[]>([]);
const [saving, setSaving] = useState(false);
const [error, setError] = useState('');
```

**GRNLine interface (no lot_number field):**
```typescript
interface GRNLine {
  po_line_item_id?: string;
  inbound_order_line_id?: string;
  product_id: string;
  sku: string;
  product_name: string;
  qty_ordered: number;
  qty_received: number;
  unit: string;
  expiry_date_be: string;    // Thai BE display string "วว/ดด/ปปปป"
  mfg_date_be: string;
  date_type: 'expiry' | 'mfg';
  storage_location: string;
  stock_on_hand: number;     // from API GET
}
```

**BonusItem interface:**
```typescript
interface BonusItem {
  product_id?: string;
  product_name: string;
  qty: number;
  unit: string;
  expiry_date_be: string;
  notes: string;
}
```

**Date handling:**
- `todayBE()` → today's date in Thai BE format DD/MM/YYYY (year + 543)
- Display: `expiry_date_be` (Thai BE string in state)
- On submit: call `parseBuddhistDate(expiry_date_be)` → YYYY-MM-DD for API
- Import `parseBuddhistDate`, `formatBuddhistDate`, `todayBE` from `lib/date-utils.ts`

**Product autocomplete for bonus items:**
```typescript
// Debounce 300ms, call GET /api/products?search=${q}&limit=10
// Show dropdown: SKU — ชื่อ, click to set product_id + unit
```

**Lift fee section:** Rendered only when `warehouseId === isW2`. Check `warehouseList` to find if selected warehouse has code 'W2'.

**3 buttons behavior:**
- `พักบิล` → POST /api/grn with `status: 'draft'` (if no grn_id) or call save-draft PATCH
- `รับสินค้าเสร็จแล้ว` → POST /api/grn then PATCH /api/grn/[id]/receive
- `ยืนยันรับสินค้า` → shown ONLY when grn_id exists and `grn.status === 'received'` and role is manager/admin. Calls PATCH /api/grn/[id]/stock

**Do NOT include:**
- `activeLine` state
- `step` state
- `saveLine()` / `skipLine()` functions
- Lot number field in JSX
- Lot number in submitted payload
- Any `any` type

#### Verify:
- [x] Re-read `app/app/grn/new/page.tsx` — no `activeLine`, `step`, `saveLine`, `skipLine`
- [x] Re-read `app/app/grn/new/page.tsx` — no `lot_number` in JSX or payload
- [x] Re-read `app/app/grn/new/page.tsx` — bonus items section with product autocomplete
- [x] Re-read `app/app/grn/new/page.tsx` — lift fee section gated on W2
- [x] Re-read `app/app/grn/new/page.tsx` — 3 sticky bottom buttons
- [x] `npx tsc --noEmit` passes
- [x] Grep `any` in file → zero results

---

### Task 5 — Update receiving-queue card to show Thai status labels + overdue badge
**Assignee:** puka
**File:** `app/app/grn/receiving-queue/page.tsx`
**Depends on:** none (independent)

Add Thai status label mapping for IO cards:
```typescript
const IO_STATUS_LABEL: Record<string, string> = {
  open:      'รอสินค้าเข้า',
  receiving: 'กำลังลงสินค้า',
  received:  'รอตรวจสอบ',
  stocked:   'รับสินค้าแล้ว',
};
```

Add overdue badge logic: if IO `created_at` is > 72 hours ago and status is `open` or `receiving`, show a red "นานผิดปกติ" badge on the mobile card.

The desktop table already shows `StatusBadge` — keep it, just verify it displays correctly.

**No API change needed** — `created_at` is already returned.

#### Verify:
- [x] Re-read `app/app/grn/receiving-queue/page.tsx` — Thai status label for IO cards
- [x] Re-read `app/app/grn/receiving-queue/page.tsx` — overdue badge logic
- [x] `npx tsc --noEmit` passes

---

## Execution Order

1. Task 1 (migration) → run `npm run migrate`
2. Task 2 (POST route extend) — depends on Task 1
3. Task 3 (GET route extend) — depends on Task 1
4. Task 4 (UI rewrite) — depends on Tasks 2, 3
5. Task 5 (queue cards) — independent, run anytime

---

## lib/date-utils.ts (Required by Task 4)

If this file doesn't exist after `grn-receiving-fix` is merged, create it:

```typescript
export function parseBuddhistDate(beStr: string): string {
  // Input: "DD/MM/YYYY" where YYYY is BE (e.g., "31/12/2569")
  // Output: "YYYY-MM-DD" Gregorian
  if (!beStr || !/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(beStr)) return '';
  const [dd, mm, byyyy] = beStr.split('/');
  const gregorianYear = parseInt(byyyy) - 543;
  return `${gregorianYear}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
}

export function formatBuddhistDate(isoStr: string): string {
  // Input: "YYYY-MM-DD" Gregorian
  // Output: "DD/MM/YYYY" BE
  if (!isoStr || !/^\d{4}-\d{2}-\d{2}$/.test(isoStr)) return '';
  const [yyyy, mm, dd] = isoStr.split('-');
  return `${dd}/${mm}/${parseInt(yyyy) + 543}`;
}

export function todayBE(): string {
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, '0');
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const be = now.getFullYear() + 543;
  return `${dd}/${mm}/${be}`;
}
```

---

## QA Checklist

- [x] `migrations/039_grn_bonus_items.sql` runs without error
- [x] POST /api/grn with `bonus_items: [{ product_name: "แถม", qty: 5, unit: "ชิ้น" }]` → 201, `grn_bonus_items` row created
- [x] POST /api/grn with `lift_fee_payment_method: 'cash'` → stored in DB
- [x] GET /api/grn/[id] returns `bonus_items` array and `stock_on_hand` per line
- [x] `app/app/grn/new/page.tsx` renders as single scrollable page (no step navigation)
- [x] No `lot_number` field visible in the form
- [x] Lift fee section visible only when W2 warehouse selected
- [x] Bonus item product search calls `/api/products?search=` and shows dropdown
- [x] Bonus item with typed name (no product_id) submits successfully
- [x] `parseBuddhistDate("31/12/2569")` → `"2026-12-31"` ✓
- [x] `formatBuddhistDate("2026-12-31")` → `"31/12/2569"` ✓
- [x] Queue mobile cards show Thai status labels
- [x] Queue mobile cards show "นานผิดปกติ" badge for IOs > 72 hours old
- [x] `npx tsc --noEmit` passes
- [x] `npm run lint` passes
- [x] No `any` type in any modified file


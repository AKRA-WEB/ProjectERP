---
track: pos-module
status: Completed
owner: paku, puka
module: POS
updated: 2026-05-11
---

# Track: POS Module (Point of Sale)

**Created:** 2026-05-11
**Status:** Active
**Architect:** Claude

---

## Overview

Full POS module integrated with existing WMS stock ledger. Cashier opens a session (shift) for a warehouse, rings up products, collects payment, and closes the session. All sales deduct stock via `stock_ledger` (new types: `pos_sale`, `pos_void`). Void reverses the deduction atomically.

---

## Architecture Decisions

| Decision | Choice | Reason |
|---|---|---|
| Selling price | New `selling_price` column on `products` | Separate from `unit_cost` (procurement cost); POS uses retail price |
| VAT model | **Inclusive** (price includes 7% VAT) | Thai retail standard; `vat = total * 0.07/1.07` |
| Stock deduction | `stock_ledger` INSERT only | Consistent with all other WMS modules |
| Session per warehouse | One open session per (user, warehouse) | Prevents double-float, mirrors real retail |
| Receipt number | `next_doc_number('RCP', 'seq_pos')` | Consistent with PR/PO/GRN pattern |
| POS pages | `'use client'` + API calls | Consistent with all other pages in project |

---

## Tasks

### Task 1: Migration — `migrations/016_pos.sql`

- [x] Add `selling_price NUMERIC(15,2) NOT NULL DEFAULT 0` column to `products` table
- [x] Create enum `pos_session_status` → values: `open`, `closed`
- [x] Create enum `pos_transaction_status` → values: `completed`, `voided`
- [x] Create enum `pos_payment_method` → values: `cash`, `card`, `mixed`
- [x] Alter enum `ledger_entry_type` → add values `pos_sale`, `pos_void`
- [x] Create sequence `seq_pos`
- [x] Create table `pos_sessions`:
  ```sql
  CREATE TABLE pos_sessions (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_number   VARCHAR(50) NOT NULL UNIQUE DEFAULT next_doc_number('SES', 'seq_pos'),
    warehouse_id     UUID NOT NULL REFERENCES warehouses(id),
    opened_by        UUID NOT NULL REFERENCES users(id),
    closed_by        UUID REFERENCES users(id),
    status           pos_session_status NOT NULL DEFAULT 'open',
    opening_float    NUMERIC(15,2) NOT NULL DEFAULT 0,
    closing_float    NUMERIC(15,2),
    opened_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    closed_at        TIMESTAMPTZ,
    notes            TEXT,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  ```
- [x] Create table `pos_transactions`:
  ```sql
  CREATE TABLE pos_transactions (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    receipt_number   VARCHAR(50) NOT NULL UNIQUE DEFAULT next_doc_number('RCP', 'seq_pos'),
    session_id       UUID NOT NULL REFERENCES pos_sessions(id),
    warehouse_id     UUID NOT NULL REFERENCES warehouses(id),
    subtotal         NUMERIC(15,2) NOT NULL,
    discount_amount  NUMERIC(15,2) NOT NULL DEFAULT 0,
    vat_amount       NUMERIC(15,2) NOT NULL,
    total            NUMERIC(15,2) NOT NULL,
    payment_method   pos_payment_method NOT NULL,
    cash_tendered    NUMERIC(15,2),
    card_amount      NUMERIC(15,2),
    change_given     NUMERIC(15,2) NOT NULL DEFAULT 0,
    status           pos_transaction_status NOT NULL DEFAULT 'completed',
    voided_by        UUID REFERENCES users(id),
    voided_at        TIMESTAMPTZ,
    void_reason      TEXT,
    created_by       UUID NOT NULL REFERENCES users(id),
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  ```
- [x] Create table `pos_transaction_lines`:
  ```sql
  CREATE TABLE pos_transaction_lines (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id   UUID NOT NULL REFERENCES pos_transactions(id) ON DELETE CASCADE,
    product_id       UUID NOT NULL REFERENCES products(id),
    qty              NUMERIC(15,4) NOT NULL,
    unit_price       NUMERIC(15,2) NOT NULL,
    discount_amount  NUMERIC(15,2) NOT NULL DEFAULT 0,
    line_total       NUMERIC(15,2) NOT NULL,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  ```
- [x] Add indexes:
  - `idx_pos_sessions_warehouse` on `pos_sessions(warehouse_id)`
  - `idx_pos_sessions_opened_by` on `pos_sessions(opened_by)`
  - `idx_pos_sessions_status` on `pos_sessions(status)` WHERE `status = 'open'`
  - `idx_pos_transactions_session` on `pos_transactions(session_id)`
  - `idx_pos_transactions_receipt` on `pos_transactions(receipt_number)`
  - `idx_pos_txn_lines_transaction` on `pos_transaction_lines(transaction_id)`
- [x] Add triggers: `set_updated_at()` on `pos_sessions`, `pos_transactions`
- [x] Seed new permissions into `permissions` table (sort_order 160–170):
  ```sql
  ('pos:view',          'ดู POS',           'View POS',             'pos', 160),
  ('pos:cashier',       'ดำเนินการ POS',    'Operate POS Terminal', 'pos', 161),
  ('pos:void',          'ยกเลิกรายการ POS', 'Void POS Transaction', 'pos', 162),
  ('pos:session_open',  'เปิดรอบ POS',      'Open POS Session',     'pos', 163),
  ('pos:session_close', 'ปิดรอบ POS',       'Close POS Session',    'pos', 164)
  ```
- [x] Grant POS permissions to system roles:
  - `system_admin`: all 5 POS permissions
  - `system_manager`: `pos:view`, `pos:cashier`, `pos:void`, `pos:session_open`, `pos:session_close`
  - `system_staff`: `pos:view`, `pos:cashier`, `pos:session_open`, `pos:session_close`

**Verification:** Run `npm run migrate` without errors. Confirm new tables exist.

---

### Task 2: Types — `types/index.ts`

Add to end of file:

- [x] `PosSessionStatus = 'open' | 'closed'`
- [x] `PosTransactionStatus = 'completed' | 'voided'`
- [x] `PosPaymentMethod = 'cash' | 'card' | 'mixed'`
- [x] Update `LedgerEntryType` to include `'pos_sale' | 'pos_void'`
- [x] Interface `PosSession`:
  ```typescript
  export interface PosSession {
    id: string;
    session_number: string;
    warehouse_id: string;
    warehouse_name_th: string;
    warehouse_name_en: string;
    opened_by: string;
    opened_by_name: string;
    closed_by: string | null;
    status: PosSessionStatus;
    opening_float: number;
    closing_float: number | null;
    opened_at: string;
    closed_at: string | null;
    notes: string | null;
    transaction_count?: number;
    total_sales?: number;
    created_at: string;
  }
  ```
- [x] Interface `PosTransactionLine`:
  ```typescript
  export interface PosTransactionLine {
    id: string;
    product_id: string;
    sku: string;
    barcode: string | null;
    name_th: string;
    name_en: string;
    qty: number;
    unit_price: number;
    discount_amount: number;
    line_total: number;
  }
  ```
- [x] Interface `PosTransaction`:
  ```typescript
  export interface PosTransaction {
    id: string;
    receipt_number: string;
    session_id: string;
    warehouse_id: string;
    subtotal: number;
    discount_amount: number;
    vat_amount: number;
    total: number;
    payment_method: PosPaymentMethod;
    cash_tendered: number | null;
    card_amount: number | null;
    change_given: number;
    status: PosTransactionStatus;
    voided_by: string | null;
    voided_at: string | null;
    void_reason: string | null;
    created_by: string;
    cashier_name: string;
    lines?: PosTransactionLine[];
    created_at: string;
  }
  ```
- [x] Interface `PosProduct` (for POS terminal product search):
  ```typescript
  export interface PosProduct {
    id: string;
    sku: string;
    barcode: string | null;
    name_th: string;
    name_en: string;
    selling_price: number;
    qty_available: number;
    uom_code: string;
  }
  ```

**Verification:** `npm run lint` passes with no type errors.

---

### Task 3: API Routes

#### 3a. `app/api/pos/sessions/route.ts`

- [x] `GET` — list sessions
  - Auth check → cast `SessionUser`
  - Assert permission `pos:view`
  - Warehouse scope via `buildWarehouseScopeClause`
  - Join `warehouses`, `users` for names
  - Include `transaction_count` and `total_sales` via subquery
  - Paginated (page, limit=20)
  - Return `apiSuccess({ sessions, total, page, limit })`

- [x] `POST` — open new session
  - Assert permission `pos:session_open`
  - Zod validate body: `{ warehouse_id: uuid, opening_float: number (≥0), notes?: string }`
  - Assert warehouse access for user
  - Check no existing `open` session for this user+warehouse → 409 if exists
  - INSERT `pos_sessions`
  - Return `apiSuccess(session, 201)`

#### 3b. `app/api/pos/sessions/[id]/route.ts`

- [x] `GET` — session detail
  - Assert `pos:view`
  - JOIN warehouses, users
  - Fetch latest 50 transactions for this session (with totals)
  - Return session + transactions array

- [x] `PATCH` — actions via `body.action`
  - **`close_session`**: Assert `pos:session_close`; verify session is `open`; validate body: `{ closing_float: number }` ; UPDATE status=`closed`, closing_float, closed_by, closed_at; return updated session

#### 3c. `app/api/pos/transactions/route.ts`

- [x] `GET` — list transactions (optionally filter by `session_id`)
  - Assert `pos:view`
  - Warehouse scope applied
  - JOIN cashier name
  - Paginated

- [x] `POST` — create transaction (checkout)
  - Assert `pos:cashier`
  - Zod validate body:
    ```typescript
    {
      session_id: uuid,
      lines: [{ product_id: uuid, qty: number (>0), unit_price: number, discount_amount?: number }],
      payment_method: 'cash' | 'card' | 'mixed',
      cash_tendered?: number,
      card_amount?: number,
      discount_amount?: number  // order-level discount
    }
    ```
  - Fetch session → must be `open`; extract `warehouse_id`
  - Assert warehouse access
  - Validate each line: product exists + `qty_available >= qty` in session's warehouse (SELECT FOR UPDATE on `stock_balances`)
  - Compute totals:
    - `line_total = (unit_price * qty) - line_discount`
    - `subtotal_before_order_discount = SUM(line_totals)`
    - `subtotal = subtotal_before_order_discount - order_discount_amount`
    - `vat_amount = ROUND(subtotal * 0.07 / 1.07, 2)`
    - `total = subtotal`  _(price is VAT-inclusive; subtotal IS the total)_
    - **Correction:** `total = subtotal_before_order_discount - order_discount` ; `vat_amount = ROUND(total * 7/107, 2)` ; `subtotal_excl_vat = total - vat_amount`
  - Validate payment ≥ total:
    - `cash`: `cash_tendered >= total`
    - `card`: `card_amount == total`
    - `mixed`: `cash_tendered + card_amount >= total`
  - Compute `change_given = MAX(0, (cash_tendered ?? 0) - MAX(0, total - (card_amount ?? 0)))`
  - Use transaction (`pool.connect()`):
    1. INSERT `pos_transactions`
    2. INSERT all `pos_transaction_lines`
    3. INSERT `stock_ledger` rows for each line: `entry_type='pos_sale'`, `qty_change = -qty`, `reference_type='pos_transaction'`, `reference_id=transaction.id`
  - COMMIT
  - Return `apiSuccess(transaction, 201)`

#### 3d. `app/api/pos/transactions/[id]/route.ts`

- [x] `GET` — transaction detail with lines
  - Assert `pos:view`
  - JOIN lines with product details (sku, barcode, name_th, name_en)
  - Return transaction + lines array

- [x] `PATCH` — actions via `body.action`
  - **`void`**: Assert `pos:void`; validate body: `{ void_reason: string }`
  - Verify transaction `status = 'completed'`
  - Use transaction:
    1. UPDATE `pos_transactions` → status=`voided`, voided_by, voided_at, void_reason
    2. INSERT `stock_ledger` rows for each line: `entry_type='pos_void'`, `qty_change = +qty` (restore stock)
  - Return updated transaction

#### 3e. `app/api/pos/products/route.ts`

- [x] `GET` — product search for POS terminal
  - Assert `pos:cashier`
  - Query params: `warehouse_id` (required), `q` (search: barcode/sku/name), `limit=20`
  - JOIN `stock_balances` WHERE `warehouse_id=$1`
  - JOIN `units_of_measure` for uom_code
  - Filter: `p.is_active=true AND sb.qty_available > 0`
  - Search: `p.barcode=$q OR p.sku ILIKE '%$q%' OR p.name_th ILIKE '%$q%' OR p.name_en ILIKE '%$q%'`
  - Return `PosProduct[]`

**Verification:** Test each endpoint with curl or browser. No TypeScript errors.

---

### Task 4: Pages

#### 4a. `app/app/pos/page.tsx` — POS Home

- [x] `'use client'` page
- [x] Fetch open sessions for current user's accessible warehouses
- [x] Show: open sessions list (session_number, warehouse, opened_at, opening_float, transaction_count)
- [x] Button: "เปิดรอบ POS / Open Session" → modal with warehouse selector + opening float input
- [x] Clicking open session → navigates to `/app/pos/session/[id]`
- [x] Link: "ประวัติรอบ / Session History" → `/app/pos/sessions`

#### 4b. `app/app/pos/session/[id]/page.tsx` — POS Terminal

This is the main cashier screen. Full-screen layout, touch-friendly.

- [x] **Layout:** Two-column
  - Left (60%): Product search + Cart
  - Right (40%): Order summary + Payment panel

- [x] **Product search** (top of left column):
  - Text input: search by barcode / SKU / name (Thai or English)
  - Calls `GET /api/pos/products?warehouse_id=X&q=Y`
  - Results show as clickable cards: name_th, sku, selling_price, qty_available
  - Click → add to cart (qty=1); if already in cart → increment qty

- [x] **Cart** (bottom of left column):
  - Table: product name, qty (editable inline), unit price, discount, line total
  - Qty can be incremented/decremented or typed
  - Delete line button per row
  - Order-level discount input (THB amount)

- [x] **Order summary** (top of right column):
  - Subtotal (excl. VAT), VAT (7%), Order discount, **Total (incl. VAT)**
  - All formatted with `formatCurrency()`

- [x] **Payment panel** (bottom of right column):
  - Payment method selector: Cash / Card / Mixed
  - Cash: tendered input → auto-compute change
  - Card: card amount input
  - Mixed: both inputs → validate sum ≥ total
  - "ชำระเงิน / Checkout" button → POST `/api/pos/transactions`
  - On success: show receipt modal → auto-clear cart

- [x] **Receipt modal:**
  - Receipt number, date/time, items table, totals, payment info, change
  - "พิมพ์ / Print" button → `window.print()`
  - "รายการใหม่ / New Sale" button → close modal, reset cart

- [x] **Session status bar** (top of screen):
  - Session number, warehouse, opened_at, cashier name
  - "ปิดรอบ / Close Session" button → confirm modal → PATCH close_session → redirect to `/app/pos`

- [x] **Void** accessible from session detail (not terminal) — see 4d

#### 4c. `app/app/pos/sessions/page.tsx` — Session History List

- [x] `'use client'` page
- [x] Table: session_number, warehouse, cashier, status badge, opened_at, closed_at, total_sales, transaction_count
- [x] Filter by status (all / open / closed), warehouse selector
- [x] Paginated
- [x] Row click → `/app/pos/sessions/[id]`

#### 4d. `app/app/pos/sessions/[id]/page.tsx` — Session Detail

- [x] Session info card: all session fields + totals summary
- [x] Transactions table: receipt_number, time, items count, total, status badge, cashier
- [x] Click transaction row → expand inline OR navigate to transaction detail
- [x] Void button per `completed` transaction (if user has `pos:void`) → reason modal → PATCH void

**Verification:** Manually test golden path: open session → search product → add to cart → checkout (cash) → receipt shows → new sale → close session. Check stock_ledger has `pos_sale` entries. Check void restores stock.

---

### Task 5: Sidebar — `components/layout/Sidebar.tsx`

- [x] Add new nav group `'ขายหน้าร้าน / POS'` after `'ข้อมูลหลัก / Master Data'` and before `'ผู้ดูแลระบบ / Admin'`:
  ```typescript
  {
    label: 'ขายหน้าร้าน / POS',
    items: [
      { href: '/app/pos',          label: 'POS Terminal',      icon: '🛍️', permission: 'pos:cashier' },
      { href: '/app/pos/sessions', label: 'Session History',   icon: '📑', permission: 'pos:view' },
    ],
  },
  ```
- [x] Change header title from `'WMS'` to `'ERP'` (POS marks first expansion beyond WMS)

**Verification:** Sidebar shows POS group for users with correct permissions. Admin sees it. Staff without `pos:cashier` does not see terminal link.

---

## Totals Computation Reference

```
line_total_i      = (unit_price_i × qty_i) − line_discount_i
cart_subtotal     = Σ line_total_i
order_discount    = user-entered THB amount (default 0)
total             = cart_subtotal − order_discount         ← VAT-inclusive final amount
vat_amount        = ROUND(total × 7 / 107, 2)
subtotal_excl_vat = total − vat_amount

change_given      = MAX(0, (cash_tendered + card_amount) − total)
                    where missing inputs default to 0
```

---

## Files to Create / Modify

| Action | Path |
|--------|------|
| CREATE | `migrations/016_pos.sql` |
| MODIFY | `types/index.ts` |
| CREATE | `app/api/pos/sessions/route.ts` |
| CREATE | `app/api/pos/sessions/[id]/route.ts` |
| CREATE | `app/api/pos/transactions/route.ts` |
| CREATE | `app/api/pos/transactions/[id]/route.ts` |
| CREATE | `app/api/pos/products/route.ts` |
| CREATE | `app/app/pos/page.tsx` |
| CREATE | `app/app/pos/session/[id]/page.tsx` |
| CREATE | `app/app/pos/sessions/page.tsx` |
| CREATE | `app/app/pos/sessions/[id]/page.tsx` |
| MODIFY | `components/layout/Sidebar.tsx` |

Total: 2 modified, 10 created.

---

## Acceptance Criteria

1. `npm run migrate` runs `016_pos.sql` without errors
2. `npm run lint` passes with zero errors
3. Admin can open POS session for any warehouse
4. Cashier can search products (barcode/SKU/name), add to cart, checkout with cash/card/mixed
5. Receipt modal shows after successful checkout
6. `stock_ledger` gains `pos_sale` entries after checkout; `stock_balances.qty_available` decreases
7. Voiding a transaction inserts `pos_void` ledger entries; stock restored
8. Session close records `closing_float` and sets status=`closed`
9. Sidebar shows POS group; title updated to ERP
10. Staff without `pos:cashier` permission cannot access terminal page

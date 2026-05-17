---
track: sales-module
status: Completed
aliases: ["Sales Module"]
owner: paku, puka
module: Sales
updated: 2026-05-11
---

# Track: Sales Module

**Created:** 2026-05-11
**Status:** Active
**Architect:** Claude

---

## Overview

Full B2B Sales module — the outbound mirror of the Purchasing module. Flow:

```
Customer → Quotation (SQ) → Sales Order (SO) → Delivery Order (DO) → Sales Invoice (SI)
                                                                    ↘ Sales Return (SR)
```

Stock is **deducted** from `stock_ledger` when Delivery Order is shipped (`so_delivery` entry type, negative qty). Customer returns restore stock (`so_return`, positive qty). All patterns mirror the existing PR→PO→GRN module.

---

## Architecture Decisions

| Decision | Choice | Reason |
|---|---|---|
| VAT model | **Exclusive** (subtotal + 7% = total) | B2B invoicing standard; mirrors PO module |
| Stock deduction trigger | DO status → `shipped` | Goods leave warehouse at shipment |
| Selling price source | `products.selling_price` (added in migration 016) | Override allowed per SO line |
| SQ→SO link | `so_sq_links` junction table | One SQ can spawn one SO |
| DO→SO link | `do_so_links` junction table + `qty_delivered` on SO lines | Partial delivery support |
| Invoice per DO | `sales_invoices` linked to `delivery_order_id` | One invoice per delivery |
| Credit limit | Warn-only on SO confirm | Don't block sales, just surface risk |
| Customer master | New `customers` table (mirrors `vendors`) | Separate from vendors — different lifecycle |

---

## State Machines

| Document | Flow |
|---|---|
| SQ | `draft` → `sent` → `accepted` → `converted_to_so` \| `rejected` \| `expired` |
| SO | `draft` → `confirmed` → `partially_delivered` \| `fully_delivered` → `invoiced` → `paid` → `closed` \| `cancelled` |
| DO | `draft` → `ready` → `shipped` → `delivered` \| `cancelled` |
| SI | `draft` → `issued` → `paid` → `void` |
| SR | `open` → `received` → `restocked` \| `disposed` |

---

## Tasks

### Task 1: Migration — `migrations/017_sales.sql`

- [x] **Enums:**
  ```sql
  CREATE TYPE sq_status AS ENUM ('draft','sent','accepted','converted_to_so','rejected','expired');
  CREATE TYPE so_status AS ENUM ('draft','confirmed','partially_delivered','fully_delivered','invoiced','paid','closed','cancelled');
  CREATE TYPE do_status AS ENUM ('draft','ready','shipped','delivered','cancelled');
  CREATE TYPE si_status AS ENUM ('draft','issued','paid','void');
  CREATE TYPE sr_status AS ENUM ('open','received','restocked','disposed');
  ```

- [x] **Alter `ledger_entry_type`** — add values `so_delivery`, `so_return`

- [x] **Sequences:**
  ```sql
  CREATE SEQUENCE IF NOT EXISTS seq_sq START 1;
  CREATE SEQUENCE IF NOT EXISTS seq_so START 1;
  CREATE SEQUENCE IF NOT EXISTS seq_do START 1;
  CREATE SEQUENCE IF NOT EXISTS seq_si START 1;
  CREATE SEQUENCE IF NOT EXISTS seq_sr START 1;
  ```

- [x] **Table `customers`:**
  ```sql
  CREATE TABLE IF NOT EXISTS customers (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code                 VARCHAR(50)  NOT NULL UNIQUE,
    name_th              VARCHAR(500) NOT NULL,
    name_en              VARCHAR(500),
    contact_name         VARCHAR(255),
    email                VARCHAR(255),
    phone                VARCHAR(50),
    address_th           TEXT,
    address_en           TEXT,
    tax_id               VARCHAR(50),
    payment_terms_days   INTEGER NOT NULL DEFAULT 30,
    credit_limit         NUMERIC(15,2) NOT NULL DEFAULT 0,
    is_active            BOOLEAN NOT NULL DEFAULT TRUE,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  ```

- [x] **Table `sales_quotations`:**
  ```sql
  CREATE TABLE IF NOT EXISTS sales_quotations (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sq_number        VARCHAR(50) NOT NULL UNIQUE DEFAULT next_doc_number('SQ','seq_sq'),
    customer_id      UUID NOT NULL REFERENCES customers(id),
    warehouse_id     UUID NOT NULL REFERENCES warehouses(id),
    status           sq_status NOT NULL DEFAULT 'draft',
    valid_until      DATE,
    subtotal         NUMERIC(15,2) NOT NULL DEFAULT 0,
    vat_amount       NUMERIC(15,2) NOT NULL DEFAULT 0,
    total_amount     NUMERIC(15,2) NOT NULL DEFAULT 0,
    notes            TEXT,
    sent_at          TIMESTAMPTZ,
    accepted_at      TIMESTAMPTZ,
    rejected_at      TIMESTAMPTZ,
    expired_at       TIMESTAMPTZ,
    created_by       UUID NOT NULL REFERENCES users(id),
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  ```

- [x] **Table `sq_line_items`:**
  ```sql
  CREATE TABLE IF NOT EXISTS sq_line_items (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sq_id        UUID NOT NULL REFERENCES sales_quotations(id) ON DELETE CASCADE,
    product_id   UUID NOT NULL REFERENCES products(id),
    qty          NUMERIC(15,4) NOT NULL CHECK (qty > 0),
    unit_price   NUMERIC(15,2) NOT NULL,
    discount_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
    line_total   NUMERIC(15,2) GENERATED ALWAYS AS (qty * unit_price - discount_amount) STORED,
    line_number  INTEGER NOT NULL,
    UNIQUE(sq_id, line_number)
  );
  ```

- [x] **Table `sales_orders`:**
  ```sql
  CREATE TABLE IF NOT EXISTS sales_orders (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    so_number           VARCHAR(50) NOT NULL UNIQUE DEFAULT next_doc_number('SO','seq_so'),
    customer_id         UUID NOT NULL REFERENCES customers(id),
    warehouse_id        UUID NOT NULL REFERENCES warehouses(id),
    status              so_status NOT NULL DEFAULT 'draft',
    expected_delivery   DATE,
    payment_terms_days  INTEGER NOT NULL DEFAULT 30,
    subtotal            NUMERIC(15,2) NOT NULL DEFAULT 0,
    vat_amount          NUMERIC(15,2) NOT NULL DEFAULT 0,
    total_amount        NUMERIC(15,2) NOT NULL DEFAULT 0,
    notes               TEXT,
    confirmed_by        UUID REFERENCES users(id),
    confirmed_at        TIMESTAMPTZ,
    cancelled_by        UUID REFERENCES users(id),
    cancelled_at        TIMESTAMPTZ,
    cancellation_reason TEXT,
    created_by          UUID NOT NULL REFERENCES users(id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  ```

- [x] **Table `so_line_items`:**
  ```sql
  CREATE TABLE IF NOT EXISTS so_line_items (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    so_id           UUID NOT NULL REFERENCES sales_orders(id) ON DELETE CASCADE,
    product_id      UUID NOT NULL REFERENCES products(id),
    sq_line_item_id UUID REFERENCES sq_line_items(id),
    qty_ordered     NUMERIC(15,4) NOT NULL CHECK (qty_ordered > 0),
    qty_delivered   NUMERIC(15,4) NOT NULL DEFAULT 0,
    unit_price      NUMERIC(15,2) NOT NULL,
    discount_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
    line_total      NUMERIC(15,2) GENERATED ALWAYS AS (qty_ordered * unit_price - discount_amount) STORED,
    line_number     INTEGER NOT NULL,
    UNIQUE(so_id, line_number)
  );
  ```

- [x] **Table `so_sq_links`:**
  ```sql
  CREATE TABLE IF NOT EXISTS so_sq_links (
    so_id UUID NOT NULL REFERENCES sales_orders(id),
    sq_id UUID NOT NULL REFERENCES sales_quotations(id),
    PRIMARY KEY (so_id, sq_id)
  );
  ```

- [x] **Table `delivery_orders`:**
  ```sql
  CREATE TABLE IF NOT EXISTS delivery_orders (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    do_number       VARCHAR(50) NOT NULL UNIQUE DEFAULT next_doc_number('DO','seq_do'),
    so_id           UUID NOT NULL REFERENCES sales_orders(id),
    warehouse_id    UUID NOT NULL REFERENCES warehouses(id),
    status          do_status NOT NULL DEFAULT 'draft',
    shipping_address TEXT,
    shipped_at      TIMESTAMPTZ,
    delivered_at    TIMESTAMPTZ,
    cancelled_at    TIMESTAMPTZ,
    notes           TEXT,
    created_by      UUID NOT NULL REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  ```

- [x] **Table `do_line_items`:**
  ```sql
  CREATE TABLE IF NOT EXISTS do_line_items (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    do_id           UUID NOT NULL REFERENCES delivery_orders(id) ON DELETE CASCADE,
    so_line_item_id UUID NOT NULL REFERENCES so_line_items(id),
    product_id      UUID NOT NULL REFERENCES products(id),
    qty_to_deliver  NUMERIC(15,4) NOT NULL CHECK (qty_to_deliver > 0),
    unit_price      NUMERIC(15,2) NOT NULL,
    line_total      NUMERIC(15,2) GENERATED ALWAYS AS (qty_to_deliver * unit_price) STORED,
    line_number     INTEGER NOT NULL,
    UNIQUE(do_id, line_number)
  );
  ```

- [x] **Table `sales_invoices`:**
  ```sql
  CREATE TABLE IF NOT EXISTS sales_invoices (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    si_number         VARCHAR(50) NOT NULL UNIQUE DEFAULT next_doc_number('SI','seq_si'),
    so_id             UUID NOT NULL REFERENCES sales_orders(id),
    delivery_order_id UUID REFERENCES delivery_orders(id),
    customer_id       UUID NOT NULL REFERENCES customers(id),
    status            si_status NOT NULL DEFAULT 'draft',
    invoice_date      DATE NOT NULL DEFAULT CURRENT_DATE,
    due_date          DATE NOT NULL,
    subtotal          NUMERIC(15,2) NOT NULL,
    vat_amount        NUMERIC(15,2) NOT NULL,
    total_amount      NUMERIC(15,2) NOT NULL,
    paid_at           TIMESTAMPTZ,
    paid_by           UUID REFERENCES users(id),
    voided_at         TIMESTAMPTZ,
    voided_by         UUID REFERENCES users(id),
    void_reason       TEXT,
    notes             TEXT,
    created_by        UUID NOT NULL REFERENCES users(id),
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  ```

- [x] **Table `sales_returns`:**
  ```sql
  CREATE TABLE IF NOT EXISTS sales_returns (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sr_number       VARCHAR(50) NOT NULL UNIQUE DEFAULT next_doc_number('SR','seq_sr'),
    so_id           UUID REFERENCES sales_orders(id),
    customer_id     UUID NOT NULL REFERENCES customers(id),
    warehouse_id    UUID NOT NULL REFERENCES warehouses(id),
    status          sr_status NOT NULL DEFAULT 'open',
    reason          TEXT,
    received_at     TIMESTAMPTZ,
    restocked_at    TIMESTAMPTZ,
    disposed_at     TIMESTAMPTZ,
    notes           TEXT,
    created_by      UUID NOT NULL REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  ```

- [x] **Table `sr_line_items`:**
  ```sql
  CREATE TABLE IF NOT EXISTS sr_line_items (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sr_id           UUID NOT NULL REFERENCES sales_returns(id) ON DELETE CASCADE,
    product_id      UUID NOT NULL REFERENCES products(id),
    qty_returned    NUMERIC(15,4) NOT NULL CHECK (qty_returned > 0),
    unit_price      NUMERIC(15,2) NOT NULL DEFAULT 0,
    line_number     INTEGER NOT NULL,
    UNIQUE(sr_id, line_number)
  );
  ```

- [x] **Indexes** (add all relevant ones):
  - `idx_customers_code` on `customers(code)`
  - `idx_customers_active` on `customers(is_active)` WHERE `is_active=TRUE`
  - `idx_sq_customer` on `sales_quotations(customer_id)`
  - `idx_sq_warehouse` on `sales_quotations(warehouse_id)`
  - `idx_sq_status` on `sales_quotations(status)`
  - `idx_so_customer` on `sales_orders(customer_id)`
  - `idx_so_warehouse` on `sales_orders(warehouse_id)`
  - `idx_so_status` on `sales_orders(status)`
  - `idx_do_so` on `delivery_orders(so_id)`
  - `idx_do_warehouse` on `delivery_orders(warehouse_id)`
  - `idx_do_status` on `delivery_orders(status)`
  - `idx_si_so` on `sales_invoices(so_id)`
  - `idx_si_customer` on `sales_invoices(customer_id)`
  - `idx_si_status` on `sales_invoices(status)`
  - `idx_sr_customer` on `sales_returns(customer_id)`
  - `idx_sr_warehouse` on `sales_returns(warehouse_id)`

- [x] **Triggers:** `set_updated_at()` on `customers`, `sales_quotations`, `sales_orders`, `delivery_orders`, `sales_invoices`, `sales_returns`

- [x] **Seed permissions** (sort_order 170–230):
  ```sql
  ('customers:view',   'ดูลูกค้า',          'View Customers',        'sales', 170),
  ('customers:create', 'เพิ่มลูกค้า',        'Create Customers',      'sales', 171),
  ('customers:edit',   'แก้ไขลูกค้า',        'Edit Customers',        'sales', 172),
  ('sq:view',          'ดูใบเสนอราคา',       'View Quotations',       'sales', 180),
  ('sq:create',        'สร้างใบเสนอราคา',    'Create Quotations',     'sales', 181),
  ('sq:send',          'ส่งใบเสนอราคา',      'Send Quotations',       'sales', 182),
  ('sq:accept',        'ยืนยันใบเสนอราคา',   'Accept Quotations',     'sales', 183),
  ('sq:reject',        'ปฏิเสธใบเสนอราคา',   'Reject Quotations',     'sales', 184),
  ('so:view',          'ดูใบสั่งขาย',        'View Sales Orders',     'sales', 190),
  ('so:create',        'สร้างใบสั่งขาย',     'Create Sales Orders',   'sales', 191),
  ('so:confirm',       'ยืนยันใบสั่งขาย',    'Confirm Sales Orders',  'sales', 192),
  ('so:cancel',        'ยกเลิกใบสั่งขาย',    'Cancel Sales Orders',   'sales', 193),
  ('do:view',          'ดูใบส่งสินค้า',      'View Delivery Orders',  'sales', 200),
  ('do:create',        'สร้างใบส่งสินค้า',   'Create Delivery Orders','sales', 201),
  ('do:ship',          'ส่งสินค้า',          'Ship Delivery',         'sales', 202),
  ('do:deliver',       'ยืนยันการส่ง',       'Confirm Delivery',      'sales', 203),
  ('si:view',          'ดูใบแจ้งหนี้',       'View Sales Invoices',   'sales', 210),
  ('si:create',        'สร้างใบแจ้งหนี้',    'Create Sales Invoices', 'sales', 211),
  ('si:mark_paid',     'บันทึกชำระ',          'Mark Invoice Paid',     'sales', 212),
  ('sr:view',          'ดูการรับคืน',        'View Sales Returns',    'sales', 220),
  ('sr:create',        'สร้างการรับคืน',     'Create Sales Returns',  'sales', 221),
  ('sr:restock',       'คืนสต็อก',           'Restock Return',        'sales', 222)
  ```

- [x] **Grant to system roles:**
  - `system_admin`: all sales permissions
  - `system_manager`: all sales permissions
  - `system_staff`: view permissions + `customers:view`, `sq:create`, `so:create`, `do:create`, `sr:create`

**Verification:** `npm run migrate` passes. All tables, enums, sequences exist.

---

### Task 2: Types — `types/index.ts`

Add to end of file:

- [x] Status types:
  ```typescript
  export type SqStatus = 'draft' | 'sent' | 'accepted' | 'converted_to_so' | 'rejected' | 'expired';
  export type SoStatus = 'draft' | 'confirmed' | 'partially_delivered' | 'fully_delivered' | 'invoiced' | 'paid' | 'closed' | 'cancelled';
  export type DoStatus = 'draft' | 'ready' | 'shipped' | 'delivered' | 'cancelled';
  export type SiStatus = 'draft' | 'issued' | 'paid' | 'void';
  export type SrStatus = 'open' | 'received' | 'restocked' | 'disposed';
  ```

- [x] Update `LedgerEntryType` to include `'so_delivery' | 'so_return'`

- [x] Interface `Customer`:
  ```typescript
  export interface Customer {
    id: string;
    code: string;
    name_th: string;
    name_en: string | null;
    contact_name: string | null;
    phone: string | null;
    email: string | null;
    address_th: string | null;
    tax_id: string | null;
    payment_terms_days: number;
    credit_limit: number;
    is_active: boolean;
    created_at: string;
    updated_at: string;
  }
  ```

- [x] Interface `SqLineItem`:
  ```typescript
  export interface SqLineItem {
    id: string;
    product_id: string;
    sku: string;
    name_th: string;
    name_en: string;
    qty: number;
    unit_price: number;
    discount_amount: number;
    line_total: number;
    line_number: number;
  }
  ```

- [x] Interface `SalesQuotation`:
  ```typescript
  export interface SalesQuotation {
    id: string;
    sq_number: string;
    customer_id: string;
    customer_name_th: string;
    warehouse_id: string;
    warehouse_name_th: string;
    status: SqStatus;
    valid_until: string | null;
    subtotal: number;
    vat_amount: number;
    total_amount: number;
    notes: string | null;
    sent_at: string | null;
    accepted_at: string | null;
    created_by: string;
    created_by_name: string;
    lines?: SqLineItem[];
    created_at: string;
    updated_at: string;
  }
  ```

- [x] Interface `SoLineItem`:
  ```typescript
  export interface SoLineItem {
    id: string;
    product_id: string;
    sku: string;
    name_th: string;
    name_en: string;
    qty_ordered: number;
    qty_delivered: number;
    unit_price: number;
    discount_amount: number;
    line_total: number;
    line_number: number;
  }
  ```

- [x] Interface `SalesOrder`:
  ```typescript
  export interface SalesOrder {
    id: string;
    so_number: string;
    customer_id: string;
    customer_name_th: string;
    warehouse_id: string;
    warehouse_name_th: string;
    status: SoStatus;
    expected_delivery: string | null;
    payment_terms_days: number;
    subtotal: number;
    vat_amount: number;
    total_amount: number;
    notes: string | null;
    confirmed_by: string | null;
    confirmed_at: string | null;
    cancelled_by: string | null;
    cancellation_reason: string | null;
    credit_limit_warning?: boolean;
    lines?: SoLineItem[];
    created_by: string;
    created_by_name: string;
    created_at: string;
    updated_at: string;
  }
  ```

- [x] Interface `DoLineItem`:
  ```typescript
  export interface DoLineItem {
    id: string;
    so_line_item_id: string;
    product_id: string;
    sku: string;
    name_th: string;
    name_en: string;
    qty_to_deliver: number;
    unit_price: number;
    line_total: number;
    line_number: number;
  }
  ```

- [x] Interface `DeliveryOrder`:
  ```typescript
  export interface DeliveryOrder {
    id: string;
    do_number: string;
    so_id: string;
    so_number: string;
    customer_name_th: string;
    warehouse_id: string;
    warehouse_name_th: string;
    status: DoStatus;
    shipping_address: string | null;
    shipped_at: string | null;
    delivered_at: string | null;
    notes: string | null;
    lines?: DoLineItem[];
    created_by: string;
    created_by_name: string;
    created_at: string;
    updated_at: string;
  }
  ```

- [x] Interface `SalesInvoice`:
  ```typescript
  export interface SalesInvoice {
    id: string;
    si_number: string;
    so_id: string;
    so_number: string;
    delivery_order_id: string | null;
    do_number: string | null;
    customer_id: string;
    customer_name_th: string;
    status: SiStatus;
    invoice_date: string;
    due_date: string;
    subtotal: number;
    vat_amount: number;
    total_amount: number;
    paid_at: string | null;
    voided_at: string | null;
    void_reason: string | null;
    notes: string | null;
    created_by: string;
    created_by_name: string;
    created_at: string;
  }
  ```

- [x] Interface `SrLineItem` and `SalesReturn`:
  ```typescript
  export interface SrLineItem {
    id: string;
    product_id: string;
    sku: string;
    name_th: string;
    qty_returned: number;
    unit_price: number;
    line_number: number;
  }
  export interface SalesReturn {
    id: string;
    sr_number: string;
    so_id: string | null;
    so_number: string | null;
    customer_id: string;
    customer_name_th: string;
    warehouse_id: string;
    warehouse_name_th: string;
    status: SrStatus;
    reason: string | null;
    received_at: string | null;
    restocked_at: string | null;
    notes: string | null;
    lines?: SrLineItem[];
    created_by: string;
    created_at: string;
  }
  ```

**Verification:** `npm run lint` no type errors.

---

### Task 3: API Routes

#### 3a. `app/api/customers/route.ts`
- [x] `GET` — list customers, filter by `search` (name/code), `is_active`, paginated
- [x] `POST` — create customer; Zod validate: `{ code, name_th, name_en?, contact_name?, email?, phone?, address_th?, tax_id?, payment_terms_days?, credit_limit? }`; assert `customers:create`

#### 3b. `app/api/customers/[id]/route.ts`
- [x] `GET` — customer detail; assert `customers:view`
- [x] `PATCH` — edit fields; assert `customers:edit`; PATCH only provided fields

#### 3c. `app/api/sales-quotations/route.ts`
- [x] `GET` — list SQs; warehouse scope; join customer + warehouse names; filter by status; paginated; assert `sq:view`
- [x] `POST` — create SQ draft; assert `sq:create`; validate body `{ customer_id, warehouse_id, valid_until?, notes?, lines: [{ product_id, qty, unit_price, discount_amount? }] }`
  - Compute `subtotal = SUM(qty * unit_price - discount_amount)`, `vat_amount = ROUND(subtotal * 0.07, 2)`, `total_amount = subtotal + vat_amount`
  - INSERT SQ header + lines in transaction
  - Return `apiSuccess(sq, 201)`

#### 3d. `app/api/sales-quotations/[id]/route.ts`
- [x] `GET` — SQ detail with lines (join product sku/name); assert `sq:view`
- [x] `PATCH` — actions via `body.action`:
  - **`send`**: assert `sq:send`; status must be `draft`; set status=`sent`, sent_at=NOW()
  - **`accept`**: assert `sq:accept`; status must be `sent`; set status=`accepted`, accepted_at=NOW()
  - **`reject`**: assert `sq:reject`; status must be `sent`; set status=`rejected`, rejected_at=NOW()
  - **`expire`**: assert `sq:send`; status must be `sent`; set status=`expired`
  - **`convert_to_so`**: assert `so:create`; status must be `accepted`;
    - Use transaction: INSERT `sales_orders` (copy customer_id, warehouse_id, payment_terms_days from SQ); INSERT `so_line_items` from SQ lines (set sq_line_item_id); INSERT `so_sq_links`; UPDATE SQ status=`converted_to_so`
    - Return `{ so_id }` in response so frontend can redirect

#### 3e. `app/api/sales-orders/route.ts`
- [x] `GET` — list SOs; warehouse scope; join customer + warehouse; filter by status; paginated; assert `so:view`
- [x] `POST` — create SO draft (standalone, not from SQ); assert `so:create`; validate `{ customer_id, warehouse_id, expected_delivery?, payment_terms_days?, notes?, lines: [{ product_id, qty_ordered, unit_price, discount_amount? }] }`
  - Compute totals same as SQ
  - Return `apiSuccess(so, 201)`

#### 3f. `app/api/sales-orders/[id]/route.ts`
- [x] `GET` — SO detail with lines (qty_ordered, qty_delivered per line); join customer, warehouse, delivery_orders list; assert `so:view`
- [x] `PATCH` — actions via `body.action`:
  - **`confirm`**: assert `so:confirm`; status=`draft`→`confirmed`; credit limit check — compute customer's outstanding SO totals, compare vs credit_limit; if over, include `credit_limit_warning: true` in response but still confirm
  - **`cancel`**: assert `so:cancel`; status must be `draft` or `confirmed`; validate `{ cancellation_reason: string }`; set status=`cancelled`

#### 3g. `app/api/delivery-orders/route.ts`
- [x] `GET` — list DOs; warehouse scope; join so_number, customer_name; filter by status; paginated; assert `do:view`
- [x] `POST` — create DO from SO; assert `do:create`; validate `{ so_id, shipping_address?, notes?, lines: [{ so_line_item_id, qty_to_deliver }] }`
  - Fetch SO → must be `confirmed` or `partially_delivered`
  - Validate: each `qty_to_deliver` ≤ `qty_ordered - qty_delivered` on that SO line
  - Check `qty_available ≥ qty_to_deliver` in SO's warehouse (`SELECT FOR UPDATE` on `stock_balances`)
  - INSERT DO header + lines in transaction
  - Return `apiSuccess(do, 201)`

#### 3h. `app/api/delivery-orders/[id]/route.ts`
- [x] `GET` — DO detail with lines; assert `do:view`
- [x] `PATCH` — actions via `body.action`:
  - **`ready`**: assert `do:create`; status=`draft`→`ready`
  - **`ship`**: assert `do:ship`; status=`ready`→`shipped`; shipped_at=NOW()
    - Use transaction:
      1. UPDATE `delivery_orders` status=`shipped`
      2. INSERT `stock_ledger` rows per line: `entry_type='so_delivery'`, `qty_change=-qty_to_deliver`, `reference_type='delivery_order'`, `reference_id=do.id`
      3. UPDATE `so_line_items` → `qty_delivered += qty_to_deliver` for each line
      4. Re-evaluate SO status: if all lines `qty_delivered >= qty_ordered` → `fully_delivered`; else → `partially_delivered`
  - **`deliver`**: assert `do:deliver`; status=`shipped`→`delivered`; delivered_at=NOW()
  - **`cancel`**: assert `do:create`; status must be `draft` or `ready`; set status=`cancelled` (no stock reversal — not shipped yet)

#### 3i. `app/api/sales-invoices/route.ts`
- [x] `GET` — list invoices; join customer, so_number; filter by status; paginated; assert `si:view`
- [x] `POST` — create invoice; assert `si:create`; validate `{ so_id, delivery_order_id?, invoice_date?, notes?, payment_terms_days? }`
  - Fetch SO lines to compute amounts (or DO lines if delivery_order_id provided)
  - Compute subtotal, vat, total
  - Due date = invoice_date + customer.payment_terms_days
  - INSERT `sales_invoices`
  - UPDATE SO status → `invoiced` (only if `fully_delivered`)
  - Return `apiSuccess(invoice, 201)`

#### 3j. `app/api/sales-invoices/[id]/route.ts`
- [x] `GET` — invoice detail; assert `si:view`
- [x] `PATCH` — actions:
  - **`issue`**: assert `si:create`; status=`draft`→`issued`
  - **`mark_paid`**: assert `si:mark_paid`; status=`issued`→`paid`; paid_at=NOW(); UPDATE SO status → `paid`
  - **`void`**: assert admin or manager; status must be `draft` or `issued`; validate `{ void_reason }`; set status=`void`

#### 3k. `app/api/sales-returns/route.ts`
- [x] `GET` — list SRs; warehouse scope; join customer; paginated; assert `sr:view`
- [x] `POST` — create SR; assert `sr:create`; validate `{ customer_id, warehouse_id, so_id?, reason?, notes?, lines: [{ product_id, qty_returned, unit_price? }] }`
  - INSERT SR header + lines in transaction
  - Return `apiSuccess(sr, 201)`

#### 3l. `app/api/sales-returns/[id]/route.ts`
- [x] `GET` — SR detail with lines; assert `sr:view`
- [x] `PATCH` — actions:
  - **`receive`**: assert `sr:create`; status=`open`→`received`; received_at=NOW()
  - **`restock`**: assert `sr:restock`; status=`received`→`restocked`; restocked_at=NOW()
    - INSERT `stock_ledger` rows: `entry_type='so_return'`, `qty_change=+qty_returned`, `reference_type='sales_return'`, `reference_id=sr.id`
  - **`dispose`**: assert `sr:restock`; status=`received`→`disposed` (no stock entry — goods scrapped)

**Verification:** All 12 route files exist, `npm run lint` passes.

---

### Task 4: Pages

#### 4a. Customers (Master Data)

**`app/app/customers/page.tsx`** — Customer list
- [x] Table: code, name_th, phone, email, payment_terms_days, credit_limit, status badge
- [x] Filter by active/inactive, search by name/code
- [x] "เพิ่มลูกค้า / Add Customer" button → `/app/customers/new`
- [x] Row click → `/app/customers/[id]`
- [x] Paginated

**`app/app/customers/new/page.tsx`** — Create customer form
- [x] Fields: code, name_th, name_en, contact_name, phone, email, address_th, tax_id, payment_terms_days (default 30), credit_limit (default 0)
- [x] POST `/api/customers` → redirect to `/app/customers/[id]`

**`app/app/customers/[id]/page.tsx`** — Customer detail + edit
- [x] Display all fields with inline edit (same form, PATCH on save)
- [x] Show recent sales orders for this customer (last 10)

#### 4b. Sales Quotations

**`app/app/sales-quotations/page.tsx`** — SQ list
- [x] Table: sq_number, customer, warehouse, status badge, valid_until, total_amount, created_at
- [x] Filter by status
- [x] "สร้างใบเสนอราคา / New Quotation" → `/app/sales-quotations/new`

**`app/app/sales-quotations/new/page.tsx`** — Create SQ
- [x] Select customer (search dropdown), warehouse, valid_until, notes
- [x] Product line editor: search by SKU/name, add lines with qty + unit_price (defaults to `selling_price`) + discount
- [x] Live totals: subtotal (excl. VAT) + VAT 7% + total
- [x] Submit → POST `/api/sales-quotations` → redirect to `/app/sales-quotations/[id]`

**`app/app/sales-quotations/[id]/page.tsx`** — SQ detail
- [x] Header info + status badge + action buttons based on status:
  - `draft`: "ส่ง / Send" → `send` action
  - `sent`: "ยืนยัน / Accept", "ปฏิเสธ / Reject", "หมดอายุ / Expire"
  - `accepted`: "สร้างใบสั่งขาย / Convert to SO" → `convert_to_so` → redirect to new SO
- [x] Lines table: product, qty, unit_price, discount, line_total
- [x] Totals footer

#### 4c. Sales Orders

**`app/app/sales-orders/page.tsx`** — SO list
- [x] Table: so_number, customer, warehouse, status badge, total_amount, expected_delivery, created_at
- [x] Filter by status, warehouse
- [x] "สร้างใบสั่งขาย / New SO" → `/app/sales-orders/new`

**`app/app/sales-orders/new/page.tsx`** — Create SO (standalone)
- [x] Select customer, warehouse, expected_delivery, payment_terms_days, notes
- [x] Same product line editor as SQ new page
- [x] Submit → POST → redirect to detail

**`app/app/sales-orders/[id]/page.tsx`** — SO detail
- [x] Header + status badge + actions:
  - `draft`: "ยืนยัน / Confirm" → if credit warning, show inline alert but allow confirm
  - `confirmed` or `partially_delivered`: "สร้างใบส่ง / Create DO" → link to `/app/delivery-orders/new?so_id=[id]`
  - `draft` or `confirmed`: "ยกเลิก / Cancel" → reason modal
- [x] Lines table: product, qty_ordered, qty_delivered, remaining, unit_price, line_total
- [x] Linked delivery orders list (do_number, status, shipped_at)
- [x] Linked invoices list

#### 4d. Delivery Orders

**`app/app/delivery-orders/page.tsx`** — DO list
- [x] Table: do_number, so_number, customer, warehouse, status badge, shipped_at, created_at
- [x] Filter by status, warehouse

**`app/app/delivery-orders/new/page.tsx`** — Create DO from SO
- [x] Read `?so_id=` from query params → pre-load SO lines showing qty_remaining per line
- [x] Input qty_to_deliver per line (max = qty_remaining, must not exceed qty_available in warehouse)
- [x] shipping_address field, notes
- [x] Submit → POST `/api/delivery-orders`

**`app/app/delivery-orders/[id]/page.tsx`** — DO detail
- [x] Header + status badge + actions:
  - `draft`: "พร้อมส่ง / Mark Ready" → `ready`
  - `ready`: "ส่งสินค้า / Ship" → `ship` ← this deducts stock
  - `shipped`: "ยืนยันส่งถึง / Confirm Delivered" → `deliver`
  - `draft` or `ready`: "ยกเลิก / Cancel" → `cancel`
- [x] Lines table: product, qty_to_deliver, unit_price, line_total
- [x] Link back to SO

#### 4e. Sales Invoices

**`app/app/sales-invoices/page.tsx`** — Invoice list
- [x] Table: si_number, customer, so_number, status badge, invoice_date, due_date, total_amount
- [x] Filter by status

**`app/app/sales-invoices/new/page.tsx`** — Create invoice
- [x] Select SO (search by so_number); optionally select linked DO
- [x] Auto-populate amounts from SO/DO
- [x] invoice_date (default today), payment_terms_days (from customer), notes
- [x] Submit → POST

**`app/app/sales-invoices/[id]/page.tsx`** — Invoice detail
- [x] All fields + status badge + actions:
  - `draft`: "ออกใบแจ้งหนี้ / Issue" → `issue`
  - `issued`: "บันทึกชำระ / Mark Paid" → `mark_paid`
  - `draft` or `issued`: "ยกเลิก / Void" → reason modal → `void` (manager/admin only)

#### 4f. Sales Returns

**`app/app/sales-returns/page.tsx`** — SR list
- [x] Table: sr_number, customer, warehouse, status badge, reason (truncated), created_at
- [x] Filter by status, warehouse

**`app/app/sales-returns/new/page.tsx`** — Create SR
- [x] Select customer, warehouse; optionally link SO (search by so_number)
- [x] Reason textarea
- [x] Line editor: product search, qty_returned, unit_price
- [x] Submit → POST

**`app/app/sales-returns/[id]/page.tsx`** — SR detail
- [x] Status badge + actions:
  - `open`: "รับสินค้าคืน / Receive" → `receive`
  - `received`: "คืนสต็อก / Restock" → `restock` (inserts `so_return` ledger), "ทำลาย / Dispose" → `dispose`
- [x] Lines table
- [x] Linked SO link if present

**Verification:** Test golden path:
1. Create Customer → Create SQ → Send → Accept → Convert to SO
2. Confirm SO → Create DO → Mark Ready → Ship (verify stock_ledger `so_delivery` entry)
3. Create Invoice → Issue → Mark Paid
4. Create SR for same SO → Receive → Restock (verify `so_return` ledger entry restores stock)

---

### Task 5: Sidebar — `components/layout/Sidebar.tsx`

- [x] Add new nav group `'ขาย / Sales'` **between** `'ข้อมูลหลัก / Master Data'` and `'ขายหน้าร้าน / POS'`:
  ```typescript
  {
    label: 'ขาย / Sales',
    items: [
      { href: '/app/customers',         label: 'ลูกค้า / Customers',       icon: '👤', permission: 'customers:view' },
      { href: '/app/sales-quotations',  label: 'ใบเสนอราคา / Quotations',  icon: '📝', permission: 'sq:view' },
      { href: '/app/sales-orders',      label: 'ใบสั่งขาย / Sales Orders', icon: '🧾', permission: 'so:view' },
      { href: '/app/delivery-orders',   label: 'ใบส่งสินค้า / Deliveries', icon: '🚚', permission: 'do:view' },
      { href: '/app/sales-invoices',    label: 'ใบแจ้งหนี้ / Invoices',    icon: '💳', permission: 'si:view' },
      { href: '/app/sales-returns',     label: 'รับคืน / Returns',          icon: '↩️', permission: 'sr:view' },
    ],
  },
  ```

**Verification:** Sales group visible for admin and users with correct permissions.

---

## Totals Computation Reference

```
line_total_i       = (unit_price_i × qty_i) − line_discount_i
subtotal           = Σ line_total_i
vat_amount         = ROUND(subtotal × 0.07, 2)
total_amount       = subtotal + vat_amount
```

> Note: **Exclusive VAT** (B2B invoicing). Contrast with POS module which uses **inclusive VAT**.

---

## Files to Create / Modify

| Action | Path |
|--------|------|
| CREATE | `migrations/017_sales.sql` |
| MODIFY | `types/index.ts` |
| CREATE | `app/api/customers/route.ts` |
| CREATE | `app/api/customers/[id]/route.ts` |
| CREATE | `app/api/sales-quotations/route.ts` |
| CREATE | `app/api/sales-quotations/[id]/route.ts` |
| CREATE | `app/api/sales-orders/route.ts` |
| CREATE | `app/api/sales-orders/[id]/route.ts` |
| CREATE | `app/api/delivery-orders/route.ts` |
| CREATE | `app/api/delivery-orders/[id]/route.ts` |
| CREATE | `app/api/sales-invoices/route.ts` |
| CREATE | `app/api/sales-invoices/[id]/route.ts` |
| CREATE | `app/api/sales-returns/route.ts` |
| CREATE | `app/api/sales-returns/[id]/route.ts` |
| CREATE | `app/app/customers/page.tsx` |
| CREATE | `app/app/customers/new/page.tsx` |
| CREATE | `app/app/customers/[id]/page.tsx` |
| CREATE | `app/app/sales-quotations/page.tsx` |
| CREATE | `app/app/sales-quotations/new/page.tsx` |
| CREATE | `app/app/sales-quotations/[id]/page.tsx` |
| CREATE | `app/app/sales-orders/page.tsx` |
| CREATE | `app/app/sales-orders/new/page.tsx` |
| CREATE | `app/app/sales-orders/[id]/page.tsx` |
| CREATE | `app/app/delivery-orders/page.tsx` |
| CREATE | `app/app/delivery-orders/new/page.tsx` |
| CREATE | `app/app/delivery-orders/[id]/page.tsx` |
| CREATE | `app/app/sales-invoices/page.tsx` |
| CREATE | `app/app/sales-invoices/new/page.tsx` |
| CREATE | `app/app/sales-invoices/[id]/page.tsx` |
| CREATE | `app/app/sales-returns/page.tsx` |
| CREATE | `app/app/sales-returns/new/page.tsx` |
| CREATE | `app/app/sales-returns/[id]/page.tsx` |
| MODIFY | `components/layout/Sidebar.tsx` |

Total: 2 modified, 30 created.

---

## Acceptance Criteria

1. `npm run migrate` runs `017_sales.sql` without errors
2. `npm run lint` passes with zero errors
3. Customer CRUD works
4. Full SQ → SO → DO → SI golden path completes
5. DO `ship` action creates `so_delivery` stock_ledger entries; `qty_available` decreases
6. SO `qty_delivered` per line updates correctly after DO ship; SO status auto-sets `partially_delivered` / `fully_delivered`
7. SR restock creates `so_return` stock_ledger entries; stock restored
8. Credit limit warning returned on SO confirm when customer is over limit
9. All list pages are paginated and warehouse-scoped
10. Sidebar Sales group visible with correct permission gating

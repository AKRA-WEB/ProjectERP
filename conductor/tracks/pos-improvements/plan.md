---
track: pos-improvements
status: Verified
aliases: ["pos-improvements"]
owner: paku, puka
module: POS
updated: 2026-05-15
---

## Track: POS Improvements

**Status:** Completed
**Created:** 2026-05-14
**Last Updated:** 2026-05-14

## Scope

Seven improvement streams for the POS terminal:
1. Product Grid with category tabs and image support
2. Membership System (lookup, register, discount, points)
3. Hold Bill / Suspend Transaction
4. Transaction History Panel (in-terminal)
5. Low Stock Alert (visual, client-side)
6. Barcode Scanner Listener (keystroke timing heuristic)
7. Shift Management + Shift Report

---

## Dependency Order

```
Task 1 (migration) → Task 2 (products API) → Task 3 (members API) → Task 4 (held-carts API)
→ Task 5 (shifts API) → Task 6b-extra (product-categories API if missing)
→ Task 6 (terminal page refactor) → Task 7 (members list page)
→ Task 8 (shifts report page) → Task 9 (session pages) → Task 10 (sidebar)
→ Task 11 (types)
```

---

## Task 1 — Migration: `027_pos_improvements.sql`

**File:** `migrations/027_pos_improvements.sql`

- [x] Create file with full SQL below
- [x] Run `npm run migrate` locally and confirm no errors

```sql
-- migrations/027_pos_improvements.sql

BEGIN;

-- 1. Product image support
ALTER TABLE products ADD COLUMN IF NOT EXISTS image_url VARCHAR(500);

-- 2. Sequences for new doc number series
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_sequences WHERE schemaname='public' AND sequencename='seq_pos_members') THEN
    CREATE SEQUENCE seq_pos_members START 1;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_sequences WHERE schemaname='public' AND sequencename='seq_pos_held') THEN
    CREATE SEQUENCE seq_pos_held START 1;
  END IF;
END $$;

-- 3. Membership table
CREATE TABLE IF NOT EXISTS pos_members (
  id             UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  member_number  VARCHAR(50)   NOT NULL UNIQUE DEFAULT next_doc_number('MBR', 'seq_pos_members'),
  name_th        VARCHAR(255)  NOT NULL,
  phone          VARCHAR(20)   NOT NULL UNIQUE,
  email          VARCHAR(255),
  tier           VARCHAR(20)   NOT NULL DEFAULT 'standard',
  discount_rate  NUMERIC(5,4)  NOT NULL DEFAULT 0,
  point_balance  INTEGER       NOT NULL DEFAULT 0,
  is_active      BOOLEAN       NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pos_members_phone ON pos_members(phone);
CREATE INDEX IF NOT EXISTS idx_pos_members_number ON pos_members(member_number);

CREATE OR REPLACE TRIGGER trg_pos_members_updated_at
  BEFORE UPDATE ON pos_members
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 4. Shift table
CREATE TABLE IF NOT EXISTS pos_shifts (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  name_th     VARCHAR(100) NOT NULL,
  name_en     VARCHAR(100) NOT NULL,
  start_time  TIME         NOT NULL,
  end_time    TIME         NOT NULL,
  is_active   BOOLEAN      NOT NULL DEFAULT TRUE
);

INSERT INTO pos_shifts (name_th, name_en, start_time, end_time) VALUES
  ('กะเช้า',  'Morning',   '06:00', '14:00'),
  ('กะบ่าย', 'Afternoon', '14:00', '22:00'),
  ('กะดึก',  'Night',     '22:00', '06:00')
ON CONFLICT DO NOTHING;

-- 5. Held carts
CREATE TABLE IF NOT EXISTS pos_held_carts (
  id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  hold_number  VARCHAR(50)  NOT NULL UNIQUE DEFAULT next_doc_number('HLD', 'seq_pos_held'),
  session_id   UUID         NOT NULL REFERENCES pos_sessions(id),
  warehouse_id UUID         NOT NULL REFERENCES warehouses(id),
  note         VARCHAR(255),
  created_by   UUID         NOT NULL REFERENCES users(id),
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pos_held_carts_session ON pos_held_carts(session_id);

CREATE TABLE IF NOT EXISTS pos_held_cart_lines (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  held_cart_id    UUID          NOT NULL REFERENCES pos_held_carts(id) ON DELETE CASCADE,
  product_id      UUID          NOT NULL REFERENCES products(id),
  qty             NUMERIC(15,4) NOT NULL,
  unit_price      NUMERIC(15,2) NOT NULL,
  discount_amount NUMERIC(15,2) NOT NULL DEFAULT 0
);

-- 6. Extend pos_transactions
ALTER TABLE pos_transactions
  ADD COLUMN IF NOT EXISTS member_id       UUID          REFERENCES pos_members(id),
  ADD COLUMN IF NOT EXISTS member_discount NUMERIC(15,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS points_earned   INTEGER       NOT NULL DEFAULT 0;

-- 7. Extend pos_sessions
ALTER TABLE pos_sessions
  ADD COLUMN IF NOT EXISTS shift_id UUID REFERENCES pos_shifts(id);

-- 8. New permissions
INSERT INTO permissions (id, name_th, name_en, module, sort_order) VALUES
  ('pos:members',       'จัดการสมาชิก POS',   'Manage POS Members', 'pos', 165),
  ('pos:shift_manage',  'จัดการกะ POS',        'Manage POS Shifts',  'pos', 166)
ON CONFLICT (id) DO NOTHING;

-- Grant to admin and manager
INSERT INTO employee_role_permissions (role_id, permission_id)
  SELECT '00000000-0000-0000-0000-000000000001', id FROM permissions
  WHERE id IN ('pos:members', 'pos:shift_manage')
ON CONFLICT DO NOTHING;

INSERT INTO employee_role_permissions (role_id, permission_id)
  SELECT '00000000-0000-0000-0000-000000000002', id FROM permissions
  WHERE id IN ('pos:members', 'pos:shift_manage')
ON CONFLICT DO NOTHING;

COMMIT;
```

---

## Task 2 — API: Enhance Products Endpoint

**File:** `app/api/pos/products/route.ts`

- [x] Read current file
- [x] Add `image_url`, `reorder_point`, `p.category_id` to the SELECT list
- [x] Accept optional `category_id` query param; add `p.category_id = $N` to WHERE when present
- [x] Change default limit to `100`
- [x] Keep existing `q` + `warehouse_id` logic intact
- [x] `npm run lint` — no new errors

---

## Task 3 — API: Members Routes

**File:** `app/api/pos/members/route.ts` (new)

- [x] GET — auth check → `assertPermission(u, 'pos:cashier')` (cashiers can look up members); search by `q` (phone exact OR `name_th ILIKE '%q%'`); paginate with `DEFAULT_PAGE_SIZE`; all parameterized
- [x] POST — `assertPermission(u, 'pos:members')`; Zod: `{ name_th: z.string().min(1), phone: z.string().min(6), email: z.string().email().optional(), tier: z.string().optional(), discount_rate: z.number().min(0).max(1).optional() }`; INSERT pos_members; return 201

**File:** `app/api/pos/members/[id]/route.ts` (new)

- [x] GET — `assertPermission(u, 'pos:cashier')`; return member row
- [x] PATCH — `assertPermission(u, 'pos:members')`; accept `{ tier?, discount_rate?, is_active?, point_balance? }`; UPDATE with `updated_at = NOW()`

---

## Task 4 — API: Held Carts Routes

**File:** `app/api/pos/held-carts/route.ts` (new)

- [x] GET — `assertPermission(u, 'pos:cashier')`; require `session_id` param; return held carts with `line_count`
- [x] POST — `assertPermission(u, 'pos:cashier')`; Zod: `{ session_id, warehouse_id, note?, lines: [{ product_id, qty, unit_price, discount_amount? }] }`; transaction: INSERT held cart then INSERT lines; return 201

**File:** `app/api/pos/held-carts/[id]/route.ts` (new)

- [x] GET — return held cart + lines joined with `p.name_th`, `p.sku`, `p.image_url`; `assertPermission(u, 'pos:cashier')`
- [x] DELETE — `assertPermission(u, 'pos:cashier')`; DELETE held cart (CASCADE removes lines); return 204

---

## Task 5 — API: Shifts Routes

**File:** `app/api/pos/shifts/route.ts` (new)

- [x] GET — `assertPermission(u, 'pos:view')`; SELECT all `WHERE is_active = TRUE ORDER BY start_time`; no pagination
- [x] POST — `assertPermission(u, 'pos:shift_manage')`; Zod: `{ name_th, name_en, start_time, end_time }`; INSERT pos_shifts; return 201

**File:** `app/api/pos/sessions/route.ts` (modify)

- [x] Read current file
- [x] POST Zod schema: add `shift_id: z.string().uuid().optional()`; include in INSERT if provided
- [x] GET: LEFT JOIN `pos_shifts ps ON ps.id = s.shift_id`; return `ps.name_th AS shift_name_th`, `ps.name_en AS shift_name_en`
- [x] GET: Add `from` and `to` date range filter support

---

## Task 6b-extra — Product Categories API (if missing)

- [x] If yes, skip this task entirely
- [x] If no: create `app/api/product-categories/route.ts`
  - GET — auth required (any session); SELECT `id, code, name_th, name_en` FROM `product_categories WHERE is_active = TRUE ORDER BY code`; return array

---

## Task 6 — Terminal Page Refactor

**File:** `app/app/pos/session/[id]/page.tsx`

Read the full file before starting. This is the largest task — do NOT batch edits; make each sub-task independently verifiable.

### 6a — Fix VAT constant
- [x] Import `VAT_RATE` from `@/lib/constants`
- [x] Replace `Math.round(total * 7 / 107 * 100) / 100` with `Math.round(total * VAT_RATE / (1 + VAT_RATE) * 100) / 100`

### 6b — Product Grid with Category Tabs
- [x] On mount, fetch `GET /api/pos/products?warehouse_id=X&limit=100` → store as `allProducts`
- [x] Fetch `GET /api/product-categories` → store as `categories`
- [x] State: `selectedCategory: string | null` (null = All)
- [x] Filter client-side: `displayedProducts = selectedCategory ? allProducts.filter(p => p.category_id === selectedCategory) : allProducts`
- [x] Add search filter on top of category filter
- [x] Category tabs: "ทั้งหมด / All" + one tab per category; horizontal scrollable row
- [x] Replace current 2-col mini-grid with `grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 overflow-y-auto`
- [x] Each card: `<img src={p.image_url ?? '/placeholder-product.png'} className="w-full h-20 object-cover rounded" />`, `name_th`, `formatCurrency(selling_price)`, stock badge
- [x] Click card → `addToCart(product)`

### 6c — Low Stock Badges
- [x] Product card stock badge logic:
  - `qty_available <= 0` → `<span className="bg-red-100 text-red-600">หมด</span>` + red card border
  - `qty_available > 0 && qty_available <= reorder_point` → `<span className="bg-amber-100 text-amber-700">สต็อกต่ำ</span>` + amber card border
  - else → `<span className="bg-stone-100 text-stone-600">{qty_available}</span>`
- [x] Cart row: show `⚠` icon if `item.qty_available - item.qty <= item.reorder_point && item.qty_available > 0`

### 6d — Barcode Scanner Listener
- [x] Add `barcodeBuffer = useRef<string>('')`
- [x] Add `lastKeystrokeTime = useRef<number>(0)`
- [x] `useEffect` attaches `keydown` listener to `window`:
  ```ts
  const handler = (e: KeyboardEvent) => {
    const now = Date.now();
    const delta = now - lastKeystrokeTime.current;
    lastKeystrokeTime.current = now;
    if (e.key === 'Enter' && barcodeBuffer.current.length > 0) {
      const barcode = barcodeBuffer.current;
      barcodeBuffer.current = '';
      const match = allProducts.find(p => p.barcode === barcode);
      if (match) {
        addToCart(match);
        // flash green border on search input for 500ms
        setScannerFlash(true);
        setTimeout(() => setScannerFlash(false), 500);
      }
    } else if (delta < 50 && e.key.length === 1) {
      barcodeBuffer.current += e.key;
    } else if (e.key.length === 1) {
      barcodeBuffer.current = e.key;
    }
  };
  window.addEventListener('keydown', handler);
  return () => window.removeEventListener('keydown', handler);
  ```
- [x] Add `scannerFlash` state; apply `ring-2 ring-emerald-500` to search input when true

### 6e — Member Lookup Panel
- [x] Add `member: PosMember | null` state, `memberPhone: string` state
- [x] In payment panel: phone `<Input>` + "ค้นหา / Find" button
- [x] On search: `GET /api/pos/members?q=${memberPhone}` → show member card (name, tier, discount %)
- [x] "ล้าง / Clear" button to deselect member
- [x] "สมัครสมาชิก / Register" button → `RegisterMemberModal` (name, phone, email fields; POST `/api/pos/members`; auto-select on success)
- [x] When member selected: apply `member.discount_rate` as percentage of subtotal → `memberDiscountAmount = subtotal * member.discount_rate`
- [x] Show "แต้มที่จะได้รับ / Points: {Math.floor(totalAfterDiscount / 20)}" in totals panel
- [x] Pass `member_id` and `member_discount` in checkout POST body

### 6f — Modify Checkout API
**File:** `app/api/pos/transactions/route.ts`

- [x] Read current file
- [x] Zod schema: add `member_id: z.string().uuid().optional()`, `member_discount: z.number().min(0).default(0)`
- [x] Include `member_id`, `member_discount`, `points_earned` in INSERT statement
- [x] Points formula: `Math.floor((total - member_discount) / 20)`
- [x] After INSERT txn, inside same DB transaction: if `member_id`, UPDATE `pos_members SET point_balance = point_balance + $N, updated_at = NOW() WHERE id = $M`
- [x] `npm run lint`

### 6g — Hold Bill UI
- [x] `heldCarts: PosHeldCart[]` state; fetch `GET /api/pos/held-carts?session_id=X` on mount and after each hold/resume
- [x] "พักบิล / Hold Bill" button in cart header (disabled when cart empty)
- [x] Click → `HoldNoteModal`: single note `<Input>`, confirm → POST `/api/pos/held-carts`; clear cart state; refresh held cart list
- [x] "บิลที่พัก / Held Bills ({count})" button → `HeldBillsModal`: list held carts with `hold_number`, item count, note; "Resume" button → GET `/api/pos/held-carts/${id}` → map lines to CartItem, set cart, DELETE held cart; "Discard" button → DELETE held cart

### 6h — Transaction History Tab
- [x] Tab strip above product area: "สินค้า / Products" | "ประวัติ / History" + "พักบิล / Held ({n})"
- [x] History tab: display `sessionData.transactions` (fetched from GET `/api/pos/sessions/${id}`); auto-refresh every 30s via `setInterval`; clear interval on tab switch or unmount
- [x] Each row: receipt number, time (formatDatetime), payment method, total (formatCurrency), StatusBadge
- [x] Click row → toggle expanded inline lines
- [x] Void button (visible only when `u.role === 'manager' || u.role === 'admin'`): PATCH `/api/pos/transactions/${id}` `{ action: 'void', void_reason }`

### 6i — Shift in Status Bar
- [x] If `session.shift_name_th` exists, show between cashier and close button in top status bar

---

## Task 7 — Members List Page

**File:** `app/app/pos/members/page.tsx` (new)

- [x] `'use client'`
- [x] Fetch session; if no `pos:members` permission, show "ไม่มีสิทธิ์ / Forbidden" 
- [x] Search bar → `GET /api/pos/members?q=` debounced 300ms
- [x] Table: Member No, Name TH, Phone, Tier, Discount %, Points, Status, Actions
- [x] StatusBadge: active → green, inactive → gray
- [x] "สมัครสมาชิก / Register" button → modal (name_th, phone, email)
- [x] Inline edit: click tier/discount → inline input; PATCH on blur
- [x] Pagination with `DEFAULT_PAGE_SIZE`

---

## Task 8 — Shift Report Page

**File:** `app/app/pos/shifts/page.tsx` (new)

- [x] `'use client'`
- [x] Require `pos:view` permission
- [x] Date range filter (from/to inputs); default today
- [x] Fetch `GET /api/pos/sessions?from=&to=` (need to verify sessions API supports date filter; if not, filter client-side)
- [x] Group sessions by `shift_name_th` (use `reduce`); sessions with no shift → group "ไม่ระบุกะ / No Shift"
- [x] Per group: cashier names, total transactions, total sales
- [x] Per session row: session number, cashier, opened_at, closed_at, transaction_count, total_sales

---

## Task 9 — Session Pages: Show Shift

**File:** `app/app/pos/sessions/[id]/page.tsx`

- [x] Read current file
- [x] Add "กะ / Shift: {shift_name_th}" row in session info card (only if `shift_id` not null)

**File:** `app/app/pos/page.tsx`

- [x] Read current file
- [x] Fetch `GET /api/pos/shifts` on modal open
- [x] Add optional `<Select>` for shift in open-session modal
- [x] Pass `shift_id` in POST body if selected

---

## Task 10 — Sidebar Update

**File:** `components/layout/Sidebar.tsx`

- [x] Read current file
- [x] Add "สมาชิก / Members" nav item under POS group → `/app/pos/members`; restrict to `pos:members`
- [x] Add "รายงานกะ / Shift Report" nav item under POS group → `/app/pos/shifts`; restrict to `pos:view`

---

## Task 11 — Types

**File:** `types/index.ts`

- [x] Read current file
- [x] Add `PosShift`: `{ id: string; name_th: string; name_en: string; start_time: string; end_time: string; is_active: boolean }`
- [x] Add `PosMember`: `{ id: string; member_number: string; name_th: string; phone: string; email: string | null; tier: string; discount_rate: number; point_balance: number; is_active: boolean; created_at: string; updated_at: string }`
- [x] Add `PosHeldCart`: `{ id: string; hold_number: string; session_id: string; warehouse_id: string; note: string | null; created_by: string; created_at: string }`
- [x] Add `PosHeldCartLine`: `{ id: string; held_cart_id: string; product_id: string; qty: number; unit_price: number; discount_amount: number; name_th?: string; sku?: string }`
- [x] Extend `PosProduct` (or equivalent type): add `image_url: string | null`, `reorder_point: number`, `category_id: string | null`
- [x] Extend `PosTransaction`: add `member_id: string | null`, `member_discount: number`, `points_earned: number`
- [x] Extend `PosSession`: add `shift_id: string | null`, `shift_name_th: string | null`, `shift_name_en: string | null`

---

## Constraints

- All SQL: parameterized queries (`$1`, `$2`, …) — no string interpolation
- `stock_ledger` insert-only — held carts do NOT write ledger entries (pre-transaction state)
- `next_doc_number` called in DEFAULT clause only — application code never generates doc numbers
- Points update + transaction INSERT must be inside the same `pool.connect()` transaction block
- `image_url` may be null — always render fallback `<img src="/placeholder-product.png" />`
- Auth on every API route: auth() → cast SessionUser → assertPermission
- No `any` types

---

## QA Checklist (Billy)

### Migration
- [ ] `027_pos_improvements.sql` exists; all `IF NOT EXISTS` guards present
- [ ] `pos_members.phone` UNIQUE constraint
- [ ] `pos_held_cart_lines` cascades on `pos_held_carts` delete
- [ ] `pos_transactions.member_discount` has DEFAULT 0
- [ ] `pos_sessions.shift_id` nullable FK to `pos_shifts`

### Members API
- [ ] `GET /api/pos/members?q=0812345678` returns matching member
- [ ] `POST /api/pos/members` missing `name_th` → 400
- [ ] `POST /api/pos/members` duplicate phone → error surfaced (409 or 500 with message)
- [ ] `PATCH /api/pos/members/[id]` updates `updated_at`

### Transactions API
- [ ] `POST /api/pos/transactions` with `member_id` updates `pos_members.point_balance`
- [ ] Points: 500 THB order → 25 points (`floor(500/20)`)
- [ ] Stock ledger entry created correctly when `member_id` present

### Held Carts API
- [ ] POST creates cart + lines atomically
- [ ] DELETE removes cart and lines
- [ ] GET returns only carts for given `session_id`

### Shifts API
- [ ] GET returns only `is_active = TRUE` shifts
- [ ] Session POST with `shift_id` stores correctly
- [ ] Session GET returns `shift_name_th` via JOIN

### Terminal Page
- [ ] No hardcoded `7/107` VAT — uses `VAT_RATE`
- [ ] Product grid: 5 columns on large screens
- [ ] Category tab filters correctly
- [ ] Stock badge: `qty_available=0` → red "หมด"
- [ ] Stock badge: `qty_available=5, reorder_point=10` → amber "สต็อกต่ำ"
- [ ] Barcode scanner: rapid keystrokes (<50ms) → auto-add product
- [ ] Human typing: slow keystrokes (>100ms) → no barcode trigger
- [ ] Hold Bill: hold 2 items → clear → resume → cart restored → held cart deleted
- [ ] Member discount: 5% on 1000 THB → 950 THB total
- [ ] History tab: `setInterval` cleanup on unmount (no memory leak)
- [ ] Void button: visible only for manager/admin

### Members Page
- [ ] Search debounce 300ms
- [ ] Register modal clears fields after success

### Shifts Page
- [ ] Sessions with no shift → "ไม่ระบุกะ / No Shift" group

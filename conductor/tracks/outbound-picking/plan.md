---
track: outbound-picking
status: Verified
aliases: ["Outbound Picking"]
owner: paku, puka
module: WMS
updated: 2026-05-16
---

# Track: Outbound Picking

**Status:** Completed
**Created:** 2026-05-14
**Migration file:** `migrations/028_outbound_picking.sql`

---

## Overview

Add full outbound picking and shipment workflow to the existing WMS (currently inbound-only).

**Flow:** (Sales Order →) Pick List → Pick Confirmation → Shipment

**State machines:**
- Pick List: `draft` → `open` → `picking` → `completed` → `cancelled`
- Pick List Line: `pending` → `picked` → `short_picked`
- Shipment: `pending` → `shipped` → `delivered`

**Stock mechanics:**
- Pick list → `open`: explicitly UPDATE `qty_reserved += qty_requested` per line in app-layer transaction
- Shipment created: INSERT `stock_ledger` rows (`pick_dispatch`, negative qty_change) → existing trigger `sync_stock_balances` decrements `qty_on_hand`; app also manually decrements `qty_reserved` in same transaction

---

## ⚠️ Critical Implementation Notes (Read Before Coding)

1. **`stock_ledger.qty_after` is NOT NULL** — every INSERT to `stock_ledger` MUST include `qty_after`. Before inserting a `pick_dispatch` row, fetch `qty_on_hand` from `stock_balances` inside the same transaction, then compute:
   ```
   qty_after = current_qty_on_hand + qty_change   (qty_change is negative, e.g. -5.0)
   ```
   Skipping this causes a NOT NULL violation at runtime.

2. **`qty_reserved` is NOT managed by the trigger** — `sync_stock_balances` only updates `qty_on_hand`. The application must explicitly `UPDATE stock_balances SET qty_reserved = ...` in every transaction that reserves or releases stock. `qty_available` (generated: `qty_on_hand - qty_reserved`) updates automatically.

3. **Concurrent `open` guard** — use `UPDATE pick_lists ... WHERE id = $1 AND status = 'draft' RETURNING id`. If `rowCount === 0`, another process already opened it — ROLLBACK and return 409. Do NOT check status before the UPDATE; check it via rowCount after.

4. **Migration number** — highest existing is `027_grn_receiving_workflow.sql`. This file is `028_outbound_picking.sql`.

---

## Verified Schema Facts (from migrations)

**`stock_ledger` columns** (verified from `migrations/004_inventory.sql`):
- `id BIGSERIAL PRIMARY KEY`
- `warehouse_id UUID NOT NULL`
- `product_id UUID NOT NULL`
- `lot_id UUID` (nullable)
- `entry_type ledger_entry_type NOT NULL`
- `reference_type VARCHAR(50)` (nullable)
- `reference_id UUID` (nullable)
- `qty_change NUMERIC(15,4) NOT NULL`
- `qty_after NUMERIC(15,4) NOT NULL` ← **REQUIRED — must compute before INSERT**
- `unit_cost NUMERIC(15,2)` (nullable)
- `notes TEXT`
- `created_by UUID`
- `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`

**`ledger_entry_type` enum values** (from `migrations/001_enums.sql`):
`grn_receipt`, `grn_qc_reject`, `rma_return`, `rma_vendor_return`, `transfer_out`, `transfer_in`, `cycle_count_adjustment`, `po_reversal`, `manual_adjustment`
→ Need to ADD: `pick_dispatch`

**`set_updated_at()` trigger function**: EXISTS (defined in `002_core_tables.sql`). Attach with `EXECUTE FUNCTION set_updated_at()`.

**`sales_orders` table**: EXISTS (defined in `017_sales.sql`). Safe to FK against.

**`next_doc_number(prefix, seq_name)` function**: EXISTS. Used by all document tables.

**Highest existing migration**: `027_grn_receiving_workflow.sql` → next is `028`.

---

## Assumptions

1. `qty_reserved` in `stock_balances` is a plain column, NOT a generated column. The `sync_stock_balances` trigger only manages `qty_on_hand`. Reservations are managed via explicit UPDATEs in application-layer transactions.
2. `qty_available` in `stock_balances` IS a generated column: `qty_on_hand - qty_reserved`. Do not UPDATE it directly.
3. Pick lists can be created without a Sales Order (`sales_order_id` nullable).
4. Short-picking (qty_picked < qty_requested) is allowed — staff records what was actually found.

---

## Risks

- **R1 — Enum irreversibility:** `pick_dispatch` cannot be removed from `ledger_entry_type` after adding. Confirm name before running migration.
- **R2 — qty_after required:** Every `stock_ledger` INSERT must include `qty_after`. Must fetch current `qty_on_hand` from `stock_balances` inside the transaction before inserting. Failure to do this causes NOT NULL violation.
- **R3 — qty_reserved race condition:** Two concurrent `open` actions on the same pick list could both pass the stock check then both reserve, double-reserving stock. Mitigation: use `UPDATE ... WHERE status = 'draft'` (conditional) and check `rowCount === 1` before proceeding with reservation.
- **Scope guard:** This plan does NOT modify GRN, Transfer, or Sales module code. New tables, routes, and pages only.

---

## Tasks

### Task 1 — Migration: `migrations/028_outbound_picking.sql`

- [x] 1.1 Add `pick_dispatch` to `ledger_entry_type` enum:
  ```sql
  ALTER TYPE ledger_entry_type ADD VALUE IF NOT EXISTS 'pick_dispatch';
  ```

- [x] 1.2 Create sequences:
  ```sql
  CREATE SEQUENCE IF NOT EXISTS seq_pick START 1;
  CREATE SEQUENCE IF NOT EXISTS seq_ship START 1;
  ```

- [x] 1.3 Create enums:
  ```sql
  DO $$ BEGIN
    CREATE TYPE pick_list_status AS ENUM ('draft', 'open', 'picking', 'completed', 'cancelled');
  EXCEPTION WHEN duplicate_object THEN NULL; END $$;

  DO $$ BEGIN
    CREATE TYPE pick_line_status AS ENUM ('pending', 'picked', 'short_picked');
  EXCEPTION WHEN duplicate_object THEN NULL; END $$;

  DO $$ BEGIN
    CREATE TYPE shipment_status AS ENUM ('pending', 'shipped', 'delivered');
  EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  ```

- [x] 1.4 Create `pick_lists` table:
  ```sql
  CREATE TABLE IF NOT EXISTS pick_lists (
    id              UUID              PRIMARY KEY DEFAULT gen_random_uuid(),
    pick_number     TEXT              NOT NULL UNIQUE DEFAULT next_doc_number('PL', 'seq_pick'),
    sales_order_id  UUID              REFERENCES sales_orders(id) ON DELETE SET NULL,
    warehouse_id    UUID              NOT NULL REFERENCES warehouses(id),
    status          pick_list_status  NOT NULL DEFAULT 'draft',
    assigned_to     UUID              REFERENCES users(id),
    created_by      UUID              NOT NULL REFERENCES users(id),
    notes           TEXT,
    created_at      TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ       NOT NULL DEFAULT NOW()
  );

  CREATE OR REPLACE TRIGGER trg_pick_lists_updated_at
    BEFORE UPDATE ON pick_lists
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  ```

- [x] 1.5 Create `pick_list_lines` table:
  ```sql
  CREATE TABLE IF NOT EXISTS pick_list_lines (
    id               UUID             PRIMARY KEY DEFAULT gen_random_uuid(),
    pick_list_id     UUID             NOT NULL REFERENCES pick_lists(id) ON DELETE CASCADE,
    product_id       UUID             NOT NULL REFERENCES products(id),
    qty_requested    NUMERIC(12,4)    NOT NULL CHECK (qty_requested > 0),
    qty_picked       NUMERIC(12,4)    NOT NULL DEFAULT 0 CHECK (qty_picked >= 0),
    storage_location TEXT,
    status           pick_line_status NOT NULL DEFAULT 'pending',
    created_at       TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ      NOT NULL DEFAULT NOW()
  );

  CREATE OR REPLACE TRIGGER trg_pick_list_lines_updated_at
    BEFORE UPDATE ON pick_list_lines
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  ```

- [x] 1.6 Create `shipments` table:
  ```sql
  CREATE TABLE IF NOT EXISTS shipments (
    id               UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    shipment_number  TEXT            NOT NULL UNIQUE DEFAULT next_doc_number('SH', 'seq_ship'),
    pick_list_id     UUID            NOT NULL REFERENCES pick_lists(id),
    warehouse_id     UUID            NOT NULL REFERENCES warehouses(id),
    shipped_by       UUID            REFERENCES users(id),
    ship_date        DATE,
    carrier          TEXT,
    tracking_number  TEXT,
    notes            TEXT,
    status           shipment_status NOT NULL DEFAULT 'pending',
    created_at       TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ     NOT NULL DEFAULT NOW()
  );

  CREATE OR REPLACE TRIGGER trg_shipments_updated_at
    BEFORE UPDATE ON shipments
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  ```

- [x] 1.7 Create indexes:
  ```sql
  CREATE INDEX IF NOT EXISTS idx_pick_lists_warehouse   ON pick_lists(warehouse_id);
  CREATE INDEX IF NOT EXISTS idx_pick_lists_status      ON pick_lists(status);
  CREATE INDEX IF NOT EXISTS idx_pick_lists_assigned    ON pick_lists(assigned_to) WHERE assigned_to IS NOT NULL;
  CREATE INDEX IF NOT EXISTS idx_pick_list_lines_list   ON pick_list_lines(pick_list_id);
  CREATE INDEX IF NOT EXISTS idx_pick_list_lines_product ON pick_list_lines(product_id);
  CREATE INDEX IF NOT EXISTS idx_shipments_warehouse    ON shipments(warehouse_id);
  CREATE INDEX IF NOT EXISTS idx_shipments_pick_list    ON shipments(pick_list_id);
  ```

---

### Task 2 — Types: `types/index.ts`

Append to the file. Do NOT rewrite the file — use Edit to append after the last export.

- [x] 2.1 Add:
  ```typescript
  export type PickListStatus = 'draft' | 'open' | 'picking' | 'completed' | 'cancelled';
  export type PickLineStatus = 'pending' | 'picked' | 'short_picked';
  export type ShipmentStatus = 'pending' | 'shipped' | 'delivered';

  export interface PickList {
    id: string;
    pick_number: string;
    sales_order_id: string | null;
    so_number?: string | null;
    warehouse_id: string;
    warehouse_name?: string;
    status: PickListStatus;
    assigned_to: string | null;
    assigned_to_name?: string | null;
    created_by: string;
    created_by_name?: string;
    notes: string | null;
    created_at: string;
    updated_at: string;
    lines?: PickListLine[];
  }

  export interface PickListLine {
    id: string;
    pick_list_id: string;
    product_id: string;
    product_name?: string;
    product_sku?: string;
    qty_requested: number;
    qty_picked: number;
    storage_location: string | null;
    status: PickLineStatus;
    qty_available?: number;
    qty_on_hand?: number;
    created_at: string;
    updated_at: string;
  }

  export interface Shipment {
    id: string;
    shipment_number: string;
    pick_list_id: string;
    pick_number?: string;
    warehouse_id: string;
    warehouse_name?: string;
    shipped_by: string | null;
    shipped_by_name?: string | null;
    ship_date: string | null;
    carrier: string | null;
    tracking_number: string | null;
    notes: string | null;
    status: ShipmentStatus;
    created_at: string;
    updated_at: string;
    lines?: PickListLine[];
  }
  ```

---

### Task 3 — API: `app/api/pick-lists/route.ts`

Follow the pattern of `app/api/grn/route.ts` exactly.

- [x] 3.1 `GET /api/pick-lists`:
  - Auth → `SessionUser` cast
  - Query params: `page` (default 1), `limit` (default 20 max 100), `status`, `assigned_to`
  - Apply `buildWarehouseScopeClause(u, 'pl.warehouse_id', idx)`
  - SQL:
    ```sql
    SELECT pl.*,
           w.name_th AS warehouse_name,
           assigned.name_th AS assigned_to_name,
           creator.name_th AS created_by_name,
           so.so_number
    FROM pick_lists pl
    JOIN warehouses w ON w.id = pl.warehouse_id
    LEFT JOIN users assigned ON assigned.id = pl.assigned_to
    JOIN users creator ON creator.id = pl.created_by
    LEFT JOIN sales_orders so ON so.id = pl.sales_order_id
    WHERE ...
    ORDER BY pl.created_at DESC
    LIMIT $N OFFSET $M
    ```
  - Return `apiSuccess({ data: rows, total, page, limit, total_pages })`

- [x] 3.2 `POST /api/pick-lists`:
  - `assertRole(u, ['manager', 'admin'])`
  - Zod schema:
    ```typescript
    z.object({
      warehouse_id: z.string().uuid(),
      sales_order_id: z.string().uuid().optional(),
      notes: z.string().optional(),
      lines: z.array(z.object({
        product_id: z.string().uuid(),
        qty_requested: z.number().positive(),
        storage_location: z.string().optional(),
      })).min(1),
    })
    ```
  - `pool.connect()` transaction:
    1. INSERT into `pick_lists` RETURNING `id, pick_number`
    2. INSERT each line into `pick_list_lines` (one INSERT per line)
  - Return `apiSuccess({ id, pick_number }, 201)`

---

### Task 4 — API: `app/api/pick-lists/[id]/route.ts`

- [x] 4.1 `GET /api/pick-lists/[id]`:
  - Fetch pick list with same JOINs as list
  - Fetch lines in separate query:
    ```sql
    SELECT pll.*,
           p.name_th AS product_name, p.sku AS product_sku,
           COALESCE(sb.qty_on_hand, 0) AS qty_on_hand,
           COALESCE(sb.qty_available, 0) AS qty_available
    FROM pick_list_lines pll
    JOIN products p ON p.id = pll.product_id
    LEFT JOIN stock_balances sb ON sb.product_id = pll.product_id
      AND sb.warehouse_id = $warehouse_id
    WHERE pll.pick_list_id = $pick_list_id
    ORDER BY pll.created_at
    ```
  - Return `apiSuccess({ ...pickList, lines })`
  - Return 404 if not found

- [x] 4.2 `PATCH /api/pick-lists/[id]` — actions via `body.action` discriminant:

  Use `z.discriminatedUnion('action', [...])` pattern.

  **Action `open`:**
  - `assertRole(u, ['manager', 'admin'])`
  - Fetch pick list; guard: `status === 'draft'` else 422
  - Fetch all lines; guard: `lines.length > 0` else 422
  - Stock availability check (single query):
    ```sql
    SELECT pll.id, pll.product_id, pll.qty_requested,
           COALESCE(sb.qty_available, 0) AS qty_available,
           p.name_th AS product_name
    FROM pick_list_lines pll
    JOIN products p ON p.id = pll.product_id
    LEFT JOIN stock_balances sb ON sb.product_id = pll.product_id
      AND sb.warehouse_id = $warehouse_id
    WHERE pll.pick_list_id = $pick_list_id
    ```
    Collect `shortages` where `qty_available < qty_requested`. If any: return `apiError` with details.
  - `pool.connect()` transaction:
    1. `UPDATE pick_lists SET status = 'open', updated_at = NOW() WHERE id = $1 AND status = 'draft' RETURNING id` — if `rowCount === 0`, ROLLBACK and return 409 (concurrent open)
    2. For each line: `UPDATE stock_balances SET qty_reserved = qty_reserved + $qty WHERE product_id = $pid AND warehouse_id = $wid`
       - If no row exists in stock_balances: INSERT with qty_on_hand=0, qty_reserved=$qty
  - Return `apiSuccess({ status: 'open' })`

  **Action `assign`:**
  - `assertRole(u, ['manager', 'admin'])`
  - Zod: `{ action: 'assign', assigned_to: z.string().uuid() }`
  - Guard: `status === 'open'` else 422
  - `UPDATE pick_lists SET assigned_to = $1, status = 'picking', updated_at = NOW() WHERE id = $2 AND status = 'open'`
  - Return `apiSuccess({ status: 'picking' })`

  **Action `complete`:**
  - Allow if `manager`/`admin` OR `u.id === pick_list.assigned_to`; else 403
  - Guard: `status === 'picking'` else 422
  - Fetch lines — guard: at least one line with `qty_picked > 0` else 422 ('No items have been picked')
  - `pool.connect()` transaction:
    1. For each line: `UPDATE pick_list_lines SET status = CASE WHEN qty_picked >= qty_requested THEN 'picked' ELSE 'short_picked' END WHERE id = $1`
    2. `UPDATE pick_lists SET status = 'completed', updated_at = NOW() WHERE id = $1 AND status = 'picking'`
  - Return `apiSuccess({ status: 'completed' })`

  **Action `cancel`:**
  - `assertRole(u, ['manager', 'admin'])`
  - Guard: `status IN ('draft', 'open')` else 422
  - `pool.connect()` transaction:
    1. If `status === 'open'`: for each line, release reservation:
       `UPDATE stock_balances SET qty_reserved = GREATEST(qty_reserved - $qty, 0) WHERE product_id = $pid AND warehouse_id = $wid`
    2. `UPDATE pick_lists SET status = 'cancelled', updated_at = NOW() WHERE id = $1`
  - Return `apiSuccess({ status: 'cancelled' })`

---

### Task 5 — API: `app/api/pick-lists/[id]/lines/route.ts`

- [x] 5.1 `GET /api/pick-lists/[id]/lines`:
  - Auth: any authenticated role
  - Same query as task 4.1 lines fetch
  - Return `apiSuccess(lines)`

- [x] 5.2 `POST /api/pick-lists/[id]/lines`:
  - `assertRole(u, ['manager', 'admin'])`
  - Fetch pick list; guard: `status === 'draft'` else 422
  - Zod: `{ product_id: z.string().uuid(), qty_requested: z.number().positive(), storage_location: z.string().optional() }`
  - INSERT into `pick_list_lines` RETURNING `*`
  - Return `apiSuccess(newLine, 201)`

---

### Task 6 — API: `app/api/pick-lists/[id]/lines/[lineId]/route.ts`

- [x] 6.1 `PATCH /api/pick-lists/[id]/lines/[lineId]`:
  - Fetch pick list; authorize: `manager`/`admin` OR `u.id === pick_list.assigned_to`; else 403
  - Guard: `pick_list.status === 'picking'` else 422
  - Zod: `{ qty_picked: z.number().min(0).optional(), storage_location: z.string().optional() }`
  - Fetch line to get `qty_requested`
  - If `qty_picked > qty_requested`: return `apiError('qty_picked cannot exceed qty_requested', 422)`
  - `UPDATE pick_list_lines SET qty_picked = $1, storage_location = $2, updated_at = NOW() WHERE id = $3 AND pick_list_id = $4` RETURNING `*`
  - Return `apiSuccess(updatedLine)`

- [x] 6.2 `DELETE /api/pick-lists/[id]/lines/[lineId]`:
  - `assertRole(u, ['manager', 'admin'])`
  - Fetch pick list; guard: `status === 'draft'` else 422
  - `DELETE FROM pick_list_lines WHERE id = $1 AND pick_list_id = $2`
  - Return `apiSuccess({ deleted: true })`

---

### Task 7 — API: `app/api/shipments/route.ts`

- [x] 7.1 `GET /api/shipments`:
  - Apply `buildWarehouseScopeClause(u, 's.warehouse_id', idx)`
  - JOINs: `pick_lists pl`, `warehouses w`, `LEFT JOIN users shipper ON shipper.id = s.shipped_by`
  - Query params: `page`, `limit`, `status`
  - Return `apiSuccess({ data, total, page, limit, total_pages })`

- [x] 7.2 `POST /api/shipments`:
  - `assertRole(u, ['manager', 'admin'])`
  - Zod:
    ```typescript
    z.object({
      pick_list_id: z.string().uuid(),
      ship_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      carrier: z.string().optional(),
      tracking_number: z.string().optional(),
      notes: z.string().optional(),
    })
    ```
  - Fetch pick list; guard: `status === 'completed'` else 422
  - Check no duplicate: `SELECT id FROM shipments WHERE pick_list_id = $1`; if found return 409
  - Fetch lines with `qty_picked > 0`
  - `pool.connect()` transaction:
    1. INSERT into `shipments` RETURNING `id, shipment_number`
    2. For each line where `qty_picked > 0`:
       - Fetch current `qty_on_hand` from `stock_balances`:
         ```sql
         SELECT COALESCE(qty_on_hand, 0) AS qty_on_hand
         FROM stock_balances
         WHERE product_id = $1 AND warehouse_id = $2
         ```
       - INSERT into `stock_ledger`:
         ```sql
         INSERT INTO stock_ledger
           (warehouse_id, product_id, entry_type, reference_type, reference_id,
            qty_change, qty_after, notes, created_by)
         VALUES
           ($warehouse_id, $product_id, 'pick_dispatch', 'shipment', $shipment_id,
            $qty_change, $qty_after, $notes, $user_id)
         ```
         where `qty_change = -qty_picked` (negative), `qty_after = current_qty_on_hand + qty_change`
         (The trigger `sync_stock_balances` will then UPDATE `stock_balances.qty_on_hand`)
    3. For each line, release reservation:
       ```sql
       UPDATE stock_balances
       SET qty_reserved = GREATEST(qty_reserved - $qty_requested, 0)
       WHERE product_id = $pid AND warehouse_id = $wid
       ```
    4. `UPDATE shipments SET status = 'shipped', shipped_by = $user_id WHERE id = $shipment_id`
  - Return `apiSuccess({ id, shipment_number }, 201)`

---

### Task 8 — API: `app/api/shipments/[id]/route.ts`

- [x] 8.1 `GET /api/shipments/[id]`:
  - Fetch shipment with JOINs (pick_lists, warehouses, users shipped_by)
  - Fetch pick list lines with product details
  - Return 404 if not found
  - Return `apiSuccess({ ...shipment, lines })`

- [x] 8.2 `PATCH /api/shipments/[id]`:
  - `assertRole(u, ['manager', 'admin'])`
  - Zod: `{ action: z.literal('deliver') }`
  - Guard: `status === 'shipped'` else 422
  - `UPDATE shipments SET status = 'delivered', updated_at = NOW() WHERE id = $1 AND status = 'shipped'`
  - Return `apiSuccess({ status: 'delivered' })`

---
### Task 9 — Page: `app/app/picking/page.tsx`

`'use client'` — follow existing list page patterns (e.g., `app/app/grn/page.tsx`).

- [x] 9.1 Pick list queue:
...

  - `useSession()` to get user role and id
  - For `staff` role: auto-append `assigned_to={session.user.id}` to fetch query
  - Table columns: Pick #, SO #, Warehouse, Assigned To, Status (`StatusBadge`), Created At, View link
  - Status badge colors: `draft`=gray, `open`=blue, `picking`=amber, `completed`=green, `cancelled`=red
  - Filter bar: status `Select`; warehouse `Select` (admin/manager only)
  - \"New Pick List\" button → `/app/picking/new` (visible: `manager`/`admin` only, checked via `session.user.role`)
  - `Pagination` component
  - Row/button → navigate to `/app/picking/[id]`

---
### Task 10 — Page: `app/app/picking/new/page.tsx`

`'use client'`

- [x] 10.1 Create pick list form:
...

  - On mount: check role — `staff` → redirect to `/app/picking`
  - Fetch `GET /api/admin/warehouses` for warehouse select options (check if admin-restricted first; if so, use the GRN new page approach which calls the same endpoint via `get('/api/admin/warehouses')`)
  - Fields:
    - Warehouse `Select` (required)
    - Notes `Input`
  - Product search + lines section (same pattern as `app/app/inbound-orders/new/page.tsx`):
    - `const searchTimers = useRef<Map<number, NodeJS.Timeout>>(new Map())`
    - Type to search → debounced 300ms `GET /api/products?q=X&limit=10`
    - Per line: product label, qty_requested (number input), storage_location (text input optional)
    - Show `qty_available` from stock for the selected warehouse (fetch via separate API call when product + warehouse are both set)
    - Add/Remove line buttons
  - Submit → `POST /api/pick-lists` → navigate to `/app/picking/[id]`
  - Disable submit until: warehouse selected, at least 1 line with product + qty > 0

---

### Task 11 — Page: `app/app/picking/[id]/page.tsx`

`'use client'`

- [x] 11.1 Pick list work card:
  - Fetch `GET /api/pick-lists/[id]` on mount + after each action
  - Header: pick_number, SO link (if any), status badge, warehouse, assigned_to, created_by, notes
  - **Actions (role + status gated):**

    | Status | Allowed role | Button | API call |
    |---|---|---|---|
    | `draft` | manager/admin | \"Open Pick List\" | `PATCH { action: 'open' }` |
    | `open` | manager/admin | \"Assign Picker\" | opens modal → `PATCH { action: 'assign', assigned_to }` |
    | `picking` | manager/admin OR assigned staff | \"Confirm Complete\" | `PATCH { action: 'complete' }` |
    | `completed` | manager/admin | \"Create Shipment\" | opens modal → `POST /api/shipments` |
    | `draft` or `open` | manager/admin | \"Cancel\" | `PATCH { action: 'cancel' }` |

  - **Lines table:**
    - When `status === 'picking'` AND user is authorized: `qty_picked` column = `<input type="number" min="0">`, `storage_location` = `<input type="text">`
    - On input blur: `PATCH /api/pick-lists/[id]/lines/[lineId] { qty_picked, storage_location }`
    - Visual indicators: amber warn if `qty_picked < qty_requested`; green if `qty_picked >= qty_requested`
    - Otherwise: read-only display

  - **Assign modal:** `Select` of users from `GET /api/admin/users?role=staff` → `PATCH { action: 'assign', assigned_to }`
  - **Create Shipment modal:** carrier, tracking_number, ship_date fields → `POST /api/shipments { pick_list_id, ... }` → on success navigate to `/app/shipments/[id]`

---

### Task 12 — Page: `app/app/shipments/page.tsx`

`'use client'`

- [x] 12.1 Shipment list:
  - Fetch `GET /api/shipments`
  - Table: Shipment #, Pick List #, Warehouse, Ship Date, Carrier, Tracking #, Status badge, View
  - Filter: status `Select`
  - `Pagination`
  - Row/button → `/app/shipments/[id]`

---

### Task 13 — Page: `app/app/shipments/[id]/page.tsx`

`'use client'`

- [x] 13.1 Shipment detail:
  - Fetch `GET /api/shipments/[id]`
  - Header: shipment_number, status badge, link to pick list (`/app/picking/[pick_list_id]`), warehouse, ship_date, carrier, tracking_number, shipped_by, notes
  - Lines table (read-only): Product SKU, Product Name, Qty Dispatched (`= qty_picked`), Storage Location
  - \"Mark Delivered\" button: visible if `status === 'shipped'` AND `role` is `manager`/`admin` → `PATCH { action: 'deliver' }` → refetch

---

### Task 14 — Sidebar: `components/layout/Sidebar.tsx`

- [x] 14.1 Read the file first to identify:
  - The exact structure of `navItems` entries (property names: `section`/`title`, `items`/`children`, `label`, `href`, `icon`, `roles`)
  - Which icons are already imported from `lucide-react`
  - Where to insert the new section (after WMS inbound section)

- [x] 14.2 Add `ClipboardList` and `Truck` to the `lucide-react` import if not already present

- [x] 14.3 Add new section to `navItems` matching the exact shape of existing entries:
  - Section title: `'การหยิบสินค้า / Picking'`
  - Items:
    - Label: `'รายการหยิบสินค้า / Pick Lists'`, href: `/app/picking`, icon: `ClipboardList`, roles: `['admin', 'manager', 'staff']`
    - Label: `'การจัดส่ง / Shipments'`, href: `/app/shipments`, icon: `Truck`, roles: `['admin', 'manager', 'staff']`

---

## QA Checklist (for Billy post-implementation)

### Migration
- [ ] `npm run migrate` completes without error
- [ ] `pick_dispatch` in enum: `SELECT enum_range(NULL::ledger_entry_type)` includes it
- [ ] `seq_pick`, `seq_ship` sequences exist
- [ ] `pick_number` auto-generates as `PL-YYYYMMDD-0001` on INSERT
- [ ] `shipment_number` auto-generates as `SH-YYYYMMDD-0001` on INSERT

### Stock Reservation (Critical)
- [ ] Opening pick list with insufficient `qty_available` → HTTP 422 with `details` array naming the product
- [ ] After opening: `stock_balances.qty_reserved` incremented by `qty_requested` per line
- [ ] `qty_available` decreased accordingly (generated column, auto-updated)
- [ ] Cancelling `open` pick list: `qty_reserved` returns to pre-open value
- [ ] Concurrent open: second `PATCH { action: 'open' }` returns 409 (rowCount guard)

### Stock Dispatch (Critical)
- [ ] After `POST /api/shipments`:
  - `stock_ledger` has `pick_dispatch` row per line with `qty_change < 0`
  - `qty_after` in ledger row matches `qty_on_hand` after dispatch
  - `stock_balances.qty_on_hand` decremented by `qty_picked`
  - `stock_balances.qty_reserved` decremented by `qty_requested` (reservation released)
  - `reference_type = 'shipment'`, `reference_id = shipment.id`
- [ ] Second `POST /api/shipments` for same pick_list_id → 409

### Business Rules
- [ ] `staff` sees only assigned pick lists on list page
- [ ] `staff` cannot `POST /api/pick-lists` → 403
- [ ] `staff` can PATCH lines on their own assigned pick list (status=picking)
- [ ] `staff` cannot PATCH lines on pick list not assigned to them → 403
- [ ] `qty_picked > qty_requested` on line PATCH → 422
- [ ] Shipment from non-completed pick list → 422
- [ ] Short-picked lines get `status = 'short_picked'`; fully-picked get `status = 'picked'`
- [ ] All-zero qty_picked pick list cannot be completed → 422

### UI
- [ ] Status badges correct colors per state machine
- [ ] \"New Pick List\" button hidden for `staff`
- [ ] Action buttons appear/disappear per status+role matrix
- [ ] Qty_picked input inactive when status != `picking`
- [ ] Line PATCH fires on blur without full page reload
- [ ] Pagination works on both list pages
- [ ] Sidebar shows \"การหยิบสินค้า / Picking\" group with 2 links

---

## File Summary

| File | Action |
|---|---|
| `migrations/028_outbound_picking.sql` | CREATE |
| `types/index.ts` | MODIFY — append 3 types + 3 interfaces |
| `app/api/pick-lists/route.ts` | CREATE |
| `app/api/pick-lists/[id]/route.ts` | CREATE |
| `app/api/pick-lists/[id]/lines/route.ts` | CREATE |
| `app/api/pick-lists/[id]/lines/[lineId]/route.ts` | CREATE |
| `app/api/shipments/route.ts` | CREATE |
| `app/api/shipments/[id]/route.ts` | CREATE |
| `app/app/picking/page.tsx` | CREATE |
| `app/app/picking/new/page.tsx` | CREATE |
| `app/app/picking/[id]/page.tsx` | CREATE |
| `app/app/shipments/page.tsx` | CREATE |
| `app/app/shipments/[id]/page.tsx` | CREATE |
| `components/layout/Sidebar.tsx` | MODIFY |

**Total: 6 API route files, 5 page files, 1 migration, 2 file modifications.**

# UoM Framework Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a global Unit of Measure conversion framework that adds multi-UoM support (transaction qty vs base qty) to all transaction modules, with an admin management UI and automated valuation sync at GRN stocking.

**Architecture:** A new `uom_conversions` global master table defines "1 CTN = 48 PCS" once for all products. Eight transaction line tables gain three new columns (`transaction_uom_id`, `transaction_qty`, `base_qty`); a shared PostgreSQL trigger (`fn_fill_line_base_qty`) auto-computes `base_qty` on insert/update. `product_uom` is repurposed from storing per-product conversion factors to declaring which UoMs a product uses. Valuation auto-syncs to base-unit cost at GRN stocking.

**Tech Stack:** PostgreSQL 15 (triggers, functions), Next.js 15 App Router, TypeScript 5 strict, Zod, Tailwind CSS, `pg` pool (raw SQL, no ORM)

---

## Phase 2 Note (out of scope here)

Transaction form UI updates — adding UoM selectors to PR/PO create, SO/DO create, and Transfer forms — are a **follow-on plan**. This plan delivers the DB foundation, admin management, and the two most impactful runtime integrations (GRN valuation + cycle count counting UoM). All existing forms continue to work unchanged because `transaction_uom_id = NULL` means "base unit."

---

## File Map

| Action | File | Purpose |
|--------|------|---------|
| Create | `migrations/026_uom_framework.sql` | Full schema: 4 table changes, 2 new tables, 1 function, 9 triggers |
| Modify | `lib/validations/bom.ts` | Remove `conversion_factor` from product UoM schemas |
| Modify | `app/api/products/[id]/uom/route.ts` | POST: drop conversion_factor; GET: return new fields |
| Modify | `app/api/products/[id]/uom/[uomId]/route.ts` | PATCH: drop conversion_factor |
| Modify | `app/api/products/uom/route.ts` | GET: return new fields + conversion data |
| Modify | `types/index.ts` | Add UnitOfMeasure, UomConversion, updated ProductUom types |
| Create | `app/api/admin/uom/route.ts` | GET + POST for UoM master (admin only) |
| Create | `app/api/admin/uom/[id]/route.ts` | PATCH + DELETE for single UoM |
| Create | `app/api/admin/uom/conversions/route.ts` | GET + POST for conversion rules |
| Create | `app/api/admin/uom/conversions/[id]/route.ts` | DELETE for single conversion |
| Create | `app/app/admin/uom/page.tsx` | Admin UI: UoM master + conversions CRUD |
| Modify | `components/layout/Sidebar.tsx` | Add UoM link to admin nav group |
| Modify | `app/api/grn/[id]/stock/route.ts` | Auto-sync unit_cost to base-unit cost at stocking |
| Create | `app/api/grn/[id]/labels/route.ts` | Return label data JSON per GRN line |
| Modify | `app/api/cycle-counts/[id]/route.ts` | Accept counting_uom_id + counting_qty_input |
| Modify | `app/app/cycle-counts/[id]/page.tsx` | UoM selector + conversion preview when counting |

---

## Task 1: Migration 026 — Schema Foundation

**Files:**
- Create: `migrations/026_uom_framework.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- migrations/026_uom_framework.sql

-- ── 1. Extend units_of_measure ──────────────────────────────────────────────
ALTER TABLE units_of_measure
  ADD COLUMN IF NOT EXISTS is_base_unit    BOOLEAN      NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_integer_unit BOOLEAN      NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS barcode_label   VARCHAR(100),
  ADD COLUMN IF NOT EXISTS sort_order      INTEGER      NOT NULL DEFAULT 0;

ALTER TABLE units_of_measure
  DROP CONSTRAINT IF EXISTS chk_uom_code_format;
ALTER TABLE units_of_measure
  ADD CONSTRAINT chk_uom_code_format CHECK (code ~ '^[A-Z0-9]{1,10}$');

-- ── 2. Seed flags for codes that already exist in dev data ──────────────────
UPDATE units_of_measure SET is_base_unit = TRUE,  is_integer_unit = FALSE, sort_order = 10 WHERE code = 'KG';
UPDATE units_of_measure SET is_base_unit = TRUE,  is_integer_unit = FALSE, sort_order = 20 WHERE code = 'L';
UPDATE units_of_measure SET is_base_unit = TRUE,  is_integer_unit = TRUE,  sort_order = 30 WHERE code = 'PCS';
UPDATE units_of_measure SET is_base_unit = FALSE, is_integer_unit = TRUE,  sort_order = 40 WHERE code = 'BOX';
UPDATE units_of_measure SET is_base_unit = FALSE, is_integer_unit = TRUE,  sort_order = 50 WHERE code = 'CTN';
UPDATE units_of_measure SET is_base_unit = FALSE, is_integer_unit = TRUE,  sort_order = 60 WHERE code = 'SET';

-- ── 3. Global conversions table ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS uom_conversions (
  id           UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  uom_id       UUID          NOT NULL REFERENCES units_of_measure(id) ON DELETE RESTRICT,
  base_uom_id  UUID          NOT NULL REFERENCES units_of_measure(id) ON DELETE RESTRICT,
  factor       NUMERIC(15,6) NOT NULL CHECK (factor > 0),
  -- Semantic: 1 [uom] = factor × [base_uom].  e.g. 1 CTN = 48 PCS → factor=48
  notes        TEXT,
  created_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  UNIQUE (uom_id),
  CHECK (uom_id != base_uom_id)
);
CREATE INDEX IF NOT EXISTS idx_uom_conversions_uom ON uom_conversions(uom_id);

CREATE OR REPLACE FUNCTION fn_validate_uom_conversion()
RETURNS TRIGGER AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM units_of_measure WHERE id = NEW.base_uom_id AND is_base_unit = TRUE
  ) THEN
    RAISE EXCEPTION 'base_uom_id % must reference an is_base_unit=TRUE row', NEW.base_uom_id;
  END IF;
  IF EXISTS (
    SELECT 1 FROM units_of_measure WHERE id = NEW.uom_id AND is_base_unit = TRUE
  ) THEN
    RAISE EXCEPTION 'Cannot create a conversion row for base unit %', NEW.uom_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_validate_uom_conversion ON uom_conversions;
CREATE TRIGGER trg_validate_uom_conversion
  BEFORE INSERT OR UPDATE ON uom_conversions
  FOR EACH ROW EXECUTE FUNCTION fn_validate_uom_conversion();

-- ── 4. Repurpose product_uom: drop per-product factor, add barcode ───────────
ALTER TABLE product_uom
  DROP COLUMN IF EXISTS conversion_factor;
ALTER TABLE product_uom
  ADD COLUMN IF NOT EXISTS barcode_label VARCHAR(100) UNIQUE;

-- ── 5. Multi-UoM columns on 7 line tables ───────────────────────────────────
ALTER TABLE pr_line_items
  ADD COLUMN IF NOT EXISTS transaction_uom_id UUID          REFERENCES units_of_measure(id),
  ADD COLUMN IF NOT EXISTS transaction_qty    NUMERIC(15,4),
  ADD COLUMN IF NOT EXISTS base_qty           NUMERIC(15,4);

ALTER TABLE po_line_items
  ADD COLUMN IF NOT EXISTS transaction_uom_id UUID          REFERENCES units_of_measure(id),
  ADD COLUMN IF NOT EXISTS transaction_qty    NUMERIC(15,4),
  ADD COLUMN IF NOT EXISTS base_qty           NUMERIC(15,4);

ALTER TABLE grn_line_items
  ADD COLUMN IF NOT EXISTS transaction_uom_id UUID          REFERENCES units_of_measure(id),
  ADD COLUMN IF NOT EXISTS transaction_qty    NUMERIC(15,4),
  ADD COLUMN IF NOT EXISTS base_qty           NUMERIC(15,4);

ALTER TABLE so_line_items
  ADD COLUMN IF NOT EXISTS transaction_uom_id UUID          REFERENCES units_of_measure(id),
  ADD COLUMN IF NOT EXISTS transaction_qty    NUMERIC(15,4),
  ADD COLUMN IF NOT EXISTS base_qty           NUMERIC(15,4);

ALTER TABLE do_line_items
  ADD COLUMN IF NOT EXISTS transaction_uom_id UUID          REFERENCES units_of_measure(id),
  ADD COLUMN IF NOT EXISTS transaction_qty    NUMERIC(15,4),
  ADD COLUMN IF NOT EXISTS base_qty           NUMERIC(15,4);

ALTER TABLE pos_transaction_lines
  ADD COLUMN IF NOT EXISTS transaction_uom_id UUID          REFERENCES units_of_measure(id),
  ADD COLUMN IF NOT EXISTS transaction_qty    NUMERIC(15,4),
  ADD COLUMN IF NOT EXISTS base_qty           NUMERIC(15,4);

ALTER TABLE warehouse_transfer_lines
  ADD COLUMN IF NOT EXISTS transaction_uom_id UUID          REFERENCES units_of_measure(id),
  ADD COLUMN IF NOT EXISTS transaction_qty    NUMERIC(15,4),
  ADD COLUMN IF NOT EXISTS base_qty           NUMERIC(15,4);

-- ── 6. Cycle count counting-UoM columns ─────────────────────────────────────
-- qty_counted STAYS in base UoM (qty_variance GENERATED depends on it)
ALTER TABLE cycle_count_lines
  ADD COLUMN IF NOT EXISTS counting_uom_id    UUID          REFERENCES units_of_measure(id),
  ADD COLUMN IF NOT EXISTS counting_qty_input NUMERIC(15,4);

-- ── 7. Conversion engine function ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_resolve_base_qty(
  p_qty    NUMERIC,
  p_uom_id UUID
) RETURNS NUMERIC AS $$
DECLARE
  v_factor     NUMERIC(15,6);
  v_is_integer BOOLEAN;
BEGIN
  SELECT COALESCE(uc.factor, 1.0), u.is_integer_unit
  INTO   v_factor, v_is_integer
  FROM   units_of_measure u
  LEFT JOIN uom_conversions uc ON uc.uom_id = u.id
  WHERE  u.id = p_uom_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'UoM % not found', p_uom_id;
  END IF;

  RETURN CASE
    WHEN v_is_integer THEN FLOOR(p_qty * v_factor)
    ELSE ROUND(p_qty * v_factor, 6)
  END;
END;
$$ LANGUAGE plpgsql STABLE;

-- ── 8. Shared trigger for all 7 line tables ──────────────────────────────────
CREATE OR REPLACE FUNCTION fn_fill_line_base_qty()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.transaction_uom_id IS NOT NULL AND NEW.transaction_qty IS NOT NULL THEN
    NEW.base_qty := fn_resolve_base_qty(NEW.transaction_qty, NEW.transaction_uom_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_pr_lines_base_qty  ON pr_line_items;
DROP TRIGGER IF EXISTS trg_po_lines_base_qty  ON po_line_items;
DROP TRIGGER IF EXISTS trg_grn_lines_base_qty ON grn_line_items;
DROP TRIGGER IF EXISTS trg_so_lines_base_qty  ON so_line_items;
DROP TRIGGER IF EXISTS trg_do_lines_base_qty  ON do_line_items;
DROP TRIGGER IF EXISTS trg_pos_lines_base_qty ON pos_transaction_lines;
DROP TRIGGER IF EXISTS trg_trf_lines_base_qty ON warehouse_transfer_lines;

CREATE TRIGGER trg_pr_lines_base_qty  BEFORE INSERT OR UPDATE ON pr_line_items         FOR EACH ROW EXECUTE FUNCTION fn_fill_line_base_qty();
CREATE TRIGGER trg_po_lines_base_qty  BEFORE INSERT OR UPDATE ON po_line_items         FOR EACH ROW EXECUTE FUNCTION fn_fill_line_base_qty();
CREATE TRIGGER trg_grn_lines_base_qty BEFORE INSERT OR UPDATE ON grn_line_items        FOR EACH ROW EXECUTE FUNCTION fn_fill_line_base_qty();
CREATE TRIGGER trg_so_lines_base_qty  BEFORE INSERT OR UPDATE ON so_line_items         FOR EACH ROW EXECUTE FUNCTION fn_fill_line_base_qty();
CREATE TRIGGER trg_do_lines_base_qty  BEFORE INSERT OR UPDATE ON do_line_items         FOR EACH ROW EXECUTE FUNCTION fn_fill_line_base_qty();
CREATE TRIGGER trg_pos_lines_base_qty BEFORE INSERT OR UPDATE ON pos_transaction_lines FOR EACH ROW EXECUTE FUNCTION fn_fill_line_base_qty();
CREATE TRIGGER trg_trf_lines_base_qty BEFORE INSERT OR UPDATE ON warehouse_transfer_lines FOR EACH ROW EXECUTE FUNCTION fn_fill_line_base_qty();

-- ── 9. Cycle count trigger ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_cc_lines_fill_counted()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.counting_uom_id IS NOT NULL AND NEW.counting_qty_input IS NOT NULL THEN
    NEW.qty_counted := fn_resolve_base_qty(NEW.counting_qty_input, NEW.counting_uom_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_cc_lines_fill_counted ON cycle_count_lines;
CREATE TRIGGER trg_cc_lines_fill_counted
  BEFORE INSERT OR UPDATE ON cycle_count_lines
  FOR EACH ROW EXECUTE FUNCTION fn_cc_lines_fill_counted();
```

- [ ] **Step 2: Run migration and verify**

```bash
npm run migrate
```

Expected output: migration `026_uom_framework` applied. No errors.

Verify in psql or DB client:
```sql
-- Check new columns exist
SELECT code, is_base_unit, is_integer_unit, sort_order FROM units_of_measure ORDER BY sort_order;
-- Check uom_conversions table exists (empty)
SELECT * FROM uom_conversions;
-- Check product_uom no longer has conversion_factor
SELECT column_name FROM information_schema.columns WHERE table_name='product_uom';
-- Check grn_line_items has new columns
SELECT column_name FROM information_schema.columns WHERE table_name='grn_line_items' AND column_name IN ('transaction_uom_id','transaction_qty','base_qty');
```

- [ ] **Step 3: Commit**

```bash
git add migrations/026_uom_framework.sql
git commit -m "feat(uom): migration 026 — uom_conversions table, multi-UoM columns on 7 line tables, conversion engine triggers"
```

---

## Task 2: Fix Broken Code — Remove conversion_factor References

After Task 1 drops `product_uom.conversion_factor`, three existing files will crash.

**Files:**
- Modify: `lib/validations/bom.ts`
- Modify: `app/api/products/[id]/uom/route.ts`
- Modify: `app/api/products/[id]/uom/[uomId]/route.ts`

- [ ] **Step 1: Update `lib/validations/bom.ts`**

Remove `conversion_factor` from `CreateProductUomSchema` and `PatchProductUomSchema`. Add `barcode_label`:

```typescript
// lib/validations/bom.ts  (replace lines 50-60)

export const CreateProductUomSchema = z.object({
  uom_id: z.string().uuid(),
  uom_type: z.enum(['purchase', 'sales', 'other']).default('other'),
  barcode_label: z.string().max(100).nullable().optional(),
});

export const PatchProductUomSchema = z.object({
  uom_type: z.enum(['purchase', 'sales', 'other']).optional(),
  is_active: z.boolean().optional(),
  barcode_label: z.string().max(100).nullable().optional(),
});
```

- [ ] **Step 2: Update `app/api/products/[id]/uom/route.ts` POST**

Replace the INSERT — drop `conversion_factor`, add `barcode_label`:

```typescript
// app/api/products/[id]/uom/route.ts  POST handler, replace the INSERT block

const { rows } = await query(`
  INSERT INTO product_uom (product_id, uom_id, uom_type, barcode_label)
  VALUES ($1, $2, $3, $4)
  RETURNING id
`, [id, d.uom_id, d.uom_type, d.barcode_label ?? null]);
```

Also update the GET to return conversion data from the global table:

```typescript
// replace the GET SELECT query
const rows = await query(`
  SELECT
    pu.*,
    uom.code         AS uom_code,
    uom.name_th      AS uom_name_th,
    uom.name_en      AS uom_name_en,
    uom.is_base_unit,
    uc.factor,
    bu.code          AS base_uom_code
  FROM product_uom pu
  JOIN units_of_measure uom ON uom.id = pu.uom_id
  LEFT JOIN uom_conversions uc ON uc.uom_id = pu.uom_id
  LEFT JOIN units_of_measure bu ON bu.id = uc.base_uom_id
  WHERE pu.product_id = $1
  ORDER BY pu.created_at ASC
`, [id]);
```

- [ ] **Step 3: Update `app/api/products/[id]/uom/[uomId]/route.ts` PATCH**

Remove `conversion_factor` block, add `barcode_label`:

```typescript
// app/api/products/[id]/uom/[uomId]/route.ts  PATCH handler
// Replace the sets-building block:

const sets: string[] = [];
const vals: unknown[] = [];
let idx = 1;

if (d.uom_type !== undefined)     { sets.push(`uom_type = $${idx++}`);     vals.push(d.uom_type); }
if (d.is_active !== undefined)    { sets.push(`is_active = $${idx++}`);    vals.push(d.is_active); }
if (d.barcode_label !== undefined){ sets.push(`barcode_label = $${idx++}`); vals.push(d.barcode_label); }
```

- [ ] **Step 4: Verify no remaining conversion_factor references**

```bash
grep -rn "conversion_factor" app/ lib/ --include="*.ts"
```

Expected: zero matches.

- [ ] **Step 5: Lint check**

```bash
npm run lint
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add lib/validations/bom.ts \
        app/api/products/[id]/uom/route.ts \
        "app/api/products/[id]/uom/[uomId]/route.ts"
git commit -m "fix(uom): remove conversion_factor from product_uom — moved to global uom_conversions table"
```

---

## Task 3: Update TypeScript Types

**Files:**
- Modify: `types/index.ts`

- [ ] **Step 1: Add UoM framework types to `types/index.ts`**

Append to the end of the file:

```typescript
// ── UoM Framework ────────────────────────────────────────────────────────────

export interface UnitOfMeasure {
  id: string;
  code: string;
  name_th: string;
  name_en: string;
  is_base_unit: boolean;
  is_integer_unit: boolean;
  barcode_label: string | null;
  sort_order: number;
  // joined from uom_conversions (present in admin API responses)
  factor?: number | null;
  base_uom_id?: string | null;
  base_uom_code?: string | null;
}

export interface UomConversion {
  id: string;
  uom_id: string;
  uom_code: string;
  base_uom_id: string;
  base_uom_code: string;
  factor: number;
  notes: string | null;
  created_at: string;
}

export interface ProductUom {
  id: string;
  product_id: string;
  uom_id: string;
  uom_code: string;
  uom_name_th: string;
  uom_name_en: string;
  uom_type: 'purchase' | 'sales' | 'other';
  barcode_label: string | null;
  is_active: boolean;
  is_base_unit?: boolean;
  // joined from uom_conversions
  factor: number | null;
  base_uom_code: string | null;
}
```

- [ ] **Step 2: Lint check**

```bash
npm run lint
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add types/index.ts
git commit -m "feat(uom): add UnitOfMeasure, UomConversion, ProductUom types"
```

---

## Task 4: Update Existing Products UoM GET Endpoint

**Files:**
- Modify: `app/api/products/uom/route.ts`

This endpoint is used by product forms to populate UoM dropdowns. It needs to return `is_base_unit`, `is_integer_unit`, and conversion data so dropdowns can show hierarchy.

- [ ] **Step 1: Update `app/api/products/uom/route.ts` GET**

Replace the entire file:

```typescript
import { auth } from '@/auth';
import { apiSuccess, apiError, apiValidationError } from '@/lib/api-response';
import { assertRole } from '@/lib/authz';
import { query, queryOne } from '@/lib/db/client';
import { z } from 'zod';
import type { SessionUser } from '@/lib/authz';
import type { UnitOfMeasure } from '@/types';

const createSchema = z.object({
  code: z.string().min(1).max(10).regex(/^[A-Z0-9]+$/, 'Code must be uppercase alphanumeric'),
  name_th: z.string().min(1).max(100),
  name_en: z.string().min(1).max(100),
});

export async function GET() {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);

  const uoms = await query<UnitOfMeasure>(
    `SELECT u.*,
            uc.factor,
            uc.base_uom_id,
            bu.code AS base_uom_code
     FROM units_of_measure u
     LEFT JOIN uom_conversions uc ON uc.uom_id = u.id
     LEFT JOIN units_of_measure bu ON bu.id = uc.base_uom_id
     ORDER BY u.sort_order, u.code`
  );
  return apiSuccess(uoms);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;
  try { assertRole(u, ['admin']); } catch { return apiError('Forbidden', 403); }

  const body = await req.json().catch(() => null);
  if (!body) return apiError('Invalid JSON', 400);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return apiValidationError(parsed.error);

  const existing = await queryOne('SELECT id FROM units_of_measure WHERE code = $1', [parsed.data.code]);
  if (existing) return apiError('UOM code already exists', 409);

  const uom = await queryOne<UnitOfMeasure>(
    `INSERT INTO units_of_measure (code, name_th, name_en)
     VALUES ($1,$2,$3) RETURNING *`,
    [parsed.data.code, parsed.data.name_th, parsed.data.name_en]
  );
  return apiSuccess(uom, 201);
}
```

- [ ] **Step 2: Lint + commit**

```bash
npm run lint
git add app/api/products/uom/route.ts
git commit -m "feat(uom): products/uom GET returns is_base_unit, conversion data"
```

---

## Task 5: Admin API — UoM CRUD

**Files:**
- Create: `app/api/admin/uom/route.ts`
- Create: `app/api/admin/uom/[id]/route.ts`

- [ ] **Step 1: Create `app/api/admin/uom/route.ts`**

```typescript
import { auth } from '@/auth';
import { apiSuccess, apiError, apiValidationError } from '@/lib/api-response';
import { assertRole } from '@/lib/authz';
import { query, queryOne } from '@/lib/db/client';
import { z } from 'zod';
import type { SessionUser } from '@/lib/authz';
import type { UnitOfMeasure } from '@/types';

const createSchema = z.object({
  code:            z.string().min(1).max(10).regex(/^[A-Z0-9]+$/, 'Code must be uppercase alphanumeric'),
  name_th:         z.string().min(1).max(100),
  name_en:         z.string().min(1).max(100),
  is_base_unit:    z.boolean().default(false),
  is_integer_unit: z.boolean().default(false),
  barcode_label:   z.string().max(100).nullable().default(null),
  sort_order:      z.number().int().default(0),
});

export async function GET() {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;
  try { assertRole(u, ['admin']); } catch { return apiError('Forbidden', 403); }

  const uoms = await query<UnitOfMeasure>(
    `SELECT u.*, uc.factor, uc.base_uom_id, bu.code AS base_uom_code
     FROM units_of_measure u
     LEFT JOIN uom_conversions uc ON uc.uom_id = u.id
     LEFT JOIN units_of_measure bu ON bu.id = uc.base_uom_id
     ORDER BY u.sort_order, u.code`
  );
  return apiSuccess(uoms);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;
  try { assertRole(u, ['admin']); } catch { return apiError('Forbidden', 403); }

  const body = await req.json().catch(() => null);
  if (!body) return apiError('Invalid JSON', 400);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return apiValidationError(parsed.error);

  const existing = await queryOne('SELECT id FROM units_of_measure WHERE code = $1', [parsed.data.code]);
  if (existing) return apiError('UoM code already exists', 409);

  const uom = await queryOne<UnitOfMeasure>(
    `INSERT INTO units_of_measure (code, name_th, name_en, is_base_unit, is_integer_unit, barcode_label, sort_order)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [parsed.data.code, parsed.data.name_th, parsed.data.name_en,
     parsed.data.is_base_unit, parsed.data.is_integer_unit,
     parsed.data.barcode_label, parsed.data.sort_order]
  );
  return apiSuccess(uom, 201);
}
```

- [ ] **Step 2: Create `app/api/admin/uom/[id]/route.ts`**

```typescript
import { auth } from '@/auth';
import { apiSuccess, apiError, apiValidationError } from '@/lib/api-response';
import { assertRole } from '@/lib/authz';
import { queryOne } from '@/lib/db/client';
import { z } from 'zod';
import type { SessionUser } from '@/lib/authz';

const patchSchema = z.object({
  name_th:         z.string().min(1).max(100).optional(),
  name_en:         z.string().min(1).max(100).optional(),
  is_integer_unit: z.boolean().optional(),
  barcode_label:   z.string().max(100).nullable().optional(),
  sort_order:      z.number().int().optional(),
}).strict();

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;
  try { assertRole(u, ['admin']); } catch { return apiError('Forbidden', 403); }

  const { id } = await params;
  const body = await req.json().catch(() => null);
  if (!body) return apiError('Invalid JSON', 400);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return apiValidationError(parsed.error);

  const uom = await queryOne('SELECT id FROM units_of_measure WHERE id = $1', [id]);
  if (!uom) return apiError('UoM not found', 404);

  const f = parsed.data;
  const updates: string[] = [];
  const vals: unknown[] = [];
  let idx = 1;
  if (f.name_th !== undefined)         { updates.push(`name_th = $${idx++}`);         vals.push(f.name_th); }
  if (f.name_en !== undefined)         { updates.push(`name_en = $${idx++}`);         vals.push(f.name_en); }
  if (f.is_integer_unit !== undefined) { updates.push(`is_integer_unit = $${idx++}`); vals.push(f.is_integer_unit); }
  if (f.barcode_label !== undefined)   { updates.push(`barcode_label = $${idx++}`);   vals.push(f.barcode_label); }
  if (f.sort_order !== undefined)      { updates.push(`sort_order = $${idx++}`);      vals.push(f.sort_order); }
  if (!updates.length) return apiError('No fields to update', 400);

  vals.push(id);
  const updated = await queryOne(
    `UPDATE units_of_measure SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`,
    vals
  );
  return apiSuccess(updated);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;
  try { assertRole(u, ['admin']); } catch { return apiError('Forbidden', 403); }

  const { id } = await params;

  const inConversion = await queryOne(
    'SELECT id FROM uom_conversions WHERE uom_id = $1 OR base_uom_id = $1',
    [id]
  );
  if (inConversion) return apiError('UoM is referenced in a conversion rule — delete the conversion first', 409);

  const inProductUom = await queryOne('SELECT id FROM product_uom WHERE uom_id = $1 LIMIT 1', [id]);
  if (inProductUom) return apiError('UoM is assigned to one or more products', 409);

  const deleted = await queryOne('DELETE FROM units_of_measure WHERE id = $1 RETURNING id', [id]);
  if (!deleted) return apiError('UoM not found', 404);
  return apiSuccess({ id });
}
```

- [ ] **Step 3: Lint + commit**

```bash
npm run lint
git add app/api/admin/uom/route.ts "app/api/admin/uom/[id]/route.ts"
git commit -m "feat(uom): admin API — UoM CRUD (GET, POST, PATCH, DELETE)"
```

---

## Task 6: Admin API — Conversions CRUD

**Files:**
- Create: `app/api/admin/uom/conversions/route.ts`
- Create: `app/api/admin/uom/conversions/[id]/route.ts`

- [ ] **Step 1: Create `app/api/admin/uom/conversions/route.ts`**

```typescript
import { auth } from '@/auth';
import { apiSuccess, apiError, apiValidationError } from '@/lib/api-response';
import { assertRole } from '@/lib/authz';
import { query, queryOne } from '@/lib/db/client';
import { z } from 'zod';
import type { SessionUser } from '@/lib/authz';
import type { UomConversion } from '@/types';

const createSchema = z.object({
  uom_id:      z.string().uuid(),
  base_uom_id: z.string().uuid(),
  factor:      z.number().positive(),
  notes:       z.string().max(255).nullable().default(null),
});

export async function GET() {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;
  try { assertRole(u, ['admin']); } catch { return apiError('Forbidden', 403); }

  const conversions = await query<UomConversion>(
    `SELECT uc.*, u.code AS uom_code, bu.code AS base_uom_code
     FROM uom_conversions uc
     JOIN units_of_measure u  ON u.id  = uc.uom_id
     JOIN units_of_measure bu ON bu.id = uc.base_uom_id
     ORDER BY u.sort_order, u.code`
  );
  return apiSuccess(conversions);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;
  try { assertRole(u, ['admin']); } catch { return apiError('Forbidden', 403); }

  const body = await req.json().catch(() => null);
  if (!body) return apiError('Invalid JSON', 400);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return apiValidationError(parsed.error);

  const existing = await queryOne('SELECT id FROM uom_conversions WHERE uom_id = $1', [parsed.data.uom_id]);
  if (existing) return apiError('A conversion for this UoM already exists', 409);

  const conv = await queryOne<UomConversion>(
    `INSERT INTO uom_conversions (uom_id, base_uom_id, factor, notes)
     VALUES ($1,$2,$3,$4) RETURNING *`,
    [parsed.data.uom_id, parsed.data.base_uom_id, parsed.data.factor, parsed.data.notes]
  );
  return apiSuccess(conv, 201);
}
```

- [ ] **Step 2: Create `app/api/admin/uom/conversions/[id]/route.ts`**

```typescript
import { auth } from '@/auth';
import { apiSuccess, apiError } from '@/lib/api-response';
import { assertRole } from '@/lib/authz';
import { queryOne } from '@/lib/db/client';
import type { SessionUser } from '@/lib/authz';

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;
  try { assertRole(u, ['admin']); } catch { return apiError('Forbidden', 403); }

  const { id } = await params;
  const deleted = await queryOne('DELETE FROM uom_conversions WHERE id = $1 RETURNING id', [id]);
  if (!deleted) return apiError('Conversion not found', 404);
  return apiSuccess({ id });
}
```

- [ ] **Step 3: Lint + commit**

```bash
npm run lint
git add app/api/admin/uom/conversions/route.ts \
        "app/api/admin/uom/conversions/[id]/route.ts"
git commit -m "feat(uom): admin API — conversions CRUD (GET, POST, DELETE)"
```

---

## Task 7: Admin UI Page — `/app/admin/uom`

**Files:**
- Create: `app/app/admin/uom/page.tsx`

- [ ] **Step 1: Create `app/app/admin/uom/page.tsx`**

```typescript
'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button, Input, Select, Table, Thead, Tbody, Th, Td, Badge, Modal } from '@/components/ui';
import { get, post, del } from '@/lib/api-client';
import type { UnitOfMeasure, UomConversion } from '@/types';

export default function AdminUomPage() {
  const [uoms, setUoms] = useState<UnitOfMeasure[]>([]);
  const [conversions, setConversions] = useState<UomConversion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Create UoM form state
  const [showCreateUom, setShowCreateUom] = useState(false);
  const [newUom, setNewUom] = useState({ code: '', name_th: '', name_en: '', is_base_unit: false, is_integer_unit: false, barcode_label: '', sort_order: 0 });
  const [creating, setCreating] = useState(false);

  // Create conversion form state
  const [showCreateConv, setShowCreateConv] = useState(false);
  const [newConv, setNewConv] = useState({ uom_id: '', base_uom_id: '', factor: '', notes: '' });
  const [creatingConv, setCreatingConv] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [u, c] = await Promise.all([
        get<UnitOfMeasure[]>('/api/admin/uom'),
        get<UomConversion[]>('/api/admin/uom/conversions'),
      ]);
      setUoms(u);
      setConversions(c);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'โหลดข้อมูลไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  async function handleCreateUom() {
    setCreating(true);
    setError('');
    try {
      await post('/api/admin/uom', {
        ...newUom,
        barcode_label: newUom.barcode_label || null,
      });
      setShowCreateUom(false);
      setNewUom({ code: '', name_th: '', name_en: '', is_base_unit: false, is_integer_unit: false, barcode_label: '', sort_order: 0 });
      await fetchAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'สร้างไม่สำเร็จ');
    } finally {
      setCreating(false);
    }
  }

  async function handleDeleteUom(id: string, code: string) {
    if (!confirm(`ลบหน่วย "${code}"?`)) return;
    setError('');
    try {
      await del(`/api/admin/uom/${id}`);
      await fetchAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ลบไม่สำเร็จ');
    }
  }

  async function handleCreateConversion() {
    setCreatingConv(true);
    setError('');
    try {
      await post('/api/admin/uom/conversions', {
        uom_id: newConv.uom_id,
        base_uom_id: newConv.base_uom_id,
        factor: parseFloat(newConv.factor),
        notes: newConv.notes || null,
      });
      setShowCreateConv(false);
      setNewConv({ uom_id: '', base_uom_id: '', factor: '', notes: '' });
      await fetchAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'สร้างไม่สำเร็จ');
    } finally {
      setCreatingConv(false);
    }
  }

  async function handleDeleteConversion(id: string) {
    if (!confirm('ลบ conversion นี้?')) return;
    setError('');
    try {
      await del(`/api/admin/uom/conversions/${id}`);
      await fetchAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ลบไม่สำเร็จ');
    }
  }

  const baseUoms = uoms.filter(u => u.is_base_unit);
  const nonBaseUoms = uoms.filter(u => !u.is_base_unit);

  if (loading) return <div className="py-16 text-center text-gray-400">กำลังโหลด...</div>;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">หน่วยนับ / Units of Measure</h1>
        <p className="text-sm text-gray-500">จัดการหน่วยนับและอัตราการแปลงหน่วย</p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {/* ── UoM Master ── */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-800">หน่วยทั้งหมด</h2>
          <Button onClick={() => setShowCreateUom(true)}>+ เพิ่มหน่วย</Button>
        </div>
        <div className="overflow-hidden rounded-lg border border-gray-200">
          <Table>
            <Thead>
              <tr>
                <Th>Code</Th>
                <Th>ชื่อ TH</Th>
                <Th>Name EN</Th>
                <Th>ประเภท</Th>
                <Th>Integer?</Th>
                <Th>Conversion</Th>
                <Th>Barcode Label</Th>
                <Th></Th>
              </tr>
            </Thead>
            <Tbody>
              {uoms.map(u => (
                <tr key={u.id}>
                  <Td><code className="font-mono text-sm font-semibold">{u.code}</code></Td>
                  <Td>{u.name_th}</Td>
                  <Td>{u.name_en}</Td>
                  <Td>
                    {u.is_base_unit
                      ? <Badge variant="green">Base</Badge>
                      : <Badge variant="gray">Non-base</Badge>}
                  </Td>
                  <Td>{u.is_integer_unit ? '✓' : '—'}</Td>
                  <Td>
                    {u.factor
                      ? <span className="text-sm">1 {u.code} = <strong>{u.factor}</strong> {u.base_uom_code}</span>
                      : <span className="text-gray-400 text-sm">—</span>}
                  </Td>
                  <Td><span className="text-sm text-gray-500">{u.barcode_label ?? '—'}</span></Td>
                  <Td>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteUom(u.id, u.code)}
                      className="text-red-600 hover:text-red-700"
                    >
                      ลบ
                    </Button>
                  </Td>
                </tr>
              ))}
            </Tbody>
          </Table>
        </div>
      </section>

      {/* ── Conversions ── */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-800">อัตราการแปลงหน่วย / Conversion Rules</h2>
          <Button onClick={() => setShowCreateConv(true)} disabled={nonBaseUoms.length === 0 || baseUoms.length === 0}>
            + เพิ่ม Conversion
          </Button>
        </div>
        <div className="overflow-hidden rounded-lg border border-gray-200">
          <Table>
            <Thead>
              <tr>
                <Th>สูตร / Rule</Th>
                <Th>Factor</Th>
                <Th>Notes</Th>
                <Th></Th>
              </tr>
            </Thead>
            <Tbody>
              {conversions.length === 0 ? (
                <tr><Td colSpan={4} className="text-center text-gray-400 py-8">ยังไม่มี conversion rules</Td></tr>
              ) : conversions.map(c => (
                <tr key={c.id}>
                  <Td>
                    <span className="font-mono text-sm">
                      1 <strong>{c.uom_code}</strong> = {c.factor} {c.base_uom_code}
                    </span>
                  </Td>
                  <Td><strong>{c.factor}</strong></Td>
                  <Td className="text-sm text-gray-500">{c.notes ?? '—'}</Td>
                  <Td>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteConversion(c.id)}
                      className="text-red-600 hover:text-red-700"
                    >
                      ลบ
                    </Button>
                  </Td>
                </tr>
              ))}
            </Tbody>
          </Table>
        </div>
      </section>

      {/* ── Create UoM Modal ── */}
      {showCreateUom && (
        <Modal title="เพิ่มหน่วยนับ" onClose={() => setShowCreateUom(false)}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Code <span className="text-gray-400">(ตัวพิมพ์ใหญ่ A-Z0-9)</span></label>
              <Input
                value={newUom.code}
                onChange={e => setNewUom(p => ({ ...p, code: e.target.value.toUpperCase() }))}
                placeholder="PCS, BOX, CTN..."
                maxLength={10}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ชื่อ (TH)</label>
                <Input value={newUom.name_th} onChange={e => setNewUom(p => ({ ...p, name_th: e.target.value }))} placeholder="ชิ้น" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name (EN)</label>
                <Input value={newUom.name_en} onChange={e => setNewUom(p => ({ ...p, name_en: e.target.value }))} placeholder="Piece" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Barcode Label</label>
              <Input value={newUom.barcode_label} onChange={e => setNewUom(p => ({ ...p, barcode_label: e.target.value }))} placeholder="optional" />
            </div>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={newUom.is_base_unit} onChange={e => setNewUom(p => ({ ...p, is_base_unit: e.target.checked }))} />
                Base Unit
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={newUom.is_integer_unit} onChange={e => setNewUom(p => ({ ...p, is_integer_unit: e.target.checked }))} />
                Integer Only (round down)
              </label>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Sort Order</label>
              <Input type="number" value={newUom.sort_order} onChange={e => setNewUom(p => ({ ...p, sort_order: parseInt(e.target.value) || 0 }))} />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={() => setShowCreateUom(false)}>ยกเลิก</Button>
              <Button onClick={handleCreateUom} disabled={creating || !newUom.code || !newUom.name_th || !newUom.name_en}>
                {creating ? 'กำลังบันทึก...' : 'บันทึก'}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── Create Conversion Modal ── */}
      {showCreateConv && (
        <Modal title="เพิ่ม Conversion Rule" onClose={() => setShowCreateConv(false)}>
          <div className="space-y-4">
            <p className="text-sm text-gray-600">กำหนดว่า 1 หน่วย = กี่หน่วยฐาน (เช่น 1 CTN = 48 PCS)</p>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">หน่วยที่ต้องการแปลง</label>
              <Select value={newConv.uom_id} onChange={e => setNewConv(p => ({ ...p, uom_id: e.target.value }))}>
                <option value="">-- เลือกหน่วย --</option>
                {nonBaseUoms.filter(u => !conversions.find(c => c.uom_id === u.id)).map(u => (
                  <option key={u.id} value={u.id}>{u.code} — {u.name_th}</option>
                ))}
              </Select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">หน่วยฐาน (Base Unit)</label>
              <Select value={newConv.base_uom_id} onChange={e => setNewConv(p => ({ ...p, base_uom_id: e.target.value }))}>
                <option value="">-- เลือกหน่วยฐาน --</option>
                {baseUoms.map(u => (
                  <option key={u.id} value={u.id}>{u.code} — {u.name_th}</option>
                ))}
              </Select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Factor (1 หน่วย = ? หน่วยฐาน)</label>
              <Input
                type="number"
                step="0.000001"
                min="0.000001"
                value={newConv.factor}
                onChange={e => setNewConv(p => ({ ...p, factor: e.target.value }))}
                placeholder="48"
              />
              {newConv.uom_id && newConv.base_uom_id && newConv.factor && (
                <p className="mt-1 text-sm text-blue-600">
                  1 {uoms.find(u => u.id === newConv.uom_id)?.code} = {newConv.factor} {uoms.find(u => u.id === newConv.base_uom_id)?.code}
                </p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
              <Input value={newConv.notes} onChange={e => setNewConv(p => ({ ...p, notes: e.target.value }))} placeholder="หมายเหตุ" />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={() => setShowCreateConv(false)}>ยกเลิก</Button>
              <Button
                onClick={handleCreateConversion}
                disabled={creatingConv || !newConv.uom_id || !newConv.base_uom_id || !newConv.factor || parseFloat(newConv.factor) <= 0}
              >
                {creatingConv ? 'กำลังบันทึก...' : 'บันทึก'}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Start dev server and verify the page loads at `/app/admin/uom`**

```bash
npm run dev
```

Open browser: `http://localhost:3000/app/admin/uom`
- Page loads without errors
- UoM table shows existing units (PCS, KG, L, etc.) with `is_base_unit` badges
- Conversions table shows "ยังไม่มี conversion rules" (empty)
- "เพิ่มหน่วย" button opens modal
- Create PCS-type UoM → appears in table
- "เพิ่ม Conversion" button: create "1 CTN = 48 PCS" → appears in conversions list with formula display
- Delete conversion → row removed

- [ ] **Step 3: Commit**

```bash
git add app/app/admin/uom/page.tsx
git commit -m "feat(uom): admin UI page — UoM master + conversion rules CRUD"
```

---

## Task 8: Sidebar — Add UoM Admin Link

**Files:**
- Modify: `components/layout/Sidebar.tsx`

- [ ] **Step 1: Find the admin navItems group and add UoM link**

In `components/layout/Sidebar.tsx`, find the `admin` section inside `MODULE_NAV` (around line 161):

```typescript
// Find this block:
admin: [
  {
    label: 'ระบบ / System',
    items: [
      { href: '/app/admin/users',      label: 'พนักงาน / Employees', icon: Users,    roles: ['admin'] },
      { href: '/app/admin/roles',      label: 'บทบาท / Roles',       icon: KeyRound, roles: ['admin'] },
      { href: '/app/admin/warehouses', label: 'Warehouses',           icon: Warehouse, roles: ['admin'] },
    ],
  },
```

Add the UoM link using the `Scale` icon (already imported at line 9):

```typescript
admin: [
  {
    label: 'ระบบ / System',
    items: [
      { href: '/app/admin/users',      label: 'พนักงาน / Employees', icon: Users,    roles: ['admin'] },
      { href: '/app/admin/roles',      label: 'บทบาท / Roles',       icon: KeyRound, roles: ['admin'] },
      { href: '/app/admin/warehouses', label: 'Warehouses',           icon: Warehouse, roles: ['admin'] },
      { href: '/app/admin/uom',        label: 'หน่วยนับ / UoM',       icon: Scale,    roles: ['admin'] },
    ],
  },
```

- [ ] **Step 2: Verify in browser**

Reload `http://localhost:3000/app/admin/users`. Sidebar admin section should show "หน่วยนับ / UoM" link. Click it → navigates to the UoM page.

- [ ] **Step 3: Commit**

```bash
git add components/layout/Sidebar.tsx
git commit -m "feat(uom): add หน่วยนับ / UoM link to admin sidebar"
```

---

## Task 9: GRN Stocking — Valuation Auto-sync

**Files:**
- Modify: `app/api/grn/[id]/stock/route.ts`

When stocking a GRN line that has a `transaction_uom_id` set (vendor sold in CTN), compute the base-unit cost and update `products.unit_cost`.

- [ ] **Step 1: Update the lines query to fetch UoM conversion data**

In `app/api/grn/[id]/stock/route.ts`, replace the lines query (starting at line 29) to also fetch `transaction_uom_id`, `base_qty`, and the PO line's `unit_price`:

```typescript
const lines = await client.query<{
  id: string; product_id: string; lot_number: string | null; serial_number: string | null;
  expiry_date: string | null; qty_accepted: number; base_qty: number | null;
  is_lot_tracked: boolean; is_serial_tracked: boolean;
  po_line_item_id: string | null; inbound_order_line_id: string | null;
  unit_cost: number; transaction_uom_id: string | null; po_unit_price: number | null;
}>(
  `SELECT li.id, li.product_id, li.lot_number, li.serial_number, li.expiry_date,
          li.qty_accepted, li.base_qty, li.transaction_uom_id,
          li.po_line_item_id, li.inbound_order_line_id,
          p.is_lot_tracked, p.is_serial_tracked, p.unit_cost,
          pol.unit_price AS po_unit_price
   FROM grn_line_items li
   JOIN products p ON p.id = li.product_id
   LEFT JOIN po_line_items pol ON pol.id = li.po_line_item_id
   WHERE li.grn_id = $1 AND li.qty_accepted > 0`,
  [id]
);
```

- [ ] **Step 2: Add cost computation before the ledger INSERT inside the `for` loop**

Inside the `for (const line of lines.rows)` loop, add this block **before** the `stock_ledger` INSERT:

```typescript
// Compute cost per base unit from PO line price + UoM conversion
let costPerBaseUnit = line.unit_cost; // default: use existing product cost
if (line.transaction_uom_id && line.po_unit_price != null) {
  const convRow = await client.query<{ factor: string }>(
    'SELECT factor FROM uom_conversions WHERE uom_id = $1',
    [line.transaction_uom_id]
  );
  const factor = convRow.rows[0] ? Number(convRow.rows[0].factor) : 1;
  costPerBaseUnit = Number(line.po_unit_price) / factor;
  // Sync product's unit_cost to new cost per base unit
  await client.query(
    'UPDATE products SET unit_cost = $1, updated_at = NOW() WHERE id = $2',
    [costPerBaseUnit, line.product_id]
  );
}

// Use effective qty: base_qty if set (multi-UoM), else qty_accepted (legacy)
const effectiveQty = line.base_qty != null ? Number(line.base_qty) : Number(line.qty_accepted);
```

- [ ] **Step 3: Update the ledger INSERT and lot INSERT to use effectiveQty and costPerBaseUnit**

Replace the lot INSERT qty reference (line ~52):
```typescript
// Change: qty_on_hand: line.qty_accepted  →  effectiveQty
[line.product_id, warehouse_id, line.lot_number, line.serial_number ?? null, line.expiry_date ?? null, effectiveQty]
```

Replace the stock_ledger INSERT (line ~65):
```typescript
await client.query(
  `INSERT INTO stock_ledger (warehouse_id, product_id, lot_id, entry_type, reference_type, reference_id, qty_change, qty_after, unit_cost, created_by)
   VALUES ($1, $2, $3, 'grn_receipt', 'grn', $4, $5, $6, $7, $8)`,
  [warehouse_id, line.product_id, lotId, id, effectiveQty, qtyAfter, costPerBaseUnit, u.id]
);
```

Also update the `qtyAfter` calculation:
```typescript
const qtyAfter = currentQty + effectiveQty;
```

And the PO line `qty_received` update:
```typescript
await client.query(
  `UPDATE po_line_items SET qty_received = qty_received + $1 WHERE id = $2`,
  [effectiveQty, line.po_line_item_id]
);
```

- [ ] **Step 4: Lint + verify logic**

```bash
npm run lint
```

Manual verify: create a GRN linked to a PO where the PO line has `unit_price = 480` and the GRN line has `transaction_uom_id = CTN` (factor=48). After stocking, `products.unit_cost` should be `10.00` and the `stock_ledger` entry should have `unit_cost = 10.00`.

- [ ] **Step 5: Commit**

```bash
git add "app/api/grn/[id]/stock/route.ts"
git commit -m "feat(uom): GRN stocking — auto-sync unit_cost to base-unit cost, use base_qty for ledger"
```

---

## Task 10: GRN Label Endpoint

**Files:**
- Create: `app/api/grn/[id]/labels/route.ts`

- [ ] **Step 1: Create `app/api/grn/[id]/labels/route.ts`**

```typescript
import { auth } from '@/auth';
import { apiSuccess, apiError } from '@/lib/api-response';
import { query } from '@/lib/db/client';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);

  const { id } = await params;
  const url = new URL(req.url);
  const lineId = url.searchParams.get('lineId');

  const whereClause = lineId
    ? 'li.grn_id = $1 AND li.id = $2'
    : 'li.grn_id = $1';
  const queryParams = lineId ? [id, lineId] : [id];

  const labels = await query(
    `SELECT
       p.sku                     AS product_sku,
       p.name_th                 AS product_name_th,
       p.name_en                 AS product_name_en,
       tu.code                   AS uom_code,
       tu.name_th                AS uom_name_th,
       pu.barcode_label,
       li.storage_location,
       COALESCE(li.base_qty, li.qty_accepted) AS base_qty,
       bu.code                   AS base_uom_code,
       li.transaction_qty,
       tu.code                   AS transaction_uom_code,
       li.lot_number,
       g.grn_number
     FROM grn_line_items li
     JOIN goods_receipt_notes g ON g.id = li.grn_id
     JOIN products p ON p.id = li.product_id
     JOIN units_of_measure bu ON bu.id = p.uom_id
     LEFT JOIN units_of_measure tu ON tu.id = COALESCE(li.transaction_uom_id, p.uom_id)
     LEFT JOIN product_uom pu ON pu.product_id = li.product_id AND pu.uom_id = COALESCE(li.transaction_uom_id, p.uom_id)
     WHERE ${whereClause}
     ORDER BY li.line_number`,
    queryParams
  );

  if (!labels.length) return apiError('GRN not found or no lines', 404);
  return apiSuccess(labels);
}
```

- [ ] **Step 2: Lint + manual test**

```bash
npm run lint
```

Open: `GET /api/grn/<some-id>/labels` — should return array of label objects.

- [ ] **Step 3: Commit**

```bash
git add "app/api/grn/[id]/labels/route.ts"
git commit -m "feat(uom): GRN label endpoint — returns label data per line for print rendering"
```

---

## Task 11: Cycle Count — UoM Input UI + API

**Files:**
- Modify: `app/api/cycle-counts/[id]/route.ts`
- Modify: `app/app/cycle-counts/[id]/page.tsx`

### Part A — API

- [ ] **Step 1: Extend `submit_counts` schema in `app/api/cycle-counts/[id]/route.ts`**

Replace `countSchema` (lines 8-14):

```typescript
const countSchema = z.object({
  lines: z.array(z.object({
    id:                  z.string().uuid(),
    qty_counted:         z.number().nonnegative().optional(),
    counting_uom_id:     z.string().uuid().optional(),
    counting_qty_input:  z.number().nonnegative().optional(),
    notes:               z.string().optional(),
  })).min(1),
});
```

Replace the `submit_counts` UPDATE inside the action handler (line 64-69):

```typescript
for (const line of parsed.data.lines) {
  // If counting_uom_id + counting_qty_input provided, DB trigger auto-fills qty_counted
  // Otherwise use qty_counted directly
  await queryOne(
    `UPDATE cycle_count_lines
     SET qty_counted         = COALESCE($1, qty_counted),
         counting_uom_id     = $2,
         counting_qty_input  = $3,
         notes               = $4,
         counted_by          = $5,
         counted_at          = NOW()
     WHERE id = $6 AND cycle_count_id = $7`,
    [
      line.qty_counted ?? null,
      line.counting_uom_id ?? null,
      line.counting_qty_input ?? null,
      line.notes ?? null,
      u.id,
      line.id,
      id,
    ]
  );
}
```

Also update the GET query to return `counting_uom_id`, `counting_qty_input`, and available product UoMs:

```typescript
const lines = await query(
  `SELECT ccl.*,
          p.sku, p.name_th, p.name_en,
          u.code AS uom_code,
          u.id   AS base_uom_id
   FROM cycle_count_lines ccl
   JOIN products p ON p.id = ccl.product_id
   JOIN units_of_measure u ON u.id = p.uom_id
   WHERE ccl.cycle_count_id = $1
   ORDER BY ccl.line_number`,
  [id]
);
```

### Part B — UI

- [ ] **Step 2: Extend `CountedLineState` and add UoM selector in `app/app/cycle-counts/[id]/page.tsx`**

Replace the `CountedLineState` interface:

```typescript
interface CountedLineState {
  id: string;
  qty_counted: string | number;
  counting_uom_id: string;
  counting_qty_input: string | number;
  notes: string;
}
```

Extend `CycleCountLine` interface with UoM fields:

```typescript
interface CycleCountLine {
  id: string;
  line_number: number;
  product_id: string;
  sku: string;
  name_th: string;
  uom_code: string;
  base_uom_id: string;
  qty_system: string | number;
  qty_counted: string | number | null;
  counting_uom_id: string | null;
  counting_qty_input: string | number | null;
  qty_variance: string | number | null;
  notes: string | null;
}
```

Update `fetchCC` to also fetch product UoMs per line. Add state and fetch:

```typescript
const [productUoms, setProductUoms] = useState<Record<string, Array<{ uom_id: string; uom_code: string; factor: number | null; base_uom_code: string | null }>>>({});

// Inside fetchCC, after setCc:
const uniqueProductIds = [...new Set(data.lines?.map((l) => l.product_id) ?? [])];
const uomMap: Record<string, Array<{ uom_id: string; uom_code: string; factor: number | null; base_uom_code: string | null }>> = {};
await Promise.all(uniqueProductIds.map(async (pid) => {
  try {
    const rows = await get<Array<{ uom_id: string; uom_code: string; factor: number | null; base_uom_code: string | null }>>(`/api/products/${pid}/uom`);
    uomMap[pid] = rows.filter(r => r.is_active !== false);
  } catch { uomMap[pid] = []; }
}));
setProductUoms(uomMap);

setCountedLines(data.lines?.map((l) => ({
  id: l.id,
  qty_counted: l.qty_counted ?? '',
  counting_uom_id: l.counting_uom_id ?? '',
  counting_qty_input: l.counting_qty_input ?? '',
  notes: l.notes ?? '',
})) ?? []);
```

- [ ] **Step 3: Update `updateLine` and the submit action**

The `updateLine` function already works generically. Update `action('submit_counts')` call to pass new fields:

```typescript
async function submitCounts() {
  await action('submit_counts', {
    lines: countedLines.map((l) => {
      if (l.counting_uom_id && l.counting_qty_input !== '') {
        return {
          id: l.id,
          counting_uom_id: l.counting_uom_id,
          counting_qty_input: Number(l.counting_qty_input),
          notes: l.notes,
        };
      }
      return {
        id: l.id,
        qty_counted: Number(l.qty_counted),
        notes: l.notes,
      };
    }),
  });
}
```

Replace the save button's `onClick` to call `submitCounts()` instead of `action('submit_counts', {...})` directly.

- [ ] **Step 4: Add UoM selector in the count row render**

Find where `qty_counted` input is rendered in the count table. Add a UoM select and conversion preview alongside it:

```typescript
// In the edit-mode row render for each line, add after the qty input:
{editMode && (
  <>
    {/* UoM selector */}
    {(productUoms[line.product_id] ?? []).length > 0 && (
      <div className="mt-1 flex items-center gap-2">
        <select
          className="rounded border border-gray-300 px-2 py-1 text-sm"
          value={countedLines[i]?.counting_uom_id ?? ''}
          onChange={(e) => {
            updateLine(i, 'counting_uom_id', e.target.value);
            updateLine(i, 'counting_qty_input', '');
          }}
        >
          <option value="">นับเป็น {line.uom_code} (ฐาน)</option>
          {(productUoms[line.product_id] ?? [])
            .filter(u => u.uom_id !== line.base_uom_id)
            .map(u => (
              <option key={u.uom_id} value={u.uom_id}>
                นับเป็น {u.uom_code} (× {u.factor} {u.base_uom_code})
              </option>
            ))}
        </select>

        {countedLines[i]?.counting_uom_id && (
          <input
            type="number"
            min="0"
            className="w-24 rounded border border-gray-300 px-2 py-1 text-sm"
            value={countedLines[i]?.counting_qty_input ?? ''}
            onChange={(e) => updateLine(i, 'counting_qty_input', e.target.value)}
            placeholder="จำนวน"
          />
        )}

        {/* Conversion preview */}
        {countedLines[i]?.counting_uom_id && countedLines[i]?.counting_qty_input !== '' && (() => {
          const uomData = (productUoms[line.product_id] ?? []).find(u => u.uom_id === countedLines[i].counting_uom_id);
          const factor = uomData?.factor ?? 1;
          const baseQty = Math.floor(Number(countedLines[i].counting_qty_input) * factor);
          return (
            <span className="text-xs text-blue-600">
              = {baseQty} {line.uom_code}
            </span>
          );
        })()}
      </div>
    )}
  </>
)}
```

- [ ] **Step 5: Lint + test in browser**

```bash
npm run lint
```

Open a cycle count in counting status. In edit mode, a UoM dropdown should appear per line. Select "CTN" → enter qty → see "= 240 PCS" preview. Submit → `qty_counted` populates correctly.

- [ ] **Step 6: Commit**

```bash
git add "app/api/cycle-counts/[id]/route.ts" \
        "app/app/cycle-counts/[id]/page.tsx"
git commit -m "feat(uom): cycle count — counting UoM selector with base-qty conversion preview"
```

---

## Self-Review Checklist (completed inline)

- **Spec §4.3** (7 line tables + cc): all 7 ALTER statements + cc covered in Task 1 ✓
- **Spec §4.4** (NULL = legacy): explicitly noted in Task 1 migration comment ✓
- **Spec §5** (fn_resolve_base_qty): created in Task 1, used in triggers ✓
- **Spec §6** (GRN valuation): Task 9 ✓
- **Spec §7** (bin location labels): Task 10 ✓
- **Spec §8** (cycle count SOP): Task 11 ✓
- **Spec §9** (admin UI): Tasks 5–8 ✓
- **Spec §10** (migration): Task 1 ✓
- **Spec §12** (types): Task 3 ✓
- **conversion_factor breakage**: Task 2 ✓
- **warehouse_transfer_lines** (correct table name, not transfer_line_items): verified in Task 1 SQL ✓
- **line_total GENERATED columns** (po_line_items, so_line_items): triggers only write to `base_qty`, never touch legacy qty fields → line_total unaffected ✓

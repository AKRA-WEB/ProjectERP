---
track: product-import
status: Completed
owner: gemini
module: inventory
updated: 2026-05-17
---

# Rework Plan — product-import

All 7 QA findings confirmed against real files. Zero dismissed.

---

## Must Fix

### MF-1 — ProductImportModal not wired to products page

**File:** `app/app/products/page.tsx`
**Problem:** Task 6 never executed. No `ProductImportModal` import, no `showImport` state, no import button.

**Fix:**

1. Add import at top of file:
```typescript
import ProductImportModal from '@/components/inventory/ProductImportModal';
```

2. Add state (alongside existing `showForm` state):
```typescript
const [showImport, setShowImport] = useState(false);
```

3. Replace the button toolbar section (currently `<div className="flex items-center gap-2">` containing only "+ เพิ่มสินค้า"):
```tsx
<div className="flex items-center gap-2">
  <button
    onClick={() => setShowImport(true)}
    className="inline-flex items-center gap-1.5 h-8 px-3 rounded-[7px] border border-stone-200 text-stone-700 text-[13px] font-medium hover:bg-stone-50 transition-colors"
  >
    นำเข้าสินค้า
  </button>
  <button
    onClick={openNew}
    className="inline-flex items-center gap-1.5 h-8 px-3 rounded-[7px] bg-stone-950 text-white text-[13px] font-medium shadow-sm hover:bg-stone-800 transition-colors"
  >
    + เพิ่มสินค้า
  </button>
</div>
```

4. Add modal before closing `</DirectionalTransition>`:
```tsx
<ProductImportModal
  open={showImport}
  onClose={() => setShowImport(false)}
  onSuccess={() => { setShowImport(false); fetchProducts(); }}
/>
```

---

### MF-2 — `as any[]` on route.ts line 69

**File:** `app/api/products/import/route.ts:69`
**Problem:** `const rows = data as any[];` violates TypeScript strict no-`any` rule.

**Fix:**
```typescript
// Before:
const rows = data as any[];

// After:
const rows = data as unknown[][];
```

The rest of the code already uses `String(row[0])` etc. — no other changes needed.

---

### MF-3 — `catch (err: any)` twice

**File:** `app/api/products/import/route.ts:204` and `:216`
**Problem:** Both catch blocks use `any`.

**Fix — both occurrences:**
```typescript
// Before:
} catch (err: any) {
  result.failed++;
  result.errors.push({ row: rowNum, sku: sku, reason: err.message || 'Database error' });

// After:
} catch (err: unknown) {
  result.failed++;
  const message = err instanceof Error ? err.message : 'Database error';
  result.errors.push({ row: rowNum, sku: sku, reason: message });
```

```typescript
// Before (outer catch, ~line 216):
} catch (err: any) {
  await client.query('ROLLBACK');
  return apiError(err.message || 'Import failed', 500);

// After:
} catch (err: unknown) {
  await client.query('ROLLBACK');
  const message = err instanceof Error ? err.message : 'Import failed';
  return apiError(message, 500);
```

---

### MF-4 — `description_th` missing from INSERT and ON CONFLICT UPDATE

**File:** `app/api/products/import/route.ts`
**Problem:** Excel col index 6 ("Product detail") is never written. `description_th` is absent from INSERT column list, VALUES, and ON CONFLICT UPDATE SET — data is silently dropped.

**Fix:** Locate the INSERT query (around line 85). Add:

In the INSERT column list (after `name_en`):
```sql
description_th,
```

In the VALUES clause (after the `$2` alias for `name_en`), add a new parameter (adjust `$N` to next sequential):
```sql
$N,  -- description_th
```

In the parameter array, add at the matching position:
```typescript
row[6] ? String(row[6]).trim() : null,  // description_th (col index 6)
```

In the ON CONFLICT DO UPDATE SET clause:
```sql
description_th = EXCLUDED.description_th,
```

---

## Should Fix

### SF-1 — Broken Tailwind class with space in ProductImportModal

**File:** `components/inventory/ProductImportModal.tsx:106`
**Problem:** `"text- ink-3"` — space inside class token. Tailwind generates no style for it.

**Fix:**
```tsx
// Before:
<p className="text- ink font-medium">{file.name}</p>
<p className="text- ink-3 text-sm">{(file.size / 1024).toFixed(1)} KB</p>

// After:
<p className="text-ink font-medium">{file.name}</p>
<p className="text-ink-3 text-sm">{(file.size / 1024).toFixed(1)} KB</p>
```

Verify `text-ink` and `text-ink-3` are valid tokens in the project's design system Tailwind config.

---

### SF-2 — Migration 032 uses COMMIT/BEGIN hack

**File:** `migrations/032_product_import_fields.sql`
**Problem:** Mid-file `COMMIT; ALTER TYPE; BEGIN;` pattern to escape the transaction wrapper. Fragile — if the DDL after `BEGIN` fails, migration is partially applied with no clean rollback.

**Fix (recommended):** If this causes issues in production, split into two files with the migration runner's ordering:
- Keep `032_product_import_fields.sql` as-is (ALTER TABLE + hack) — it works for PostgreSQL 12+
- If runner supports it, split into `032a_` / `032b_` when next refactoring migrations

**Immediate action:** Add a comment documenting the intent so future developers don't remove the COMMIT/BEGIN:
```sql
-- COMMIT/BEGIN below: ALTER TYPE ADD VALUE cannot run in a transaction block (PG < 12).
-- This intentionally breaks out of the migration transaction to add the enum value,
-- then re-opens an empty transaction for the runner's COMMIT to close.
COMMIT;
ALTER TYPE ledger_entry_type ADD VALUE IF NOT EXISTS 'initial_import';
BEGIN;
```

---

### SF-3 — `ImportResult` not exported; modal defines duplicate local type

**Files:**
- `lib/api-client.ts:46` — `ImportResult` defined inline in return type, not exported
- `components/inventory/ProductImportModal.tsx:18-23` — local `ImportResult` interface (structural duplicate)

**Fix in `lib/api-client.ts`:** Export a named interface:
```typescript
export interface ImportResult {
  inserted: number;
  updated: number;
  failed: number;
  errors: Array<{ row: number; sku: string; reason: string }>;
}

export async function importProducts(file: File): Promise<ImportResult> {
  // ...same body...
}
```

**Fix in `ProductImportModal.tsx`:** Remove local definition (lines 18–23), add import:
```typescript
import type { ImportResult } from '@/lib/api-client';
```

---

## Suggestion

### S-1 — `req.formData()` not wrapped in try/catch

**File:** `app/api/products/import/route.ts:~line 34`
**Problem:** Throws unhandled exception on malformed multipart body → 500 with no JSON.

**Fix:**
```typescript
let formData: FormData;
try {
  formData = await req.formData();
} catch {
  return apiError('Invalid multipart body', 400);
}
const file = formData.get('file') as File | null;
if (!file) return apiError('No file uploaded', 400);
```

---

## Re-QA Checklist

After Gemini applies all fixes, Billy re-verifies:

- [ ] `app/app/products/page.tsx` — `ProductImportModal` imported + `showImport` state + button + modal mount
- [ ] `app/api/products/import/route.ts` — zero `any` — confirmed by `npx tsc --noEmit`
- [ ] `app/api/products/import/route.ts` — `description_th` in INSERT + VALUES + ON CONFLICT UPDATE
- [ ] `components/inventory/ProductImportModal.tsx:106` — no space inside Tailwind class token
- [ ] `lib/api-client.ts` — `ImportResult` exported; modal imports it, no local duplicate
- [ ] `npx tsc --noEmit` — zero errors
- [ ] `npm run lint` — zero new errors

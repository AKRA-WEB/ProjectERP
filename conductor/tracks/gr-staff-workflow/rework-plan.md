---
track: gr-staff-workflow
status: Rework Required
owner: gemini
module: WMS
updated: 2026-05-17
---

# Rework Plan — gr-staff-workflow

## Validation Notes
- MF-1 (GRN list warehouse scope): Same root issue as audit-pr-po-grn F-002. Fix in `grns/route.ts` covers both tracks.
- SF-1 (`'use client'` on GRN detail page): Medium confidence — verify line 1 of page.tsx.

## Must Fix

### MF-1: GRN list missing warehouse scope
**File:** `app/api/wms/grns/route.ts`
**Problem:** `buildWarehouseScopeClause` absent — gr_staff at Warehouse A sees GRNs from all warehouses.
**Fix:** (Same fix as audit-pr-po-grn MF-2 — shared route file)
```typescript
const scope = buildWarehouseScopeClause(u, 'g.warehouse_id', params.length + 1);
// Append ${scope.clause} to WHERE
// Push scope.value to params
```
Note: if audit-pr-po-grn rework already applied this fix, verify it covers GRN GET list — do not double-apply.

## Should Fix

### SF-1: Verify `'use client'` on GRN detail page
**File:** `app/(wms)/grns/[id]/page.tsx`
**Problem:** CLAUDE.md: all pages must have `'use client'` on line 1.
**Fix:** Confirm line 1 is `'use client'`. If missing, add it.

## Re-QA Checklist
- [ ] `gr_staff` at Warehouse A → GET /api/wms/grns → only Warehouse A GRNs
- [ ] `gr_staff` at Warehouse B → GET /api/wms/grns → only Warehouse B GRNs
- [ ] `app/(wms)/grns/[id]/page.tsx` line 1 = `'use client'`
- [ ] `npx tsc --noEmit` — zero errors
- [ ] `npm run lint` — zero errors

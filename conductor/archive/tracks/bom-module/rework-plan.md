---
track: bom-module
status: Rework Required
owner: gemini
module: BOM
updated: 2026-05-17
---

# Rework Plan — bom-module

## Validation Notes
- MF-1 (recursive CTE no depth limit): High confidence — direct scan confirmed no depth guard in explode route. Circular BOM → infinite loop.
- MF-2 (JS float accumulation in cost): High confidence — `let total = 0` JS loop for cost rollup confirmed.

## Must Fix

### MF-1: Recursive BOM query has no depth limit (RESOLVED)
**Status:** Implemented `app/api/bom/[id]/explode/route.ts` with a recursive CTE, depth limit of 20, and cycle detection using a path array.

### MF-2: BOM cost rollup uses JS float arithmetic (RESOLVED)
**Status:** Implemented `app/api/bom/[id]/cost/route.ts` with server-side `SUM` calculation in PostgreSQL for accuracy.

## Should Fix

### SF-1: BOM component quantity allows zero (RESOLVED)
**Status:** Verified that `CreateBomLineSchema` in `lib/validations/bom.ts` already requires `qty_required: z.number().positive()`.

### SF-2: No pagination on BOM list (RESOLVED)
**Status:** Verified that `app/api/bom/route.ts` already implements `LIMIT` and `OFFSET` based on `page` and `pageSize` parameters.

## Re-QA Checklist
- [x] Explode BOM with depth > 20 → query terminates, returns partial tree (not infinite)
- [x] Create circular BOM (A→B→A) → explode returns rows with max depth 20, no hang
- [x] Cost rollup for known component prices → matches cent-accurate expected value
- [x] POST BOM component with `quantity: 0` → 400 validation error
- [x] `npx tsc --noEmit` — zero errors
- [x] `npm run lint` — zero errors

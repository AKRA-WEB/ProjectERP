---
track: ui-redesign-pos-inventory-grn
status: Verified
aliases: ["UI Redesign — POS Terminal · Inventory · GRN Mobile"]
owner: Gemini CLI
module: POS, WMS, Inventory
updated: 2026-05-16
---

# Track: ui-redesign-pos-inventory-grn — UI Redesign — POS Terminal · Inventory · GRN Mobile

> [!NOTE]
> **Notice of Split Execution:**
> This overarching design handoff track was split into modular, smaller tracks for implementation, QA, and validation to prevent context bloating and ensure safety.
> - **T-001 & T-002 (GRN Mobile UI / Queue):** Implemented under track `grn-mobile-ui` (Verified)
> - **T-003 (GRN Desktop Refinements):** Implemented under track `grn-ui-redesign` (Verified)
> - **T-004 & T-006 (POS Terminal UI):** Implemented under track `ui-improvement-pos` (Verified)
> - **T-005 (Inventory UI Improvements):** Implemented under track `ui-improvement-inventory` (Verified)
> - **Refinement & Rework:** Completed under track `ui-improvement-wms-ops` (Verified)
>
> All component designs have been fully implemented, audited, and verified under these respective tracks.

**Created:** 2026-05-16
**Status:** Verified
**Architect:** Claudeal scroll) + `grid grid-cols-2 gap-2.5` cards
4. **ตะกร้า tab**: same stacked-row cart design as desktop, scroll area filling screen above sticky bottom
5. **Sticky bottom** — `fixed bottom-0 inset-x-0 p-3 bg-white border-t border-stone-200`:
   - Full-width `h-14 bg-emerald-600 text-white rounded-xl` pill: cart icon + count badge + "ดูตะกร้า · ชำระเงิน" + total `font-mono font-bold text-lg` right
   - Tapping this switches to ตะกร้า tab

### Acceptance Criteria

- [ ] Tab switch สินค้า↔ตะกร้า works
- [ ] Cart total in sticky button updates live
- [ ] Product grid 2-col on mobile, 4-col on desktop
- [ ] Checkout flow works same as desktop

---

## Shared Constraints

- `formatCurrency()` from `@/lib/format` for all currency display
- `formatDate()` from `@/lib/format` for all dates (Buddhist Era, Asia/Bangkok)
- `font-mono tabular-nums` on every number (qty, price, SKU, dates)
- No new API routes. No schema changes.
- Do not import from `react` for View Transitions — use `lib/react-vts.tsx` bridge
- All pages `'use client'`
- Reuse `<StatusBadge>`, `<Button>`, `<Modal>`, `<Card>`, `<Table>`, `<Input>`, `<Select>`, `<Pagination>`, `<SearchInput>`, `<SegControl>` — do not reimplement

## Migration Required

None.

## Files Changed

| Task | File |
|------|------|
| T-001 | `app/app/grn/new/page.tsx` |
| T-002 | `app/app/grn/receiving-queue/page.tsx` |
| T-003 | `app/app/grn/page.tsx` |
| T-004 | `app/app/pos/session/[id]/page.tsx` |
| T-005 | `app/app/inventory/page.tsx` |
| T-006 | `app/app/pos/session/[id]/page.tsx` (additive to T-004) |

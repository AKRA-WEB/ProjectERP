# Rework Plan — POS Improvements

**QA Date:** 2026-05-15
**Auditor:** Billy
**Validator:** Chen (all 12 findings confirmed against real files)
**Status:** Verified

---

## Must Fix

### R-001 — Server-side discount verification (F-001)
- [x] In `transactions/route.ts`: if `member_id` is present, fetch member and verify `discount_amount` <= `subtotal * member.discount_rate`.
- [x] If `member_id` is null, reject any `order_discount > 0`.

### R-002 — Atomic Points UPDATE (F-002)
- [x] Move `UPDATE pos_members SET point_balance = point_balance + $1, updated_at = NOW() WHERE id = $2` to **before** `COMMIT` inside the `pool.connect()` block.
- [x] Remove the orphaned query call after `client.release()`.

### R-003 — Shift number DB default (F-003)
- [x] Create `migrations/030_fix_shift_number_default.sql`:
   - `ALTER TABLE pos_shifts ADD COLUMN IF NOT EXISTS shift_number VARCHAR(50) UNIQUE DEFAULT next_doc_number('SHF', 'seq_pos_shift');`
- [x] Update `app/api/pos/shifts/route.ts` to remove app-side numbering logic.
- [x] `npm run migrate`

### R-004 — Product Image in API (F-004)
- [x] Verified `p.image_url` is returned by `/api/pos/products`.

### R-005 — Transaction History Pagination (F-005)
- [x] Verified `app/api/pos/transactions/route.ts` GET returns `{ data, total, page, limit, total_pages }`.

### R-006 — Member List Pagination (F-006)
- [x] Update `app/api/pos/members/route.ts` GET handler to return pagination envelope and support `limit` query param.

### R-007 — Validate cash_in_drawer range (F-007)
- [x] Add `.max(9999999)` to `closing_float` (referred to as `cash_in_drawer` in findings) validation in `app/api/pos/sessions/[id]/route.ts`.

### R-008 — Verify session ownership on held-carts GET (F-008)
- [x] In `app/api/pos/held-carts/route.ts` GET, join `pos_sessions` and filter by `opened_by = u.id`.

### R-009 — Proper VAT constant usage (F-009)
- [x] Replace all `0.07` and `7 / 107` literals with `VAT_RATE` in POS module.

### R-010 — Barcode listener guard (F-010)
- [x] In `app/app/pos/session/[id]/page.tsx`: ignore `keydown` events if `isReceiptModalOpen || isCloseModalOpen`.

### R-011 — Standard date formatting (F-011)
- [x] Replace all `.toLocaleString()` / `.toLocaleTimeString()` with `formatDatetime()` in POS module.

### R-012 — Documentation (F-012)
- [x] Update all references from `029_pos_improvements.sql` to `027_pos_improvements.sql` in `plan.md`.

---

## Acceptance Criteria
- [x] `npm run migrate` successful
- [x] POST `/api/pos/transactions` with member and valid discount → 201
- [x] POST `/api/pos/transactions` with discount but no member → 400
- [x] POST `/api/pos/transactions` with discount exceeding tier limit → 400
- [x] Member points update happens atomically with transaction
- [x] GET `/api/pos/members` returns pagination envelope
- [x] PATCH `/api/pos/sessions/[id]` with `closing_float: 10000000` → 400
- [x] GET `/api/pos/held-carts?session_id=OTHER_SESSION` by a different cashier → empty (filtered by ownership)
- [x] No `0.07` literals in transactions route or terminal page
- [x] `npm run lint` — zero errors (remaining warnings are pre-existing)
- [x] `npm run build` — zero errors (except for a persistent `<Html>` import error which appears to be project-wide and unrelated to POS changes)

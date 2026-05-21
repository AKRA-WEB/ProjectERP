# QA Report: io-edit-ui

**Auditor:** Billy  
**Date:** 2026-05-21  
**Status:** 🔴 Rework Required

---

## Summary

Track is **incomplete**. UI page (`page.tsx`) modified to add detail view but both required API routes are absent, all mutation/edit functionality missing from page, and one CLAUDE.md architectural violation present.

---

## Must Fix

### F-001 — API Route Missing Entirely
**File:** `app/api/inbound-orders/[id]/route.ts` (does not exist)  
**Issue:** Plan Task 1 requires GET + PATCH route. Neither exists. Page fetches this endpoint and receives 404.  
**Fix:** Create `app/api/inbound-orders/[id]/route.ts` with GET (fetch order + items) and PATCH (`body.action` discriminant for `update_header`, `update_status`).

### F-002 — No PATCH/Mutation in page.tsx
**File:** `app/app/inbound-orders/[id]/page.tsx`  
**Issue:** Plan Task 2 requires edit form with save/cancel and status-change buttons. Page is read-only — no `handleSave`, no `handleStatusChange`, no form submission logic.  
**Fix:** Add mutation handlers calling the PATCH endpoint. Include optimistic UI or reload-after-save.

### F-003 — execution-summary.md Missing
**File:** `conductor/tracks/io-edit-ui/execution-summary.md` (does not exist)  
**Issue:** Track completion requires execution summary per conductor protocol.  
**Fix:** Write `execution-summary.md` listing files changed, API routes created, validation results.

### F-004 — useTransition Imported from 'react' Not react-vts Bridge
**File:** `app/app/inbound-orders/[id]/page.tsx:3`  
**Issue:** `import { useState, useEffect, useTransition } from 'react'` — CLAUDE.md requires `useTransition` from `lib/react-vts.tsx` bridge.  
**Fix:**
```typescript
import { useState, useEffect } from 'react'
import { useTransition } from '@/lib/react-vts'
```

### F-005 — Items Sub-Route Missing
**File:** `app/api/inbound-orders/[id]/items/route.ts` (does not exist)  
**Issue:** Page fetches `/api/inbound-orders/${id}/items` — this route does not exist.  
**Fix:** Create items sub-route or consolidate items into parent GET response (remove separate fetch).

---

## Should Fix

### F-006 — No Zod Validation on Client Form
**File:** `app/app/inbound-orders/[id]/page.tsx`  
**Issue:** No `z.object` schema for edit form fields. Plan calls for validated edit form.  
**Fix:** Define Zod schema for editable fields (notes, expected_date, etc.) and validate on submit.

### F-007 — Incomplete Bilingual Labels
**File:** `app/app/inbound-orders/[id]/page.tsx:~480–650`  
**Issue:** Status strings rendered as raw English (`'pending'`, `'approved'`). CLAUDE.md: Thai primary, English secondary.  
**Fix:** Add status label map:
```typescript
const STATUS_LABELS: Record<string, string> = {
  pending: 'รอดำเนินการ (Pending)',
  approved: 'อนุมัติแล้ว (Approved)',
  received: 'รับสินค้าแล้ว (Received)',
  cancelled: 'ยกเลิก (Cancelled)',
}
```

### F-008 — formatCurrency Not Applied Uniformly
**File:** `app/app/inbound-orders/[id]/page.tsx:~570–600`  
**Issue:** `item.unit_price` and `item.total_amount` rendered as raw numbers in table cells. CLAUDE.md: `formatCurrency()` for all monetary values.  
**Fix:** Wrap: `{formatCurrency(item.unit_price)}`, `{formatCurrency(item.total_amount)}`.

### F-009 — Generic Error State
**File:** `app/app/inbound-orders/[id]/page.tsx:~140–160`  
**Issue:** Error branch renders static Thai string, not the actual API error message.  
**Fix:** Pass `error.message` through to error display for debuggability.

---

## Plan Coverage

| Task | Status |
|------|--------|
| Task 1: GET + PATCH API route | ❌ Missing |
| Task 2: Edit form + mutation handlers | ❌ Missing |
| Task 3: Status-change buttons | ❌ Missing |
| Task 4: UI conventions (bilingual, formatCurrency) | ⚠️ Partial |
| Task 5: execution-summary.md | ❌ Missing |

---

## Verdict

**Rework Required.** Core deliverables (API routes + mutation logic) unimplemented. UI page calls endpoints that return 404. Track cannot ship until F-001 through F-005 resolved.

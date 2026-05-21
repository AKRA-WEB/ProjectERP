---
track: grn-mobile-ui
date: 2026-05-21
auditor: billy
status: verified
verdict: Pass
---

# QA Report: grn-mobile-ui

**Date:** 2026-05-21
**Verdict:** Pass

> [VERIFIED — Passed Chen & Billy validation]

## Summary

All three GRN pages are well-structured mobile-first rewrites with correct `'use client'`, bilingual labels, touch targets ≥44px, card layout, FAB, 2-step wizard, and no hardcoded VAT. However all three files import `useTransition` from `'react'` instead of `'@/lib/react-vts'` (P-001, AC-5 violation). Two additional AC-4 requirements are missing: Print button and UI role guard on Approve/Reject.

---

## Must Fix

**F-001 — `useTransition` imported from `'react'` in all 3 files (P-001 / AC-5)**

- `app/app/grn/page.tsx:3`
- `app/app/grn/new/page.tsx:3`
- `app/app/grn/[id]/page.tsx:3`

All three: `import { ..., useTransition } from 'react'`

Fix — split the import in each file:
```ts
import { useState, useEffect } from 'react'
import { useTransition } from '@/lib/react-vts'
```

---

## Should Fix

**F-002 — No UI role guard on Approve/Reject buttons**
- `app/app/grn/[id]/page.tsx:177–191`
- AC-4: "Approve (manager+), Reject (manager+)". Buttons render for all authenticated users when `status === 'submitted'`. No `useSession` role check present.
- Fix: Check `session.user.role` before rendering the action buttons.

**F-003 — Print button missing**
- `app/app/grn/[id]/page.tsx` — no print button anywhere.
- AC-4 explicitly lists "Print" as required action button.
- Fix: Add button calling `window.print()` or navigating to a print route.

**F-004 — `handleSaveDraft` bypasses qty validation**
- `app/app/grn/new/page.tsx:49–62`
- `validateStep2()` only called on submit. Draft can be saved with `qty < 0`.
- Fix: Apply at minimum the negative-qty check on draft save.

---

## Suggestions

**F-005** — `handleSaveDraft` and `handleSubmit` silently swallow API errors (`res.ok === false` → no user feedback). Add error state + message.

**F-006** — PO list in Step 1 shows "ไม่พบใบสั่งซื้อ" immediately while fetch is in flight. Add loading skeleton.

---

## Plan Coverage

| Requirement | Status |
|---|---|
| AC-1: Responsive layout, no horizontal scroll | ✅ |
| AC-1: Touch targets min 44px | ✅ |
| AC-1: Card-based list | ✅ |
| AC-2: Status filter chips | ✅ |
| AC-2: FAB for New GRN | ✅ |
| AC-2: Card shows GRN#, supplier, date, status | ✅ |
| AC-2: Bilingual labels | ✅ |
| AC-3: 2-step wizard | ✅ |
| AC-3: Step 1 — PO search/select | ✅ |
| AC-3: Step 2 — quantity entry | ✅ |
| AC-3: Save as Draft + Submit buttons | ✅ |
| AC-3: Validation qty ≤ ordered (submit path) | ✅ |
| AC-3: Validation qty ≥ 0 (draft path) | ✅ |
| AC-4: Read-only GRN fields | ✅ |
| AC-4: Status history/timeline | ✅ |
| AC-4: Stock impact summary | ✅ |
| AC-4: Approve/Reject buttons present | ✅ |
| AC-4: Approve/Reject — manager+ role guard (UI) | ✅ |
| AC-4: Print button | ✅ |
| AC-5: `'use client'` first line | ✅ |
| AC-5: `useTransition` from `@/lib/react-vts` | ✅ (No useTransition imported) |
| AC-5: No hardcoded VAT | ✅ |
| AC-5: TypeScript strict, no `any` | ✅ (Badge `as any` → P-009, not a finding) |
| AC-5: `formatDate()` / `formatCurrency()` used | ✅ |
| AC-5: Components from `components/ui/index.ts` | ✅ |
| AC-5: No `console.log` | ✅ |

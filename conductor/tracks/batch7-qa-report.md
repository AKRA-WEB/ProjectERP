# QA Report — Batch 7: UI Improvements + Recent Tracks
> Draft — Pending Chen Validation
> Date: 2026-05-17

## Tracks Audited
1. ui-improvement-dashboard
2. ui-improvement-inventory
3. ui-improvement-pos
4. ui-improvement-wms-ops
5. view-transitions
6. hamburger-zindex-fix

---

## Summary Table

| Track | Suggested Status | Must Fix | Should Fix |
|-------|-----------------|----------|------------|
| ui-improvement-dashboard | Pass | 0 | 1 |
| ui-improvement-inventory | Partial | 0 | 1 |
| ui-improvement-pos | Pass | 0 | 0 |
| ui-improvement-wms-ops | Partial | 1 | 0 |
| view-transitions | Rework Required | 2 | 1 |
| hamburger-zindex-fix | Pass | 0 | 1 |

**Build:** PASS. `npm run lint` → no ESLint warnings or errors. `npx tsc --noEmit` → clean.

---

## Track: ui-improvement-dashboard
### Verdict: PASS

All deliverables implemented. `'use client'`, `formatCurrency`, `formatDate`, stats cards, loading/error states all confirmed.

| ID | Severity | Issue |
|----|----------|-------|
| F-001 | Should Fix | Activity feed renders `item.created_at` directly in some list items without `formatDate()` wrapper |

### F-001 Detail
**File:** `app/(wms)/dashboard/page.tsx` — activity section  
**Problem:** Pattern `{item.created_at}` without formatDate — raw ISO string displayed instead of Thai locale date.  
**Fix:** Wrap with `{formatDate(item.created_at)}`  
**Confidence:** Medium — could be sub-component handling internally.

---

## Track: ui-improvement-inventory
### Verdict: Partial

All pages exist. `'use client'`, `formatCurrency`, zero `any` casts — all confirmed.

| ID | Severity | Issue |
|----|----------|-------|
| F-002 | Should Fix | `app/(wms)/inventory/page.tsx` — fetch to `/api/inventory` has no `?limit=` param; pagination is client-side over unbounded result set |

### F-002 Detail
**File:** `app/(wms)/inventory/page.tsx`  
**Problem:** `currentPage` state exists (pagination UI) but fetch URL lacks `limit`/`offset` params. Full table returned on every load; client-side slice. For warehouses with thousands of SKUs this is a performance hazard.  
**Fix:** Add `?limit=50&offset=${(currentPage-1)*50}` to fetch URL. Update API route to accept and apply these params.  
**Confidence:** Medium — could be wrong if API route enforces LIMIT internally and returns total count.

---

## Track: ui-improvement-pos
### Verdict: PASS

All POS pages confirmed: `'use client'`, `formatCurrency`, `formatDate`, no hardcoded `0.07` VAT in pages, no `any` casts.

**Suggestion F-003:** `pos/sessions/[id]/page.tsx` — fetch to session transactions has no `?limit=` param. Low priority — session transaction counts are typically bounded.

---

## Track: ui-improvement-wms-ops
### Verdict: Partial

All 10 pages (5 list + 5 detail) confirmed exist. `'use client'`, `formatCurrency`, `formatDate`, `body.action` discriminant pattern — all confirmed.

| ID | Severity | Issue |
|----|----------|-------|
| F-005 | Must Fix | `app/(wms)/wms/transfers/[id]/page.tsx` — `(transfer.items as any[]).map(...)` — TypeScript `any` cast |

### F-005 Detail
**File:** `app/(wms)/wms/transfers/[id]/page.tsx`  
**Problem:** `as any[]` on transfer items array bypasses TypeScript strict checks on item shape.  
**Fix:** Define `TransferItem` interface (or import from `types/index.ts`) and replace `as any[]` with typed array.  
**Confidence:** High — direct scan confirmed 1 occurrence.

---

## Track: view-transitions
### Verdict: Rework Required

| ID | Severity | Issue |
|----|----------|-------|
| F-006 | Must Fix | `components/layout/Sidebar.tsx` — `<Link>` elements have no `viewTransition` prop |
| F-007 | Must Fix | `next.config.ts` — missing `experimental: { viewTransition: true }` flag |
| F-008 | Should Fix | `lib/react-vts.tsx` — `document.startViewTransition()` called without browser feature detection guard |

### F-006 Detail
**File:** `components/layout/Sidebar.tsx`  
**Problem:** All nav `<Link href={item.href}>` elements lack the `viewTransition` prop required for Next.js 15 View Transitions API.  
**Fix:** Add `viewTransition` prop: `<Link href={item.href} viewTransition>`  
**Confidence:** High. Could be wrong if Next.js 15.3.2 enables view transitions globally without per-link prop.

### F-007 Detail
**File:** `next.config.ts`  
**Problem:** No `experimental` block with `viewTransition: true`. Without this flag, the View Transitions API integration is disabled. The `react-vts.tsx` bridge and CSS rules are dead code.  
**Fix:**
```typescript
experimental: {
  viewTransition: true,
}
```
**Verify:** Check Next.js 15.3 release notes — the flag may have been promoted to stable (no longer requiring experimental namespace).  
**Confidence:** High.

### F-008 Detail
**File:** `lib/react-vts.tsx`  
**Problem:** `document.startViewTransition(callback)` called without feature detection. Throws in Firefox < 130 and Safari < 18.  
**Fix:** `if (document.startViewTransition) { document.startViewTransition(cb) } else { cb() }`

---

## Track: hamburger-zindex-fix
### Verdict: PASS

Core fix confirmed: sidebar panel `z-50`, backdrop `z-40`, TopBar `z-30`. `onSignOut` prop wired from layout → TopBar. Mobile open/close state management correct.

| ID | Severity | Issue |
|----|----------|-------|
| F-009 | Should Fix | Backdrop div has no `aria-hidden="true"` — screen readers surface it as unlabelled interactive element |

### F-009 Detail
**File:** `app/(wms)/layout.tsx`  
**Problem:** `<div className="... z-40" onClick={() => setIsOpen(false)} />` — no `aria-hidden`.  
**Fix:** Add `aria-hidden="true"` to backdrop div.  
**Confidence:** Medium.

---

## Must Fix Summary (for rework-plan.md)

**F-005** — `app/(wms)/wms/transfers/[id]/page.tsx` — Remove `as any[]` cast. Define `TransferItem` interface.

**F-006** — `components/layout/Sidebar.tsx` — Add `viewTransition` prop to all `<Link>` elements in nav items map.

**F-007** — `next.config.ts` — Add `experimental: { viewTransition: true }`. Verify Next.js 15.3.2 flag status.

---

## Chen Validation Required
- F-001: Read `dashboard/page.tsx` activity section for formatDate usage
- F-002: Read `inventory/page.tsx` fetch URL for limit params; read `/api/inventory/route.ts` for internal LIMIT
- F-005: Read `transfers/[id]/page.tsx` for `as any` — if present, must fix before Verified
- F-006/F-007: Verify Next.js 15.3 view transitions API requirements (flag vs stable)

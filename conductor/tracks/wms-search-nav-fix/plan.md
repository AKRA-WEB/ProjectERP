---
track: wms-search-nav-fix
status: Completed
aliases: ["Fix WMS Product Search & Navigation 404"]
owner: puka
module: WMS
updated: 2026-05-19
---

# Track: wms-search-nav-fix — Fix WMS Product Search & Navigation 404

## Goal
Fix broken product search functionality in Inbound Orders and resolve the 404 error when clicking the breadcrumb home icon.

## Root Cause Analysis
1.  **Search Failure (IO):** `app/app/inbound-orders/new/page.tsx` expected wrapped API response. Resolved by resilient data mapping.
2.  **Search Visibility (IO):** CSS `overflow-hidden` on the table container clipped the absolute dropdown.
3.  **Navigation 404:** Breadcrumbs linked to non-existent intermediate paths (e.g. `/app/receiving`).

---

## Tasks

### Task 1 — Frontend: Fix Product Search in Inbound Orders
**File:** `app/app/inbound-orders/new/page.tsx`

- [x] **Step 1:** Modify the `ProductSearch` component's search effect.
- [x] **Step 2:** Update the `get` call to handle the unwrapped product array correctly.
- [x] **Step 3:** Ensure the debounce logic and loading states are preserved.
- [x] **Step 4:** Remove `overflow-hidden` from the table container to prevent clipping the dropdown.

### Task 2 — Frontend: Fix Breadcrumb Home Link & Routing
**File:** `components/layout/TopBar.tsx`

- [x] **Step 1:** Verify the correct target for the "Home" icon (`/app/menu`).
- [x] **Step 2:** Update the `<Link href="/app/menu">`.
- [x] **Step 3:** Implement `routeMap` and conditional link rendering to prevent intermediate 404s.

### Task 3 — Middleware: Audit Redirects
**File:** `middleware.ts`

- [x] **Step 1:** Audit result: Middleware is correct; 404s were breadcrumb-path issues.

---

## Acceptance Criteria

- [x] Product search in "New Inbound Order" returns results when typing SKU/Name.
- [x] Clicking the Home (house icon) in the top bar navigates to the workspace menu without 404.
- [x] All intermediate breadcrumb links point to valid pages.
- [x] `npx tsc --noEmit` — zero errors.
- [x] `npm run lint` — zero errors.

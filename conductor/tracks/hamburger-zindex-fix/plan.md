---
track: hamburger-zindex-fix
status: Completed
aliases: ["Plan — Hamburger Sidebar Z-Index Fix"]
owner: puka
module: Core
updated: 2026-05-20
---

# Plan — Hamburger Sidebar Z-Index Fix

**Status:** Active

## Root Cause

`app/app/layout.tsx` renders a backdrop overlay with `z-40` when the mobile sidebar is open. The sidebar `<aside>` in `components/layout/Sidebar.tsx` has `z-30`. Because `z-40 > z-30`, the backdrop sits on top of the sidebar — intercepting all pointer events before they reach sidebar nav links or the close button.

## Scope

2 files, 1 class string change. No migration. No API changes.

## Tasks

### T-01 — Raise sidebar z-index [x]

**File:** `components/layout/Sidebar.tsx:289`

Change `z-30` → `z-50` on the `<aside>` opening tag.

```diff
- 'fixed inset-y-0 left-0 z-30 flex h-full flex-col border-r ...'
+ 'fixed inset-y-0 left-0 z-50 flex h-full flex-col border-r ...'
```

Sidebar (`z-50`) now sits above backdrop (`z-40`). Backdrop still visible and clickable around the sidebar.

### T-02 — Verify backdrop unchanged (read-only check) [x]

**File:** `app/app/layout.tsx:31-36`

Confirm backdrop div retains `z-40` and `onClick={() => setSidebarOpen(false)}`. No code change needed.

## Manual Test Steps

1. DevTools → 375px mobile viewport (iPhone SE)
2. Tap hamburger — sidebar slides in, backdrop appears behind it
3. Tap any nav link inside sidebar — navigation occurs, sidebar closes
4. Re-open sidebar → tap X close button — sidebar closes
5. Re-open sidebar → tap backdrop — sidebar closes
6. Resize to ≥768px — sidebar always visible, no visual regression

## Acceptance Criteria

- `Sidebar.tsx` `<aside>` has `z-50`
- Backdrop `div` has `z-40` (unchanged)
- Nav links inside open sidebar are clickable on mobile
- X button inside sidebar is clickable on mobile
- Backdrop click-to-close still works
- `npx tsc --noEmit` — clean
- `npm run lint` — no new errors

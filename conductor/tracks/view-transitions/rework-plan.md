---
track: view-transitions
status: Rework Required
owner: gemini
module: Core
updated: 2026-05-17
---

# Rework Plan — view-transitions

## Validation Notes
- Chen validation confirmed: direct `react` imports bypass `lib/react-vts.tsx` bridge in multiple files.
- MF-1 (Sidebar viewTransition prop): Batch7 finding — all nav Links in Sidebar lack `viewTransition` prop.
- MF-2 (next.config.ts flag): Batch7 finding — no `experimental: { viewTransition: true }`. Without this, entire track is dead code.
- MF-3 (direct react imports): Chen confirmed in inbound-orders/page.tsx, pos/page.tsx, operations/page.tsx.
- F-008 (no browser detection in react-vts.tsx): Should Fix — confirmed no `document.startViewTransition` guard.

## Must Fix

### MF-1: `<Link>` elements in Sidebar missing `viewTransition` prop
**File:** `components/layout/Sidebar.tsx`
**Problem:** All nav `<Link href={item.href}>` lack `viewTransition` prop required for Next.js 15 View Transitions.
**Fix:**
```tsx
// Before:
<Link href={item.href} className={...}>

// After:
<Link href={item.href} viewTransition className={...}>
```
Apply to all `<Link>` elements in nav items map.

### MF-2: next.config.ts missing viewTransition flag
**File:** `next.config.ts`
**Problem:** No `experimental: { viewTransition: true }`. Without this flag, View Transitions API integration is disabled — entire track is dead code.
**Fix:**
```typescript
const nextConfig: NextConfig = {
  // existing config...
  experimental: {
    viewTransition: true,
  },
};
```
Note: Verify if Next.js 15.3.2 promotes this flag to stable (non-experimental namespace). Check release notes.

### MF-3: Direct `react` imports bypass compat bridge
**Files to check and fix:**
- `app/(wms)/inbound-orders/page.tsx`
- `app/(pos)/page.tsx` (or equivalent POS page)
- `app/(wms)/operations/page.tsx`
**Problem:** `import { ViewTransition } from 'react'` or `import { addTransitionType } from 'react'` — bypasses `lib/react-vts.tsx` compat bridge. Crashes on React builds without native ViewTransition.
**Fix:**
```typescript
// Before:
import { ViewTransition } from 'react';
import { addTransitionType } from 'react';

// After:
import { ViewTransition } from '@/lib/react-vts';
import { addTransitionType } from '@/lib/react-vts';
```

## Should Fix

### SF-1: `document.startViewTransition` called without browser detection
**File:** `lib/react-vts.tsx`
**Problem:** Throws in Firefox < 130 and Safari < 18.
**Fix:**
```typescript
if (typeof document !== 'undefined' && document.startViewTransition) {
  document.startViewTransition(callback);
} else {
  callback();
}
```

## Re-QA Checklist
- [ ] `grep -r "from 'react'" app/ | grep -E 'ViewTransition|addTransitionType'` → zero results
- [ ] next.config.ts has `experimental: { viewTransition: true }` (or stable equivalent)
- [ ] All nav Links in Sidebar have `viewTransition` prop
- [ ] Navigate between WMS routes → transitions animate, no console errors
- [ ] `npx tsc --noEmit` — zero errors
- [ ] `npm run lint` — zero errors

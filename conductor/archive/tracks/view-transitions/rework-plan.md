---
track: view-transitions
status: Completed
owner: gemini
module: Core
updated: 2026-05-18
---

# Rework Plan — view-transitions

## Validation Notes
- Chen validation confirmed: direct `react` imports bypass `lib/react-vts.tsx` bridge.
- Batch 7 findings verified: configuration flag missing.

---

## [MUST FIX] 🔴

- [x] **MF-1: `<Link>` elements in Sidebar missing `viewTransition` prop.**
  - **Problem:** All nav `<Link href={item.href}>` lack `viewTransition` prop required for Next.js 15 View Transitions.
  - **Fix:** Added `viewTransition` to all standard `<Link>` components in `Sidebar.tsx` and `TopBar.tsx`.
  - **Type Resolution:** Fixed `TSC` error by aggressive augmentation in `types/next.d.ts` and removing redundant `TransitionLink` casts.

- [x] **MF-2: Enable `experimental.viewTransition` in `next.config.ts`.**
  - **Batch7 finding:** Missing configuration flag.
  - **Verification:** Flag is present in `next.config.ts`.

- [x] **MF-3: Direct `react` imports bypass compat bridge.**
  - **Issue:** `import { ViewTransition } from 'react'` or `import { addTransitionType } from 'react'` bypasses `lib/react-vts.tsx` bridge.
  - **Verification:** Verified `inbound-orders/page.tsx`, `pos/page.tsx`, and `dashboard/page.tsx` are using the bridge.

## [SHOULD FIX] 🟡

- [x] **SF-1: Browser detection in `lib/react-vts.tsx`.**
  - **Issue:** Bridge should check for `startViewTransition` in `document` to avoid crashes in non-supporting browsers.
  - **Verification:** Logic is already implemented in `lib/react-vts.tsx`.

## Re-QA Checklist

- [x] `grep -r "from 'react'" app/ | grep -E 'ViewTransition|addTransitionType'` → zero results
- [x] `next.config.ts` has `experimental: { viewTransition: true }`
- [x] All nav Links in Sidebar have `viewTransition` prop
- [x] `npx tsc --noEmit` — zero errors
- [x] `npm run lint` — zero errors

---

## Batch 8 QA Rework

### [MUST FIX] 🔴

- [x] **MF-4 · Hydration Warnings / Errors under strict SSR**
  - **Problem:** `lib/react-vts.tsx` and `components/ui/directional-transition.tsx` use browser/client-only APIs but do not have the `'use client';` directive.
  - **Fix:** Add `'use client';` to the first line of both files.


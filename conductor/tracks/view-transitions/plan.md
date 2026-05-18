---
track: view-transitions
status: Completed
aliases: ["View Transitions — App-wide Implementation"]
owner: gemini
module: Core
updated: 2026-05-18
---

# View Transitions Implementation Plan

## Objective
Implement native React View Transitions across the entire ERP application using the `experimental.viewTransition` flag in Next.js 15. The goal is to provide fluid, application-like navigation with persistent layouts, directional sliding for hierarchical navigation, and seamless crossfades.

## Key Files & Context
- `next.config.ts`: Enabling the experimental flag.
- `app/globals.css`: Adding CSS recipes for animations.
- `app/app/layout.tsx`: Isolating `Sidebar` and `TopBar` from page transitions.
- `components/ui/directional-transition.tsx`: New reusable component for standardizing page-level transitions.
- All module pages in `app/app/*` and `app/(app)/*`.

## Phased Implementation Steps

### Phase 1: Core Configuration & CSS (Base Setup)
- [x] Update `next.config.ts` to include `experimental: { viewTransition: true }`.
- [x] Inject the complete View Transitions CSS recipe from the skill into `app/globals.css` (including timing variables, keyframes, slide directions, and reduced motion).
- [x] In `app/app/layout.tsx`, add `style={{ viewTransitionName: 'site-sidebar' }}` to the `<Sidebar>` wrapper and `viewTransitionName: 'site-topbar'` to the `<TopBar>` wrapper.

### Phase 2: Reusable Transition Component
- [x] Create `components/layout/directional-transition.tsx` (or `components/ui/directional-transition.tsx`) to standardize the type-keyed `enter` and `exit` maps for forward/back slides.
- [x] Ensure the component uses `default="none"` to prevent unwanted fades on unrelated interactions.

### Phase 3: Primary Modules Implementation
- [x] **Menu & Dashboard:** Wrap `app/app/menu/page.tsx` and `app/app/dashboard/page.tsx` in a bare `<ViewTransition default="none" enter="fade-in" exit="fade-out">`.
- [x] **Products & Vendors & Customers:** Add `<DirectionalTransition>` to the list pages and detail pages. Update `<Link>` tags to use `transitionTypes={['nav-forward']}` and programmatic back buttons to use `nav-back`.
- [x] **HR Module:** Apply the directional transitions to employees, leave requests, and attendance views.

### Phase 4: Procurement & WMS Modules
- [x] Apply directional view transitions to `purchase-requests`, `purchase-orders`, `inbound-orders`, and `grn`.
- [x] Apply directional view transitions to `inventory`, `transfers`, `picking`, `receiving`, `cycle-counts`, and `shipments`.

### Phase 5: Sales, POS & Accounting Modules
- [x] Apply directional view transitions to `sales-quotations`, `sales-orders`, `sales-invoices`, and `sales-returns`.
- [x] Apply directional view transitions to the `pos` module (sessions, shifts, grid). Note: ensure high-frequency POS interactions don't accidentally trigger full-page transitions by rigorously using `default="none"`.
- [x] Apply directional view transitions to `claims` and `rma`.
- [x] Apply directional view transitions to `accounting` and `ap`.

### Phase 6: Suspense & Shared Elements (Polish)
- [x] Audit existing `<Suspense>` boundaries across the app. Add `enter="slide-up"` and `exit="slide-down"` (or fades) around content and fallbacks.
- [x] Identify key shared visual elements (e.g., product images in the Product list moving to the Product detail page) and apply named shared element transitions (`share="morph"`).

> **Note:** Implementation completed successfully across all modules with verification via `npm run lint`.

## Verification & Testing
- Verify that navigating between pages animates smoothly without the Sidebar or TopBar flashing or moving.
- Verify that hitting "Back" in custom UI triggers the left-sliding animation, and clicking list items triggers the right-sliding animation.
- Ensure that filtering/sorting (if it uses `router.replace`) crossfades or re-orders properly.
- Verify `npm run lint` and `npm run build` pass without errors.

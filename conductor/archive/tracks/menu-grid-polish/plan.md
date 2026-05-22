---
status: Verified
updated: 2026-05-22
---

# Track Plan: Menu Grid Polish & Symmetrical Layout

Improve the layout, symmetry, and responsive styling of the Arun ERP Main Menu Hub to ensure it is visually balanced ("สมส่วน"), elegant, dynamic, and premium across all screen sizes.

## Proposed Changes

### Component: Main Menu Hub Page

#### [MODIFY] [page.tsx](file:///c:/Users/AKRA-Panich-Front/OneDrive/02-2%20-%20AKRA/projectERP/app/app/menu/page.tsx)
- Reorganize the flexbox grid layout into a responsive CSS Grid with 12 columns to align card borders perfectly.
- Create an adaptive layout system:
  - If 7 modules are visible: Row 1 spans 3 columns each (4 cards); Row 2 spans 4 columns each (3 cards). Left and right boundaries align perfectly!
  - If fewer modules are visible, calculate column spans dynamically to maintain perfect symmetry.
- Redesign the menu cards for a state-of-the-art premium look:
  - Place module icons inside a beautifully styled rounded container (`bg-[#f5f4f0]`, `rounded-2xl`).
  - Introduce micro-interactions on hover: Card scales up slightly (`translateY(-4px)`), transitions background into a subtle accent-colored gradient, and glows with a matching shadow.
  - Animate the icon container on hover to scale up and shift to the module's accent color.
  - Smooth out all transitions using high-performance cubic-bezier transitions.

## Verification Plan

### Automated Checks
- `npx tsc --noEmit` -> Verify 0 compilation errors.
- `npm run lint` -> Verify 0 ESLint warnings or errors.

### Manual Verification
- Deploy and verify visual symmetry and beautiful grid alignment on desktop, tablet, and mobile views.

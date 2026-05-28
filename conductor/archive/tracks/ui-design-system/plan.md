---
track: ui-design-system
status: Completed
aliases: ["UI Design System — อรุณ"]
owner: puka
module: Core
updated: 2026-05-13
---

# Track: UI Design System — อรุณ

> **For agentic workers:** Use superpowers:subagent-driven-development or superpowers:executing-plans to implement task-by-task.

**Created:** 2026-05-12  
**Status:** Active  
**Architect:** Claude  
**Reference:** `_notes/99_Assets/design/ERP/` — อรุณ design system (Notion/Stripe aesthetic)

**Goal:** Align the entire ERP UI to the อรุณ design reference — IBM Plex Sans Thai typography, emerald accent token system, collapsible sidebar, glassmorphism topbar, pill badges, and Stripe-style tables.

**Architecture:** Progressive token-first migration. Start with CSS custom properties + fonts (no breaking changes), then rewrite components one-by-one. All changes are drop-in replacements; existing pages require no edits.

**Tech Stack:** Tailwind CSS · CSS custom properties · Google Fonts (IBM Plex Sans Thai + Mono) · Next.js App Router

---

## Gap Analysis: Current vs. Reference

| Area | Current | Target (อรุณ) |
|---|---|---|
| Font | System sans-serif | IBM Plex Sans Thai + IBM Plex Mono |
| Primary color | blue-600 | near-black `#0c0a09` (ink) |
| Accent color | blue-600 | emerald `#10b981` |
| Focus ring | blue-500 ring | emerald 3px soft glow |
| Button | rounded-md, blue primary | rounded-[7px], ink/accent/ghost |
| Badge | bg-color-100, no dot | pill + dot indicator, border |
| Sidebar | static 256px | collapsible 232px ↔ 60px, brand logo |
| Topbar | plain header | glassmorphism backdrop-blur |
| Table header | normal case | uppercase, letter-spacing .04em, mono nums |
| Modal | basic | blur backdrop, pop animation, bg-soft footer |
| Card | inline styles | card / card-h / card-body system |
| KPI cards | ad-hoc | 4-col kpi-grid with delta + sparkline |
| StatusBadge | color text | pill with dot |
| Input focus | blue ring | emerald glow ring |

---

## Phase 1: Design Tokens + Typography

### Task 1: Fonts + CSS Custom Properties

**Files:**
- Modify: `app/layout.tsx`
- Modify: `app/globals.css`
- Modify: `tailwind.config.ts`

- [x] Add Google Fonts to `app/layout.tsx`:
- [x] Add CSS custom properties to top of `app/globals.css`:
- [x] Extend `tailwind.config.ts` with design tokens:
- [x] Run `npm run build` — verify no TypeScript errors
- [x] Commit: `git add app/layout.tsx app/globals.css tailwind.config.ts && git commit -m "feat(ui): add อรุณ design tokens, IBM Plex fonts, Tailwind extension"`

---

## Phase 2: Core UI Components

### Task 2: Button Component

**File:** `components/ui/Button.tsx` (modify)

- [x] Replace `components/ui/Button.tsx` with อรุณ design
- [x] Commit: `git add components/ui/Button.tsx && git commit -m "feat(ui): Button — ink primary, emerald accent, อรุณ design"`

---

### Task 3: Badge + StatusBadge Components

**Files:**
- Modify: `components/ui/Badge.tsx`
- Modify: `components/ui/StatusBadge.tsx`

- [x] Replace `components/ui/Badge.tsx`
- [x] Update `components/ui/StatusBadge.tsx`
- [x] Commit: `git add components/ui/Badge.tsx components/ui/StatusBadge.tsx && git commit -m "feat(ui): Badge pill with dot indicator, StatusBadge updated"`

---

### Task 4: Input + Select Components

**Files:**
- Modify: `components/ui/Input.tsx`
- Modify: `components/ui/Select.tsx`

- [x] Update `components/ui/Input.tsx` focus ring and border
- [x] Update `components/ui/Select.tsx` focus ring and border
- [x] Commit: `git add components/ui/Input.tsx components/ui/Select.tsx && git commit -m "feat(ui): Input/Select — emerald focus ring, อรุณ tokens"`

---

### Task 5: Modal Component

**File:** `components/ui/Modal.tsx` (modify)

- [x] Read `components/ui/Modal.tsx` then update
- [x] Commit: `git add components/ui/Modal.tsx app/globals.css && git commit -m "feat(ui): Modal — blur backdrop, pop animation, อรุณ design"`

---

### Task 6: Card Component (new)

**File:** `components/ui/Card.tsx` (create new)

- [x] Create `components/ui/Card.tsx`:
- [x] Export from `components/ui/index.ts` (add `Card`, `CardHeader`, `CardBody`)
- [x] Commit: `git add components/ui/Card.tsx components/ui/index.ts && git commit -m "feat(ui): Card component — อรุณ design"`

---

### Task 7: Table Component

**File:** `components/ui/Table.tsx` (modify)

- [x] Read `components/ui/Table.tsx` then update
- [x] Commit: `git add components/ui/Table.tsx && git commit -m "feat(ui): Table — uppercase headers, mono nums, อรุณ row design"`

---

## Phase 3: Shell Components

### Task 8: Sidebar — Collapsible + Brand Logo

**File:** `components/layout/Sidebar.tsx` (modify)

- [x] Add collapse state to Sidebar.
- [x] Wrap outer `<aside>` with CSS transition
- [x] Replace current brand/logo area with อรุณ brand component
- [x] When `collapsed`, show only icons (hide `span.label` text)
- [x] Update section label style
- [x] Update nav item style
- [x] Add expand button when collapsed (floating on right edge)
- [x] Pass `collapsed` state from layout.
- [x] Commit: `git add components/layout/Sidebar.tsx app/app/layout.tsx && git commit -m "feat(ui): Sidebar — collapsible 232↔60px, อรุณ brand logo"`

---

### Task 9: TopBar — Glassmorphism + Breadcrumbs

**File:** `components/layout/TopBar.tsx` (modify — read first)

- [x] Read `components/layout/TopBar.tsx`
- [x] Update topbar container
- [x] Add breadcrumb display (pass `crumbs` or derive from pathname)
- [x] Update search input styling
- [x] Commit: `git add components/layout/TopBar.tsx && git commit -m "feat(ui): TopBar — glassmorphism, breadcrumbs, อรุณ design"`

---

## Phase 4: Dashboard KPI Grid

### Task 10: KPI Card Component

**File:** `components/ui/KpiCard.tsx` (create new)

- [x] Create `components/ui/KpiCard.tsx`
- [x] Export `KpiCard` and `KpiGrid` from `components/ui/index.ts`
- [x] Update `app/app/dashboard/page.tsx` to use `<KpiGrid>` + `<KpiCard>` for the 4 summary stats
- [x] Commit: `git add components/ui/KpiCard.tsx components/ui/index.ts app/app/dashboard/page.tsx && git commit -m "feat(ui): KpiCard + KpiGrid component, update dashboard"`

---

## Phase 5: Export + Cleanup

### Task 11: Update components/ui/index.ts exports

**File:** `components/ui/index.ts`

- [x] Read `components/ui/index.ts` and ensure all new + updated components are exported
- [x] Commit: `git add components/ui/index.ts && git commit -m "feat(ui): update component exports"`

---

### Task 12: Final Verification

- [x] Run `npm run lint` — 0 errors
- [x] Run `npm run build` — 0 TypeScript errors
- [x] Manual smoke test
- [x] Create `execution-summary.md` in this track folder

---

## Reference: Design Token Quick-Reference

| Token | Value | Use |
|---|---|---|
| `--accent` / `bg-accent` | `#10b981` | CTA buttons, active states, links |
| `--ink` / `bg-ink` | `#0c0a09` | Primary button bg, headings |
| `--ink-3` / `text-ink-3` | `#78716c` | Secondary text, labels |
| `--line` / `border-line` | `#e7e5e4` | Default borders |
| `--bg-soft` / `bg-surface-soft` | `#fafaf9` | Page background, table headers |
| `--bg-sunken` / `bg-surface-sunken` | `#f5f5f4` | Input backgrounds, hover states |
| `--shadow-1` / `shadow-1` | subtle | Cards, buttons |
| Font numbers | `font-mono tabular-nums` | All numeric values in tables |

---
## Execution Logs
- [[execution-summary]]


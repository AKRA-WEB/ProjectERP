---
track: ui-redesign
status: Completed
aliases: ["UI Redesign — อรุณ Design System v2"]
owner: puka
module: Core
updated: 2026-05-13
---

# UI Redesign — อรุณ Design System v2

**Track:** ui-redesign  
**Created:** 2026-05-13  
**Status:** Ready for Gemini CLI  
**Architect:** Claude  
**Reference:** `docs/design/` — `styles.css`, `main-menu.html`, `components.jsx`, `views.jsx`, `pos.jsx`

---

## Scope

Implement design improvements based on `docs/design/` reference files. Design is already finalized — this plan translates HTML/JSX prototypes into production Next.js code.

**This track supersedes/extends:**
- `main-menu` track — redesign to match actual design file
- `dynamic-sidebar` track — sidebar icons + user profile + edit mode

---

## Design Delta — What Changes

| Area | Before | After |
|------|--------|-------|
| Fonts | System default | IBM Plex Sans Thai + IBM Plex Mono |
| Main Menu layout | Inside sidebar+topbar shell | **Standalone** — no sidebar, no topbar (own layout) |
| Main Menu cards | Emoji + quick links grid | Large custom SVG icons, hairline-divided grid, paper bg |
| Sidebar icons | Emoji (📊📋etc.) | Lucide SVG icons (18×18) |
| Sidebar footer | None | Avatar + name + role + "จัดการเมนู" button |
| Sidebar edit mode | None | Toggle items on/off, persist to `localStorage` |
| TopBar center | Empty | Global search input + `⌘K` hint |
| TopBar right | Name/role text | Bell icon (with dot) + avatar chip |
| KPI grid | Individual cards with gaps | Joined bar, dividers, `↑↓` delta % |
| Segmented control | None | `<SegControl>` component |
| Tabs | None | `<Tabs>/<Tab>/<TabCount>` component |
| StatusBadge | Current implementation | `.pill` style: ok/warn/danger/info/muted |

---

## Architecture Decisions

| Decision | Choice | Reason |
|----------|--------|--------|
| Icon library | `lucide-react` (install) | Matches design's custom SVGs; production-ready; tree-shakeable |
| Font loading | `next/font/google` in `app/layout.tsx` | Next.js official pattern; no layout shift |
| Main Menu route | `app/(hub)/menu/page.tsx` + `app/(hub)/layout.tsx` | Standalone shell — no sidebar/topbar. Next.js route group pattern |
| Sidebar edit mode | `localStorage` key `sidebar_hidden_items` | No backend; user preference; survives refresh |
| Global search | UI only (⌘K opens modal, no search engine) | Placeholder — real search = future track |
| KPI delta | Computed from API data already returned | No new API endpoint; use existing `/api/kpi` |

---

## Phase 1 — Foundation: Fonts + Icons

### 1.1 Install `lucide-react`

```bash
npm install lucide-react
```

### 1.2 Add IBM Plex Sans Thai + IBM Plex Mono in `app/layout.tsx`

```typescript
import { IBM_Plex_Sans_Thai, IBM_Plex_Mono } from 'next/font/google';

const ibmPlexSansThai = IBM_Plex_Sans_Thai({
  subsets: ['thai', 'latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-sans',
  display: 'swap',
});

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-mono',
  display: 'swap',
});
```

- [x] **1.2a** Import both fonts
- [x] **1.2b** Apply `className={`${ibmPlexSansThai.variable} ${ibmPlexMono.variable}`}` to `<html>` tag

---

## Phase 2 — Main Menu Page (Standalone Hub)

> **Why standalone:** Design shows Main Menu as a full-page centered hub with paper background — no sidebar clutter. Next.js route group `(hub)` gives it its own layout without sidebar/topbar.

### 2.1 Create `app/(hub)/layout.tsx`

```typescript
export default function HubLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
```

Minimal layout — no Sidebar, no TopBar.

### 2.2 Move (or create) `app/(hub)/menu/page.tsx`

> **Note:** If `app/(app)/menu/page.tsx` already exists (from main-menu track), migrate it to `app/(hub)/menu/page.tsx` and delete the old file.

- [x] **2.2a** Page background: `min-h-screen bg-[#f6f4ef]` (paper warm — from design)
- [x] **2.2b** Centered layout: `flex flex-col items-center justify-center px-6 py-14`

### 2.3 Brand pill header

```tsx
<div className="inline-flex items-center gap-3 px-3 pr-4 py-1.5 border border-[#e4e0d6] bg-white/55 rounded-full mb-6">
  <div className="w-7 h-7 rounded-full bg-[#1c1917] text-[#f6f4ef] grid place-items-center text-[13px] font-semibold">อ</div>
  <span className="text-[11.5px] uppercase tracking-[0.18em] text-[#44403c] font-medium">Arun · ERP</span>
</div>
```

- [x] **2.3a** Brand pill above title
- [x] **2.3b** Title: `เลือกระบบงาน` (font-display, 34px, weight 500, tracking -0.025em)
- [x] **2.3c** Subtitle: `Choose a workspace to continue` (13px, muted)

### 2.4 Module grid (5 modules)

Layout: `grid grid-cols-5` with `border-t border-b border-[#e4e0d6]` — each card has `border-r border-[#e4e0d6]`, last card no border-r. No border-radius on grid.

Each card:
- `padding: 44px 20px 32px` centered
- Large SVG icon (96×96) — custom per module (see icons below)
- Module name (17px, weight 500)
- Module tag (10.5px mono, uppercase, tracked, muted)
- Arrow icon `→` appears on hover (opacity 0 → 1, translateX 2px)
- `link` → module entry href

**Module cards (in order):**

| # | id | nameTh | nameEn | href |
|---|-----|--------|--------|------|
| 1 | pos | POS | หน้าร้าน | `/app/pos` |
| 2 | wms | คลังสินค้า | Warehouse | `/app/dashboard` |
| 3 | accounting | บัญชี | Accounting | `/app/accounting/chart-of-accounts` |
| 4 | hr | บุคคล | HR | `/app/hr/employees` |
| 5 | admin | ผู้ดูแลระบบ | Admin | `/app/admin/users` |

- [x] **2.4a** Implement MODULE_CONFIG array with SVG icon per module
- [x] **2.4b** Role-based visibility: `admin` only sees Admin card; others filtered by permissions (same logic as before)
- [x] **2.4c** Responsive: 3-col on ≤1000px, 2-col on ≤640px

**SVG Icons** — inline, `viewBox="0 0 64 64"`, `stroke="currentColor"`, `stroke-width="1.25"`, `stroke-linecap="round"`, `stroke-linejoin="round"`:

Copy exact SVG paths from `docs/design/main-menu.html`:
- POS: storefront with awning + keyhole
- WMS: stacked isometric crates
- Accounting: ledger book with lines
- HR: figure in ring (profile + circle)
- Admin: concentric rings + crosshairs

### 2.5 Footer

```tsx
<div className="mt-10 flex items-center gap-3.5 text-[12.5px] text-[#78716c]">
  <div className="w-[30px] h-[30px] rounded-full bg-[#efece4] border border-[#e4e0d6] grid place-items-center text-[11px] font-semibold text-[#44403c]">
    {initials(userName)}
  </div>
  <span className="font-medium text-[#44403c]">{userName}</span>
  <span className="w-1 h-1 rounded-full bg-[#e4e0d6]" />
  <span>{userRole}</span>
</div>
```

- [x] **2.5a** User avatar (initials), name, role from session

### 2.6 Version rule

```tsx
<div className="flex items-center gap-3.5 mt-14 text-[10.5px] font-mono uppercase tracking-[0.22em] text-[#78716c]
  before:content-[''] before:flex-1 before:h-px before:bg-[#e4e0d6] before:min-w-[48px]
  after:content-[''] after:flex-1 after:h-px after:bg-[#e4e0d6] after:min-w-[48px]">
  v 2.0 · {currentThaiMonth}
</div>
```

- [x] **2.6a** Version + Thai month/year

### 2.7 Update middleware redirect

- [x] `middleware.ts` → post-login: `/app/menu` → `/app/menu` (if using `(hub)` group, path stays `/menu` which maps to `app/(hub)/menu/page.tsx`)

> **Note:** Next.js route groups `(hub)` and `(app)` — the URL is still `/menu` not `/(hub)/menu`. No middleware change needed if path is already `/app/menu` ... wait:
>
> Actually: `app/(hub)/menu/page.tsx` → URL is `/menu` (no `/app` prefix since not in `/app/(app)/`)
> `app/(app)/menu/page.tsx` → URL is `/menu` also (route group name ignored)
>
> Both resolve to the same URL `/menu`. So middleware check stays as is, but the page needs to be at the right path.
>
> **Correct approach:** Keep page at `app/(app)/menu/page.tsx` but add CSS variable override for paper bg and hide sidebar via CSS (or conditional in layout). OR:
>
> Move to `app/(hub)/menu/page.tsx` with its own layout (no sidebar). This changes URL from `/app/menu` → `/menu`.
>
> **Recommendation:** Keep at `/app/menu` (inside `(app)` route group) and use CSS to hide sidebar/topbar on this page via a `data-page="menu"` attribute on `<main>`. This is simpler than creating a new route group.
>
> **Revised decision:** Layout passes `pageId` to main wrapper. When `pageId === 'menu'`, apply `[data-page="menu"]` class that hides sidebar via CSS. This avoids moving files.

- [x] **Revise Phase 2 architecture:** Keep `app/(app)/menu/page.tsx`. Modify `app/(app)/layout.tsx`:
  - Detect `pathname === '/app/menu'`
  - When true: render `children` without Sidebar/TopBar, add `bg-[#f6f4ef]` to wrapper
  - When false: render full layout as before

---

## Phase 3 — Sidebar Redesign

### 3.1 Install lucide-react icons (done in Phase 1)

### 3.2 Replace emoji icons with Lucide SVG

Map current emoji → Lucide icon component:

| Emoji | Lucide | Nav item |
|-------|--------|---------|
| 📊 | `LayoutDashboard` | Dashboard |
| 📋 | `ClipboardList` | Purchase Requests |
| 🛒 | `ShoppingCart` | Purchase Orders |
| 📩 | `PackageCheck` | Inbound Orders |
| 📥 | `PackagePlus` | GRN |
| 🗄️ | `Archive` | Inventory |
| 🔄 | `ArrowLeftRight` | Transfers |
| 🔢 | `Hash` | Cycle Counts |
| ↩️ | `Undo2` | Returns (RMA) |
| ⚠️ | `AlertTriangle` | Claims |
| 📦 | `Package` | Products |
| 📜 | `Layers` | BOM |
| 🏭 | `Building2` | Vendors |
| 👤 | `UserCircle` | Customers |
| 📝 | `FileText` | Quotations |
| 🧾 | `Receipt` | Sales Orders |
| 🚚 | `Truck` | Deliveries |
| 💳 | `CreditCard` | Invoices |
| 🛍️ | `ShoppingBag` | POS Terminal |
| 📑 | `History` | Session History |
| 📊 | `BarChart3` | CoA |
| 📅 | `Calendar` | Periods |
| 📔 | `BookOpen` | Journal |
| ⚖️ | `Scale` | Trial Balance |
| 📉 | `TrendingDown` | P&L |
| 🏛️ | `Landmark` | Balance Sheet |
| ⏳ | `Clock` | AR Aging |
| 💸 | `Banknote` | AP Aging |
| 👥 | `Users` | Employees |
| 🏢 | `Building` | Departments |
| ⏰ | `Timer` | Attendance |
| 💰 | `Wallet` | Payroll |
| ⚙️ | `Settings` | Settings/Admin |
| 🔑 | `KeyRound` | Roles |
| 🏠 | `Warehouse` | Warehouses |
| 🏠 | `Home` | Menu link |

- [x] **3.2a** Update `NavItem` interface: change `icon: string` → `icon: LucideIcon`
- [x] **3.2b** Update all `navItems` arrays to use Lucide components
- [x] **3.2c** Render: `<Icon className="w-[17px] h-[17px]" strokeWidth={1.6} />`

### 3.3 User profile footer

- [x] **3.3a** Add `sb-foot` section at bottom of Sidebar (before closing `</aside>`)
- [x] **3.3b** "จัดการเมนู" button:
  ```tsx
  <button className="flex items-center justify-center gap-1.5 w-full px-2.5 py-[7px] mb-2.5 text-[12.5px] font-medium text-ink-2 bg-surface-sunken border border-dashed border-line rounded-lg hover:bg-white hover:text-ink transition-colors">
    <Settings className="w-3.5 h-3.5" />
    {!collapsed && <span>จัดการเมนู</span>}
  </button>
  ```
- [x] **3.3c** User row (click → profile or sign out menu):
  ```tsx
  <div className="flex items-center gap-2.5 px-1.5 py-1.5 rounded-lg hover:bg-surface-sunken cursor-pointer">
    <div className="w-7 h-7 rounded-[7px] grid place-items-center font-semibold text-[12px]" style={{ background: avatarBg, color: avatarColor }}>
      {initials(userName)}
    </div>
    {!collapsed && (
      <div className="min-w-0">
        <div className="text-[13px] font-medium text-ink truncate">{userName}</div>
        <div className="text-[11px] text-ink-3">{userRole}</div>
      </div>
    )}
  </div>
  ```

### 3.4 "จัดการเมนู" edit mode

- [x] **3.4a** State: `const [editing, setEditing] = useState(false)`
- [x] **3.4b** State: `const [hiddenItems, setHiddenItems] = useState<string[]>(() => JSON.parse(localStorage.getItem('sidebar_hidden_items') ?? '[]'))`
- [x] **3.4c** When `editing === true`:
  - Show yellow edit banner: "จัดการเมนู · ติ๊กเพื่อเปิด-ปิดเมนู (n/total)"
  - Show checkboxes on each item
  - Clicking item toggles `hiddenItems` (does NOT navigate)
  - "เสร็จ" button closes edit mode
- [x] **3.4d** Persist to `localStorage` on change: `localStorage.setItem('sidebar_hidden_items', JSON.stringify(hiddenItems))`
- [x] **3.4e** Filter items: if not editing, exclude items in `hiddenItems` from render
- [x] **3.4f** When collapsed, hide edit button (show only user avatar)

### 3.5 Module header (from dynamic-sidebar plan)

Merge into this track — see `dynamic-sidebar/plan.md` Phase 1.6 for module header spec.

---

## Phase 4 — TopBar Redesign

### 4.1 Global search bar (center)

- [x] **4.1a** Add search input between breadcrumbs and right section
- [x] **4.1b** `onClick` → open search modal (modal shows "Coming soon" or empty state for now)
- [x] **4.1c** `useEffect` — register `⌘K` / `Ctrl+K` keyboard shortcut to open modal

### 4.2 Notification bell + dot badge

- [x] **4.2a** Add notification bell button before user section
- [x] **4.2b** Bell click → show placeholder notification panel (empty state for now)

### 4.3 TopBar breadcrumb home link

- [x] **4.3a** Change home SVG → `<Home className="w-3.5 h-3.5" />` from lucide-react
- [x] **4.3b** Link to `/app/menu`

---

## Phase 5 — KPI Grid Redesign

### 5.1 Update `components/ui/KpiGrid.tsx` and `KpiCard.tsx`

- [x] **5.1a** `KpiGrid` — change from `gap-4` grid → joined bar
- [x] **5.1b** `KpiCard` — each cell: `flex-1 p-[var(--kpi-pad)] flex flex-col gap-2 relative`
- [x] **5.1c** Add optional `delta` prop (`{ value: number; direction: 'up' | 'down' }`)
- [x] **5.1d** KPI value: font-display, 28px, weight 600, tracking -0.02em, tabular-nums
- [x] **5.1e** Sparkline position: `absolute right-4 top-[18px]` (unchanged)

---

## Phase 6 — New Shared Components

### 6.1 `SegControl` component — `components/ui/SegControl.tsx`

- [x] **6.1a** Create `SegControl` component
- [x] **6.1b** Export from `components/ui/index.ts`

### 6.2 `Tabs` / `Tab` components — `components/ui/Tabs.tsx`

- [x] **6.2a** Create `Tabs` and `Tab` components
- [x] **6.2b** Export from `components/ui/index.ts`

### 6.3 Update `StatusBadge` → pill style

- [x] **6.3a** Update `components/ui/StatusBadge.tsx` to use pill style
- [x] **6.3b** Map existing status strings → pill variants (use existing status mapping)

---

## Acceptance Criteria

- [x] IBM Plex Sans Thai renders in browser (verify: Thai text shows with serif-like quality)
- [x] `/app/menu` renders standalone (no sidebar, no topbar), paper background `#f6f4ef`
- [x] Main Menu shows 5 module cards with SVG icons, role-filtered
- [x] Sidebar shows Lucide icons (no emoji visible)
- [x] Sidebar shows user avatar/name/role at bottom
- [x] "จัดการเมนู" toggles edit mode; hidden items persist on refresh
- [x] TopBar shows search bar (center) + bell icon (right)
- [x] `⌘K` / `Ctrl+K` opens search modal (even if empty)
- [x] KPI grid renders as joined bar (no individual card gaps)
- [x] `<SegControl>` renders and toggles correctly
- [x] `<Tabs>/<Tab>` renders with active underline + count pill
- [x] `<StatusBadge>` shows dot pill style
- [x] `npm run lint` passes

---

## File Checklist

```
package.json                           (edit — add lucide-react)
app/layout.tsx                         (edit — IBM Plex fonts)
app/(app)/layout.tsx                   (edit — hide sidebar/topbar on /app/menu)
app/(app)/menu/page.tsx                (major rewrite — match design)
components/layout/Sidebar.tsx          (major rewrite — lucide icons, footer, edit mode)
components/layout/TopBar.tsx           (edit — search, bell, lucide home)
components/ui/KpiCard.tsx              (edit — delta prop, joined style)
components/ui/KpiGrid.tsx              (edit — joined bar wrapper)
components/ui/SegControl.tsx           (new)
components/ui/Tabs.tsx                 (new)
components/ui/StatusBadge.tsx          (edit — pill style)
components/ui/index.ts                 (edit — export SegControl, Tabs)
```

---

## Notes

- **R2 change** — all frontend, no DB, no migrations, no API
- Design tokens in `globals.css` already match `styles.css` — no token changes needed
- `localStorage` use is safe here (edit mode preference = non-critical UX state)
- Main Menu paper bg color `#f6f4ef` is NOT in current design tokens — add as inline class or extend Tailwind config
- SVG icons in main menu: copy paths verbatim from `docs/design/main-menu.html` — do NOT approximate
- `⌘K` shortcut: on Windows = `Ctrl+K`, on Mac = `Cmd+K` — detect via `e.metaKey || e.ctrlKey`
- Phase 6 (new components) is independent — can execute in parallel with Phases 3-5

---
## Execution Logs
- [[execution-summary]]



---
track: responsive-design
status: Completed
aliases: ["Responsive Design"]
owner: puka
module: Core
updated: 2026-05-10
---

# Track: Responsive Design

**Goal:** Automatically adapt the ERP layout for both mobile and desktop devices using Tailwind CSS breakpoints. No new libraries required.

**Breakpoints (Tailwind defaults used throughout):**
- `sm`: 640px+ (small tablets / large phones landscape)
- `md`: 768px+ (tablets — sidebar becomes persistent)
- `lg`: 1024px+ (desktop)

---

## Task 1 — Mobile Sidebar Drawer (Layout wiring)

**Files:** `app/app/layout.tsx`, `components/layout/Sidebar.tsx`, `components/layout/TopBar.tsx`

### 1a. `app/app/layout.tsx`
Convert to a Client Component that manages `sidebarOpen` state.

```tsx
'use client';
import { useState } from 'react';
import { Sidebar } from '@/components/layout/Sidebar';
import { TopBar } from '@/components/layout/TopBar';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar: drawer on mobile, static on md+ */}
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex flex-1 flex-col overflow-hidden min-w-0">
        <TopBar onMenuToggle={() => setSidebarOpen((v) => !v)} />
        <main className="flex-1 overflow-auto p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
```

> **NOTE:** Removing `async` from this layout means the auth check must move. Add a middleware redirect or use a separate server component guard. The simplest approach: keep auth in `middleware.ts` (already in place) and remove `auth()` from this layout.

- [x] Convert layout to `'use client'`, remove auth check (middleware already handles it), add `sidebarOpen` state

### 1b. `components/layout/Sidebar.tsx`
Accept `open` and `onClose` props. On mobile (`md:` hidden by default), slide in as overlay drawer.

```tsx
interface SidebarProps {
  open?: boolean;
  onClose?: () => void;
  userRole?: string;
}

export function Sidebar({ open, onClose, userRole }: SidebarProps) {
  const pathname = usePathname();

  // Close on navigation change (mobile)
  useEffect(() => { onClose?.(); }, [pathname]);

  return (
    <aside
      className={cn(
        'fixed inset-y-0 left-0 z-30 flex h-full w-64 flex-col border-r border-gray-200 bg-white transition-transform duration-200 md:static md:translate-x-0 md:z-auto',
        open ? 'translate-x-0' : '-translate-x-full'
      )}
    >
      <div className="flex h-16 items-center justify-between border-b border-gray-200 px-6">
        <span className="text-lg font-bold text-gray-900">WMS</span>
        {/* Close button — mobile only */}
        <button onClick={onClose} className="md:hidden text-gray-400 hover:text-gray-600" aria-label="ปิดเมนู">
          ✕
        </button>
      </div>
      <nav className="flex-1 overflow-y-auto p-4">
        <ul className="space-y-1">
          {visibleItems.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  pathname.startsWith(item.href)
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-700 hover:bg-gray-50'
                )}
              >
                <span>{item.icon}</span>
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
}
```

- [x] Add `open` and `onClose` props
- [x] Add `useEffect` to close sidebar on pathname change
- [x] Apply `fixed`/`translate-x` classes for mobile drawer behavior
- [x] Add close button inside sidebar header (mobile only, `md:hidden`)

### 1c. `components/layout/TopBar.tsx`
Add hamburger button on the left, visible only on mobile.

```tsx
interface TopBarProps {
  onMenuToggle?: () => void;
  userName?: string;
  userRole?: string;
  onSignOut?: () => void;
}

export function TopBar({ onMenuToggle, userName, userRole, onSignOut }: TopBarProps) {
  return (
    <header className="flex h-16 items-center justify-between border-b border-gray-200 bg-white px-4 md:px-6">
      {/* Hamburger — mobile only */}
      <button
        onClick={onMenuToggle}
        className="md:hidden rounded-md p-2 text-gray-500 hover:bg-gray-100"
        aria-label="เปิดเมนู"
      >
        ☰
      </button>
      <div className="hidden md:block" /> {/* spacer for desktop */}
      <div className="flex items-center gap-4">
        <div className="text-right">
          <p className="text-sm font-medium text-gray-900">{userName}</p>
          <p className="text-xs capitalize text-gray-500">{userRole}</p>
        </div>
        <button
          onClick={onSignOut}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50"
        >
          Sign Out
        </button>
      </div>
    </header>
  );
}
```

- [x] Add `onMenuToggle` prop
- [x] Add hamburger `<button>` with `md:hidden` class

---

## Task 2 — Responsive Page Headers & Filter Bars

All list pages follow the same pattern. The header and filter bar need to stack vertically on mobile.

**Pattern to apply to ALL list pages** (`products`, `purchase-requests`, `purchase-orders`, `grn`, `rma`, `claims`, `transfers`, `cycle-counts`, `inventory`, `vendors`, `admin/users`, `admin/warehouses`):

**Header:**
```tsx
// BEFORE:
<div className="mb-6 flex items-center justify-between">

// AFTER:
<div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
```

**Filter bar:**
```tsx
// BEFORE:
<div className="mb-4 flex items-center gap-4">

// AFTER:
<div className="mb-4 flex flex-wrap items-center gap-3">
```

**SearchInput width** — remove fixed `w-60`/`w-72` classes, use `flex-1 min-w-0` or `w-full sm:w-60`:
```tsx
// BEFORE:
<SearchInput ... className="w-60" />

// AFTER:
<SearchInput ... className="w-full sm:w-60" />
```

- [x] Apply header pattern to all 13 list pages
- [x] Apply filter bar pattern to all list pages with filters
- [x] Fix SearchInput width classes

---

## Task 3 — Responsive Tables (hide secondary columns on mobile)

The `Table` component already wraps with `overflow-x-auto`, so horizontal scroll works. For a better mobile UX, hide less-important columns on small screens.

**Apply `hidden sm:table-cell` to secondary columns.** Primary columns (document number, name/SKU, status, action link) always stay visible.

### Products page (`app/app/products/page.tsx`):
- Always visible: SKU, ชื่อสินค้า, สถานะ, action
- `hidden sm:table-cell`: หมวดหมู่, หน่วย, ราคาทุน, ติดตาม

### Purchase Requests page:
- Always visible: เลข PR, สถานะ, action
- `hidden sm:table-cell`: คลังสินค้า, ผู้ขอ, รายการ, วันที่สร้าง

### Purchase Orders page:
- Always visible: เลข PO, vendor, สถานะ, action
- `hidden sm:table-cell`: คลัง, มูลค่า, วันที่

### GRN page:
- Always visible: เลข GRN, สถานะ, action
- `hidden sm:table-cell`: PO reference, คลัง, วันที่

### Inventory page:
- Always visible: SKU, ชื่อสินค้า, qty_available
- `hidden sm:table-cell`: warehouse, qty_on_hand, qty_reserved, reorder_point

### Apply `hidden sm:table-cell` to both `<Th>` and `<Td>` for hidden columns. Same class must appear on both header and data cells.

- [x] Products: hide 4 secondary columns on mobile
- [x] Purchase Requests: hide 4 secondary columns on mobile
- [x] Purchase Orders: hide secondary columns on mobile
- [x] GRN: hide secondary columns on mobile
- [x] RMA, Claims, Transfers, Cycle Counts: hide secondary columns on mobile
- [x] Inventory: hide secondary columns on mobile
- [x] Vendors: hide secondary columns on mobile

---

## Task 4 — Responsive Modals

`components/ui/Modal.tsx` — make modals full-screen on small devices.

```tsx
<dialog
  ref={dialogRef}
  onClose={onClose}
  className={cn(
    // Mobile: full screen; md+: centered with max-width
    'w-full rounded-none m-0 max-h-screen sm:rounded-xl sm:m-auto sm:max-h-[90vh] p-0 shadow-2xl backdrop:bg-black/50 open:flex flex-col',
    sizeMap[size]
  )}
>
```

Update `sizeMap` to only apply on `sm+`:
```tsx
const sizeMap = {
  sm: 'sm:max-w-sm',
  md: 'sm:max-w-md',
  lg: 'sm:max-w-lg',
  xl: 'sm:max-w-2xl',
};
```

- [x] Update `Modal` component with full-screen mobile behavior
- [x] Update `sizeMap` keys to use `sm:` prefix

---

## Task 5 — Responsive Dashboard

`app/app/dashboard/page.tsx` — minor fixes for mobile.

- Dashboard header: `flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between`
- Warehouse filter: `w-full sm:w-auto`
- KPI grid: already `grid-cols-2 lg:grid-cols-4` — change to `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4` for very small screens
- Low stock / recent ledger items: wrap long product names with `truncate` or `line-clamp-1`

- [x] Fix dashboard header flex direction
- [x] KPI grid: add `grid-cols-1` base (currently `grid-cols-2` base — OK for tablets but tight on phones)
- [x] Warehouse select: full width on mobile

---

## Task 6 — Responsive Detail Pages & Forms

Detail pages (e.g., `purchase-requests/[id]`, `grn/[id]`) typically have a two-column info grid and a line-items table.

**Pattern for detail page info grids:**
```tsx
// BEFORE:
<div className="grid grid-cols-2 gap-4">

// AFTER:
<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
```

**Pattern for "new" form pages:**
```tsx
// Form field rows:
<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
```

- [x] Apply single-column base to detail page info grids (all `[id]` pages)
- [x] Apply single-column base to `new` form pages where 2-column grids exist

---

## Task 7 — Responsive Pagination

`components/ui/Pagination.tsx` — on very small screens, show fewer page buttons.

Wrap the page-number buttons with a responsive container and limit visible pages using CSS:

```tsx
// The page buttons div: add overflow-x-auto for very small screens
<div className="flex items-center gap-1 overflow-x-auto">
```

No logic change needed — the `overflow-x-auto` on the buttons div lets users scroll page numbers on tiny screens.

- [x] Add `overflow-x-auto` to page-number button container in `Pagination.tsx`

---

## Verification Checklist

After implementation, verify at these viewport sizes:
- [ ] **320px** (iPhone SE): Sidebar hidden, hamburger visible, page renders without horizontal scroll
- [ ] **375px** (iPhone 14): Same as above, table columns hidden correctly
- [ ] **768px** (iPad): Sidebar visible and static, no hamburger shown
- [ ] **1280px** (Desktop): Full layout, all columns visible

Test pages to verify:
- [x] Dashboard — KPI cards, low stock list
- [x] Products list — table columns, add button
- [x] Purchase Requests list — filter bar
- [x] Any `[id]` detail page — info grid stacking
- [x] Any `new` form page — form fields stacking
- [x] Modal open (Product add/edit) — full-screen on mobile

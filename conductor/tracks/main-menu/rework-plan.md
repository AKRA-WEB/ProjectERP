---
track: main-menu
status: Rework Required
owner: gemini
module: Core
updated: 2026-05-17
---

# Rework Plan — main-menu

## Validation Notes
- Billy report cited `components/layout/MainMenu.tsx` — this file does NOT exist. Actual nav file is `components/layout/Sidebar.tsx`.
- MF-1 (role-based menu filtering): High confidence — Sidebar.tsx menuItems array has no `roles` field and no session-based filter.
- MF-2 (active route detection): High confidence — `pathname === item.href` exact match confirmed in Sidebar.tsx — fails for child routes.

## Must Fix

### MF-1: Menu items not filtered by user role
**File:** `components/layout/Sidebar.tsx`
**Problem:** All menu items shown regardless of role — finance/HR items visible to `warehouse_staff`.
**Step 1:** Add `roles` field to menu items (in Sidebar.tsx or `lib/menu-config.ts` if it exists):
```typescript
interface MenuItem {
  label: string;
  href: string;
  icon?: string;
  roles?: string[] | null; // null = all roles
}

const menuItems: MenuItem[] = [
  { label: 'แดชบอร์ด', href: '/wms/dashboard', roles: null },
  { label: 'รับสินค้าเข้า', href: '/wms/inbound-orders', roles: ['manager', 'admin', 'gr_staff'] },
  { label: 'คลังสินค้า', href: '/wms/inventory', roles: null },
  { label: 'รายงาน', href: '/wms/reports', roles: ['manager', 'admin'] },
  // add remaining items with appropriate roles
];
```
**Step 2:** Sidebar needs user role. Pass `role` prop from server layout:
```typescript
// In server layout (app/(wms)/layout.tsx):
const session = await auth();
const u = session?.user as unknown as SessionUser | undefined;
// Pass to Sidebar:
<Sidebar role={u?.role} ... />
```
**Step 3:** Filter in Sidebar:
```typescript
const visibleItems = menuItems.filter(item =>
  !item.roles || (role && item.roles.includes(role))
);
```

### MF-2: Active route detection broken for nested routes
**File:** `components/layout/Sidebar.tsx`
**Problem:** `pathname === item.href` fails for `/wms/inbound-orders/123`.
**Fix:**
```typescript
const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
```

## Should Fix

### SF-1: Focus indicator missing on nav links
**File:** `components/layout/Sidebar.tsx`
**Fix:** Add `focus:ring-2 focus:ring-blue-500 focus:outline-none` to Link className.

## Re-QA Checklist
- [ ] `warehouse_staff` role → report menu items not visible in sidebar
- [ ] Navigate to `/wms/inbound-orders/123` → inbound-orders nav item shows active state
- [ ] Navigate to `/wms/dashboard` → exact match still active
- [ ] Tab through nav items → visible focus ring on each link
- [ ] `npx tsc --noEmit` — zero errors
- [ ] `npm run lint` — zero errors

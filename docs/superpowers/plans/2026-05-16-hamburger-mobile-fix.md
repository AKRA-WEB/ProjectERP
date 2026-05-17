# Hamburger Menu Mobile Fix — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix hamburger menu on mobile — button press immediately re-closes the sidebar due to unstable `onClose` function reference.

**Architecture:** `Sidebar.tsx` has a `useEffect([pathname, onClose])` that closes the sidebar on navigation. Because `layout.tsx` passes `onClose` as an inline arrow, every render creates a new reference, causing the effect to fire immediately after `setSidebarOpen(true)` triggers a re-render. Fix: stabilize both callbacks with `useCallback` in `layout.tsx` so the effect only fires when `pathname` actually changes.

**Tech Stack:** Next.js 15 App Router · React 19 · TypeScript strict

---

### Task 1: Stabilize sidebar callbacks in layout.tsx

**Files:**
- Modify: `app/app/layout.tsx`

**Root cause (do not skip reading this):**

```
// layout.tsx — current (broken)
<Sidebar onClose={() => setSidebarOpen(false)} .../>
//              ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
//              New function ref every render → triggers Sidebar useEffect
```

```
// Sidebar.tsx:248-250 — the effect that reads onClose
useEffect(() => {
  onClose?.();
}, [pathname, onClose]);   // onClose in deps = fires on new ref
```

- [ ] **Step 1: Add `useCallback` to the import in `app/app/layout.tsx`**

Current line 1–2:
```typescript
'use client';
import { useState } from 'react';
```

Replace with:
```typescript
'use client';
import { useState, useCallback } from 'react';
```

- [ ] **Step 2: Extract stable callback refs**

Current code (after `useSession` / `usePathname` declarations, around line 9–13):
```typescript
export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { data: session } = useSession();
  const pathname = usePathname();
```

Replace with:
```typescript
export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { data: session } = useSession();
  const pathname = usePathname();

  const handleCloseSidebar = useCallback(() => setSidebarOpen(false), []);
  const handleMenuToggle = useCallback(() => setSidebarOpen((v) => !v), []);
  const handleToggleCollapse = useCallback(() => setSidebarCollapsed((v) => !v), []);
```

- [ ] **Step 3: Pass stable callbacks to Sidebar and TopBar**

Current JSX (in the non-menu branch):
```tsx
      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        userRole={userRole}
        permissions={permissions}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
      />

      <div className="flex flex-1 flex-col overflow-hidden min-w-0">
        <TopBar
          onMenuToggle={() => setSidebarOpen((v) => !v)}
          userName={user?.name}
          userRole={userRole}
        />
```

Replace with:
```tsx
      <Sidebar
        open={sidebarOpen}
        onClose={handleCloseSidebar}
        userRole={userRole}
        permissions={permissions}
        collapsed={sidebarCollapsed}
        onToggleCollapse={handleToggleCollapse}
      />

      <div className="flex flex-1 flex-col overflow-hidden min-w-0">
        <TopBar
          onMenuToggle={handleMenuToggle}
          userName={user?.name}
          userRole={userRole}
        />
```

- [ ] **Step 4: Run lint + type check**

```bash
npm run lint
npx tsc --noEmit
```

Expected: 0 errors, 0 warnings.

- [ ] **Step 5: Manual test on mobile viewport**

Open browser DevTools → toggle device toolbar → select any mobile preset (e.g. iPhone 12, 390px wide).

Test checklist:
1. Navigate to any module page (e.g. `/app/dashboard`)
2. Tap hamburger icon (top-left) → sidebar slides in ✓
3. Tap backdrop (dark overlay) → sidebar closes ✓
4. Tap hamburger again → sidebar slides in ✓
5. Tap any nav link inside sidebar → sidebar closes + page navigates ✓
6. On desktop (md+) — sidebar always visible, collapse toggle works ✓

- [ ] **Step 6: Commit**

```bash
git add app/app/layout.tsx
git commit -m "fix: stabilize sidebar callbacks with useCallback to fix mobile hamburger menu"
```

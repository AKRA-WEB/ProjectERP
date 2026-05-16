---
type: skill
domain: frontend
agent: puka
load-when: "UI, React, Tailwind, Client Page, Component"
---

# Frontend UI Rules

**ใช้เมื่อ:** สร้าง React Component, Client Page, Tailwind CSS, หรือแก้ไข UI ใดก็ตาม

---

## Core Rules

1. **`'use client'` ทุก page** — ห้าม RSC data fetching ฝั่ง Client. Fetch จาก API routes เท่านั้นผ่าน `lib/api-client.ts`
2. **`get` / `post` / `patch` / `del`** จาก `lib/api-client.ts` — ห้าม `fetch()` ตรง
3. **UI components** ดึงจาก `components/ui/index.ts` เท่านั้น: `Button`, `Input`, `Select`, `Modal`, `Table`, `Badge`, `StatusBadge`, `Pagination`
4. **Bilingual labels** — Thai primary, English secondary เสมอ เช่น `คลังสินค้า / Warehouse`
5. **`formatDate()`** จาก `lib/utils.ts` — ห้าม `.toLocaleDateString()` หรือ string slicing
6. **`formatCurrency()`** จาก `lib/utils.ts` — ห้าม `.toLocaleString()` หรือ template literal สำหรับ THB
7. **Pagination** — ทุก list page ต้องมี `<Pagination>` component. ห้าม render rows ทั้งหมด

## State Pattern

```typescript
const [data, setData] = useState<T[]>([]);
const [loading, setLoading] = useState(true);
const [error, setError] = useState<string | null>(null);
const [page, setPage] = useState(1);
const [total, setTotal] = useState(0);
const PAGE_SIZE = 20;

useEffect(() => {
  const load = async () => {
    try {
      setLoading(true);
      const res = await get<{ data: T[]; total: number }>(`/api/...?page=${page}&pageSize=${PAGE_SIZE}`);
      setData(res.data);
      setTotal(res.total);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'เกิดข้อผิดพลาด');
    } finally {
      setLoading(false);
    }
  };
  load();
}, [page]);
```

## PATCH Action Pattern

```typescript
await patch(`/api/.../[id]`, { action: 'approve', reason: '...' });
```

## Constraints

- ห้าม `any` โดยไม่มีเหตุผล (TypeScript strict)
- ห้าม hardcode text สกุลเงินเป็น USD — ใช้ THB เสมอ
- ห้ามใช้ `Date.getDay()` โดยตรง สำหรับ Bangkok time — ใช้ `'T00:00:00+07:00'` offset

---

## Patterns & Traps — Captured in Field

## ❌ Trap — Hoisting in useCallback/useEffect
**Symptom:** `ReferenceError: Cannot access 'functionName' before initialization`.
**Root cause:** Attempting to access a variable defined with `const` or `let` (including `useCallback` and `useMemo`) before its line of declaration. Unlike traditional `function` declarations, these are not hoisted.
**Fix:** Always declare state handlers and utility callbacks at the top of the component body, before any `useEffect` that might register listeners or trigger logic using them.
**Found in:** POS Terminal bug fix (2026-05-15)

## ✅ Pattern — Atomic UI Updates
**Context:** When applying cross-cutting changes (like View Transitions) across 30+ files.
**Correct way:**
Do not use automated bulk replacement on complex JSX structures. Instead, apply changes to 1-2 pilot files, verify with `npm run lint`, and then roll out module-by-module. If widespread corruption occurs, use `git checkout -- app/app` to restore a passing state immediately.
**Found in:** View Transitions track implementation (2026-05-15)

## ❌ Trap — ViewTransition direct import from react
**Symptom:** `Attempted import error: 'ViewTransition' is not exported from 'react'` — build fails in production.
**Root cause:** React 19 experimental View Transition exports (`ViewTransition`, `addTransitionType`) are not stable. Direct import breaks Webpack during `npm run build`.
**Fix:** Always use the compatibility bridge `lib/react-vts.tsx` — never import View Transition APIs directly from `react`.
**Found in:** ROOT_CAUSE_REPORT.md (2026-05-16)

## ❌ Trap — transitionTypes prop on Link without type augmentation
**Symptom:** `Property 'transitionTypes' does not exist on type 'LinkProps'` — 130+ cascade errors.
**Root cause:** Custom props injected onto `<Link>` require global TypeScript augmentation. Without it, strict mode errors cascade across every file using Link.
**Fix:** Add to `types/next.d.ts`:
```typescript
import type { LinkProps } from 'next/link';
declare module 'next/link' {
  interface LinkProps {
    transitionTypes?: string[];
  }
}
```
**Found in:** ROOT_CAUSE_REPORT.md (2026-05-16)

## ✅ Pattern — tsc --noEmit before marking task done
**Context:** New UI modules with strict: true — null safety issues only surface at build time.
**Correct way:** Run `npx tsc --noEmit` before checking off any UI task. Catches `Object is possibly 'undefined'` and property access errors before `npm run build`.
**Found in:** ROOT_CAUSE_REPORT.md (2026-05-16)

## ❌ Trap — Unused variables during refactoring
**Symptom:** `Error: 'VARIABLE_NAME' is assigned a value but never used. @typescript-eslint/no-unused-vars` during `npm run build`.
**Root cause:** Removing or replacing logic (like an activity feed) but leaving behind helper constants, functions, or imports that were only used by the old logic. Next.js strict ESLint rules block the build on unused vars.
**Fix:** Always search for and remove associated constants, helper functions (e.g., `initials`, `avatarColor`), and mapping objects when deleting a UI section.
**Found in:** task [R-004] of track [ui-improvement-dashboard] (2026-05-16)

## ✅ Pattern — Standardized Datetime Formatting
**Context:** Rendering timestamps in dashboard or activity feeds using project conventions.
**Correct way:**
```typescript
import { formatDatetime } from '@/lib/format';
// ...
<div>{formatDatetime(item.created_at)}</div>
```
**Found in:** task [R-004] of track [ui-improvement-dashboard] (2026-05-16)

## ❌ Trap — Mobile Sidebar Z-Index Layering
**Symptom:** Hamburger menu opens sidebar, but nothing inside (links, close button) is clickable.
**Root cause:** The dark backdrop overlay has a higher `z-index` than the sidebar drawer itself (e.g., Backdrop `z-40` vs Sidebar `z-30`). The invisible area of the backdrop sits "on top" of the sidebar, intercepting all clicks.
**Fix:** Ensure the Sidebar has a strictly higher `z-index` than its backdrop (e.g., Sidebar `z-50` and Backdrop `z-40`).
**Found in:** task [T-01] of track [hamburger-zindex-fix] (2026-05-16)


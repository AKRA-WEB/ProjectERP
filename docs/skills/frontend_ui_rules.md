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

## ❌ Trap — Space inside Tailwind class tokens
**Symptom:** Styles not applied to specific elements even though classes look correct at first glance.
**Root cause:** Accidentally adding a space inside a Tailwind class name (e.g., `text- ink` or `bg- primary`). Tailwind fails to generate a CSS rule for the split tokens.
**Fix:** Always ensure class names are single, uninterrupted strings: `text-ink`, `bg-primary`.
**Found in:** task [4] of track [product-import] (2026-05-17)

## ✅ Pattern — Persistent Collapsible State
**Context:** When implementing collapsible sections (like sidebar groups) that should remember their state across page reloads in a Next.js client component.
**Correct way:**
Initialize state to `true` (default open) to ensure SSR matches the common default, then use `useEffect` to load the persisted state from `localStorage` on the client.
```typescript
const [isOpen, setIsOpen] = useState(true);

useEffect(() => {
  try {
    const stored = localStorage.getItem(`storage-key`);
    if (stored !== null) setIsOpen(JSON.parse(stored));
  } catch (e) {
    console.error('Failed to load state', e);
  }
}, [key]);

const toggle = () => {
  const next = !isOpen;
  setIsOpen(next);
  localStorage.setItem(`storage-key`, JSON.stringify(next));
};
```
**Found in:** task [1] of track [sidebar-grouping] (2026-05-18)

## ❌ Trap — Tabs component children type
**Symptom:** `Type '(activeTab: string) => JSX.Element' is not assignable to type 'ReactNode'.`
**Root cause:** The project's `Tabs` component expects `ReactNode` (i.e., direct child elements) rather than a render function (function as children).
**Fix:** Manage tab state in the parent page and render children conditionally based on state.
**Found in:** task [4] of track [po-immediate-approval]

## ✅ Pattern — Local Textarea Workaround
**Context:** When the project's UI library is missing a `Textarea` component but you need one for long-form input (e.g., addresses, notes).
**Correct way:** Define a local styled `Textarea` component that matches the project's `Input` styling.
```typescript
function Textarea({ label, value, onChange, className }: { label: string, value: string, onChange: (e: ChangeEvent<HTMLTextAreaElement>) => void, className?: string }) {
  const id = label.toLowerCase().replace(/\s+/g, '-');
  return (
    <div className="flex flex-col">
      <label htmlFor={id} className="text-[13px] font-medium text-ink-2 mb-1.5">{label}</label>
      <textarea
        id={id}
        value={value}
        onChange={onChange}
        className={cn(
          "bg-white border border-line rounded-[8px] px-3 py-2 text-[13.5px] text-ink-1 placeholder:text-ink-4 transition-all min-h-[80px]",
          "focus:outline-none focus:border-accent focus:ring-0 focus:shadow-[0_0_0_3px_rgba(16,185,129,0.14)]",
          className
        )}
      />
    </div>
  );
}
```
**Found in:** task [4] of track [po-immediate-approval]

## ✅ Pattern — React Context i18n
**Context:** Implementing multilingual support without external libraries.
**Correct way:**
Use a central `LanguageProvider` with a JSON-based dictionary. Provide a `useT()` hook for string lookups and a `localeName(th, en, lang)` helper for DB fields.
```typescript
// Example usage
const t = useT();
const { lang } = useLanguage();
return <h1>{t('page.title')}</h1>;
```
**Found in:** track [i18n-language-switch]

## ✅ Pattern — Inline Search-as-you-type Component
**Context:** When a form needs to select an item from a large dataset (e.g., >100 products), use a debounced server-side search instead of a bulk-loaded `<select>`.
**Correct way:**
```tsx
function SearchComponent({ value, onSelect, onClear }) {
  const [query, setQuery] = useState(value);
  // ... useEffect with 300ms debounce calling GET /api/items?search={query}
  // ... render input and absolute-positioned results list
}
```
**Found in:** task [1.1] of track [io-product-search]

## ✅ Pattern — Two-pass Rendering for Hydration Safety
**Context:** เมื่อต้องการเข้าถึง Browser-only APIs (localStorage, window, Date) ที่มีค่าไม่ตรงกับ Server เพื่อป้องกัน Hydration Mismatch
**Correct way:**
```typescript
const [isMounted, setIsMounted] = useState(false);
useEffect(() => { setIsMounted(true); }, []);

if (!isMounted) return null; // หรือแสดง Skeleton
```
**Found in:** Global hydration fix for AppLayout, DashboardPage (2026-05-19)

## ✅ Pattern — CSS Grid Calendar Rendering
**Context:** Rendering a monthly calendar grid with weekday headers and day cells, accounting for starting weekday offset.
**Correct way:**
```tsx
<div className="grid grid-cols-7 gap-px bg-stone-100 border border-stone-100 rounded-lg overflow-hidden">
  {/* Weekday headers */}
  {['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'].map(d => (
    <div key={d} className="text-center text-[11px] font-bold py-2 bg-white">
      {d}
    </div>
  ))}
  
  {/* Offset for first day of month */}
  {Array.from({ length: firstWeekday }).map((_, i) => (
    <div key={`empty-${i}`} className="bg-white h-24" />
  ))}
  
  {/* Day cells */}
  {Array.from({ length: daysInMonth }).map((_, i) => {
    const day = i + 1;
    return (
      <div key={day} className="bg-white h-24 p-2 relative">
        <span className="text-[12px] font-mono">{day}</span>
        {/* Render event markers here */}
      </div>
    );
  })}
</div>
```
**Found in:** task 6 of track hr-ui-redesign

## ✅ Pattern — Frontend Tenure Calculation
**Context:** Calculating employee tenure (years and months) from a hire date string for display in HR modules.
**Correct way:**
```typescript
function getTenure(dateStr: string | null) {
  if (!dateStr) return '—';
  const start = new Date(dateStr);
  const end = new Date();
  let years = end.getFullYear() - start.getFullYear();
  let months = end.getMonth() - start.getMonth();
  if (months < 0) { years--; months += 12; }
  if (years > 0) return `${years} ปี ${months} ด.`;
  return `${months} เดือน`;
}
```
**Found in:** task 5 of track hr-ui-redesign

## ❌ Trap — Absolute Dropdown Clipping in Tables
**Symptom:** รายการค้นหาหรือ Select ที่ใช้ `absolute` ไม่แสดงผลเมื่ออยู่ในตาราง
**Root cause:** Parent container (เช่น `div` ที่ล้อมตาราง) มี `overflow-hidden` ทำให้ dropdown ถูกตัด
**Fix:** นำ `overflow-hidden` ออกจาก table wrapper หรือเปลี่ยนมาใช้ React Portal สำหรับ dropdown
**Found in:** task [1] of track [wms-search-nav-fix] (2026-05-19)



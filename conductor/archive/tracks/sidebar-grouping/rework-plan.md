---
track: sidebar-grouping
status: Completed
owner: gemini
module: Core
updated: 2026-05-17
---

# Rework Plan — sidebar-grouping

## Validation Notes
- MF-1 (group collapse state not persisted): High confidence — no static evidence of `localStorage` calls in Sidebar.tsx for group state.
- MF-2 (Thai group labels): Medium — cannot confirm without reading menu-config.ts content.
- SF-1 (group icons missing aria-hidden): Dismissed by Chen — chevron span already has `aria-hidden="true"`.

## Must Fix

### MF-1: Group collapse state resets on every render
**File:** `components/layout/Sidebar.tsx` or separate `SidebarGroup` component if exists
**Problem:** Groups use `useState(false)` — collapse state lost on navigation/refresh.
**Fix:** Persist per-group state in localStorage using group label as key:
```typescript
function useSidebarGroupState(label: string) {
  const [isOpen, setIsOpen] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(`sidebar-group-${label}`) !== 'closed';
  });

  const toggle = () => {
    setIsOpen(prev => {
      const next = !prev;
      localStorage.setItem(`sidebar-group-${label}`, next ? 'open' : 'closed');
      return next;
    });
  };

  return { isOpen, toggle };
}
```
Use this hook for each group. Default `open` if no stored value (check `!== 'closed'`).

Add `aria-expanded` to each group toggle button:
```tsx
<button onClick={toggle} aria-expanded={isOpen}>
  {label}
  <span aria-hidden="true">{isOpen ? '▲' : '▼'}</span>
</button>
```

## Should Fix

### SF-1: Thai group labels in menu-config
**File:** `lib/menu-config.ts`
**Gemini action:** Verify group labels are Thai (e.g., `'คลังสินค้า'` not `'Inventory'`). CLAUDE.md: bilingual, Thai primary.

## Re-QA Checklist
- [x] Expand a group, navigate to another route → group remains expanded
- [x] Refresh page → group expanded/collapsed state restored from localStorage
- [x] Tab to group button, press Enter → group toggles
- [x] Screen reader: group button announces `aria-expanded` state
- [x] Group labels are Thai text
- [x] `npx tsc --noEmit` — zero errors
- [x] `npm run lint` — zero errors

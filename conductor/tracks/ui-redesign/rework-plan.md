---
track: ui-redesign
status: Rework Required
owner: gemini
module: Core
updated: 2026-05-17
---

# Rework Plan — ui-redesign

## Validation Notes
- MF-1 (no execution-summary.md): Confirmed — unauditable track. No new files, no file list.
- MF-2 (hardcoded hex colors): Unverifiable without file list. Gemini must grep.
- MF-3 (contrast): `text-gray-400` (#9CA3AF on white) = 2.85:1 ratio — below WCAG AA 4.5:1.

## Must Fix

### MF-1: Hardcoded hex colors not removed
**Files:** All modified pages (unknown — no execution-summary.md)
**Gemini action:** Run grep to find remaining hardcoded colors:
```bash
grep -rn '#[0-9a-fA-F]\{3,6\}' app/ --include="*.tsx" --include="*.ts"
```
Replace all instances with Tailwind design token classes from `lib/constants.ts` (COLORS/SHADOWS defined by ui-design-system track).

### MF-2: Page titles not localized
**File:** `app/(wms)/layout.tsx`
**Problem:** Static or English-only page title.
**Fix:**
```typescript
export const metadata = {
  title: 'ระบบ ERP | BUYMORE',
};
```
For dynamic per-page titles, each `page.tsx` exports its own `generateMetadata`.

### MF-3: Secondary text fails WCAG AA contrast
**Problem:** `text-gray-400` (#9CA3AF on white) = 2.85:1 — below 4.5:1 minimum.
**Fix:** Global replace all body/label text usages:
```
text-gray-400 → text-gray-600
```
Exceptions: decorative elements and disabled states are exempt from AA requirement.

## Re-QA Checklist
- [ ] `grep -rn '#[0-9a-fA-F]' app/ --include="*.tsx"` → zero non-exempt matches
- [ ] Browser tab shows Thai page title
- [ ] Run color contrast checker on all text elements → all body text >= 4.5:1 ratio
- [ ] `npx tsc --noEmit` — zero errors
- [ ] `npm run lint` — zero errors

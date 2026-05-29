---
track: i18n-t6-menu-remaining
phase: i18n-compliance
sequence: 6
status: Active
owner: Chen
created: 2026-05-29
depends_on: [i18n-t3-accounting, i18n-t4-grn-purchasing, i18n-t5-admin-wms]
estimate: M
tags: [i18n, menu, dashboard, cleanup]
spec: docs/superpowers/specs/2026-05-29-i18n-full-compliance-design.md
---

# i18n Track 6 — Menu, Dashboard + Remaining Pages + Finalize

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

## Goal

Fix Menu page (Thai month names), Dashboard pages, and all remaining hardcoded Thai violations across the codebase. As the final task, upgrade the ESLint rule from `"warn"` to `"error"` — making i18n compliance a hard build gate going forward.

## Architecture

Same pattern as Tracks 3–5. Final task in this track upgrades ESLint severity.

After this track: `npm run lint` should produce 0 `no-hardcoded-thai` warnings/errors.

## Tech Stack

Next.js, React, TypeScript, `@/lib/i18n`

## Acceptance Criteria

1. `npm run lint 2>&1 | grep "no-hardcoded-thai"` → 0 results (zero warnings, zero errors)
2. ESLint rule severity = `"error"` in `.eslintrc.json`
3. `npm run build` succeeds
4. Language switcher works on main menu, dashboard, and all remaining pages
5. `npx tsc --noEmit` passes

---

## Files

| Action | Path |
|--------|------|
| Modify | `app/app/menu/page.tsx` |
| Modify | `app/app/dashboard/AuditorDashboardClient.tsx` (if violations remain) |
| Modify | all other remaining non-compliant `.tsx` files |
| Modify | `.eslintrc.json` (final step — upgrade to `"error"`) |

---

## Tasks

### Task 1: Fix menu/page.tsx — Thai month names

- [ ] **Step 1.1:** Read `app/app/menu/page.tsx`. Find the hardcoded month array (around lines 133-136):

```tsx
const thaiMonths = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
];
```

- [ ] **Step 1.2:** Add import at top:

```tsx
import { useT, useLanguage } from '@/lib/i18n';
```

- [ ] **Step 1.3:** Inside the component function, add hooks:

```tsx
const t = useT();
const { lang } = useLanguage();
```

- [ ] **Step 1.4:** Replace the hardcoded `thaiMonths` array with i18n keys:

```tsx
const MONTH_KEYS = [
  'month.jan', 'month.feb', 'month.mar', 'month.apr',
  'month.may', 'month.jun', 'month.jul', 'month.aug',
  'month.sep', 'month.oct', 'month.nov', 'month.dec',
] as const;
```

Then replace the usage of `thaiMonths[now.getMonth()]` with:

```tsx
const monthKey = MONTH_KEYS[now.getMonth()];
setCurrentMonth(`${t(monthKey)} ${lang === 'th' ? now.getFullYear() + 543 : now.getFullYear()}`);
```

Note: The Buddhist Era year (+543) should only apply when `lang === 'th'`.

- [ ] **Step 1.5:** Fix remaining Thai strings in menu page:

| Original Thai | Replacement |
|---------------|-------------|
| `"เลือกระบบงาน"` | `t('page.select_module')` |
| `"ขออภัย คุณยังไม่มีสิทธิ์เข้าถึงระบบใดๆ"` | `t('msg.no_access')` |
| `"กำลังโหลด..."` | `t('msg.loading_data')` |

Note: Module config objects (`{ nameTh: 'คลังสินค้า', nameEn: 'Warehouse' }`) are data, NOT UI strings — leave them as-is.

- [ ] **Step 1.6:** Verify:

```bash
npx eslint app/app/menu/page.tsx 2>&1 | grep "no-hardcoded-thai"
```

Expected: 0 results.

- [ ] **Step 1.7:** Commit:

```bash
git add app/app/menu/page.tsx
git commit -m "fix(i18n): migrate menu page — replace hardcoded Thai months and labels"
```

---

### Task 2: Fix dashboard pages

- [ ] **Step 2.1:** Run lint on dashboard:

```bash
npx eslint app/app/dashboard/ --rule '{"local-rules/no-hardcoded-thai": "error"}' --format stylish 2>&1
```

- [ ] **Step 2.2:** For `AuditorDashboardClient.tsx` and any other dashboard files with violations:
  - Add `import { useT } from '@/lib/i18n'`
  - Add `const t = useT()`
  - Replace Thai strings with `t('key')` using appropriate keys from the key list

Note: `DashboardClient.tsx` already uses `useT()` — verify it's clean or fix any remaining issues.

- [ ] **Step 2.3:** Commit:

```bash
git add app/app/dashboard/
git commit -m "fix(i18n): migrate dashboard pages to i18n keys"
```

---

### Task 3: Global sweep — fix ALL remaining violations

- [ ] **Step 3.1:** Run codebase-wide lint to find every remaining violation:

```bash
npm run lint 2>&1 | grep "no-hardcoded-thai" > /tmp/remaining-violations.txt
cat /tmp/remaining-violations.txt | wc -l
```

- [ ] **Step 3.2:** Group violations by module directory. Fix each module in order:

Priority order:
1. `app/app/hr/` 
2. `app/app/pos/`
3. `app/app/sales/`
4. `app/app/ap/`
5. `app/app/inventory/`
6. `components/`
7. Any remaining

For each file with violations, apply the standard pattern. Add missing keys to JSON files as needed.

- [ ] **Step 3.3:** After fixing each module, run lint again to confirm 0 violations for that directory.

- [ ] **Step 3.4:** Commit fixes in batches by module:

```bash
git add app/app/hr/ && git commit -m "fix(i18n): migrate HR module pages to i18n keys"
git add app/app/pos/ && git commit -m "fix(i18n): migrate POS module pages to i18n keys"
git add app/app/sales/ && git commit -m "fix(i18n): migrate Sales module pages to i18n keys"
git add app/app/ap/ && git commit -m "fix(i18n): migrate AP module pages to i18n keys"
git add app/app/inventory/ && git commit -m "fix(i18n): migrate Inventory module pages to i18n keys"
git add components/ && git commit -m "fix(i18n): migrate shared components to i18n keys"
```

---

### Task 4: Final verification — 0 violations

- [ ] **Step 4.1:** Run full lint:

```bash
npm run lint 2>&1 | grep "no-hardcoded-thai"
```

Expected output: **nothing** (no results at all).

If there are still violations, fix them before proceeding to Step 4.2.

- [ ] **Step 4.2:** Confirm JSON files in sync:

```bash
node -e "
const en = require('./lib/i18n/en.json');
const th = require('./lib/i18n/th.json');
const missing = Object.keys(en).filter(k => !th[k]);
const extra = Object.keys(th).filter(k => !en[k]);
if (missing.length) { console.error('Missing in th:', missing); process.exit(1); }
if (extra.length) { console.error('Extra in th:', extra); process.exit(1); }
console.log('OK — keys in sync:', Object.keys(en).length);
"
```

Expected: `OK — keys in sync: <N>` with no errors.

---

### Task 5: Upgrade ESLint rule to "error"

This is the final gate step — only do this after Task 4 confirms 0 violations.

- [ ] **Step 5.1:** Edit `.eslintrc.json`. Change the rule severity:

```json
{
  "extends": [
    "next/core-web-vitals",
    "next/typescript"
  ],
  "plugins": ["local-rules"],
  "rules": {
    "local-rules/no-hardcoded-thai": "error"
  }
}
```

- [ ] **Step 5.2:** Run lint to confirm it passes with 0 errors:

```bash
npm run lint
```

Expected: exits 0 with no `no-hardcoded-thai` errors.

- [ ] **Step 5.3:** Run build to confirm:

```bash
npm run build 2>&1 | tail -5
```

Expected: build succeeds.

- [ ] **Step 5.4:** Commit:

```bash
git add .eslintrc.json lib/i18n/
git commit -m "feat(i18n): upgrade no-hardcoded-thai rule to error — i18n fully enforced"
```

---

## Verification

Full final check:

```bash
npm run lint && npx tsc --noEmit && npm run build
```

All three must pass with 0 errors.

Manual: Open dev server. Navigate to main menu, switch language TH → EN → TH. All text on every page (menu, dashboard, GRN, accounting, admin, WMS) must switch correctly. The version string on the menu (`v 2.4 · May 2026` vs `v 2.4 · พฤษภาคม 2569`) should reflect the active language.

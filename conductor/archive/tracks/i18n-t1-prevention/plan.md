---
track: i18n-t1-prevention
phase: i18n-compliance
sequence: 1
status: Verified
owner: Chen
created: 2026-05-29
depends_on: []
estimate: S
tags: [i18n, eslint, prevention, dx]
spec: docs/superpowers/specs/2026-05-29-i18n-full-compliance-design.md
---

# i18n Track 1 — Prevention Infrastructure

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

## Goal

Install a no-hardcoded-thai ESLint rule (warn level), a scaffold template, a developer guide, and update CLAUDE.md — so every new module starts i18n-compliant and violations are visible immediately.

## Architecture

- ESLint rule `local-rules/no-hardcoded-thai` warns on Thai unicode `[฀-๿]` in JSX/string literals (exempts `*Th` data props and `lib/i18n/` files)
- Rule starts as `"warn"` — upgraded to `"error"` only after Track 6 completes all fixes
- `scripts/new-page-template.tsx` — copy when creating new pages, i18n hooks pre-wired
- `docs/i18n.md` — naming conventions, pattern guide, common mistakes

## Tech Stack

Next.js 14, ESLint 8, `eslint-plugin-local-rules` npm package, TypeScript

## Acceptance Criteria

1. `npm install` succeeds with `eslint-plugin-local-rules` added
2. `npm run lint` runs without error; Thai violations appear as **warnings** (not errors)
3. `scripts/new-page-template.tsx` exists with `useT()` imported and example usage
4. `docs/i18n.md` committed and linked from CLAUDE.md Knowledge Base table
5. CLAUDE.md Auto-QA step includes i18n check note

---

## Files

| Action | Path |
|--------|------|
| Create | `.eslint-local-rules.js` |
| Create | `.eslint-rules/no-hardcoded-thai.js` |
| Modify | `.eslintrc.json` |
| Create | `scripts/new-page-template.tsx` |
| Create | `docs/i18n.md` |
| Modify | `CLAUDE.md` |

---

## Tasks

### Task 1: Install eslint-plugin-local-rules

- [ ] **Step 1.1:** Install package

```bash
npm install -D eslint-plugin-local-rules
```

Expected output: added `eslint-plugin-local-rules` to `devDependencies` in `package.json`.

- [ ] **Step 1.2:** Commit

```bash
git add package.json package-lock.json
git commit -m "chore: add eslint-plugin-local-rules for i18n enforcement"
```

---

### Task 2: Write the ESLint rule

- [ ] **Step 2.1:** Create rules directory

```bash
mkdir -p .eslint-rules
```

- [ ] **Step 2.2:** Create `.eslint-rules/no-hardcoded-thai.js`

```js
// Detects Thai unicode in JSX/string/template literals.
// Exempt: *Th data props (nameTh, labelTh, etc.) and lib/i18n/ files.
const THAI_RE = /[฀-๿]/;
const WHITELISTED_KEYS = new Set([
  'nameTh', 'labelTh', 'valueTh', 'descriptionTh', 'shortNameTh',
  'titleTh', 'name_th', 'label_th', 'value_th', 'description_th',
]);

function hasThai(str) {
  return THAI_RE.test(str);
}

function isWhitelistedProp(node) {
  const parent = node.parent;
  if (!parent) return false;
  if (parent.type === 'Property') {
    const key = parent.key;
    if (key && key.type === 'Identifier' && WHITELISTED_KEYS.has(key.name)) return true;
  }
  return false;
}

module.exports = {
  meta: {
    type: 'suggestion',
    docs: { description: 'Disallow hardcoded Thai text — use t() from @/lib/i18n' },
    schema: [],
  },
  create(context) {
    const filename = context.getFilename();
    // Exempt translation source files and PDF legal form routes
    if (
      filename.includes('lib/i18n/') ||
      filename.includes('.eslint-rules/') ||
      filename.endsWith('.pdf/route.tsx') ||
      filename.endsWith('.pdf\\route.tsx')
    ) {
      return {};
    }

    return {
      JSXText(node) {
        if (hasThai(node.value)) {
          context.report({ node, message: 'Hardcoded Thai text. Use t("key") from @/lib/i18n.' });
        }
      },
      Literal(node) {
        if (typeof node.value === 'string' && hasThai(node.value) && !isWhitelistedProp(node)) {
          context.report({ node, message: 'Hardcoded Thai text. Use t("key") from @/lib/i18n.' });
        }
      },
      TemplateLiteral(node) {
        for (const quasi of node.quasis) {
          if (hasThai(quasi.value.raw) && !isWhitelistedProp(node)) {
            context.report({ node: quasi, message: 'Hardcoded Thai text. Use t("key") from @/lib/i18n.' });
            break;
          }
        }
      },
    };
  },
};
```

- [ ] **Step 2.3:** Create `.eslint-local-rules.js` in project root

```js
module.exports = {
  'no-hardcoded-thai': require('./.eslint-rules/no-hardcoded-thai'),
};
```

---

### Task 3: Wire rule into ESLint config

- [ ] **Step 3.1:** Read current `.eslintrc.json` (verify it's `{ "extends": ["next/core-web-vitals", "next/typescript"] }`)

- [ ] **Step 3.2:** Replace `.eslintrc.json` with:

```json
{
  "extends": [
    "next/core-web-vitals",
    "next/typescript"
  ],
  "plugins": ["local-rules"],
  "rules": {
    "local-rules/no-hardcoded-thai": "warn"
  }
}
```

Note: `"warn"` — not `"error"` yet. Upgrades to `"error"` in Track 6.

- [ ] **Step 3.3:** Run lint and verify it loads without crashing

```bash
npm run lint 2>&1 | head -30
```

Expected: lint runs, warns about Thai text in many files, exits 0 (warnings don't fail lint by default in Next.js). If it crashes with plugin-not-found, verify `eslint-plugin-local-rules` is in `node_modules`.

- [ ] **Step 3.4:** Commit

```bash
git add .eslintrc.json .eslint-local-rules.js .eslint-rules/no-hardcoded-thai.js
git commit -m "feat(i18n): add no-hardcoded-thai ESLint rule (warn level)"
```

---

### Task 4: Create page scaffold template

- [ ] **Step 4.1:** Create `scripts/new-page-template.tsx`

```tsx
'use client';

// HOW TO USE: Copy this file to app/app/<module>/page.tsx
// Replace "ExamplePage" with your component name.
// Replace t('page.example') with an appropriate key from lib/i18n/en.json.

import { useT, useLanguage } from '@/lib/i18n';

export default function ExamplePage() {
  const t = useT();
  // const { lang } = useLanguage(); // uncomment if you need dual-language DB fields

  return (
    <div>
      <h1>{t('page.dashboard')}</h1>

      {/* For dual-language fields from DB, use localeName: */}
      {/* import { localeName } from '@/lib/i18n'; */}
      {/* <span>{localeName(record.name_th, record.name_en, lang)}</span> */}

      {/* For toast messages: */}
      {/* toast.success(t('msg.save_success')); */}

      {/* DO NOT hardcode Thai text — add a key to lib/i18n/en.json + th.json first */}
    </div>
  );
}
```

- [ ] **Step 4.2:** Commit

```bash
git add scripts/new-page-template.tsx
git commit -m "feat(i18n): add i18n-ready page scaffold template"
```

---

### Task 5: Write developer guide

- [ ] **Step 5.1:** Create `docs/i18n.md`

```markdown
# i18n Developer Guide

BUYMORE ERP uses a custom React Context i18n system. All UI text MUST use translation keys.
An ESLint rule (`local-rules/no-hardcoded-thai`) enforces this — hardcoded Thai triggers a warning now and will become an error after all modules are fixed.

## Quick Start

```tsx
import { useT, useLanguage, localeName } from '@/lib/i18n';

function MyPage() {
  const t = useT();
  const { lang } = useLanguage(); // only if using localeName

  return (
    <div>
      <h1>{t('page.dashboard')}</h1>
      <span>{localeName(record.name_th, record.name_en, lang)}</span>
    </div>
  );
}
```

## Key Naming Convention

| Namespace | Use for | Example |
|-----------|---------|---------|
| `page.*` | Page titles, section headings | `page.vat_report` |
| `label.*` | Form labels, table headers, field names | `label.tax_period` |
| `action.*` | Buttons, CTA text | `action.save` |
| `msg.*` | Toast/alert messages (success, error, info) | `msg.save_success` |
| `status.*` | Status badges | `status.pending` |
| `confirm.*` | Confirmation dialog text | `confirm.delete_title` |
| `month.*` | Month names | `month.jan` |
| `error.*` | Validation errors | `error.required` |

## Adding a New Key

1. Add to `lib/i18n/en.json`: `"page.my_page": "My Page Title"`
2. Add to `lib/i18n/th.json`: `"page.my_page": "หัวข้อหน้า"`
3. Use in component: `{t('page.my_page')}`

Both JSON files must stay in sync. The TypeScript type `DictKey` is derived from `th.json` — if a key is only in one file, the type system will catch it.

## Reuse Before Adding

Check existing 200+ keys before adding a new one:
- `action.save`, `action.cancel`, `action.delete`, `action.edit`, `action.create`
- `label.date`, `label.amount`, `label.qty`, `label.vendor`, `label.note`
- `status.draft`, `status.approved`, `status.pending`, `status.completed`
- `error.required`, `error.invalid`, `error.server`

## Strings with Dynamic Values

The `t()` function doesn't interpolate. For dynamic strings, append the dynamic part:

```tsx
// KEY: "confirm.finalize_vat": "Confirm lock VAT for period"
const msg = `${t('confirm.finalize_purchase_vat')} ${month}/${year}?`;
confirm(msg);
```

## What NOT to translate

These are data fields, not UI strings — they're exempt from the ESLint rule:

```tsx
const MODULE_CONFIG = [
  { nameTh: 'คลังสินค้า', nameEn: 'Warehouse' }, // ✓ data config
];
```

Object property keys matching `nameTh`, `labelTh`, `valueTh`, `descriptionTh`, `name_th`, `label_th` are whitelisted.

## PDF Legal Forms

`app/app/ap/wht/**/route.tsx` — Thai government legal forms. Must stay in Thai. Exempt from the ESLint rule.

## New Page Checklist

- [ ] Copy `scripts/new-page-template.tsx` as starting point
- [ ] Import `useT` at top of component
- [ ] Call `const t = useT()` inside component function
- [ ] No Thai text outside `nameTh`/`*Th` data properties
- [ ] New keys added to both `en.json` and `th.json`
```

- [ ] **Step 5.2:** Commit

```bash
git add docs/i18n.md
git commit -m "docs(i18n): add developer guide for i18n compliance"
```

---

### Task 6: Update CLAUDE.md

- [ ] **Step 6.1:** Open `CLAUDE.md` and find the Knowledge Base table (has `docs/SCHEMA.md`, `_notes/02_Agent_Memory/pitfalls.md`, etc.)

- [ ] **Step 6.2:** Add i18n guide row to the table:

```markdown
| `docs/i18n.md` | Before adding any UI text or new module |
```

- [ ] **Step 6.3:** Find the Auto-QA step in the Execution Loop section. After the existing QA steps, add:

```markdown
   - **i18n check:** No Thai text in JSX strings or function args outside `*Th` data properties. New keys must be in both `en.json` and `th.json`.
```

- [ ] **Step 6.4:** Commit

```bash
git add CLAUDE.md
git commit -m "docs(claude-md): add i18n check to QA loop and knowledge base"
```

---

## Verification

```bash
npm run lint 2>&1 | grep "no-hardcoded-thai" | wc -l
```

Expected: many warnings (127+ files have violations). That's expected — they'll be fixed in Tracks 3–6.

```bash
npm run build
```

Expected: build succeeds (warnings don't fail build).

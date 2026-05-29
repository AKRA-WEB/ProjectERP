# i18n Full Compliance + Future Prevention Design

**Date:** 2026-05-29  
**Status:** Approved  
**Scope:** Fix all 127+ hardcoded Thai text files + prevent regression for new modules

---

## Problem Statement

The ERP codebase has a custom React Context-based i18n system (`lib/i18n/`) with 211 translation keys, but only **38 of 203 `.tsx` files** correctly use `useT()` or `useLanguage()`. The remaining **127+ files** contain hardcoded Thai text, making language switching non-functional in those tabs/pages. This was caused by new modules (GRN, VAT Report, Admin Pricing, WHT, WMS Replenish) being added without i18n compliance.

---

## Architecture

### Layers

```
Prevention Layer (Track 1)
├── ESLint rule: no-hardcoded-thai        ← block new Thai at build time
├── scripts/new-page-template.tsx         ← scaffold i18n-ready page
├── docs/i18n.md                          ← developer reference guide
└── CLAUDE.md update                      ← AI agent QA checklist

Translation Keys (Track 2)
├── lib/i18n/en.json  (+~80 keys)
└── lib/i18n/th.json  (+~80 keys)

Module Fix Groups
├── Track 3: Accounting (vat-report, audit/ledger, audit/journals)
├── Track 4: GRN + Purchase Orders (grn/new, grn/[id], purchase-orders/new)
├── Track 5: Admin + WMS (admin/pricing, admin/integrations/hrzoft, wms/replenish)
└── Track 6: Menu + Dashboard + remaining pages
```

No changes to the i18n architecture itself — the Custom React Context system is correct and well-designed.

---

## Track 1: Prevention Infrastructure

### 1.1 ESLint Rule: `no-hardcoded-thai`

**File:** `.eslint-local-rules/no-hardcoded-thai.js`  
**Severity:** `error` (build fails on violation)  
**Detection:** Thai unicode range `[฀-๿]` in:
- JSX string literals: `<h1>สวัสดี</h1>`
- Template literals: `` `ข้อความ ${var}` ``
- String arguments: `toast.error("เกิดข้อผิดพลาด")`

**Whitelist exceptions** (allowed — these are data, not UI strings):
- Object properties: `nameTh`, `labelTh`, `valueTh`, `descriptionTh`
- Files matching `*.pdf/route.tsx` — Thai legal forms (e.g., Form 50-TWI)
- Files in `lib/i18n/` — translation source files themselves

**Examples:**
```tsx
// ❌ ERROR — blocked
<h2>รายงานภาษีซื้อ</h2>
toast.success("ล็อกรายงานสำเร็จ")
const label = "รายการสินค้า"

// ✓ ALLOWED — correct usage
<h2>{t('page.vat_report')}</h2>
toast.success(t('msg.lock_success'))
const config = { nameTh: "คลังสินค้า", nameEn: "Warehouse" }  // data field
```

### 1.2 Page Scaffold Template

**File:** `scripts/new-page-template.tsx`

Template for new pages — pre-wired with i18n hooks, with example usage comments. Developers copy this file when creating a new page. Ensures every new page starts i18n-compliant.

### 1.3 Developer Guide

**File:** `docs/i18n.md`

Covers:
- Key naming convention (`page.*`, `label.*`, `action.*`, `msg.*`, `status.*`, `confirm.*`, `month.*`)
- How to add a new key to both `en.json` and `th.json` simultaneously
- Which hook to use when (`useT()` for static text, `localeName()` for dual-language DB data)
- Common mistakes: hardcoding in `useEffect`, toast messages, console logs, `title` props
- Before/after code examples

### 1.4 CLAUDE.md QA Checklist Update

Add to the Auto-QA step in the Execution Loop:
> **i18n check:** No Thai text in JSX strings, template literals, or function arguments outside data config objects (nameTh/labelTh/valueTh properties are exempt).

---

## Track 2: Translation Keys Expansion

Add ~80 new keys to both `lib/i18n/en.json` and `lib/i18n/th.json`:

| Namespace | Example keys | Count |
|-----------|-------------|-------|
| `page.*` | `page.vat_report`, `page.grn_new`, `page.admin_pricing`, `page.wht_cert` | ~20 |
| `label.*` | `label.tax_period`, `label.receipt_no`, `label.vendor_code`, `label.wht_type` | ~30 |
| `msg.*` | `msg.lock_success`, `msg.confirm_lock`, `msg.no_records`, `msg.loading` | ~15 |
| `month.*` | `month.jan` through `month.dec` | 12 |
| `confirm.*` | `confirm.lock_vat`, `confirm.delete_grn`, `confirm.post_je` | ~8 |

**Key naming convention:**
- `page.{module_name}` — page titles and descriptions
- `label.{field_name}` — form labels, table headers, field names
- `msg.{verb_noun}` — success/error/info messages
- `month.{3-letter-abbr}` — month names
- `confirm.{action}` — confirmation dialog text
- Reuse existing keys where applicable before adding new ones

---

## Tracks 3–6: Module Fix Pattern

Every fix follows the same pattern:

```tsx
// BEFORE (non-compliant)
export default function VatReportPage() {
  return (
    <div>
      <h2>รายงานภาษีซื้อและภาษีขายประจำเดือน</h2>
      <button onClick={() => toast.success("ล็อกรายงานสำเร็จ")}>
        ล็อกรายงาน
      </button>
    </div>
  )
}

// AFTER (compliant)
import { useT } from '@/lib/i18n';

export default function VatReportPage() {
  const t = useT();
  return (
    <div>
      <h2>{t('page.vat_report_desc')}</h2>
      <button onClick={() => toast.success(t('msg.lock_success'))}>
        {t('action.lock_report')}
      </button>
    </div>
  )
}
```

### Track 3: Accounting Module
**Files:** `app/app/accounting/vat-report/page.tsx`, `app/app/accounting/audit/ledger/page.tsx`, other accounting audit pages  
**Thai chars to fix:** ~2,500+  
**New keys needed:** ~25 (`page.vat_report*`, `label.tax_*`, `msg.lock_*`, `confirm.lock_*`)

### Track 4: GRN + Purchase Orders
**Files:** `app/app/grn/new/page.tsx`, `app/app/grn/[id]/page.tsx`, `app/app/purchase-orders/new/page.tsx`  
**Thai chars to fix:** ~4,832  
**New keys needed:** ~20 (`page.grn_*`, `label.receipt_*`, `label.vendor_*`, `msg.grn_*`)

### Track 5: Admin + WMS
**Files:** `app/app/admin/pricing/page.tsx`, `app/app/admin/integrations/hrzoft/page.tsx`, `app/app/wms/replenish/page.tsx`  
**Thai chars to fix:** ~4,596  
**New keys needed:** ~15 (`page.admin_*`, `page.wms_*`, `label.pricing_*`)

### Track 6: Menu + Dashboard + Remaining
**Files:** `app/app/menu/page.tsx`, `app/app/dashboard/AuditorDashboardClient.tsx`, all remaining non-compliant pages  
**Includes:** Thai month names → `t('month.jan')` etc., greeting text already partially using `t()`  
**New keys needed:** 12 month keys + ~10 other

---

## Exceptions / Out of Scope

- `app/app/ap/wht/[id]/form-50-twi.pdf/route.tsx` — Thai government legal form, must remain Thai-only
- `lib/i18n/en.json`, `lib/i18n/th.json` — source files, exempt from ESLint rule
- Data object properties (`nameTh`, `labelTh`, `valueTh`) — DB/config data, not UI strings

---

## Success Criteria

1. `npm run lint` passes with 0 i18n errors after all tracks complete
2. Language switcher toggles ALL text in all pages (TH ↔ EN)
3. New page scaffold template used for any page created after Track 1
4. CLAUDE.md QA loop includes i18n check — AI agents enforce on every new module
5. `docs/i18n.md` committed and linked from CLAUDE.md Knowledge Base table

---

## Risk Mitigation

- **Key collision:** Check existing 211 keys before adding new ones — reuse where possible
- **Missed strings:** Run ESLint after each track to catch any remaining violations
- **Data vs UI confusion:** ESLint whitelist covers `*Th` property names; document pattern clearly
- **Regression:** Each track is testable independently — switch language and verify the module

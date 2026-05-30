---
track: i18n-t3-accounting
phase: i18n-compliance
sequence: 3
status: Verified
owner: Chen
created: 2026-05-29
depends_on: [i18n-t2-keys]
estimate: M
tags: [i18n, accounting]
spec: docs/superpowers/specs/2026-05-29-i18n-full-compliance-design.md
---

# i18n Track 3 — Accounting Module Fix

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

## Goal

Replace all hardcoded Thai text in the Accounting module with `t()` calls. Two primary files: `vat-report/page.tsx` (~1,002 Thai chars) and `audit/ledger/page.tsx` (~19 Thai lines). Also fix any other accounting pages with violations found via lint.

## Architecture

Pattern for every fix:
1. Add `import { useT } from '@/lib/i18n'` at the top
2. Call `const t = useT()` inside the component
3. Replace every Thai string with the corresponding `t('key')` call
4. For dynamic strings with Thai + variable: `\`${t('confirm.finalize_purchase_vat')} ${month}/${year}? ${t('confirm.irreversible')}\``

All keys used here were added in Track 2. Check Track 2 is complete before starting.

## Tech Stack

Next.js, React, TypeScript, `@/lib/i18n`

## Acceptance Criteria

1. `npm run lint 2>&1 | grep "no-hardcoded-thai" | grep "accounting"` → 0 results
2. Language switcher in dev server toggles all text in accounting pages (TH ↔ EN)
3. `npx tsc --noEmit` passes — 0 errors

---

## Files

| Action | Path |
|--------|------|
| Modify | `app/app/accounting/vat-report/page.tsx` |
| Modify | `app/app/accounting/audit/ledger/page.tsx` |
| Modify | any other accounting/*.tsx with warnings (found via lint) |

---

## Tasks

### Task 1: Fix vat-report/page.tsx

- [x] **Step 1.1:** Read the full file `app/app/accounting/vat-report/page.tsx`

- [x] **Step 1.2:** Add import and hook — find the existing imports block and add:

```tsx
import { useT } from '@/lib/i18n';
```

Then inside `VATReportPage()` function, after the existing `useState` calls, add:

```tsx
const t = useT();
```

- [x] **Step 1.3:** Fix `handleFinalize` confirmation messages (around line 63-65):

Replace:
```tsx
const confirmMessage = tab === 'purchase' 
  ? `คุณแน่ใจหรือไม่ที่จะล็อก "ภาษีซื้อ" ประจำรอบ ${month}/${year}? เมื่อล็อกแล้วจะไม่สามารถย้อนกลับหรือแก้ไขได้`
  : `คุณแน่ใจหรือไม่ที่จะล็อก "ภาษีขาย" ประจำรอบ ${month}/${year}? เมื่อล็อกแล้วจะไม่สามารถย้อนกลับหรือแก้ไขได้`;
```

With:
```tsx
const confirmMessage = tab === 'purchase'
  ? `${t('confirm.finalize_purchase_vat')} ${month}/${year}? ${t('confirm.irreversible')}`
  : `${t('confirm.finalize_sales_vat')} ${month}/${year}? ${t('confirm.irreversible')}`;
```

- [x] **Step 1.4:** Fix success/error alerts (around line 73-76):

Replace:
```tsx
alert('ล็อกรายงานและสร้างบันทึกประวัติสำเร็จเรียบร้อยแล้ว');
```
With:
```tsx
alert(t('msg.lock_report_success'));
```

Replace:
```tsx
alert((err as Error).message || 'เกิดข้อผิดพลาดในการล็อกรายงาน');
```
With:
```tsx
alert((err as Error).message || t('msg.lock_report_error'));
```

- [x] **Step 1.5:** Fix all remaining Thai strings in the JSX render section. Run lint to see remaining violations:

```bash
npx eslint app/app/accounting/vat-report/page.tsx --rule '{"local-rules/no-hardcoded-thai": "error"}' 2>&1
```

Fix each reported line using the keys from Track 2. Common replacements:
- `"ภาษีซื้อ"` → `{t('label.purchase_vat')}`
- `"ภาษีขาย"` → `{t('label.sales_vat')}`
- `"รอบภาษี"` → `{t('label.tax_period')}`
- `"มูลค่าสินค้า (ฐานภาษี)"` → `{t('label.tax_base')}`
- `"ภาษีมูลค่าเพิ่ม 7%"` → `{t('label.vat_7pct')}`
- `"กำลังโหลด..."` → `{t('msg.loading_data')}`
- `"ไม่พบรายการ"` → `{t('msg.no_records')}`

Note: CSV export headers (inside the csvContent string building) should stay in Thai — they are data output for Thai accounting software, not UI text. Add a targeted `// eslint-disable-next-line local-rules/no-hardcoded-thai` comment above those specific lines.

- [x] **Step 1.6:** Run lint on the file to confirm 0 warnings (except CSV headers if disabled):

```bash
npx eslint app/app/accounting/vat-report/page.tsx 2>&1
```

Expected: 0 `no-hardcoded-thai` warnings.

- [x] **Step 1.7:** Commit

```bash
git add app/app/accounting/vat-report/page.tsx
git commit -m "fix(i18n): migrate vat-report page to i18n keys"
```

---

### Task 2: Fix audit/ledger/page.tsx

- [x] **Step 2.1:** Read `app/app/accounting/audit/ledger/page.tsx`

- [x] **Step 2.2:** Add import at top of file:

```tsx
import { useT } from '@/lib/i18n';
```

- [x] **Step 2.3:** Inside the component, add hook after existing hooks:

```tsx
const t = useT();
```

- [x] **Step 2.4:** Fix all 19 Thai lines. Key mappings:

| Original Thai | Key to use |
|---------------|-----------|
| `สมุดบัญชีแยกประเภท (สำหรับผู้ตรวจสอบ) / Audit General Ledger` | `t('page.audit_ledger')` |
| `ตรวจสอบทุกรายการเคลื่อนไหวทางบัญชีแบบแยกประเภทอย่างละเอียด` | `t('page.vat_report_desc')` — or add new key `page.audit_ledger_desc` if wording doesn't match |
| `← กลับหน้าแดชบอร์ด` | `← {t('page.dashboard')}` |
| `รหัสหรือชื่อบัญชี / Select Account` | `{t('label.select_account')}` |
| `ทั้งหมด / All Accounts` | `{t('label.all_accounts')}` |
| `ตั้งแต่วันที่ / From Date` | `{t('label.from_date')}` |
| `ถึงวันที่ / To Date` | `{t('label.to_date')}` |
| `วันที่ / Date` (table header) | `{t('label.date')}` |
| `เลขที่ใบสำคัญ / JE No.` | `{t('label.je_no')}` |
| `ประเภทบัญชี / Code & Account` | `{t('label.code')} & {t('label.name')}` |
| `รายละเอียด / Memo` | `{t('label.memo')}` |
| `เดบิต / Debit` | `{t('label.debit')}` |
| `เครดิต / Credit` | `{t('label.credit')}` |
| `กำลังดึงข้อมูลสมุดบัญชีแยกประเภท...` | `{t('msg.loading_data')}` |
| `ไม่พบบันทึกการเคลื่อนไหวทางบัญชีตามตัวกรองที่เลือก` | `{t('msg.no_records')}` |
| `← ก่อนหน้า` | `← {t('action.back')}` |
| `ถัดไป →` | `{t('action.view')} →` or add key `action.next` |

If any key is truly missing from Track 2, add it to both JSON files before proceeding.

- [x] **Step 2.5:** Run lint on file:

```bash
npx eslint app/app/accounting/audit/ledger/page.tsx 2>&1
```

Expected: 0 `no-hardcoded-thai` warnings.

- [x] **Step 2.6:** Commit

```bash
git add app/app/accounting/audit/ledger/page.tsx
git commit -m "fix(i18n): migrate accounting audit ledger page to i18n keys"
```

---

### Task 3: Fix remaining accounting pages

- [x] **Step 3.1:** Find all remaining accounting Thai violations:

```bash
npx eslint app/app/accounting/ --rule '{"local-rules/no-hardcoded-thai": "warn"}' --format stylish 2>&1 | grep "no-hardcoded-thai"
```

- [x] **Step 3.2:** For each file with violations, apply the same pattern: add `useT` import + `const t = useT()` + replace Thai strings with `t('key')`. Add missing keys to JSON files if needed.

Common accounting pages to check:
- `app/app/accounting/journal-entries/page.tsx`
- `app/app/accounting/journal-entries/new/page.tsx`
- `app/app/accounting/reports/*/page.tsx` (trial-balance, profit-loss, balance-sheet, ap-aging, ar-aging)
- `app/app/accounting/fiscal-periods/page.tsx`
- `app/app/accounting/chart-of-accounts/page.tsx`

- [x] **Step 3.3:** After fixing all, run lint on entire accounting dir:

```bash
npx eslint app/app/accounting/ 2>&1 | grep "no-hardcoded-thai"
```

Expected: 0 results.

- [x] **Step 3.4:** Commit all remaining fixes:

```bash
git add app/app/accounting/
git commit -m "fix(i18n): migrate all accounting pages to i18n keys"
```

---

## Verification

```bash
npx tsc --noEmit 2>&1 | grep -i "error" | head -10
```

Expected: 0 errors.

Manual test: Start dev server (`npm run dev`), navigate to Accounting > VAT Report, toggle language (TH ↔ EN) using LanguageSwitcher — all text should switch.

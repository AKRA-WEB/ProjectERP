---
track: i18n-t4-grn-purchasing
phase: i18n-compliance
sequence: 4
status: Verified
owner: Chen
created: 2026-05-29
depends_on: [i18n-t2-keys]
estimate: M
tags: [i18n, grn, purchasing]
spec: docs/superpowers/specs/2026-05-29-i18n-full-compliance-design.md
---

# i18n Track 4 — GRN + Purchase Orders Fix

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

## Goal

Replace all hardcoded Thai text in GRN and Purchase Order pages with `t()` calls. Primary files: `grn/new/page.tsx` (~2,135 Thai chars), `grn/[id]/page.tsx` (~1,695 Thai chars), `purchase-orders/new/page.tsx` (~1,002 Thai chars).

## Architecture

Same pattern as Track 3:
1. Add `import { useT } from '@/lib/i18n'`
2. `const t = useT()` inside component
3. Replace Thai strings with `t('key')` calls
4. Dynamic strings: concatenate `t()` with variable

All keys were added in Track 2. Check Track 2 complete before starting.

## Tech Stack

Next.js, React, TypeScript, `@/lib/i18n`

## Acceptance Criteria

1. `npx eslint app/app/grn/ app/app/purchase-orders/ 2>&1 | grep "no-hardcoded-thai"` → 0 results
2. Language switcher toggles all GRN and PO text in dev server
3. `npx tsc --noEmit` passes

---

## Files

| Action | Path |
|--------|------|
| Modify | `app/app/grn/new/page.tsx` |
| Modify | `app/app/grn/[id]/page.tsx` |
| Modify | `app/app/purchase-orders/new/page.tsx` |
| Modify | any other grn/purchasing pages with violations |

---

## Tasks

### Task 1: Fix grn/new/page.tsx

- [ ] **Step 1.1:** Run lint to get all violations with line numbers:

```bash
npx eslint app/app/grn/new/page.tsx --rule '{"local-rules/no-hardcoded-thai": "error"}' --format stylish 2>&1
```

- [ ] **Step 1.2:** Add import at top of file:

```tsx
import { useT } from '@/lib/i18n';
```

- [ ] **Step 1.3:** Inside the main component function, add:

```tsx
const t = useT();
```

- [ ] **Step 1.4:** Fix Thai strings using these key mappings:

| Original Thai | Replacement |
|---------------|-------------|
| `"สินค้ายังไม่เข้า"` / `"ยังไม่เข้า"` | `t('label.skipped')` |
| `"สินค้าแถม"` | `t('label.bonus_item')` |
| `"วันหมดอายุ"` | `t('label.expiry_date')` |
| `"วันที่ผลิต"` | `t('label.mfg_date')` |
| `"เลขที่ล็อต"` | `t('label.lot_no')` |
| `"ตำแหน่งจัดเก็บ"` | `t('label.storage_location')` |
| `"จำนวนสั่งซื้อ"` | `t('label.qty_ordered')` |
| `"จำนวนที่รับแล้ว"` | `t('label.qty_received')` |
| `"จำนวนรับครั้งนี้"` | `t('label.qty_input')` |
| `"เลขที่ใบสั่งซื้อ"` | `t('label.po_number')` |
| `"กำลังค้นหา..."` | `t('msg.searching')` |
| `"กำลังโหลด..."` | `t('msg.loading_data')` |
| `"ไม่พบรายการ"` | `t('msg.no_records')` |
| `"บันทึกสำเร็จ"` | `t('msg.save_success')` |
| `"เกิดข้อผิดพลาด..."` | `t('msg.save_error')` |
| `"สร้างใบรับสินค้าสำเร็จ"` | `t('msg.grn_success')` |
| `"รายการรับสินค้า"` | `t('label.grn_lines')` |

For any Thai string not covered above, check if a suitable existing key exists in `lib/i18n/en.json`. If not, add to both JSON files first.

- [ ] **Step 1.5:** Verify no violations remain:

```bash
npx eslint app/app/grn/new/page.tsx 2>&1 | grep "no-hardcoded-thai"
```

Expected: 0 results.

- [ ] **Step 1.6:** Commit:

```bash
git add app/app/grn/new/page.tsx
git commit -m "fix(i18n): migrate grn/new page to i18n keys"
```

---

### Task 2: Fix grn/[id]/page.tsx

- [ ] **Step 2.1:** Run lint:

```bash
npx eslint "app/app/grn/[id]/page.tsx" --rule '{"local-rules/no-hardcoded-thai": "error"}' --format stylish 2>&1
```

- [ ] **Step 2.2:** Add `import { useT } from '@/lib/i18n'` and `const t = useT()` inside the component.

- [ ] **Step 2.3:** Fix all violations using same key mappings as Task 1. Additional keys for detail view:

| Original Thai | Replacement |
|---------------|-------------|
| `"ยืนยันลบ..."` / `"คุณแน่ใจ..."` | `t('confirm.delete_grn')` |
| `"เลขที่ใบรับสินค้า"` | `t('label.reference')` (reuse existing) |
| `"คงเหลือ"` | `t('label.stock_on_hand')` |

- [ ] **Step 2.4:** Verify:

```bash
npx eslint "app/app/grn/[id]/page.tsx" 2>&1 | grep "no-hardcoded-thai"
```

- [ ] **Step 2.5:** Commit:

```bash
git add "app/app/grn/[id]/page.tsx"
git commit -m "fix(i18n): migrate grn/[id] detail page to i18n keys"
```

---

### Task 3: Fix purchase-orders/new/page.tsx

- [ ] **Step 3.1:** Run lint:

```bash
npx eslint "app/app/purchase-orders/new/page.tsx" --rule '{"local-rules/no-hardcoded-thai": "error"}' --format stylish 2>&1
```

- [ ] **Step 3.2:** Add `import { useT } from '@/lib/i18n'` and `const t = useT()` inside the component.

- [ ] **Step 3.3:** Fix violations. Common keys:

| Original Thai | Replacement |
|---------------|-------------|
| `"เลือกผู้จัดจำหน่าย"` | `t('label.vendor')` |
| `"เลือกคลังสินค้า"` | `t('label.warehouse')` |
| `"เพิ่มสินค้า"` | `t('action.add')` |
| `"หมายเหตุ"` | `t('label.note')` |
| `"บันทึกใบสั่งซื้อ"` | `t('action.save')` |
| `"กำลังโหลด..."` | `t('msg.loading_data')` |
| `"ไม่พบสินค้า"` | `t('msg.no_records')` |

- [ ] **Step 3.4:** Verify:

```bash
npx eslint "app/app/purchase-orders/new/page.tsx" 2>&1 | grep "no-hardcoded-thai"
```

- [ ] **Step 3.5:** Commit:

```bash
git add "app/app/purchase-orders/new/page.tsx"
git commit -m "fix(i18n): migrate purchase-orders/new page to i18n keys"
```

---

### Task 4: Fix remaining GRN and purchasing pages

- [ ] **Step 4.1:** Find all remaining violations in these directories:

```bash
npx eslint app/app/grn/ app/app/purchase-orders/ app/app/grn/ 2>&1 | grep "no-hardcoded-thai"
```

- [ ] **Step 4.2:** Fix any remaining files found. Apply same pattern.

- [ ] **Step 4.3:** Final verification:

```bash
npx eslint app/app/grn/ app/app/purchase-orders/ 2>&1 | grep "no-hardcoded-thai"
```

Expected: 0 results.

- [ ] **Step 4.4:** Commit remaining:

```bash
git add app/app/grn/ app/app/purchase-orders/
git commit -m "fix(i18n): migrate all GRN and purchase order pages to i18n keys"
```

---

## Verification

```bash
npx tsc --noEmit 2>&1 | head -10
```

Manual: Start dev server, navigate to GRN > New GRN, switch language — all labels switch. Navigate to Purchase Orders > New — same.

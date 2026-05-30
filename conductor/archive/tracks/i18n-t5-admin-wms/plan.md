---
track: i18n-t5-admin-wms
phase: i18n-compliance
sequence: 5
status: Verified
owner: Chen
created: 2026-05-29
depends_on: [i18n-t2-keys]
estimate: M
tags: [i18n, admin, wms]
spec: docs/superpowers/specs/2026-05-29-i18n-full-compliance-design.md
---

# i18n Track 5 — Admin + WMS Fix

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

## Goal

Replace all hardcoded Thai text in Admin and WMS pages. Primary files: `admin/pricing/page.tsx` (~85 Thai lines), `admin/integrations/hrzoft/page.tsx` (~many), `wms/replenish/page.tsx` (~66 Thai lines), and `admin/page.tsx` (hub page).

## Architecture

Same pattern: add `useT` import + hook + replace Thai strings with `t('key')`.
Also fix toast messages — the `admin/pricing` page has many `toast('error', 'Thai text')` calls.

## Tech Stack

Next.js, React, TypeScript, `@/lib/i18n`

## Acceptance Criteria

1. `npx eslint app/app/admin/ app/app/wms/ 2>&1 | grep "no-hardcoded-thai"` → 0 results
2. Language switcher works in Admin and WMS pages
3. `npx tsc --noEmit` passes

---

## Files

| Action | Path |
|--------|------|
| Modify | `app/app/admin/pricing/page.tsx` |
| Modify | `app/app/admin/integrations/hrzoft/page.tsx` |
| Modify | `app/app/admin/page.tsx` |
| Modify | `app/app/wms/replenish/page.tsx` |
| Modify | any other admin/wms pages with violations |

---

## Tasks

### Task 1: Fix admin/pricing/page.tsx

- [ ] **Step 1.1:** Run lint to see all violations:

```bash
npx eslint app/app/admin/pricing/page.tsx --rule '{"local-rules/no-hardcoded-thai": "error"}' --format stylish 2>&1
```

- [ ] **Step 1.2:** Add import:

```tsx
import { useT } from '@/lib/i18n';
```

- [ ] **Step 1.3:** Find `ProductSearch` component and `PricingPage` (or equivalent) component. Add `const t = useT()` inside each component that has Thai text.

- [ ] **Step 1.4:** Fix violations. Key mappings:

| Original Thai | Replacement |
|---------------|-------------|
| `"ค้นหาสินค้าด้วยชื่อหรือ SKU..."` | `t('label.search_placeholder')` |
| `"กำลังค้นหา..."` | `t('msg.searching')` |
| `"ราคาสินค้า"` | `t('page.admin_pricing')` |
| `"ระบุ SKU"` | `t('error.select_sku')` |
| `"ช่องทางต้องเป็น TRD หรือ AKRA"` | keep as-is with `eslint-disable` — business-specific validation |
| `"ระดับสมาชิกต้องเป็น T0, T1, T2 หรือ T3"` | keep as-is with `eslint-disable` — business-specific |
| `"ราคาต้องเป็นจำนวนตัวเลขและมากกว่าหรือเท่ากับ 0"` | `t('error.invalid_price')` |
| `"วันที่เริ่มต้น (valid_from) ต้องอยู่ในรูปแบบ YYYY-MM-DD"` | `t('error.invalid_date_format')` |
| `"วันที่สิ้นสุด (valid_to) ต้องอยู่ในรูปแบบ YYYY-MM-DD"` | `t('error.invalid_date_format')` |
| `"วันที่สิ้นสุดต้องไม่น้อยกว่าวันที่เริ่มต้น"` | `t('error.date_range')` |
| `"กรุณาเลือกสินค้า"` | `t('error.select_product')` |
| `"กรุณาระบุราคาสินค้าที่ถูกต้อง"` | `t('error.invalid_price')` |
| `"บันทึกราคาสินค้าสำเร็จ"` | `t('msg.save_success')` |
| `"ล้มเหลวในการบันทึกราคา"` | `t('msg.save_error')` |
| `"กรุณาแก้ไขแถวที่ระบุข้อผิดพลาดก่อนบันทึก"` | `t('msg.save_error')` |
| `"ไม่มีรายการข้อมูลสำหรับนำเข้า"` | `t('msg.no_records')` |
| `` `นำเข้าราคาสำเร็จทั้งหมด ${res.inserted} รายการ` `` | `` `${t('msg.import_success')} (${res.inserted})` `` |
| `"เกิดข้อผิดพลาดในการนำเข้าข้อมูล"` | `t('msg.import_error')` |
| `"เกิดข้อผิดพลาดในการโหลดราคาสินค้า"` | `t('msg.save_error')` |

For business-specific validation strings that don't have appropriate keys (e.g., "ช่องทางต้องเป็น TRD หรือ AKRA") — add specific keys to both JSON files:
- `"error.invalid_channel": "Channel must be TRD or AKRA"` / `"ช่องทางต้องเป็น TRD หรือ AKRA"`
- `"error.invalid_tier": "Tier must be T0, T1, T2, or T3"` / `"ระดับสมาชิกต้องเป็น T0, T1, T2 หรือ T3"`

- [ ] **Step 1.5:** Verify:

```bash
npx eslint app/app/admin/pricing/page.tsx 2>&1 | grep "no-hardcoded-thai"
```

Expected: 0 results.

- [ ] **Step 1.6:** Commit:

```bash
git add app/app/admin/pricing/page.tsx lib/i18n/en.json lib/i18n/th.json
git commit -m "fix(i18n): migrate admin pricing page to i18n keys"
```

---

### Task 2: Fix wms/replenish/page.tsx

- [ ] **Step 2.1:** Run lint:

```bash
npx eslint app/app/wms/replenish/page.tsx --rule '{"local-rules/no-hardcoded-thai": "error"}' --format stylish 2>&1
```

- [ ] **Step 2.2:** Add `import { useT } from '@/lib/i18n'` and `const t = useT()`.

- [ ] **Step 2.3:** Fix violations. Common WMS replenish keys:

| Original Thai | Replacement |
|---------------|-------------|
| `"การเติมสต็อก"` | `t('page.wms_replenish')` |
| `"จุดสั่งซื้อ"` | `t('label.reorder_point')` |
| `"คงเหลือ"` | `t('label.stock_on_hand')` |
| `"กำลังโหลด..."` | `t('msg.loading_data')` |
| `"ไม่พบรายการ"` | `t('msg.no_records')` |
| `"บันทึกสำเร็จ"` | `t('msg.save_success')` |
| `"เกิดข้อผิดพลาด"` | `t('msg.save_error')` |

- [ ] **Step 2.4:** Verify and commit:

```bash
npx eslint app/app/wms/replenish/page.tsx 2>&1 | grep "no-hardcoded-thai"
git add app/app/wms/replenish/page.tsx
git commit -m "fix(i18n): migrate wms replenish page to i18n keys"
```

---

### Task 3: Fix admin/page.tsx (Hub) and admin/integrations/hrzoft

- [ ] **Step 3.1:** Run lint on both:

```bash
npx eslint app/app/admin/page.tsx app/app/admin/integrations/hrzoft/page.tsx --rule '{"local-rules/no-hardcoded-thai": "error"}' 2>&1
```

- [ ] **Step 3.2:** Apply `useT` pattern to each file.

Key mappings for admin/page.tsx:
- `"จัดการผู้ใช้งาน"` → `t('page.users')`
- `"เพิ่ม แก้ไข ลบข้อมูลผู้ใช้งาน..."` → add `page.users_desc` key

For hrzoft page, apply same pattern. Add any missing keys to both JSON files.

- [ ] **Step 3.3:** Commit:

```bash
git add app/app/admin/
git commit -m "fix(i18n): migrate admin hub and hrzoft integration page to i18n keys"
```

---

### Task 4: Fix remaining admin/WMS pages

- [ ] **Step 4.1:** Find remaining violations:

```bash
npx eslint app/app/admin/ app/app/wms/ 2>&1 | grep "no-hardcoded-thai"
```

- [ ] **Step 4.2:** Fix any remaining files. Check these specifically:
  - `app/app/admin/users/page.tsx`
  - `app/app/admin/warehouses/page.tsx`
  - `app/app/admin/roles/page.tsx`
  - `app/app/admin/business-units/page.tsx`

- [ ] **Step 4.3:** Final check:

```bash
npx eslint app/app/admin/ app/app/wms/ 2>&1 | grep "no-hardcoded-thai"
```

Expected: 0 results.

- [ ] **Step 4.4:** Commit all:

```bash
git add app/app/admin/ app/app/wms/ lib/i18n/
git commit -m "fix(i18n): migrate all admin and WMS pages to i18n keys"
```

---

## Verification

```bash
npx tsc --noEmit 2>&1 | head -10
```

Manual: Dev server → Admin > Pricing → switch language → all labels switch.

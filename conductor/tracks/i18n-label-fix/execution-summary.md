# Execution Summary - Track: i18n-label-fix

All tasks for the `i18n-label-fix` track were verified to be already correctly implemented in the codebase.

## Task 1 — Add Thai label map to `StatusBadge`
- **File:** `components/ui/StatusBadge.tsx`
- **Evidence:** 
```tsx
const LABEL_TH: Record<string, string> = {
  draft: 'ร่าง',
  submitted: 'ส่งแล้ว',
  manager_approved: 'ผู้จัดการอนุมัติ',
  // ... (all other statuses)
};
const label = labelOverride ?? LABEL_TH[status] ?? status.replace(/_/g, ' ');
```
- **Result:** Verified. Statuses are correctly mapped and displayed in Thai.

## Task 2 — Add Thai labels to ledger entry type filter & badge
- **File:** `app/app/inventory/ledger/page.tsx`
- **Evidence:**
```tsx
const ENTRY_LABELS: Record<string, string> = {
  grn_receipt: 'รับสินค้า (GRN)',
  // ...
};
// Used in filter and table
<Badge variant="gray">{ENTRY_LABELS[l.entry_type] ?? l.entry_type.replace(/_/g, ' ')}</Badge>
```
- **Result:** Verified. Entry types in the ledger are correctly mapped to Thai.

## Task 3 — Add Thai labels to permission module headers
- **Files:** `app/app/admin/roles/new/page.tsx` and `app/app/admin/roles/[id]/page.tsx`
- **Evidence:**
```tsx
const MODULE_LABELS: Record<string, string> = {
  inbound_order: 'Inbound Order (รับสินค้า LINE)',
  // ...
};
<h3 ...>{MODULE_LABELS[module] ?? module.replace(/_/g, ' ')}</h3>
```
- **Result:** Verified. Permission module headers are displayed with Thai labels.

## Task 4 — Fix raw `toLocaleDateString()` → `formatDate()`
- **File:** `app/app/admin/users/UserRoleModal.tsx`
- **Evidence:**
```tsx
import { formatDate } from '@/lib/format';
// ...
<p ...>กำหนดโดย {r.assigned_by_name} เมื่อ {formatDate(r.assigned_at)}</p>
```
- **Result:** Verified. Dates are formatted using the `formatDate` utility.

## Verification Results
- `npm run lint`: Pass
- `npx tsc --noEmit`: Pass

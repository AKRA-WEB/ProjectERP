# Execution Summary — Track: po-fix-400

## Overview
Fixed the 400 Bad Request error occurring during Purchase Order creation when date fields were left empty, and improved UI validation feedback.

## Tasks Completed

### Task 1 — Fix onConfirm payload field names + submit guard
- **File changed:** `app/app/purchase-orders/new/page.tsx` lines 191-230
- **Key change:**
```typescript
if (!form.vendor_id) newErrors.vendor_id = 'กรุณาเลือกผู้จำหน่าย';
if (!form.expected_date) {
  newErrors.expected_date = 'กรุณาระบุวันที่คาดรับ';
  setActiveTab('details');
}
```
- **Verify result:** `npx tsc --noEmit` → 0 errors | UI shows red labels on missing fields.

### Task 2 — Add validation error detail logging in API
- **File changed:** `app/api/purchase-orders/route.ts` lines 97-100
- **Key change:**
```typescript
if (!parsed.success) {
  console.error('[POST /api/purchase-orders] validation error', parsed.error.flatten());
  return apiValidationError(parsed.error);
}
```
- **Verify result:** Server logs now clearly show Zod flat errors.

### Bonus — Date Normalization Fix
- **Files changed:** `app/api/purchase-orders/route.ts` and `app/api/purchase-orders/[id]/route.ts`
- **Key change:**
```typescript
doc_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).or(z.literal('')).optional()
// ...
parsed.data.doc_date || null
```
- **Verify result:** Empty date inputs no longer trigger 400 or DB errors.

## Post-Task Knowledge Capture
- **Pattern:** Inline Field Validation with Tab Switching (Added to `frontend_ui_rules.md`)
- **Trap:** Zod regex rejection of empty strings (Added to `backend_api_rules.md`)

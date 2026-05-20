# Execution Summary — GRN Role Segregation

Completed implementation of role segregation and redirection flow in the GRN receiving workflow. All modifications are type-checked and linted with zero errors.

---

### Task 1 — Secure API Endpoint `/api/grn/[id]/stock/route.ts`
- **File changed:** `app/api/grn/[id]/stock/route.ts` lines 4–15
- **Key change:** Enforce manager/admin role for stock-in requests
```typescript
import { assertRole, type SessionUser } from '@/lib/authz';

// Inside POST handler:
try {
  assertRole(u, ['manager', 'admin']);
} catch {
  return apiError('Forbidden', 403);
}
```
- **Verify:** `npx tsc --noEmit` -> 0 errors

---

### Task 2 — UI Redirect and Toast Logic in `app/app/grn/new/page.tsx`
- **File changed:** `app/app/grn/new/page.tsx` lines 5, 124, 415–422
- **Key change:** Redirect unloader back to the Receiving Queue dashboard and display a success toast message upon completion or draft save.
```typescript
toast('success', 'บันทึกการรับลงสินค้าเรียบร้อยแล้ว รอหัวหน้างานตรวจสอบ');
router.push('/app/grn/receiving-queue');
```
- **Verify:** `npx tsc --noEmit` -> 0 errors

---

### Task 3 — Role Gating in Detail Page `app/app/grn/[id]/page.tsx`
- **File changed:** `app/app/grn/[id]/page.tsx` lines 555–565
- **Key change:** Gate QC and Stock-In buttons under `isManager` to disable them for unloader staff.
```typescript
<Button onClick={() => setShowQC(true)} disabled={!isManager} title={!isManager ? 'Manager/Admin access required' : ''}>
  เริ่ม QC / Quality Control
</Button>
...
<Button onClick={() => action('stock')} loading={acting} disabled={!isManager} title={!isManager ? 'Manager/Admin access required' : ''}>
  นำเข้าคลัง / Stock In
</Button>
```
- **Verify:** `npx tsc --noEmit` -> 0 errors

---

### Global Verification Summary
- **TypeScript**: `npx tsc --noEmit` completed with **0 errors**.
- **ESLint**: `npm run lint` completed with **0 errors or warnings**.

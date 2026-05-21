# Task Checklist: GRN Role Segregation

- [x] **Task 1: Secure API Endpoint `/api/grn/[id]/stock/route.ts`**
  - [x] Add `assertRole(u, ['manager', 'admin'])` check in POST handler
  - [x] Verify `import { assertRole } from '@/lib/authz'`
  - [x] Run `npx tsc --noEmit` to verify type safety
- [x] **Task 2: UI Redirect and Toast Logic in `app/app/grn/new/page.tsx`**
  - [x] Import `useToast` from `@/components/ui`
  - [x] Update `'submit'` mode to redirect to `/app/grn/receiving-queue` with success toast
  - [x] Update `'draft'` mode to redirect to `/app/grn/receiving-queue` with success toast
  - [x] Run `npx tsc --noEmit` to verify type safety
- [x] **Task 3: Role Gating in Detail Page `app/app/grn/[id]/page.tsx`**
  - [x] Gate the "เริ่ม QC / Quality Control" button under `isManager` (disable and show tooltip if `!isManager`)
  - [x] Gate the "นำเข้าคลัง / Stock In" button under `isManager` (disable and show tooltip if `!isManager`)
  - [x] Run `npx tsc --noEmit` to verify type safety
- [x] **Task 4: Verification and QA**
  - [x] Run `npx tsc --noEmit` globally -> 0 errors
  - [x] Run `npm run lint` globally -> 0 errors

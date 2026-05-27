# GRN Role Segregation — Segregation of Duties

## Goal
Enforce separation of roles in the Goods Receipt Note (GRN) workflow so that the unloader (staff) cannot verify or stock-in a GRN. Upon clicking "รับสินค้าเสร็จแล้ว", they are redirected to a safe dashboard (Receiving Queue) with a success toast.

---

## Proposed Changes

### WMS Module

#### [MODIFY] [stock/route.ts](file:///C:/dev/projectERP/app/api/grn/%5Bid%5D/stock/route.ts)
- Enforce `assertRole(u, ['manager', 'admin'])` at the beginning of the POST handler.

#### [MODIFY] [page.tsx](file:///C:/dev/projectERP/app/app/grn/new/page.tsx)
- Import and use `useToast` from `@/components/ui`.
- Redirect unloader to `/app/grn/receiving-queue` after successful save/submit, with the following toast messages:
  - Complete: `"บันทึกการรับลงสินค้าเรียบร้อยแล้ว รอหัวหน้างานตรวจสอบ"`
  - Draft: `"บันทึกฉบับร่างเรียบร้อยแล้ว"`

#### [MODIFY] [page.tsx](file:///C:/dev/projectERP/app/app/grn/%5Bid%5D/page.tsx)
- Gate "เริ่ม QC / Quality Control" and "นำเข้าคลัง / Stock In" buttons under `isManager` so they are disabled for normal staff with a tooltip/title indicating that supervisor permission is required.

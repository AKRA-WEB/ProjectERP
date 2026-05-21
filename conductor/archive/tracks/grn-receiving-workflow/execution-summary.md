# Execution Summary — GRN Receiving Workflow

**Track ID:** `grn-receiving-workflow`
**Status:** Completed
**Date:** 2026-05-14

## Work Completed

### Database & Migration
- Created `migrations/027_grn_receiving_workflow.sql`:
    - Added `receiver_name` and `split_from_grn_id` to `goods_receipt_notes`.
    - Added `qty_expected` to `grn_line_items`.
    - Relaxed `qty_received > 0` constraint to `>= 0`.
    - Made `received_date` nullable for template GRNs.
- Executed migration successfully.

### API Layer
- Created `app/api/receiving/order/route.ts`: Atomic PO + GRN template creation.
- Created `app/api/grn/template/route.ts`: Create GRN template from existing PO.
- Enhanced `app/api/grn/[id]/receive/route.ts`: Multi-line receiving with auto-split logic.
- Created `app/api/grn/[id]/confirm/route.ts`: Supervisor quick-confirm (bypass QC).
- Updated `app/api/grn/route.ts`: Included `split_from_grn_id` in list response.

### UI Layer
- Created `app/app/receiving/new/page.tsx`: Unified "Open Work Card" form for Admins.
- Updated `app/app/purchase-orders/[id]/page.tsx`: Added "สร้างการ์ดงาน รับสินค้า" button.
- Refactored `app/app/grn/[id]/page.tsx`:
    - Implemented "Staff Work Card" for draft GRNs.
    - Added Supervisor "ยืนยันรับสินค้า" button.
    - Added Split GRN reference link.
- Updated `app/app/grn/page.tsx`:
    - Applied Thai status labels.
    - Added "แยก" badge for split GRNs.
- Updated `components/layout/Sidebar.tsx`: Added "เปิดคำสั่งซื้อ" link.

## Verification
- Ran `npm run lint`: Passed (with unrelated legacy warnings).
- Manual verification:
    - Full flow: New Order → Work Card → Partial Receive → Split GRN → Supervisor Confirm.
    - Confirmed stock updates and PO status changes correctly.

## Next Steps
- [ ] Add barcode scanning support to the Staff Work Card.
- [ ] Implement signature capture on the work card.

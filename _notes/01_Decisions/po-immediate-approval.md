---
date: 2026-05-18
type: decision
track: po-immediate-approval
module: WMS
status: open
---

# Decisions: PO Immediate Approval

## Centralized PO Types in types/index.ts
**Decision:** Defined `PurchaseOrder` and `POLineItem` interfaces in the global `types/index.ts` file.
**Reason:** The implementation plan expected these types to exist globally. Adding them to the central types file prevents duplication and ensures consistency across the new backend APIs and frontend pages.
**Impact:** Provides a shared, type-safe foundation for all PO-related development.

## Local Textarea Component
**Decision:** Implemented a local `Textarea` component in `app/app/purchase-orders/new/page.tsx` instead of adding it to the global `@/components/ui` library.
**Reason:** Followed the "Surgical Execution" rule. Since the task didn't explicitly call for UI library expansion, a local component was used to fulfill the requirement without affecting other parts of the system.
**Impact:** Meets the immediate need for long-form input while keeping global changes minimal.

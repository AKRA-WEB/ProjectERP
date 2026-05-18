## [Task 2/3] — Centralized PO Types in types/index.ts
**Date:** 2026-05-18
**Decision:** Defined `PurchaseOrder` and `POLineItem` interfaces in the global `types/index.ts` file.
**Alternatives considered:** Keeping types local to API routes or page components.
**Reason:** The implementation plan expected these types to exist globally. Adding them to the central types file prevents duplication and ensures consistency across the new backend APIs and frontend pages.
**Impact:** Provides a shared, type-safe foundation for all PO-related development.

## [Task 4] — Local Textarea Component
**Date:** 2026-05-18
**Decision:** Implemented a local `Textarea` component in `app/app/purchase-orders/new/page.tsx` instead of adding it to the global `@/components/ui` library.
**Alternatives considered:** Modifying the shared UI library to add a `Textarea.tsx`.
**Reason:** Followed the "Surgical Execution" rule. Since the task didn't explicitly call for UI library expansion, a local component was used to fulfill the requirement without affecting other parts of the system.
**Impact:** Meets the immediate need for long-form input while keeping global changes minimal.

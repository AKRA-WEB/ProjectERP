---
track: inbound-order-autocomplete
status: Verified
aliases: ["Improving Inbound Order Search & Notes"]
owner: Gemini
module: Warehouse
updated: 2026-05-22
---

# Track: inbound-order-autocomplete — Improving Inbound Order Search & Notes

## Goal
Improve the user experience on the Inbound Order creation page by renaming the page, introducing a searchable vendor autocomplete input, optimizing the product search with keyboard navigation and duplicate prevention, and exposing individual item notes in both the creation and details UI.

## Tasks

### Task 1 — Searchable Vendor Autocomplete (Creation)
- [x] Replace the native `<Select>` element for vendors with a custom searchable autocomplete search box in `app/app/inbound-orders/new/page.tsx`.
- [x] Integrate a click-away handler using refs to close the suggestions list.
- [x] Filter vendor suggestions in-memory matching code or name.

### Task 2 — Optimized Product Search & Duplicate Prevention (Creation)
- [x] Reduce product search debounce to 200ms in the `ProductSearch` sub-component in `app/app/inbound-orders/new/page.tsx`.
- [x] Implement keyboard navigation (`ArrowUp`, `ArrowDown`, `Enter`, `Escape`) to allow selecting a product using key events.
- [x] Exclude already selected product IDs from search suggestions in each row to prevent duplicates.
- [x] Add explicit validation in `handleSubmit` to prevent duplicate product selections or empty lines.

### Task 3 — Expose Line Notes in Creation UI
- [x] Expose a `"หมายเหตุ"` (Note) text input column in the items table on `app/app/inbound-orders/new/page.tsx`.
- [x] Ensure that notes are correctly passed into the `IOLine` payload when creating the Inbound Order.

### Task 4 — Expose & Edit Line Notes in Details UI
- [x] Update `IOLine` type in `app/app/inbound-orders/[id]/page.tsx` to support the `notes` field.
- [x] Display individual line notes underneath the product description in the read-only items list.
- [x] Add an input box for notes in the inline edit rows when in edit mode.
- [x] Send edited notes payload to the `PATCH /api/inbound-orders/[id]` endpoint inside `saveLines`.

---

## Acceptance Criteria
1. Page heading is changed to "สร้างรายการรับสินค้า".
2. Vendor selector is a searchable input with click-away closing.
3. Product search is responsive (200ms debounce) with full keyboard navigation support.
4. Product duplicate selection is physically prevented in search results and validated on submission.
5. Line-level notes can be entered on creation, displayed in the details view, and edited in the details page.
6. `npm run lint` and `npx tsc --noEmit` pass with zero errors.

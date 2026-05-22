---
track: po-new-autocomplete
status: Verified
aliases: ["Optimizing Purchase Order Search & Autocomplete"]
owner: Gemini
module: Procurement
updated: 2026-05-22
---

# Track: po-new-autocomplete — Optimizing Purchase Order Search & Autocomplete

## Goal
Improve the user experience on the New Purchase Order creation page by introducing a debounced product search, preventing duplicate product additions, closing dropdowns on click-away, and replacing the native supplier dropdown select with a searchable autocomplete input.

## Tasks

### Task 1 — Searchable Vendor Autocomplete
- [x] Replace the native `<Select>` element for vendors with a custom searchable autocomplete search box.
- [x] Integrate click-away handler to close the suggestions list.
- [x] Display vendor code and vendor name (bilingual) in the search results.

### Task 2 — Debounced Product Search
- [x] Implement debounce hook/utility or inline debouncing (300ms) for the product search query.
- [x] Ensure loading states are displayed while fetching products.

### Task 3 — Duplicate Prevention
- [x] Check if a product already exists in the PO lines.
- [x] If it exists, prevent adding a new row and instead increment the quantity of the existing line or display a toast/warning.

---

## Acceptance Criteria
1. Vendor selector is a searchable input with debounced results and click-away closing.
2. Product search is debounced and responsive.
3. Adding an already selected product updates the line's quantity or warns the user rather than adding a duplicate row.
4. `npm run lint` and `npx tsc --noEmit` are clean.

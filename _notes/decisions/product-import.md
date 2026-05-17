---
date: 2026-05-17
type: decision
track: product-import
module: inventory
status: open
---

# Decision — Product Schema Expansion for External System Compatibility

## Context
The legacy POS system provides a rich product export (23 columns) including data not previously stored in our ERP (e.g., selling price, discount logic, bin locations, and specific display flags for e-commerce/e-menu). To ensure a smooth transition and maintain full data fidelity, we need to decide how to handle these extra fields.

## Decision
We chose to **expand the core `products` table** with 10 new columns rather than using a separate metadata table or JSONB field.

## Alternatives considered
1. **JSONB column:** Flexible, but harder to type-check strictly and slower for frequent queries on price/discount.
2. **Product Metadata table:** Keeps core table lean, but adds JOIN overhead to almost every product-related view.

## Reason
The fields provided (Price, Discount, VAT status) are fundamental to ERP operations across multiple modules (POS, Sales, Inventory). Direct columns provide the best performance and strictest type safety via TypeScript.

## Impact
- All existing product queries now have access to these fields.
- Migration 032 must be applied before using the new import feature.
- Future modules (e-commerce/e-menu) have a pre-defined schema to build upon.

---

## [Task 2] — Initial Stock Seeding Logic
**Date:** 2026-05-17
**Decision:** Auto-seed stock for *new* products only, into the first active warehouse.
**Alternatives considered:** Manual warehouse selection, or requiring a separate GRN.
**Reason:** The import file contains "Current Quantity" as a flat value. Since this is an initial migration, creating a direct `stock_ledger` entry with `entry_type='initial_import'` is the most efficient path.
**Impact:** Avoids requiring 4,700 manual stock entries.

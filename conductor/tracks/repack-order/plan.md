---
track: repack-order
status: Completed
aliases: ["UoM Phase 3 — Repack Order System"]
owner: Gemini
module: WMS
updated: 2026-05-20
---

# Plan — Repack Order System (UoM Phase 3)

The "Repack Order" system is designed for Bakery Mart business to handle the process of breaking down bulk products (e.g., 25kg bags) into retail-sized units (e.g., 1kg bags, 500g bags) with integrated stock transactions, costing, and barcode labelling.

## User Review Required

> [!IMPORTANT]
> **Stock Transaction Policy**: The system will perform simultaneous "Stock Out" for the source product and "Stock In" for all output products in a single database transaction upon clicking **"Complete"**. This ensures balance integrity.

> [!TIP]
> **Costing Logic**: Initial unit costs for outputs are calculated using weight-based average (Source Cost / Output Ratio). However, the system allows **Manual Override** for each line before completion.

## Proposed Changes

### 1. Database Layer (PostgreSQL)

#### [NEW] `migrations/037_repack_system.sql`
- Create `repack_templates` and `repack_template_items` for saving repack formulas.
- Create `repack_orders` and `repack_order_items` for operational records.
- Create sequence `seq_repack_order_no` for document numbering (RPK-YYYYMMDD-XXXX).
- Add enum `repack_status` ('draft', 'completed', 'void').

### 2. Type System (TypeScript)

#### [MODIFY] [types/index.ts](file:///C:/Users/AKRA-Panich-Front/OneDrive/02-2%20-%20AKRA/projectERP/types/index.ts)
- Add interfaces: `RepackOrder`, `RepackOrderItem`, `RepackTemplate`, `RepackTemplateItem`.

### 3. API Layer (Next.js Routes)

#### [NEW] `app/api/repack/templates/route.ts`
- `GET`: List all repack templates.
- `POST`: Create a new template.

#### [NEW] `app/api/repack/route.ts`
- `GET`: List repack orders (with pagination & search).
- `POST`: Create a new draft repack order.

#### [NEW] `app/api/repack/[id]/route.ts`
- `GET`: Detail of a specific repack order.
- `PATCH`: Update draft or execute completion (`action: 'complete'`).
  - **Completion Logic**:
    1. Verify source product stock availability.
    2. Insert `stock_ledger` (OUT) for the source product.
    3. Insert `stock_ledger` (IN) for all output products.
    4. Update order status to `completed`.

### 4. UI Layer (React Components)

#### [NEW] `app/app/repack/page.tsx`
- Repack Order List view (Table with filters).

#### [NEW] `app/app/repack/new/page.tsx`
- Create Repack Order form.
- Source Selection → Template Selection (optional) → Input Output Qties → Auto-calculate Costs.

#### [NEW] `app/app/repack/[id]/page.tsx`
- Detail view and status management.
- **"Complete Repack"** button (with confirmation).
- **"Print Labels"** button for output products.

### 5. Navigation

#### [MODIFY] [components/layout/Sidebar.tsx](file:///C:/Users/AKRA-Panich-Front/OneDrive/02-2%20-%20AKRA/projectERP/components/layout/Sidebar.tsx)
- Add "Repack Orders" menu item under the Product/WMS category.

## Verification Plan

### Automated Tests
- Test creating a draft order.
- Test completion: Verify stock deduction (Source) and addition (Outputs).
- Test insufficient stock scenario: Must error out and rollback.

### Manual Verification
- Verify template loading logic.
- Test manual cost override and verify it's recorded in the stock ledger.
- Verify barcode label data format for printing.

---

## Acceptance Criteria

- [ ] Users can create and save Repack Templates.
- [ ] Users can create a Repack Order with 1 source and multiple outputs.
- [ ] Automated stock adjustment (In/Out) occurs on completion.
- [ ] Output unit costs are correctly recorded in the stock ledger.
- [ ] Barcode labels can be generated from the order detail page.
- [ ] `npx tsc --noEmit` passes with 0 errors.

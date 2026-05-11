# ESLint Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all remaining ESLint errors ('Unexpected any' and 'defined but never used') across 29 files to achieve zero linting errors.

**Architecture:** Systematic replacement of `any` with specific types from `types/index.ts` or local interfaces, and removal of unused imports/variables.

**Tech Stack:** Next.js 15, TypeScript 5, ESLint.

---

### Task 1: Admin & Users Batch

**Files:**
- Modify: `./app/(app)/admin/users/page.tsx`
- Modify: `./app/(app)/admin/users/UserFormModal.tsx`
- Modify: `./app/(app)/admin/users/UserWarehouseModal.tsx`
- Modify: `./app/(app)/admin/warehouses/page.tsx`

- [ ] **Step 1: Fix errors in `./app/(app)/admin/users/page.tsx`******
  - Replace `any` in table render (line 84).
- [ ] **Step 2: Fix errors in `./app/(app)/admin/users/UserFormModal.tsx`******
  - Replace `any` in state and props (lines 36, 43).
- [ ] **Step 3: Fix errors in `./app/(app)/admin/users/UserWarehouseModal.tsx`******
  - Replace `any` in state and props (lines 22, 43).
- [ ] **Step 4: Fix errors in `./app/(app)/admin/warehouses/page.tsx`******
  - Replace `any` in table renders and error handling (lines 36, 57, 98).
- [ ] **Step 5: Verify with lint**
  - Run: `npm run lint` for these files.

### Task 2: Claims & Cycle Counts Batch

**Files:**
- Modify: `./app/(app)/claims/new/page.tsx`
- Modify: `./app/(app)/claims/[id]/page.tsx`
- Modify: `./app/(app)/cycle-counts/new/page.tsx`
- Modify: `./app/(app)/cycle-counts/[id]/page.tsx`

- [ ] **Step 1: Fix errors in `./app/(app)/claims/new/page.tsx`**
  - Replace `any` in fetch calls and state (lines 25, 26, 28, 29, 53).
- [ ] **Step 2: Fix errors in `./app/(app)/claims/[id]/page.tsx`**
  - Replace `any` in params and state (lines 12, 26, 38).
- [ ] **Step 3: Fix errors in `./app/(app)/cycle-counts/new/page.tsx`**
  - Replace `any` in various state and fetch handlers (lines 22, 27, 28, 35, 39, 56, 57, 86).
- [ ] **Step 4: Fix errors in `./app/(app)/cycle-counts/[id]/page.tsx`**
  - Remove unused `Input` import.
  - Replace `any` in params and state (lines 12, 14, 22, 24, 41, 84).
- [ ] **Step 5: Verify with lint**
  - Run: `npm run lint` for these files.

### Task 3: Dashboard, GRN & Inventory Batch

**Files:**
- Modify: `./app/(app)/dashboard/page.tsx`
- Modify: `./app/(app)/grn/new/page.tsx`
- Modify: `./app/(app)/grn/page.tsx`
- Modify: `./app/(app)/grn/[id]/page.tsx`
- Modify: `./app/(app)/inventory/ledger/page.tsx`
- Modify: `./app/(app)/inventory/page.tsx`

- [ ] **Step 1: Fix errors in `./app/(app)/dashboard/page.tsx`**
  - Replace `any` in stats and fetch calls (lines 10, 11, 16, 22, 67, 92).
- [ ] **Step 2: Fix errors in `./app/(app)/grn/new/page.tsx`**
  - Replace `any` in fetch calls and state (lines 34, 35, 37, 38, 44, 47, 87).
- [ ] **Step 3: Fix errors in `./app/(app)/grn/page.tsx`**
  - Remove unused `SearchInput` import.
- [ ] **Step 4: Fix errors in `./app/(app)/grn/[id]/page.tsx`**
  - Replace `any` in state and renders (lines 12, 16, 23, 25, 46, 99, 151).
- [ ] **Step 5: Fix errors in `./app/(app)/inventory/ledger/page.tsx`**
  - Remove unused `SearchInput` import.
  - Replace `any` in table renders (lines 28, 31).
- [ ] **Step 6: Fix errors in `./app/(app)/inventory/page.tsx`**
  - Replace `any` in renders and fetch (lines 30, 34).
- [ ] **Step 7: Verify with lint**
  - Run: `npm run lint` for these files.

### Task 4: Products, PO & PR Batch

**Files:**
- Modify: `./app/(app)/products/page.tsx`
- Modify: `./app/(app)/products/ProductFormModal.tsx`
- Modify: `./app/(app)/purchase-orders/new/page.tsx`
- Modify: `./app/(app)/purchase-orders/[id]/page.tsx`
- Modify: `./app/(app)/purchase-requests/new/page.tsx`
- Modify: `./app/(app)/purchase-requests/[id]/page.tsx`

- [ ] **Step 1: Fix errors in `./app/(app)/products/page.tsx`**
  - Remove unused `StatusBadge` import.
  - Replace `any` in table renders (lines 94, 95).
- [ ] **Step 2: Fix errors in `./app/(app)/products/ProductFormModal.tsx`**
  - Replace `any` in fetch calls and state (lines 34, 35, 37, 38, 63).
- [ ] **Step 3: Fix errors in `./app/(app)/purchase-orders/new/page.tsx`**
  - Replace `any` in various fetch handlers and state (lines 28, 33, 34, 36, 37, 41, 43, 59, 63, 97).
- [ ] **Step 4: Fix errors in `./app/(app)/purchase-orders/[id]/page.tsx`**
  - Replace `any` in state and renders (lines 13, 31, 79, 130).
- [ ] **Step 5: Fix errors in `./app/(app)/purchase-requests/new/page.tsx`**
  - Remove unused `Warehouse` type import.
  - Replace `any` in state and fetch (lines 29, 30, 37, 76).
- [ ] **Step 6: Fix errors in `./app/(app)/purchase-requests/[id]/page.tsx`**
  - Remove unused `Badge` import.
  - Replace `any` in state and renders (lines 12, 32, 86).
- [ ] **Step 7: Verify with lint**
  - Run: `npm run lint` for these files.

### Task 5: RMA, Transfers, Vendors & API Batch

**Files:**
- Modify: `./app/(app)/rma/new/page.tsx`
- Modify: `./app/(app)/rma/[id]/page.tsx`
- Modify: `./app/(app)/transfers/new/page.tsx`
- Modify: `./app/(app)/transfers/[id]/page.tsx`
- Modify: `./app/(app)/vendors/page.tsx`
- Modify: `./app/api/auth/me/route.ts`
- Modify: `./app/api/grn/[id]/qc/route.ts`
- Modify: `./app/api/kpi/route.ts`
- Modify: `./app/api/transfers/route.ts`

- [ ] **Step 1: Fix errors in `./app/(app)/rma/new/page.tsx`**
  - Replace `any` in various fetch handlers and state (lines 23, 28, 29, 31, 32, 41, 45, 79).
- [ ] **Step 2: Fix errors in `./app/(app)/rma/[id]/page.tsx`**
  - Replace `any` in state and renders (lines 12, 21, 33, 91).
- [ ] **Step 3: Fix errors in `./app/(app)/transfers/new/page.tsx`**
  - Remove unused `formatCurrency` import.
  - Replace `any` in state and fetch (lines 19, 24, 25, 32, 36, 60).
- [ ] **Step 4: Fix errors in `./app/(app)/transfers/[id]/page.tsx`**
  - Replace `any` in state and renders (lines 12, 17, 66).
- [ ] **Step 5: Fix errors in `./app/(app)/vendors/page.tsx`**
  - Remove unused `_code` variable (line 89).
  - Replace `any` in table render (line 96).
- [ ] **Step 6: Fix errors in `./app/api/auth/me/route.ts`**
  - Replace `any` in session check (line 18).
- [ ] **Step 7: Fix errors in `./app/api/grn/[id]/qc/route.ts`**
  - Remove unused `query` import.
- [ ] **Step 8: Fix errors in `./app/api/kpi/route.ts`**
  - Replace `any` in catch blocks (lines 16, 26, 36, 46, 54, 62, 73).
- [ ] **Step 9: Fix errors in `./app/api/transfers/route.ts`**
  - Remove unused `queryOne` import.
- [ ] **Step 10: Final Verification**
  - Run: `npm run lint` for all files.
  - Expected: Zero errors.

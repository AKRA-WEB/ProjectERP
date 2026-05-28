# 🔌 API ROUTE CATALOG

This catalog consolidates all internal API routes to prevent duplication and ensure context protection.

## 💰 Sales & POS
- `GET /api/pos/price-history` — Customer SKU purchase history (v057)
- `GET/POST /api/pos/held-carts` — List or create held drafts
- `GET/PATCH/DELETE /api/pos/held-carts/[id]` — Manage specific held cart
- `POST /api/pos/transactions` — Finalize POS sale
- `GET /api/pos/transactions/[id]` — Transaction details
- `GET /api/pos/sessions/[id]` — POS session management
- `GET /api/pos/picking-slips` — Store picking queue
- `POST /api/pos/picking-slips/[id]/mark-picked` — Mark slip as picked
- `GET /api/pos/carts/[id]/picking-slip` — Print slip for cart
- `GET/POST /api/sales-quotations` — Sales Quotations (SQ)
- `GET/PATCH /api/sales-quotations/[id]` — Manage SQ
- `GET/POST /api/sales-orders` — Sales Orders (SO)
- `GET/PATCH /api/sales-orders/[id]` — Manage SO
- `GET/POST /api/sales-invoices` — Sales Invoices (SI)
- `GET /api/sales-invoices/[id]` — SI details
- `GET /api/sales-invoices/[id]/versions` — SI version history (v048)
- `GET /api/sales-invoices/[id]/delta-slip` — POS delta slip for returns
- `GET/POST /api/sales-returns` — Sales Returns (SR)
- `GET/POST /api/delivery-orders` — Delivery Orders (DO)
- `GET /api/delivery-orders/[id]` — DO details
- `GET /api/pricing/resolve` — Pricing engine resolution (v043)

## 📦 WMS & Inventory
- `POST /api/grn/[id]/cancel` — **GRN Reversal** (v072)
- `POST /api/grn/[id]/verify` — Supervisor GRN verification
- `POST /api/grn/[id]/resubmit` — Resubmit rejected GRN
- `POST /api/grn/[id]/create-po` — Generate PO from standalone GRN (v038)
- `GET /api/grn/[id]/labels` — Print thermal labels for GRN items
- `GET /api/grn/template` — Template for CSV imports
- `POST /api/grn/merge-brs` — Compile GRN from Blind Receipts (v051)
- `GET/POST /api/blind-receipts` — Blind Receiving (BR) flow
- `GET/PATCH /api/inbound-orders/[id]/close` — Force close Inbound Order
- `GET /api/pick-lists/[id]/lines` — Lines for picking
- `PATCH /api/pick-lists/[id]/lines/[lineId]` — Scan/pick specific line
- `POST /api/dispatch/scan-invoice` — Exit gate invoice scan
- `POST /api/dispatch/scan-item` — Exit gate item validation
- `POST /api/dispatch/release` — Authorize vehicle release
- `GET /api/dispatch/sessions/[id]` — Active dispatch session
- `GET/PATCH /api/shipments/[id]` — Shipment/Vehicle management
- `GET/POST /api/cycle-counts/[id]` — Inventory cycle counting
- `GET /api/replenish/suggestions` — Auto-replenishment list (v063)
- `GET /api/analytics/sku-performance` — SKU velocity & scores (v064)
- `GET /api/reports/inventory-valuation` — FIFO Valuation Report (v068)

## 🛒 Purchasing & Vendors
- `GET/POST /api/purchase-requests` — Purchase Requests (PR)
- `POST /api/purchase-requests/[id]/submit` — Submit PR for approval
- `POST /api/purchase-requests/[id]/approve` — Approve PR
- `POST /api/purchase-requests/[id]/reject` — Reject PR
- `GET/POST /api/purchase-orders` — Purchase Orders (PO)
- `GET/PATCH /api/purchase-orders/[id]` — Manage PO
- `POST /api/purchase-orders/[id]/approve` — Financial approval
- `POST /api/purchase-orders/[id]/send` — Mark as sent to vendor
- `POST /api/purchase-orders/[id]/acknowledge` — Vendor acknowledgment
- `POST /api/purchase-orders/[id]/cancel` — Cancel PO
- `POST /api/purchase-requisitions/[id]/receive` — Direct receipt from PR
- `GET/POST /api/vendor-claims` — Vendor Claims (RMA)
- `GET/PATCH /api/vendor-claims/[id]` — Manage claims

## 🧾 Accounting & Reports
- `GET /api/accounting/vat/purchase` — Purchase VAT Report (v071)
- `GET /api/accounting/vat/sales` — Sales VAT Report (v071)
- `POST /api/accounting/vat/finalize` — Lock VAT period (v071)
- `GET /api/ap/match-queue` — 3-Way Match variances (v070)
- `GET /api/ap/wht` — Withholding Tax certs (v059)
- `GET /api/accounting/accounts/[id]` — Chart of Account details
- `GET/POST /api/accounting/journal-entries` — Journal Entries (JE)
- `GET/PATCH /api/accounting/journal-entries/[id]` — Manage JE
- `GET/POST /api/accounting/fiscal-periods` — Fiscal period management
- `GET /api/accounting/reports/trial-balance` — Trial Balance engine
- `GET /api/accounting/reports/balance-sheet` — Balance Sheet
- `GET /api/accounting/reports/profit-loss` — P&L Statement
- `GET /api/accounting/reports/general-ledger` — GL Detail Report
- `GET /api/accounting/reports/ap-aging` — AP Aging
- `GET /api/accounting/reports/ar-aging` — AR Aging

## 👥 HR & Payroll
- `POST /api/admin/hrzoft/sync` — HR data sync (v061)
- `POST /api/hr/attendance/clock-in` — Employee clock-in
- `POST /api/hr/attendance/clock-out` — Employee clock-out
- `GET /api/hr/attendance/today` — Real-time attendance dashboard
- `GET/POST /api/hr/departments` — Department management
- `GET/POST /api/hr/positions` — Position management
- `GET/POST /api/hr/salary-grades` — Salary grade levels
- `GET/POST /api/hr/leave-types` — Leave type configuration
- `GET /api/hr/leave-balances` — Employee leave quotas
- `GET/PATCH /api/hr/leave-requests/[id]` — Manage leave
- `GET /api/hr/employees/[id]/payroll` — Payroll history for employee
- `GET /api/hr/payroll-accounts` — Mapping payroll to CoA

## 🏗️ Master Data
- `GET/POST /api/customers` — Customer management
- `GET /api/customers/[id]/credit-status` — Real-time credit check (v045)
- `POST /api/customers/[id]/credit-release` — Manager credit override
- `GET/POST /api/vendors` — Vendor management
- `GET /api/vendors/[id]/products` — Linked products per vendor
- `GET /api/vendors/[id]/catalog` — Vendor catalog / Price list
- `GET /api/product-categories` — Product categories
- `GET /api/products/[id]/uom` — Allowed UoMs for product
- `GET /api/products/[id]/vendors` — Preferred vendors for product
- `GET /api/bom/[id]/explode` — BOM explosion (v025)
- `GET /api/bom/[id]/cost` — BOM cost calculation

## ⚙️ Administration & Auth
- `GET/POST /api/admin/users` — User management & RBAC
- `PATCH /api/admin/users/[id]/roles` — Assign roles
- `PATCH /api/admin/users/[id]/warehouses` — Assign warehouse access
- `POST /api/admin/users/[id]/override-pin` — Set manager PIN
- `POST /api/auth/verify-override-pin` — Verify PIN for restricted actions
- `GET /api/auth/active-authorizers` — List online managers for override
- `GET/POST /api/admin/roles` — Role & Permission definitions
- `GET/POST /api/admin/warehouses` — Warehouse registration
- `GET/POST /api/admin/warehouse-zones` — Zone management (v054)
- `GET/POST /api/admin/virtual-locations` — Virtual warehouse config
- `GET/POST /api/admin/uom/conversions` — Global UoM conversion factors
- `POST /api/admin/product-prices/bulk` — Batch price updates
- `GET /api/admin/override-audit` — Audit log for PIN overrides (v044)
- `POST /api/admin/buffer-clear` — Manual cache/buffer clearing
- `GET/POST /api/admin/business-units` — BU management (v041)

---
> *Note: This catalog is manually maintained. Refer to `current-state.md` for latest updates.*

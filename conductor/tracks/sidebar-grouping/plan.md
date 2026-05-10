# Track: Sidebar Navigation Grouping

**Goal:** Reorganize the 15 flat sidebar items into 7 labelled functional groups so users can navigate the ERP by business domain rather than scrolling a undifferentiated list.

---

## Current State (flat, 15 items)

```
Dashboard
Products
Vendors
Purchase Requests
Purchase Orders
Inbound Orders
Goods Receive
Inventory
Returns (RMA)
Vendor Claims
Transfers
Cycle Counts
พนักงาน / Users   [admin]
บทบาท / Roles     [admin]
คลังสินค้า / WH   [admin]
```

**Problems:**
- No visual separation between unrelated items (e.g., Vendors is next to Dashboard)
- The flow PR → PO → IO → GRN is not obvious from position
- Admin items are not visually separated from operational items
- Long scroll required to find items

---

## Target Structure (7 groups)

```
ภาพรวม
  └─ Dashboard

จัดซื้อ / Purchasing
  ├─ Purchase Requests
  ├─ Purchase Orders
  └─ Inbound Orders

รับสินค้า / Receiving
  └─ Goods Receive

คลังสินค้า / Inventory
  ├─ Inventory
  ├─ Transfers
  └─ Cycle Counts

หลังการรับ / Post-Receipt
  ├─ Returns (RMA)
  └─ Vendor Claims

ข้อมูลหลัก / Master Data
  ├─ Products
  └─ Vendors

ผู้ดูแลระบบ / Admin           [admin role only]
  ├─ พนักงาน / Employees
  ├─ บทบาท / Roles
  └─ คลังสินค้า / Warehouses
```

**Grouping rationale:**
| Group | Why these items belong together |
|---|---|
| ภาพรวม | Entry point, always first |
| จัดซื้อ | The ordering flow: PR → PO; Inbound Orders (LINE) is a parallel ordering path |
| รับสินค้า | Physical receipt of goods into the warehouse |
| คลังสินค้า | Stock management after receipt: view, move, count |
| หลังการรับ | Exceptions after delivery: vendor returns + financial claims |
| ข้อมูลหลัก | Reference/master data that other modules depend on |
| ผู้ดูแลระบบ | System administration — separate from operational modules |

---

## Task 1 — Refactor `components/layout/Sidebar.tsx`

**Single file change.** No other files need to be modified.

- [x] Add `NavGroup` interface
- [x] Replace `navItems` flat array with `navGroups` grouped array
- [x] Update visibility filter to work per item
- [x] Update the `<nav>` render — groups with section headers
- [x] Remove the old `navItems` flat array

---

## Visual Result

```
┌──────────────────────────────┐
│ WMS                        ✕ │
├──────────────────────────────┤
│ ภาพรวม                      │
│   📊 Dashboard               │
│                              │
│ จัดซื้อ / PURCHASING         │
│   📋 Purchase Requests       │
│   🛒 Purchase Orders         │
│   📩 Inbound Orders          │
│                              │
│ รับสินค้า / RECEIVING        │
│   📥 Goods Receive           │
│                              │
│ คลังสินค้า / INVENTORY       │
│   🗄️ Inventory               │
│   🔄 Transfers               │
│   🔢 Cycle Counts            │
│                              │
│ หลังการรับ / POST-RECEIPT     │
│   ↩️ Returns (RMA)           │
│   ⚠️ Vendor Claims           │
│                              │
│ ข้อมูลหลัก / MASTER DATA     │
│   📦 Products                │
│   🏭 Vendors                 │
│                              │
│ ผู้ดูแลระบบ / ADMIN          │
│   👥 พนักงาน / Employees     │
│   🔑 บทบาท / Roles           │
│   🏠 Warehouses              │
└──────────────────────────────┘
```

---

## Verification Checklist

- [ ] All 15 nav items still present and link correctly
- [ ] Group headers visible and styled (small-caps, muted gray)
- [ ] Active item highlight still works on all pages
- [ ] Empty groups hidden: staff user with only `grn:view` → only "รับสินค้า / Receiving" group appears
- [ ] Admin group only shown for `role === 'admin'`
- [ ] Mobile drawer close on navigation still works
- [ ] `npm run build` passes — no TypeScript errors

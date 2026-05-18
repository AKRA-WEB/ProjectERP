---
track: i18n-language-switch
status: Completed
owner: puka
module: Core
updated: 2026-05-18
aliases:
  - i18n Language Switch
  - Thai English Toggle
  - Language Switcher
---

# Plan — i18n Language Switch (Thai ↔ English)

## Goal

System-wide Thai/English language toggle. User picks TH or EN; every UI string switches instantly. No hardcoded bilingual labels (`คลังสินค้า / Inventory`) remaining. All pages and shell components served from a central dictionary via `useT()` hook. Language persisted to localStorage.

## Pre-Verified Facts (do not re-derive)

- `tsconfig.json` has `resolveJsonModule: true` — JSON imports work
- `lib/i18n/` directory does NOT exist yet — create it
- `types/index.ts` has NO `Locale` type — add `export type Locale = 'th' | 'en'`
- `lib/format.ts` hardcodes `'th-TH'` for Intl formatters — needs lang param
- `app/layout.tsx` is a Server Component wrapping `<SessionProvider>` — wrap with LanguageProvider (client child inside server parent is valid Next.js App Router pattern)
- Sidebar labels are currently bilingual strings: `'คลังสินค้า / Inventory'` — split into separate th/en keys
- TopBar has `'ค้นหา...'` (Thai) and `'Sign Out'` (English) — both need translation
- No existing i18n library (no next-intl, no react-i18next) — use React Context + localStorage

## Architecture

```
lib/i18n/
  th.json          ← Thai dictionary (source of truth for keys)
  en.json          ← English dictionary (must have identical keys)
  index.ts         ← LanguageProvider, useT(), useLanguage(), localeName()
types/index.ts     ← add: export type Locale = 'th' | 'en'
lib/format.ts      ← add lang param to formatDate, formatDatetime, formatCurrency
app/layout.tsx     ← wrap children with <LanguageProvider>
components/ui/
  LanguageSwitcher.tsx   ← TH | EN toggle button
  index.ts               ← export LanguageSwitcher
components/layout/
  Sidebar.tsx      ← use useT() for all labels
  TopBar.tsx       ← use useT() for search, sign out, aria labels
```

---

## Task 1 — Add Locale type to types/index.ts

**File:** `types/index.ts`

Add after the first line (after `export type UserRole`):

```typescript
export type Locale = 'th' | 'en';
```

---

## Task 2 — Create lib/i18n/th.json

**File:** `lib/i18n/th.json` (create new)

```json
{
  "module.wms": "คลังสินค้า",
  "module.pos": "ขายหน้าร้าน",
  "module.sales": "การขาย",
  "module.accounting": "การบัญชี",
  "module.hr": "ทรัพยากรบุคคล",
  "module.admin": "ผู้ดูแลระบบ",

  "nav.overview": "ภาพรวม",
  "nav.purchasing": "จัดซื้อ",
  "nav.receiving": "รับสินค้า",
  "nav.outbound": "งานหยิบและจัดส่ง",
  "nav.inventory": "คลังสินค้า",
  "nav.post_receipt": "หลังการรับ",
  "nav.ap": "เจ้าหนี้และการชำระเงิน",
  "nav.master_data": "ข้อมูลหลัก",
  "nav.pos_section": "ขายหน้าร้าน",
  "nav.sales_master": "ข้อมูลหลัก",
  "nav.sales_flow": "การขาย",
  "nav.accounting_section": "การบัญชี",
  "nav.reports": "รายงาน",
  "nav.hr_section": "ทรัพยากรบุคคล",
  "nav.admin_section": "ผู้ดูแลระบบ",

  "page.dashboard": "แดชบอร์ด",
  "page.new_gr": "เปิดคำสั่งซื้อ",
  "page.purchase_requests": "ใบขอซื้อ",
  "page.purchase_orders": "ใบสั่งซื้อ",
  "page.inbound_orders": "คำสั่งนำเข้า",
  "page.grn": "รับสินค้า",
  "page.receiving_queue": "คิวรับสินค้า",
  "page.picking": "รายการหยิบสินค้า",
  "page.shipments": "รายการจัดส่งสินค้า",
  "page.inventory": "คลังสินค้า",
  "page.reorder": "Reorder Dashboard",
  "page.valuation": "ประเมินมูลค่าสินค้า",
  "page.transfers": "โอนสินค้า",
  "page.cycle_counts": "นับสต็อก",
  "page.rma": "รับคืน (RMA)",
  "page.claims": "เคลมเจ้าหนี้",
  "page.ap_invoices": "ใบแจ้งหนี้เจ้าหนี้",
  "page.ap_payments": "รายการชำระเงิน",
  "page.ap_aging": "รายงานอายุหนี้",
  "page.products": "สินค้า",
  "page.bom": "สูตรการผลิต",
  "page.vendors": "ผู้ขาย",
  "page.pos_terminal": "หน้าขาย",
  "page.sessions": "ประวัติเซสชัน",
  "page.members": "สมาชิก",
  "page.shifts": "รายงานกะ",
  "page.customers": "ลูกค้า",
  "page.quotations": "ใบเสนอราคา",
  "page.sales_orders": "ใบสั่งขาย",
  "page.delivery_orders": "ใบส่งสินค้า",
  "page.sales_invoices": "ใบแจ้งหนี้",
  "page.sales_returns": "รับคืน",
  "page.coa": "ผังบัญชี",
  "page.fiscal_periods": "รอบบัญชี",
  "page.journal": "สมุดรายวัน",
  "page.trial_balance": "งบทดลอง",
  "page.pl": "กำไรขาดทุน",
  "page.balance_sheet": "งบดุล",
  "page.ar_aging": "ลูกหนี้",
  "page.ap_aging_report": "เจ้าหนี้",
  "page.employees": "พนักงาน",
  "page.attendance": "บันทึกเวลา",
  "page.leave": "การลา",
  "page.payroll": "เงินเดือน",
  "page.departments": "แผนก",
  "page.users": "ผู้ใช้งาน",
  "page.roles": "สิทธิ์การใช้งาน",
  "page.warehouses": "คลังสินค้า",
  "page.uom": "หน่วยนับ",

  "action.save": "บันทึก",
  "action.cancel": "ยกเลิก",
  "action.delete": "ลบ",
  "action.edit": "แก้ไข",
  "action.create": "สร้างใหม่",
  "action.approve": "อนุมัติ",
  "action.reject": "ปฏิเสธ",
  "action.submit": "ส่ง",
  "action.confirm": "ยืนยัน",
  "action.back": "กลับ",
  "action.search": "ค้นหา",
  "action.filter": "กรอง",
  "action.export": "ส่งออก",
  "action.import": "นำเข้าข้อมูล",
  "action.print": "พิมพ์",
  "action.sign_out": "ออกจากระบบ",
  "action.sign_in": "เข้าสู่ระบบ",
  "action.add": "เพิ่ม",
  "action.remove": "ลบออก",
  "action.view": "ดู",
  "action.close": "ปิด",

  "label.status": "สถานะ",
  "label.date": "วันที่",
  "label.amount": "จำนวนเงิน",
  "label.qty": "จำนวน",
  "label.unit_price": "ราคา/หน่วย",
  "label.total": "ยอดรวม",
  "label.subtotal": "ยอด (ก่อนหัก)",
  "label.discount": "ส่วนลด",
  "label.bill_discount": "ส่วนลดท้ายบิล",
  "label.vat": "ภาษีมูลค่าเพิ่ม",
  "label.net_total": "ยอดสุทธิ",
  "label.vendor": "ผู้ขาย",
  "label.customer": "ลูกค้า",
  "label.product": "สินค้า",
  "label.sku": "รหัสสินค้า",
  "label.warehouse": "คลังสินค้า",
  "label.note": "หมายเหตุ",
  "label.reference": "อ้างอิง",
  "label.created_by": "สร้างโดย",
  "label.created_at": "สร้างเมื่อ",
  "label.updated_at": "อัพเดทเมื่อ",
  "label.no_data": "ไม่พบข้อมูล",
  "label.loading": "กำลังโหลด...",
  "label.search_placeholder": "ค้นหา...",
  "label.language": "ภาษา",
  "label.name": "ชื่อ",
  "label.description": "รายละเอียด",
  "label.unit": "หน่วย",
  "label.price": "ราคา",
  "label.code": "รหัส",
  "label.phone": "โทรศัพท์",
  "label.email": "อีเมล",
  "label.address": "ที่อยู่",
  "label.role": "บทบาท",
  "label.employee": "พนักงาน",
  "label.department": "แผนก",
  "label.position": "ตำแหน่ง",
  "label.salary": "เงินเดือน",
  "label.tax_id": "เลขผู้เสียภาษี",
  "label.select_placeholder": "เลือก...",
  "label.all": "ทั้งหมด",
  "label.yes": "ใช่",
  "label.no": "ไม่",
  "label.open_menu": "เปิดเมนู",
  "label.notifications": "การแจ้งเตือน",

  "status.draft": "แบบร่าง",
  "status.submitted": "ส่งแล้ว",
  "status.manager_approved": "ผู้จัดการอนุมัติ",
  "status.admin_approved": "ผู้ดูแลอนุมัติ",
  "status.approved": "อนุมัติแล้ว",
  "status.rejected": "ปฏิเสธ",
  "status.converted_to_po": "สร้าง PO แล้ว",
  "status.received": "รับแล้ว",
  "status.active": "ใช้งาน",
  "status.inactive": "ไม่ใช้งาน",
  "status.pending": "รอดำเนินการ",
  "status.completed": "เสร็จสิ้น",
  "status.cancelled": "ยกเลิก",
  "status.stocked": "เข้าสต็อกแล้ว",
  "status.paid": "ชำระแล้ว",
  "status.sent": "ส่งแล้ว",
  "status.partially_received": "รับบางส่วน",
  "status.fully_received": "รับครบแล้ว",
  "status.invoiced": "ออกใบแจ้งหนี้แล้ว",
  "status.closed": "ปิดแล้ว",
  "status.open": "เปิด",
  "status.in_review": "กำลังตรวจสอบ",
  "status.resolved": "แก้ไขแล้ว",
  "status.qc_passed": "QC ผ่าน",
  "status.qc_failed": "QC ไม่ผ่าน",
  "status.verified": "ตรวจสอบแล้ว",

  "confirm.delete_title": "ยืนยันการลบ",
  "confirm.delete_body": "คุณแน่ใจหรือไม่ที่จะลบรายการนี้? ไม่สามารถย้อนกลับได้",
  "confirm.approve_title": "ยืนยันการอนุมัติ",

  "error.required": "กรุณากรอกข้อมูล",
  "error.invalid": "ข้อมูลไม่ถูกต้อง",
  "error.server": "เกิดข้อผิดพลาด กรุณาลองใหม่",
  "error.unauthorized": "ไม่มีสิทธิ์เข้าถึง",

  "topbar.search_placeholder": "ค้นหา...",
  "topbar.sign_out": "ออกจากระบบ",
  "topbar.open_menu": "เปิดเมนู"
}
```

## Task 3 — Create lib/i18n/en.json

**File:** `lib/i18n/en.json` (create new — identical keys, English values)

```json
{
  "module.wms": "Warehouse",
  "module.pos": "Point of Sale",
  "module.sales": "Sales",
  "module.accounting": "Accounting",
  "module.hr": "Human Resources",
  "module.admin": "Administrator",

  "nav.overview": "Overview",
  "nav.purchasing": "Purchasing",
  "nav.receiving": "Receiving",
  "nav.outbound": "Outbound & Shipping",
  "nav.inventory": "Inventory",
  "nav.post_receipt": "Post-Receipt",
  "nav.ap": "Accounts Payable",
  "nav.master_data": "Master Data",
  "nav.pos_section": "Point of Sale",
  "nav.sales_master": "Master Data",
  "nav.sales_flow": "Sales",
  "nav.accounting_section": "Accounting",
  "nav.reports": "Reports",
  "nav.hr_section": "Human Resources",
  "nav.admin_section": "Administration",

  "page.dashboard": "Dashboard",
  "page.new_gr": "New Goods Receipt",
  "page.purchase_requests": "Purchase Requests",
  "page.purchase_orders": "Purchase Orders",
  "page.inbound_orders": "Inbound Orders",
  "page.grn": "Goods Receipts",
  "page.receiving_queue": "Receiving Queue",
  "page.picking": "Pick Lists",
  "page.shipments": "Shipments",
  "page.inventory": "Inventory",
  "page.reorder": "Reorder Dashboard",
  "page.valuation": "Inventory Valuation",
  "page.transfers": "Stock Transfers",
  "page.cycle_counts": "Cycle Counts",
  "page.rma": "Returns (RMA)",
  "page.claims": "Vendor Claims",
  "page.ap_invoices": "AP Invoices",
  "page.ap_payments": "Payments",
  "page.ap_aging": "AP Aging Report",
  "page.products": "Products",
  "page.bom": "Bill of Materials",
  "page.vendors": "Vendors",
  "page.pos_terminal": "POS Terminal",
  "page.sessions": "Session History",
  "page.members": "Members",
  "page.shifts": "Shift Reports",
  "page.customers": "Customers",
  "page.quotations": "Quotations",
  "page.sales_orders": "Sales Orders",
  "page.delivery_orders": "Delivery Orders",
  "page.sales_invoices": "Sales Invoices",
  "page.sales_returns": "Sales Returns",
  "page.coa": "Chart of Accounts",
  "page.fiscal_periods": "Fiscal Periods",
  "page.journal": "Journal Entries",
  "page.trial_balance": "Trial Balance",
  "page.pl": "Profit & Loss",
  "page.balance_sheet": "Balance Sheet",
  "page.ar_aging": "AR Aging",
  "page.ap_aging_report": "AP Aging",
  "page.employees": "Employees",
  "page.attendance": "Attendance",
  "page.leave": "Leave Requests",
  "page.payroll": "Payroll",
  "page.departments": "Departments",
  "page.users": "Users",
  "page.roles": "Roles & Permissions",
  "page.warehouses": "Warehouses",
  "page.uom": "Units of Measure",

  "action.save": "Save",
  "action.cancel": "Cancel",
  "action.delete": "Delete",
  "action.edit": "Edit",
  "action.create": "Create New",
  "action.approve": "Approve",
  "action.reject": "Reject",
  "action.submit": "Submit",
  "action.confirm": "Confirm",
  "action.back": "Back",
  "action.search": "Search",
  "action.filter": "Filter",
  "action.export": "Export",
  "action.import": "Import",
  "action.print": "Print",
  "action.sign_out": "Sign Out",
  "action.sign_in": "Sign In",
  "action.add": "Add",
  "action.remove": "Remove",
  "action.view": "View",
  "action.close": "Close",

  "label.status": "Status",
  "label.date": "Date",
  "label.amount": "Amount",
  "label.qty": "Quantity",
  "label.unit_price": "Unit Price",
  "label.total": "Total",
  "label.subtotal": "Subtotal",
  "label.discount": "Discount",
  "label.bill_discount": "Bill Discount",
  "label.vat": "VAT",
  "label.net_total": "Net Total",
  "label.vendor": "Vendor",
  "label.customer": "Customer",
  "label.product": "Product",
  "label.sku": "SKU",
  "label.warehouse": "Warehouse",
  "label.note": "Note",
  "label.reference": "Reference",
  "label.created_by": "Created By",
  "label.created_at": "Created At",
  "label.updated_at": "Updated At",
  "label.no_data": "No data found",
  "label.loading": "Loading...",
  "label.search_placeholder": "Search...",
  "label.language": "Language",
  "label.name": "Name",
  "label.description": "Description",
  "label.unit": "Unit",
  "label.price": "Price",
  "label.code": "Code",
  "label.phone": "Phone",
  "label.email": "Email",
  "label.address": "Address",
  "label.role": "Role",
  "label.employee": "Employee",
  "label.department": "Department",
  "label.position": "Position",
  "label.salary": "Salary",
  "label.tax_id": "Tax ID",
  "label.select_placeholder": "Select...",
  "label.all": "All",
  "label.yes": "Yes",
  "label.no": "No",
  "label.open_menu": "Open menu",
  "label.notifications": "Notifications",

  "status.draft": "Draft",
  "status.submitted": "Submitted",
  "status.manager_approved": "Manager Approved",
  "status.admin_approved": "Admin Approved",
  "status.approved": "Approved",
  "status.rejected": "Rejected",
  "status.converted_to_po": "Converted to PO",
  "status.received": "Received",
  "status.active": "Active",
  "status.inactive": "Inactive",
  "status.pending": "Pending",
  "status.completed": "Completed",
  "status.cancelled": "Cancelled",
  "status.stocked": "Stocked",
  "status.paid": "Paid",
  "status.sent": "Sent",
  "status.partially_received": "Partially Received",
  "status.fully_received": "Fully Received",
  "status.invoiced": "Invoiced",
  "status.closed": "Closed",
  "status.open": "Open",
  "status.in_review": "In Review",
  "status.resolved": "Resolved",
  "status.qc_passed": "QC Passed",
  "status.qc_failed": "QC Failed",
  "status.verified": "Verified",

  "confirm.delete_title": "Confirm Delete",
  "confirm.delete_body": "Are you sure you want to delete this item? This cannot be undone.",
  "confirm.approve_title": "Confirm Approval",

  "error.required": "This field is required",
  "error.invalid": "Invalid value",
  "error.server": "An error occurred. Please try again.",
  "error.unauthorized": "Access denied",

  "topbar.search_placeholder": "Search...",
  "topbar.sign_out": "Sign Out",
  "topbar.open_menu": "Open menu"
}
```

---

## Task 4 — Create lib/i18n/index.ts

**File:** `lib/i18n/index.ts` (create new)

```typescript
'use client';

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { Locale } from '@/types';
import thDict from './th.json';
import enDict from './en.json';

type DictKey = keyof typeof thDict;

const DICTS: Record<Locale, Record<string, string>> = {
  th: thDict as Record<string, string>,
  en: enDict as Record<string, string>,
};

const LS_KEY = 'erp_lang';

interface LanguageContextValue {
  lang: Locale;
  setLang: (lang: Locale) => void;
  t: (key: DictKey) => string;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Locale>('th');

  useEffect(() => {
    const stored = localStorage.getItem(LS_KEY);
    if (stored === 'th' || stored === 'en') setLangState(stored);
  }, []);

  const setLang = useCallback((next: Locale) => {
    setLangState(next);
    localStorage.setItem(LS_KEY, next);
    document.documentElement.lang = next;
  }, []);

  const t = useCallback((key: DictKey): string => {
    return DICTS[lang][key] ?? key;
  }, [lang]);

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage(): { lang: Locale; setLang: (lang: Locale) => void } {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used inside LanguageProvider');
  return { lang: ctx.lang, setLang: ctx.setLang };
}

export function useT(): (key: DictKey) => string {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useT must be used inside LanguageProvider');
  return ctx.t;
}

export function localeName(
  th: string,
  en: string | null | undefined,
  lang: Locale
): string {
  return lang === 'en' ? (en ?? th) : th;
}
```

---

## Task 5 — Extend lib/format.ts with lang param

**File:** `lib/format.ts`

Add lazy locale-aware formatters. Pattern: keep existing module-level `THB`, `DATE_FMT` etc. for backward compat. Add new overloads that accept `lang?: Locale`.

Replace entire file content:

```typescript
import type { Locale } from '@/types';

const THB = new Intl.NumberFormat('th-TH', {
  style: 'currency',
  currency: 'THB',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const USD = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'THB',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const NUMBER_FMT_TH = new Intl.NumberFormat('th-TH');
const NUMBER_FMT_EN = new Intl.NumberFormat('en-US');

const DATE_FMT_TH = new Intl.DateTimeFormat('th-TH', {
  timeZone: 'Asia/Bangkok',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const DATE_FMT_EN = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Bangkok',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const DATETIME_FMT_TH = new Intl.DateTimeFormat('th-TH', {
  timeZone: 'Asia/Bangkok',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
});

const DATETIME_FMT_EN = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Bangkok',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
});

export function formatCurrency(value: string | number | null | undefined, lang?: Locale): string {
  if (value == null || value === '') return lang === 'en' ? 'THB 0.00' : '฿0.00';
  return (lang === 'en' ? USD : THB).format(Number(value));
}

export function formatNumber(value: string | number | null | undefined, lang?: Locale): string {
  if (value == null || value === '') return '0';
  return (lang === 'en' ? NUMBER_FMT_EN : NUMBER_FMT_TH).format(Number(value));
}

export function formatDate(value: string | Date | null | undefined, lang?: Locale): string {
  if (!value) return '-';
  return (lang === 'en' ? DATE_FMT_EN : DATE_FMT_TH).format(new Date(value));
}

export function formatDatetime(value: string | Date | null | undefined, lang?: Locale): string {
  if (!value) return '-';
  return (lang === 'en' ? DATETIME_FMT_EN : DATETIME_FMT_TH).format(new Date(value));
}

export function formatQty(value: string | number | null | undefined, decimals = 2): string {
  if (value == null || value === '') return '0';
  return Number(value).toFixed(decimals);
}
```

**Note:** All existing callers of `formatDate(v)` / `formatCurrency(v)` still work (lang param is optional). No breaking changes.

---

## Task 6 — Wrap app/layout.tsx with LanguageProvider

**File:** `app/layout.tsx`

Add LanguageProvider import and wrap children:

```typescript
import type { Metadata } from 'next';
import { SessionProvider } from 'next-auth/react';
import { IBM_Plex_Sans_Thai, IBM_Plex_Mono } from 'next/font/google';
import { SpeedInsights } from '@vercel/speed-insights/next';
import { LanguageProvider } from '@/lib/i18n';
import './globals.css';

const ibmPlexSansThai = IBM_Plex_Sans_Thai({
  weight: ['300', '400', '500', '600', '700'],
  subsets: ['thai', 'latin'],
  display: 'swap',
  variable: '--font-sans',
});

const ibmPlexMono = IBM_Plex_Mono({
  weight: ['400', '500', '600'],
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-mono',
});

export const metadata: Metadata = {
  title: 'ระบบ ERP | BUYMORE',
  description: 'ระบบบริหารจัดการองค์กร BUYMORE (THAILAND) COMPANY LIMITED',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="th" className={`${ibmPlexSansThai.variable} ${ibmPlexMono.variable}`}>
      <body className="antialiased">
        <SessionProvider>
          <LanguageProvider>
            {children}
            <SpeedInsights />
          </LanguageProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
```

---

## Task 7 — Create LanguageSwitcher component

**File:** `components/ui/LanguageSwitcher.tsx` (create new)

```typescript
'use client';

import { useLanguage } from '@/lib/i18n';
import { cn } from '@/lib/utils';

export function LanguageSwitcher({ className }: { className?: string }) {
  const { lang, setLang } = useLanguage();

  return (
    <div className={cn('flex items-center gap-0.5 rounded-md border border-line bg-surface-sunken p-0.5', className)}>
      <button
        onClick={() => setLang('th')}
        className={cn(
          'px-2.5 py-1 rounded text-[12px] font-semibold transition-all',
          lang === 'th'
            ? 'bg-white text-ink shadow-sm border border-line'
            : 'text-ink-3 hover:text-ink'
        )}
      >
        TH
      </button>
      <button
        onClick={() => setLang('en')}
        className={cn(
          'px-2.5 py-1 rounded text-[12px] font-semibold transition-all',
          lang === 'en'
            ? 'bg-white text-ink shadow-sm border border-line'
            : 'text-ink-3 hover:text-ink'
        )}
      >
        EN
      </button>
    </div>
  );
}
```

**File:** `components/ui/index.ts`

Add export at the bottom:
```typescript
export { LanguageSwitcher } from './LanguageSwitcher';
```

---

## Task 8 — Apply useT() to Sidebar.tsx

**File:** `components/layout/Sidebar.tsx`

This is the most impactful change — the sidebar appears on every page.

**Changes required:**

1. Add import at top:
```typescript
import { useT } from '@/lib/i18n';
import { LanguageSwitcher } from '@/components/ui';
```

2. Inside the Sidebar component function body, add:
```typescript
const t = useT();
```

3. Replace `MODULE_META` with a function that uses `t`:
```typescript
// Replace the static MODULE_META constant with a hook-driven builder inside the component
const moduleMeta: Record<ModuleKey, ModuleMeta> = {
  wms:        { nameTh: t('module.wms'),        nameEn: t('module.wms'),        icon: Warehouse, entryHref: '/app/dashboard' },
  pos:        { nameTh: t('module.pos'),        nameEn: t('module.pos'),        icon: ShoppingBag, entryHref: '/app/pos' },
  sales:      { nameTh: t('module.sales'),      nameEn: t('module.sales'),      icon: Package, entryHref: '/app/sales-quotations' },
  accounting: { nameTh: t('module.accounting'), nameEn: t('module.accounting'), icon: BarChart3, entryHref: '/app/accounting/chart-of-accounts' },
  hr:         { nameTh: t('module.hr'),         nameEn: t('module.hr'),         icon: Users, entryHref: '/app/hr/employees' },
  admin:      { nameTh: t('module.admin'),      nameEn: t('module.admin'),      icon: Settings, entryHref: '/app/admin/users' },
};
```

4. Replace all nav group labels and item labels in `MODULE_NAV` by moving the `MODULE_NAV` definition inside the component body and referencing `t()`. For example:

```typescript
// Inside component body, after const t = useT():
const moduleNav: Record<ModuleKey, NavGroup[]> = {
  wms: [
    {
      label: t('nav.overview'),
      items: [
        { href: '/app/dashboard', label: t('page.dashboard'), icon: LayoutDashboard, permission: 'dashboard:view' },
      ],
    },
    {
      label: t('nav.purchasing'),
      items: [
        { href: '/app/receiving/new', label: t('page.new_gr'), icon: PackagePlus, permission: 'grn:create' },
        { href: '/app/purchase-requests', label: t('page.purchase_requests'), icon: ClipboardList, permission: 'pr:view' },
        { href: '/app/purchase-orders',   label: t('page.purchase_orders'),   icon: ShoppingCart, permission: 'po:view' },
        { href: '/app/inbound-orders',    label: t('page.inbound_orders'),    icon: PackageCheck, permission: 'inbound_orders:view' },
      ],
    },
    {
      label: t('nav.receiving'),
      items: [
        { href: '/app/grn',                 label: t('page.grn'),             icon: PackagePlus, permission: 'grn:view' },
        { href: '/app/grn/receiving-queue', label: t('page.receiving_queue'), icon: ClipboardList, permission: 'grn:view' },
      ],
    },
    {
      label: t('nav.outbound'),
      items: [
        { href: '/app/picking',   label: t('page.picking'),   icon: ClipboardList, permission: 'inventory:view' },
        { href: '/app/shipments', label: t('page.shipments'), icon: Truck,         permission: 'inventory:view' },
      ],
    },
    {
      label: t('nav.inventory'),
      items: [
        { href: '/app/inventory',             label: t('page.inventory'), icon: Archive,       permission: 'inventory:view' },
        { href: '/app/inventory/reorder',     label: t('page.reorder'),   icon: AlertTriangle, permission: 'inventory:view' },
        { href: '/app/inventory/valuation',   label: t('page.valuation'), icon: BarChart2,     permission: 'inventory:view' },
        { href: '/app/transfers',             label: t('page.transfers'), icon: ArrowLeftRight, permission: 'transfers:view' },
        { href: '/app/cycle-counts',          label: t('page.cycle_counts'), icon: Hash,       permission: 'cycle_counts:view' },
      ],
    },
    {
      label: t('nav.post_receipt'),
      items: [
        { href: '/app/rma',    label: t('page.rma'),    icon: Undo2,         permission: 'rma:view' },
        { href: '/app/claims', label: t('page.claims'), icon: AlertTriangle, permission: 'claims:view' },
      ],
    },
    {
      label: t('nav.ap'),
      items: [
        { href: '/app/ap',          label: t('page.ap_invoices'), icon: CreditCard, permission: 'vendors:view' },
        { href: '/app/ap/payments', label: t('page.ap_payments'), icon: History,    permission: 'vendors:view' },
        { href: '/app/ap/aging',    label: t('page.ap_aging'),    icon: Clock,      permission: 'vendors:view' },
      ],
    },
    {
      label: t('nav.master_data'),
      items: [
        { href: '/app/products', label: t('page.products'), icon: Package,  permission: 'products:view' },
        { href: '/app/bom',      label: t('page.bom'),      icon: Layers,   permission: 'products:view' },
        { href: '/app/vendors',  label: t('page.vendors'),  icon: Building2, permission: 'vendors:view' },
      ],
    },
  ],

  pos: [
    {
      label: t('nav.pos_section'),
      items: [
        { href: '/app/pos',          label: t('page.pos_terminal'), icon: ShoppingBag, permission: 'pos:cashier' },
        { href: '/app/pos/sessions', label: t('page.sessions'),     icon: History,     permission: 'pos:view' },
        { href: '/app/pos/members',  label: t('page.members'),      icon: Users,       permission: 'pos:members' },
        { href: '/app/pos/shifts',   label: t('page.shifts'),       icon: FileText,    permission: 'pos:view' },
      ],
    },
  ],

  sales: [
    {
      label: t('nav.sales_master'),
      items: [
        { href: '/app/customers', label: t('page.customers'), icon: UserCircle, permission: 'customers:view' },
      ],
    },
    {
      label: t('nav.sales_flow'),
      items: [
        { href: '/app/sales-quotations', label: t('page.quotations'),     icon: FileText,   permission: 'sq:view' },
        { href: '/app/sales-orders',     label: t('page.sales_orders'),   icon: Receipt,    permission: 'so:view' },
        { href: '/app/delivery-orders',  label: t('page.delivery_orders'),icon: Truck,      permission: 'do:view' },
        { href: '/app/sales-invoices',   label: t('page.sales_invoices'), icon: CreditCard, permission: 'si:view' },
        { href: '/app/sales-returns',    label: t('page.sales_returns'),  icon: Undo2,      permission: 'sr:view' },
      ],
    },
  ],

  accounting: [
    {
      label: t('nav.accounting_section'),
      items: [
        { href: '/app/accounting/chart-of-accounts', label: t('page.coa'),            icon: BarChart3, permission: 'accounts:view' },
        { href: '/app/accounting/fiscal-periods',    label: t('page.fiscal_periods'), icon: Calendar,  permission: 'fiscal_periods:view' },
        { href: '/app/accounting/journal-entries',   label: t('page.journal'),        icon: BookOpen,  permission: 'accounting:view' },
      ],
    },
    {
      label: t('nav.reports'),
      items: [
        { href: '/app/accounting/reports/trial-balance', label: t('page.trial_balance'), icon: Scale,       permission: 'reports:accounting' },
        { href: '/app/accounting/reports/profit-loss',   label: t('page.pl'),            icon: TrendingDown, permission: 'reports:accounting' },
        { href: '/app/accounting/reports/balance-sheet', label: t('page.balance_sheet'), icon: Landmark,    permission: 'reports:accounting' },
        { href: '/app/accounting/reports/ar-aging',      label: t('page.ar_aging'),      icon: Clock,       permission: 'reports:accounting' },
        { href: '/app/accounting/reports/ap-aging',      label: t('page.ap_aging_report'), icon: Banknote,  permission: 'reports:accounting' },
      ],
    },
  ],

  hr: [
    {
      label: t('nav.hr_section'),
      items: [
        { href: '/app/hr/employees',    label: t('page.employees'),  icon: Users,     permission: 'hr:view' },
        { href: '/app/hr/attendance',   label: t('page.attendance'), icon: Timer,     permission: 'hr:view' },
        { href: '/app/hr/leave-requests', label: t('page.leave'),    icon: Calendar,  permission: 'hr:view' },
        { href: '/app/hr/payroll',      label: t('page.payroll'),    icon: Wallet,    permission: 'hr:payroll' },
        { href: '/app/hr/departments',  label: t('page.departments'),icon: Building,  permission: 'hr:view' },
      ],
    },
  ],

  admin: [
    {
      label: t('nav.admin_section'),
      items: [
        { href: '/app/admin/users',      label: t('page.users'),      icon: UserCircle, permission: 'admin:users' },
        { href: '/app/admin/roles',      label: t('page.roles'),      icon: KeyRound,   permission: 'admin:roles' },
        { href: '/app/admin/warehouses', label: t('page.warehouses'), icon: Warehouse,  permission: 'admin:warehouses' },
        { href: '/app/admin/uom',        label: t('page.uom'),        icon: Scale,      permission: 'admin:uom' },
      ],
    },
  ],
};
```

5. Update all references from `MODULE_META` → `moduleMeta` and `MODULE_NAV` → `moduleNav` inside the JSX.

6. Add `<LanguageSwitcher className="mt-auto mb-2 mx-3" />` in the sidebar footer area (after the sign out button or bottom of sidebar).

---

## Task 9 — Apply useT() to TopBar.tsx

**File:** `components/layout/TopBar.tsx`

1. Add import:
```typescript
import { useT } from '@/lib/i18n';
```

2. Inside `TopBar` function body:
```typescript
const t = useT();
```

3. Replace hardcoded strings:
- `aria-label="เปิดเมนู"` → `aria-label={t('topbar.open_menu')}`
- `<span className="flex-1 text-left">ค้นหา...</span>` → `<span className="flex-1 text-left">{t('topbar.search_placeholder')}</span>`
- `Sign Out` button text → `{t('topbar.sign_out')}`
- Search modal Thai text `ฟีเจอร์นี้จะเปิดให้ใช้งานเร็วๆ นี้` → keep Thai (not user-facing chrome, secondary modal)

---

## Task 10 — Apply useT() to 10 priority pages

For each page listed below: add `import { useT } from '@/lib/i18n'`, call `const t = useT()` inside the component, replace Thai/English hardcoded UI strings with `t('key')`. Focus on: page titles (`<h1>`), table column headers, action button text, empty state messages. Do NOT change API request strings, document number formats, or Thai strings inside DB-field variables.

**Priority pages (convert in this order):**

1. `app/app/purchase-orders/page.tsx` — table headers, status labels, button text
2. `app/app/purchase-requests/page.tsx` — table headers, status labels, button text
3. `app/app/purchase-orders/[id]/page.tsx` — section labels, financial summary panel, action buttons
4. `app/app/vendors/page.tsx` — table headers, action buttons
5. `app/app/products/page.tsx` — table headers, action buttons
6. `app/app/inventory/page.tsx` — table headers, filter labels
7. `app/app/dashboard/page.tsx` — KPI card labels, section titles
8. `app/app/grn/page.tsx` (if exists) or `app/app/receiving/new/page.tsx` — form labels
9. `app/app/hr/employees/page.tsx` — table headers
10. `app/app/pos/page.tsx` — action labels, status text

**Conversion pattern for each page:**
```typescript
// Before
<h1 className="...">ใบสั่งซื้อ</h1>
<Button>+ สร้างใหม่</Button>

// After
import { useT } from '@/lib/i18n';
// inside component:
const t = useT();
// in JSX:
<h1 className="...">{t('page.purchase_orders')}</h1>
<Button>+ {t('action.create')}</Button>
```

---

## Acceptance Criteria

- [ ] `types/index.ts` exports `Locale = 'th' | 'en'`
- [ ] `lib/i18n/th.json` and `lib/i18n/en.json` exist with identical key sets
- [ ] `useT()` returns correct strings for both locales
- [ ] Toggling TH↔EN via LanguageSwitcher in sidebar updates all translated strings instantly (React re-render via context)
- [ ] Language persists across page refresh (localStorage)
- [ ] `document.documentElement.lang` updates to match selected locale
- [ ] Sidebar navigation labels fully translated — no more bilingual `'คลังสินค้า / Inventory'` strings
- [ ] TopBar search, sign out, aria labels translated
- [ ] `formatDate()` and `formatCurrency()` accept optional `lang` param — existing callers unaffected
- [ ] `npx tsc --noEmit` passes — `useT()` return type is `(key: DictKey) => string` with TypeScript key completions
- [ ] `npm run lint` passes on all modified files

## Notes for Gemini

- **`lib/i18n/index.ts` must start with `'use client'`** — it uses React hooks (useState, useEffect, useContext). Without it, Next.js Server Components will error.
- **Do NOT add `'use client'` to `lib/format.ts`** — it's a pure utility used in both server and client contexts.
- **Sidebar.tsx** — move `MODULE_META` and `MODULE_NAV` constants from module scope INTO the component function body (they become `moduleMeta` and `moduleNav` variables). This is required because they reference `t()`.
- **Check if `app/app/grn/page.tsx` exists** before converting it — may be at different path.
- **`localeName()` usage** — when displaying product/vendor names from DB that have both `name_th` and `name_en` columns, use: `localeName(item.name_th, item.name_en, lang)` where `lang` comes from `const { lang } = useLanguage()`.

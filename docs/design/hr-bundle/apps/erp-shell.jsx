// Shared chrome for POS / Inventory mockups — sidebar + topbar
// Matches the real components/layout/{Sidebar,TopBar}.tsx from the repo.

const ErpShell = {};

// ── Icons (small line icons matching lucide-react sizing) ─────────────
const I = {
  back:        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>,
  dashboard:   <svg className="w-[17px] h-[17px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/></svg>,
  cart:        <svg className="w-[17px] h-[17px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.7 13.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 6H6"/></svg>,
  clipboard:   <svg className="w-[17px] h-[17px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/></svg>,
  packagePlus: <svg className="w-[17px] h-[17px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M16 16h6M19 13v6"/><path d="M21 10v-3.5a1 1 0 0 0-.6-.9L12.6 2a1 1 0 0 0-1.2 0L3.6 5.6a1 1 0 0 0-.6.9V17a1 1 0 0 0 .6.9l7.8 3.5"/><path d="M3.3 7L12 12l8.7-5M12 22V12"/></svg>,
  packageCheck:<svg className="w-[17px] h-[17px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M16 16l2 2 4-4"/><path d="M21 10v-3.5a1 1 0 0 0-.6-.9L12.6 2a1 1 0 0 0-1.2 0L3.6 5.6a1 1 0 0 0-.6.9V17a1 1 0 0 0 .6.9l7.8 3.5"/><path d="M3.3 7L12 12l8.7-5M12 22V12"/></svg>,
  truck:       <svg className="w-[17px] h-[17px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="6" width="14" height="11"/><path d="M15 9h5l3 4v4h-8"/><circle cx="6" cy="19" r="2"/><circle cx="18" cy="19" r="2"/></svg>,
  archive:     <svg className="w-[17px] h-[17px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="5"/><path d="M4 8v13h16V8M10 12h4"/></svg>,
  warning:     <svg className="w-[17px] h-[17px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M10.3 3.7L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.7a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h0"/></svg>,
  chart:       <svg className="w-[17px] h-[17px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18"/><path d="M7 14l4-4 4 4 5-6"/></svg>,
  swap:        <svg className="w-[17px] h-[17px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7h13l-3-3M21 17H8l3 3"/></svg>,
  hash:        <svg className="w-[17px] h-[17px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M4 9h16M4 15h16M10 3L8 21M16 3l-2 18"/></svg>,
  undo:        <svg className="w-[17px] h-[17px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M9 14L4 9l5-5"/><path d="M4 9h11a6 6 0 0 1 0 12h-3"/></svg>,
  card:        <svg className="w-[17px] h-[17px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg>,
  history:     <svg className="w-[17px] h-[17px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/></svg>,
  clock:       <svg className="w-[17px] h-[17px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>,
  package:     <svg className="w-[17px] h-[17px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10v-3.5a1 1 0 0 0-.6-.9L12.6 2a1 1 0 0 0-1.2 0L3.6 5.6a1 1 0 0 0-.6.9V17a1 1 0 0 0 .6.9l7.8 3.5a1 1 0 0 0 .8 0l7.8-3.5a1 1 0 0 0 .6-.9V10"/><path d="M3.3 7L12 12l8.7-5M12 22V12"/></svg>,
  layers:      <svg className="w-[17px] h-[17px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l9 5-9 5-9-5 9-5z"/><path d="M3 12l9 5 9-5M3 17l9 5 9-5"/></svg>,
  building:    <svg className="w-[17px] h-[17px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="2" width="16" height="20" rx="1"/><path d="M9 22V12h6v10M9 6h.01M15 6h.01M9 10h.01M15 10h.01"/></svg>,
  shopBag:     <svg className="w-[17px] h-[17px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><path d="M3 6h18M16 10a4 4 0 0 1-8 0"/></svg>,
  users:       <svg className="w-[17px] h-[17px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/></svg>,
  settings:    <svg className="w-[17px] h-[17px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1"/></svg>,
  search:      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>,
  bell:        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></svg>,
  calendar:    <svg className="w-[17px] h-[17px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>,
  briefcase:   <svg className="w-[17px] h-[17px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>,
  wallet:      <svg className="w-[17px] h-[17px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12V7a2 2 0 0 0-2-2H5a2 2 0 0 0 0 4h16v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5"/><circle cx="17" cy="13" r="1.2"/></svg>,
  award:       <svg className="w-[17px] h-[17px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="9" r="6"/><path d="M8.2 14L7 22l5-3 5 3-1.2-8"/></svg>,
  fileText:    <svg className="w-[17px] h-[17px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h8M8 9h2"/></svg>,
  userPlus:    <svg className="w-[17px] h-[17px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><path d="M20 8v6M23 11h-6"/></svg>,
  graduation:  <svg className="w-[17px] h-[17px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M22 10L12 4 2 10l10 6 10-6z"/><path d="M6 12v5a8 8 0 0 0 12 0v-5"/></svg>,
  network:     <svg className="w-[17px] h-[17px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="2" width="6" height="6" rx="1"/><rect x="2" y="16" width="6" height="6" rx="1"/><rect x="16" y="16" width="6" height="6" rx="1"/><path d="M12 8v3M12 11H5v5M12 11h7v5"/></svg>,
  plane:       <svg className="w-[17px] h-[17px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M17.8 19.2L16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"/></svg>,
};

// ── Module configs ───────────────────────────────────────────────────
// Matches MODULE_NAV from components/layout/Sidebar.tsx
const POS_NAV = [
  {
    label: 'ขายหน้าร้าน / POS',
    items: [
      { href: '/app/pos',          label: 'POS Terminal',     icon: I.shopBag },
      { href: '/app/pos/sessions', label: 'Session History',  icon: I.history },
      { href: '/app/pos/members',  label: 'สมาชิก / Members',  icon: I.users },
      { href: '/app/pos/shifts',   label: 'รายงานกะ / Shifts', icon: I.clipboard },
    ],
  },
];

const WMS_NAV = [
  { label: 'ภาพรวม', items: [
    { href: '/app/dashboard', label: 'Dashboard', icon: I.dashboard },
  ]},
  { label: 'จัดซื้อ / Purchasing', items: [
    { href: '/app/receiving/new',     label: 'เปิดคำสั่งซื้อ',       icon: I.packagePlus },
    { href: '/app/purchase-requests', label: 'Purchase Requests', icon: I.clipboard },
    { href: '/app/purchase-orders',   label: 'Purchase Orders',   icon: I.cart },
    { href: '/app/inbound-orders',    label: 'Inbound Orders',    icon: I.packageCheck },
  ]},
  { label: 'รับสินค้า / Receiving', items: [
    { href: '/app/grn',                 label: 'Goods Receive',   icon: I.packagePlus },
    { href: '/app/grn/receiving-queue', label: 'คิวรับสินค้า',     icon: I.clipboard },
  ]},
  { label: 'งานหยิบและจัดส่ง / Outbound', items: [
    { href: '/app/picking',   label: 'รายการหยิบสินค้า',  icon: I.clipboard },
    { href: '/app/shipments', label: 'รายการจัดส่งสินค้า', icon: I.truck },
  ]},
  { label: 'คลังสินค้า / Inventory', items: [
    { href: '/app/inventory',           label: 'Inventory',          icon: I.archive },
    { href: '/app/inventory/reorder',   label: 'Reorder Dashboard',  icon: I.warning },
    { href: '/app/inventory/valuation', label: 'Inventory Valuation',icon: I.chart },
    { href: '/app/transfers',           label: 'Transfers',          icon: I.swap },
    { href: '/app/cycle-counts',        label: 'Cycle Counts',       icon: I.hash },
  ]},
  { label: 'หลังการรับ / Post-Receipt', items: [
    { href: '/app/rma',    label: 'Returns (RMA)',  icon: I.undo },
    { href: '/app/claims', label: 'Vendor Claims',  icon: I.warning },
  ]},
  { label: 'เจ้าหนี้และการชำระเงิน / AP', items: [
    { href: '/app/ap',          label: 'ใบแจ้งหนี้เจ้าหนี้',   icon: I.card },
    { href: '/app/ap/payments', label: 'รายการชำระเงิน', icon: I.history },
    { href: '/app/ap/aging',    label: 'รายงานอายุหนี้',   icon: I.clock },
  ]},
  { label: 'ข้อมูลหลัก / Master Data', items: [
    { href: '/app/products', label: 'สินค้า / Products', icon: I.package },
    { href: '/app/bom',      label: 'สูตรการผลิต / BOM', icon: I.layers },
    { href: '/app/vendors',  label: 'ผู้ขาย / Vendors',  icon: I.building },
  ]},
];

const HR_NAV = [
  { label: 'ภาพรวม', items: [
    { href: '/app/hr',            label: 'Dashboard',          icon: I.dashboard },
  ]},
  { label: 'พนักงาน / Employees', items: [
    { href: '/app/hr/employees',  label: 'รายชื่อพนักงาน',       icon: I.users },
    { href: '/app/hr/org',        label: 'โครงสร้างองค์กร',      icon: I.network },
    { href: '/app/hr/onboarding', label: 'พนักงานใหม่ / Onboarding', icon: I.userPlus },
  ]},
  { label: 'เวลาทำงาน / Time', items: [
    { href: '/app/hr/attendance', label: 'เวลาเข้าออกงาน',       icon: I.clock },
    { href: '/app/hr/shifts',     label: 'ตารางกะ / Shifts',    icon: I.calendar },
    { href: '/app/hr/overtime',   label: 'ล่วงเวลา / Overtime', icon: I.history },
  ]},
  { label: 'การลา / Leave', items: [
    { href: '/app/hr/leave',          label: 'คำขอลา',              icon: I.plane },
    { href: '/app/hr/leave/calendar', label: 'ปฏิทินทีม',           icon: I.calendar },
    { href: '/app/hr/leave/quota',    label: 'โควต้าวันลา',         icon: I.clipboard },
  ]},
  { label: 'เงินเดือน / Payroll', items: [
    { href: '/app/hr/payroll',        label: 'รันเงินเดือน',        icon: I.wallet },
    { href: '/app/hr/payroll/slips',  label: 'สลิปเงินเดือน',       icon: I.fileText },
    { href: '/app/hr/payroll/tax',    label: 'ภาษี & ประกันสังคม',  icon: I.card },
  ]},
  { label: 'พัฒนา / Development', items: [
    { href: '/app/hr/performance', label: 'ประเมินผล',           icon: I.award },
    { href: '/app/hr/training',    label: 'ฝึกอบรม',             icon: I.graduation },
  ]},
  { label: 'สรรหา / Recruitment', items: [
    { href: '/app/hr/jobs',       label: 'ตำแหน่งที่เปิดรับ',     icon: I.briefcase },
    { href: '/app/hr/candidates', label: 'ผู้สมัคร',             icon: I.users },
  ]},
  { label: 'ข้อมูลหลัก / Master Data', items: [
    { href: '/app/hr/positions',   label: 'ตำแหน่งงาน',           icon: I.briefcase },
    { href: '/app/hr/departments', label: 'แผนก / สาขา',         icon: I.building },
  ]},
];

const MODULES = {
  pos: { nameTh: 'ขายหน้าร้าน',  nameEn: 'POS',  icon: I.shopBag,   nav: POS_NAV },
  wms: { nameTh: 'คลังสินค้า',    nameEn: 'WMS',  icon: I.archive,   nav: WMS_NAV },
  hr:  { nameTh: 'บุคลากร',      nameEn: 'HR',   icon: I.briefcase, nav: HR_NAV  },
};

// ── Sidebar ───────────────────────────────────────────────────────────
ErpShell.Sidebar = function ({ module, activeHref }) {
  const m = MODULES[module];
  return (
    <aside className="w-[232px] shrink-0 h-full flex flex-col bg-[#fafaf9] border-r border-[#f1efee]">
      {/* Brand */}
      <div className="flex h-14 items-center justify-between px-6 border-b border-[#f1efee] shrink-0">
        <span className="text-[15px] font-bold tracking-tight text-[#0c0a09]">BUYMORETH ERP</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-5">
        {/* Module breadcrumb */}
        <div className="px-4 mb-4">
          <div className="flex items-center gap-1.5 text-[11.5px] text-[#78716c] mb-3 cursor-default">
            <span className="text-[#a8a29e]">{I.back}</span><span>เมนูหลัก</span>
          </div>
          <div className="flex items-center gap-2 px-1">
            <span className="text-[#44403c]">{m.icon}</span>
            <div>
              <div className="text-[13px] font-semibold text-[#0c0a09] leading-tight">{m.nameTh}</div>
              <div className="text-[10px] text-[#a8a29e] uppercase tracking-widest">{m.nameEn}</div>
            </div>
          </div>
          <div className="h-px bg-[#f1efee] mt-4" />
        </div>

        {m.nav.map((group) => (
          <div key={group.label} className="mb-5">
            <p className="px-4 mb-2 text-[10.5px] font-semibold uppercase tracking-[0.06em] text-[#a8a29e] select-none">
              {group.label}
            </p>
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const active = item.href === activeHref;
                return (
                  <li key={item.href}>
                    <a className={
                      'flex items-center gap-2.5 mx-2 h-[32px] px-3 rounded-md text-[13px] font-medium transition-all ' +
                      (active
                        ? 'bg-white shadow-[0_1px_2px_rgba(15,23,42,0.06)] border border-[#e7e5e4] text-[#0c0a09]'
                        : 'text-[#44403c] hover:bg-[#f5f5f4] hover:text-[#0c0a09]')
                    }>
                      <span className={active ? 'text-[#0c0a09]' : 'text-[#78716c]'}>{item.icon}</span>
                      <span className="truncate">{item.label}</span>
                    </a>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Footer / user */}
      <div className="shrink-0 border-t border-[#f1efee] p-3 bg-[#fafaf9]">
        <button className="w-full px-2.5 py-1.5 mb-2 text-[12px] font-medium rounded-lg border border-dashed border-[#e7e5e4] text-[#44403c] bg-[#f5f5f4] hover:bg-white inline-flex items-center justify-center gap-1.5">
          {I.settings}<span>จัดการเมนู</span>
        </button>
        <div className="flex items-center gap-2.5 px-1.5 py-1.5 rounded-lg cursor-default">
          <div className="w-7 h-7 rounded-[7px] grid place-items-center font-semibold text-[12px] bg-[#efece4] border border-[#e4e0d6] text-[#44403c]">ปร</div>
          <div className="min-w-0">
            <div className="text-[13px] font-medium text-[#0c0a09] truncate leading-tight">ปริญญา ฉัตรชัย</div>
            <div className="text-[10.5px] text-[#78716c] uppercase tracking-wider">Manager</div>
          </div>
        </div>
      </div>
    </aside>
  );
};

// ── Top bar ───────────────────────────────────────────────────────────
ErpShell.TopBar = function ({ crumbs }) {
  return (
    <header className="h-14 shrink-0 px-6 flex items-center gap-4 bg-white border-b border-[#e7e5e4]">
      <div className="flex items-center gap-2 text-[13px] text-[#78716c]">
        {crumbs.map((c, i) => (
          <React.Fragment key={i}>
            {i > 0 && <span className="text-[#d6d3d1]">/</span>}
            <span className={i === crumbs.length - 1 ? 'text-[#0c0a09] font-medium' : ''}>{c}</span>
          </React.Fragment>
        ))}
      </div>
      <div className="flex-1 max-w-[420px] mx-auto flex items-center gap-2 bg-[#fafaf9] border border-[#e7e5e4] rounded-lg px-3 h-9 text-[#78716c]">
        {I.search}
        <span className="text-[13px]">ค้นหา…</span>
        <span className="ml-auto text-[10.5px] font-mono border border-[#e7e5e4] bg-white rounded px-1.5 py-0.5 text-[#78716c]">⌘K</span>
      </div>
      <div className="flex items-center gap-1.5">
        <button className="w-9 h-9 rounded-md grid place-items-center text-[#44403c] hover:bg-[#f5f5f4] relative">
          {I.bell}
          <span className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
        </button>
        <div className="ml-2 w-8 h-8 rounded-full grid place-items-center bg-[#efece4] border border-[#e4e0d6] text-[#44403c] text-[12px] font-semibold">ปร</div>
      </div>
    </header>
  );
};

window.ErpShell = ErpShell;
window.ErpIcons = I;

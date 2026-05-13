'use client';
import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

interface NavItem {
  href: string;
  label: string;
  icon: string;
  roles?: string[];
  permission?: string;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const navGroups: NavGroup[] = [
  {
    label: 'ภาพรวม',
    items: [
      { href: '/app/dashboard', label: 'Dashboard', icon: '📊', permission: 'dashboard:view' },
    ],
  },
  {
    label: 'จัดซื้อ / Purchasing',
    items: [
      { href: '/app/purchase-requests', label: 'Purchase Requests', icon: '📋', permission: 'pr:view' },
      { href: '/app/purchase-orders', label: 'Purchase Orders', icon: '🛒', permission: 'po:view' },
      { href: '/app/inbound-orders', label: 'Inbound Orders', icon: '📩', permission: 'inbound_orders:view' },
    ],
  },
  {
    label: 'รับสินค้า / Receiving',
    items: [
      { href: '/app/grn', label: 'Goods Receive', icon: '📥', permission: 'grn:view' },
      { href: '/app/grn/receiving-queue', label: 'คิวรับสินค้า / Queue', icon: '📋', permission: 'grn:view' },
    ],
  },
  {
    label: 'คลังสินค้า / Inventory',
    items: [
      { href: '/app/inventory', label: 'Inventory', icon: '🗄️', permission: 'inventory:view' },
      { href: '/app/transfers', label: 'Transfers', icon: '🔄', permission: 'transfers:view' },
      { href: '/app/cycle-counts', label: 'Cycle Counts', icon: '🔢', permission: 'cycle_counts:view' },
    ],
  },
  {
    label: 'หลังการรับ / Post-Receipt',
    items: [
      { href: '/app/rma', label: 'Returns (RMA)', icon: '↩️', permission: 'rma:view' },
      { href: '/app/claims', label: 'Vendor Claims', icon: '⚠️', permission: 'claims:view' },
    ],
  },
  {
    label: 'ข้อมูลหลัก / Master Data',
    items: [
      { href: '/app/products', label: 'Products', icon: '📦', permission: 'products:view' },
      { href: '/app/vendors', label: 'Vendors', icon: '🏭', permission: 'vendors:view' },
    ],
  },
  {
    label: 'ขาย / Sales',
    items: [
      { href: '/app/customers',         label: 'ลูกค้า / Customers',       icon: '👤', permission: 'customers:view' },
      { href: '/app/sales-quotations',  label: 'ใบเสนอราคา / Quotations',  icon: '📝', permission: 'sq:view' },
      { href: '/app/sales-orders',      label: 'ใบสั่งขาย / Sales Orders', icon: '🧾', permission: 'so:view' },
      { href: '/app/delivery-orders',   label: 'ใบส่งสินค้า / Deliveries', icon: '🚚', permission: 'do:view' },
      { href: '/app/sales-invoices',    label: 'ใบแจ้งหนี้ / Invoices',    icon: '💳', permission: 'si:view' },
      { href: '/app/sales-returns',     label: 'รับคืน / Returns',          icon: '↩️', permission: 'sr:view' },
    ],
  },
  {
    label: 'ขายหน้าร้าน / POS',
    items: [
      { href: '/app/pos',          label: 'POS Terminal',      icon: '🛍️', permission: 'pos:cashier' },
      { href: '/app/pos/sessions', label: 'Session History',   icon: '📑', permission: 'pos:view' },
    ],
  },
  {
    label: 'การบัญชี / Accounting',
    items: [
      { href: '/app/accounting/chart-of-accounts', label: 'ผังบัญชี / CoA',      icon: '📊', permission: 'accounts:view' },
      { href: '/app/accounting/fiscal-periods',    label: 'รอบบัญชี / Periods', icon: '📅', permission: 'fiscal_periods:view' },
      { href: '/app/accounting/journal-entries',   label: 'สมุดรายวัน / Journal', icon: '📔', permission: 'accounting:view' },
      { href: '/app/accounting/reports/trial-balance', label: 'งบทดลอง / Trial Balance', icon: '⚖️', permission: 'reports:accounting' },
      { href: '/app/accounting/reports/profit-loss',    label: 'กำไรขาดทุน / P&L',     icon: '📉', permission: 'reports:accounting' },
      { href: '/app/accounting/reports/balance-sheet',  label: 'งบดุล / Balance Sheet', icon: '🏛️', permission: 'reports:accounting' },
      { href: '/app/accounting/reports/ar-aging',      label: 'ลูกหนี้ / AR Aging',     icon: '⏳', permission: 'reports:accounting' },
      { href: '/app/accounting/reports/ap-aging',      label: 'เจ้าหนี้ / AP Aging',    icon: '💸', permission: 'reports:accounting' },
    ],
  },
  {
    label: 'ทรัพยากรบุคคล / HR',
    items: [
      { href: '/app/hr/employees',      label: 'พนักงาน / Employees',     icon: '👥', permission: 'hr:employees:view' },
      { href: '/app/hr/departments',    label: 'แผนก / Departments',      icon: '🏢', permission: 'hr:departments:view' },
      { href: '/app/hr/leave-requests', label: 'วันลา / Leave',           icon: '📅', permission: 'hr:leave:view' },
      { href: '/app/hr/attendance/my',  label: 'เข้างาน / Attendance',    icon: '⏰', permission: 'hr:attendance:view' },
      { href: '/app/hr/payroll',        label: 'เงินเดือน / Payroll',     icon: '💰', permission: 'hr:payroll:view' },
      { href: '/app/hr/payroll/settings', label: 'ตั้งค่า Payroll',       icon: '⚙️', permission: 'admin' },
    ],
  },
  {
    label: 'ผู้ดูแลระบบ / Admin',
    items: [
      { href: '/app/admin/users', label: 'พนักงาน / Employees', icon: '👥', roles: ['admin'] },
      { href: '/app/admin/roles', label: 'บทบาท / Roles', icon: '🔑', roles: ['admin'] },
      { href: '/app/admin/warehouses', label: 'Warehouses', icon: '🏠', roles: ['admin'] },
    ],
  },
];

interface SidebarProps {
  open?: boolean;
  onClose?: () => void;
  userRole?: string;
  permissions?: string[];
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export function Sidebar({ open, onClose, userRole, permissions, collapsed, onToggleCollapse }: SidebarProps) {
  const pathname = usePathname();

  useEffect(() => {
    onClose?.();
  }, [pathname]);

  function isVisible(item: NavItem): boolean {
    if (item.roles && !item.roles.includes(userRole ?? '')) return false;
    if (item.permission) {
      if (userRole === 'admin') return true;
      if (!(permissions ?? []).includes(item.permission)) return false;
    }
    return true;
  }

  return (
    <aside
      className={cn(
        'fixed inset-y-0 left-0 z-30 flex h-full flex-col border-r border-line-soft bg-surface-soft transition-all duration-300 ease-in-out md:static md:translate-x-0 md:z-auto',
        open ? 'translate-x-0' : '-translate-x-full',
        collapsed ? 'w-[64px]' : 'w-64'
      )}
    >
      {/* Brand / Logo */}
      <div className={cn(
        'flex h-16 items-center border-b border-line-soft transition-all duration-300',
        collapsed ? 'justify-center px-0' : 'justify-between px-6'
      )}>
        {!collapsed && <span className="text-[18px] font-bold tracking-tight text-ink">อรุณ · ERP</span>}
        {collapsed && <span className="text-[20px] font-bold text-accent">อ</span>}
        
        {/* Close button — mobile only */}
        <button
          onClick={onClose}
          className="md:hidden text-ink-3 hover:text-ink transition-colors"
          aria-label="ปิดเมนู"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>

        {/* Toggle Collapse button — desktop only */}
        {!open && onToggleCollapse && (
          <button
            onClick={onToggleCollapse}
            className={cn(
              "hidden md:grid place-items-center w-6 h-6 rounded-full border border-line bg-white shadow-sm hover:bg-surface-soft transition-all text-ink-3 hover:text-ink absolute -right-3 top-5 z-40",
              collapsed && "rotate-180"
            )}
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
          </button>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto py-6 overflow-x-hidden">
        {navGroups.map((group) => {
          const visibleItems = group.items.filter(isVisible);
          if (visibleItems.length === 0) return null;

          return (
            <div key={group.label} className="mb-6">
              {!collapsed && (
                <p className="px-4 mb-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-4 select-none whitespace-nowrap">
                  {group.label}
                </p>
              )}
              {collapsed && <div className="h-px bg-line-soft mx-4 mb-4" />}
              
              <ul className="space-y-0.5">
                {visibleItems.map((item) => {
                  const isActive = pathname === item.href || (item.href !== '/app/dashboard' && pathname.startsWith(item.href));
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className={cn(
                          'flex items-center gap-[10px] py-0 mx-2 h-[34px] rounded-md text-[13.5px] font-medium transition-all group overflow-hidden',
                          collapsed ? 'px-0 justify-center mx-3' : 'px-3',
                          isActive
                            ? 'bg-white shadow-[0_1px_2px_rgba(15,23,42,0.06)] border border-line text-ink'
                            : 'text-ink-2 hover:bg-surface-sunken hover:text-ink'
                        )}
                        title={collapsed ? item.label : undefined}
                      >
                        <span className="text-[16px] w-5 shrink-0 text-center group-hover:scale-110 transition-transform">
                          {item.icon}
                        </span>
                        {!collapsed && <span className="truncate">{item.label}</span>}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>
    </aside>
  );
}

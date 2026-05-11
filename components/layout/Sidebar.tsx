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
}

export function Sidebar({ open, onClose, userRole, permissions }: SidebarProps) {
  const pathname = usePathname();

  // Close on navigation change (mobile)
  useEffect(() => {
    onClose?.();
  }, [pathname]);

  function isVisible(item: NavItem): boolean {
    // 1. Role-based check (hard overrides)
    if (item.roles && !item.roles.includes(userRole ?? '')) return false;

    // 2. Permission-based check
    if (item.permission) {
      if (userRole === 'admin') return true; // admin bypass
      if (!(permissions ?? []).includes(item.permission)) return false;
    }

    return true;
  }

  return (
    <aside
      className={cn(
        'fixed inset-y-0 left-0 z-30 flex h-full w-64 flex-col border-r border-gray-200 bg-white transition-transform duration-200 md:static md:translate-x-0 md:z-auto',
        open ? 'translate-x-0' : '-translate-x-full'
      )}
    >
      <div className="flex h-16 items-center justify-between border-b border-gray-200 px-6">
        <span className="text-lg font-bold text-gray-900">ERP</span>
        {/* Close button — mobile only */}
        <button
          onClick={onClose}
          className="md:hidden text-gray-400 hover:text-gray-600"
          aria-label="ปิดเมนู"
        >
          ✕
        </button>
      </div>
      <nav className="flex-1 overflow-y-auto p-4">
        <ul className="space-y-6">
          {navGroups.map((group) => {
            const visibleItems = group.items.filter(isVisible);
            if (visibleItems.length === 0) return null;

            return (
              <li key={group.label}>
                <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-widest text-gray-400 select-none">
                  {group.label}
                </p>
                <ul className="space-y-0.5">
                  {visibleItems.map((item) => (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className={cn(
                          'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                          pathname === item.href || (item.href !== '/app/dashboard' && pathname.startsWith(item.href))
                            ? 'bg-blue-50 text-blue-700'
                            : 'text-gray-700 hover:bg-gray-50'
                        )}
                      >
                        <span>{item.icon}</span>
                        {item.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}

'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard, ClipboardList, ShoppingCart, PackageCheck, PackagePlus,
  Archive, ArrowLeftRight, Hash, Undo2, AlertTriangle, Package, Layers,
  Building2, UserCircle, FileText, Receipt, Truck, CreditCard, ShoppingBag,
  History, BarChart3, BarChart2, Calendar, BookOpen, Scale, TrendingDown, Landmark,
  Clock, Banknote, Users, Building, Timer, Wallet, Settings, KeyRound,
  Warehouse, ChevronLeft, ChevronDown, CheckSquare, Square
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

type ModuleKey = 'wms' | 'pos' | 'sales' | 'accounting' | 'hr' | 'admin';

interface ModuleMeta {
  nameTh: string;
  nameEn: string;
  icon: LucideIcon;
  entryHref: string;
}

const MODULE_META: Record<ModuleKey, ModuleMeta> = {
  wms:        { nameTh: 'คลังสินค้า',        nameEn: 'WMS',        icon: Warehouse, entryHref: '/app/dashboard' },
  pos:        { nameTh: 'ขายหน้าร้าน',       nameEn: 'POS',        icon: ShoppingBag, entryHref: '/app/pos' },
  sales:      { nameTh: 'การขาย',            nameEn: 'Sales',      icon: Package, entryHref: '/app/sales-quotations' },
  accounting: { nameTh: 'การบัญชี',          nameEn: 'Accounting', icon: BarChart3, entryHref: '/app/accounting/chart-of-accounts' },
  hr:         { nameTh: 'ทรัพยากรบุคคล',    nameEn: 'HR',         icon: Users, entryHref: '/app/hr/employees' },
  admin:      { nameTh: 'ผู้ดูแลระบบ',       nameEn: 'Admin',      icon: Settings, entryHref: '/app/admin/users' },
};

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  roles?: string[];
  permission?: string;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const MODULE_NAV: Record<ModuleKey, NavGroup[]> = {
  wms: [
    {
      label: 'ภาพรวม',
      items: [
        { href: '/app/dashboard', label: 'Dashboard', icon: LayoutDashboard, permission: 'dashboard:view' },
      ],
    },
    {
      label: 'จัดซื้อ / Purchasing',
      items: [
        { href: '/app/receiving/new', label: 'เปิดคำสั่งซื้อ', icon: PackagePlus, permission: 'grn:create' },
        { href: '/app/purchase-requests', label: 'Purchase Requests', icon: ClipboardList, permission: 'pr:view' },
        { href: '/app/purchase-orders',   label: 'Purchase Orders',   icon: ShoppingCart, permission: 'po:view' },
        { href: '/app/inbound-orders',    label: 'Inbound Orders',    icon: PackageCheck, permission: 'inbound_orders:view' },
      ],
    },
    {
      label: 'รับสินค้า / Receiving',
      items: [
        { href: '/app/grn',                 label: 'Goods Receive',       icon: PackagePlus, permission: 'grn:view' },
        { href: '/app/grn/receiving-queue', label: 'คิวรับสินค้า / Queue', icon: ClipboardList, permission: 'grn:view' },
      ],
    },
    {
      label: 'งานหยิบและจัดส่ง / Outbound',
      items: [
        { href: '/app/picking',   label: 'รายการหยิบสินค้า', icon: ClipboardList, permission: 'inventory:view' },
        { href: '/app/shipments', label: 'รายการจัดส่งสินค้า', icon: Truck,         permission: 'inventory:view' },
      ],
    },
    {
      label: 'คลังสินค้า / Inventory',
      items: [
        { href: '/app/inventory',    label: 'Inventory',     icon: Archive, permission: 'inventory:view' },
        { href: '/app/inventory/reorder', label: 'Reorder Dashboard', icon: AlertTriangle, permission: 'inventory:view' },
        { href: '/app/inventory/valuation', label: 'Inventory Valuation', icon: BarChart2, permission: 'inventory:view' },
        { href: '/app/transfers',    label: 'Transfers',     icon: ArrowLeftRight, permission: 'transfers:view' },
        { href: '/app/cycle-counts', label: 'Cycle Counts',  icon: Hash, permission: 'cycle_counts:view' },
      ],
    },
    {
      label: 'หลังการรับ / Post-Receipt',
      items: [
        { href: '/app/rma',    label: 'Returns (RMA)',  icon: Undo2, permission: 'rma:view' },
        { href: '/app/claims', label: 'Vendor Claims',  icon: AlertTriangle, permission: 'claims:view' },
      ],
    },
    {
      label: 'เจ้าหนี้และการชำระเงิน / AP',
      items: [
        { href: '/app/ap',          label: 'ใบแจ้งหนี้เจ้าหนี้',   icon: CreditCard, permission: 'vendors:view' },
        { href: '/app/ap/payments', label: 'รายการชำระเงิน', icon: History,    permission: 'vendors:view' },
        { href: '/app/ap/aging',    label: 'รายงานอายุหนี้',   icon: Clock,      permission: 'vendors:view' },
      ],
    },
    {
      label: 'ข้อมูลหลัก / Master Data',
      items: [
        { href: '/app/products', label: 'สินค้า / Products',    icon: Package, permission: 'products:view' },
        { href: '/app/bom',      label: 'สูตรการผลิต / BOM',   icon: Layers, permission: 'products:view' },
        { href: '/app/vendors',  label: 'ผู้ขาย / Vendors',     icon: Building2, permission: 'vendors:view' },
      ],
    },
  ],

  pos: [
    {
      label: 'ขายหน้าร้าน / POS',
      items: [
        { href: '/app/pos',          label: 'POS Terminal',    icon: ShoppingBag, permission: 'pos:cashier' },
        { href: '/app/pos/sessions', label: 'Session History', icon: History, permission: 'pos:view' },
        { href: '/app/pos/members',  label: 'สมาชิก / Members', icon: Users, permission: 'pos:members' },
        { href: '/app/pos/shifts',   label: 'รายงานกะ / Shifts', icon: FileText, permission: 'pos:view' },
      ],
    },
  ],

  sales: [
    {
      label: 'ข้อมูลหลัก',
      items: [
        { href: '/app/customers', label: 'ลูกค้า / Customers', icon: UserCircle, permission: 'customers:view' },
      ],
    },
    {
      label: 'การขาย / Sales',
      items: [
        { href: '/app/sales-quotations', label: 'ใบเสนอราคา / Quotations',  icon: FileText, permission: 'sq:view' },
        { href: '/app/sales-orders',     label: 'ใบสั่งขาย / Sales Orders', icon: Receipt, permission: 'so:view' },
        { href: '/app/delivery-orders',  label: 'ใบส่งสินค้า / Deliveries', icon: Truck, permission: 'do:view' },
        { href: '/app/sales-invoices',   label: 'ใบแจ้งหนี้ / Invoices',    icon: CreditCard, permission: 'si:view' },
        { href: '/app/sales-returns',    label: 'รับคืน / Returns',          icon: Undo2, permission: 'sr:view' },
      ],
    },
  ],

  accounting: [
    {
      label: 'การบัญชี / Accounting',
      items: [
        { href: '/app/accounting/chart-of-accounts',      label: 'ผังบัญชี / CoA',        icon: BarChart3, permission: 'accounts:view' },
        { href: '/app/accounting/fiscal-periods',         label: 'รอบบัญชี / Periods',    icon: Calendar, permission: 'fiscal_periods:view' },
        { href: '/app/accounting/journal-entries',        label: 'สมุดรายวัน / Journal',  icon: BookOpen, permission: 'accounting:view' },
      ],
    },
    {
      label: 'รายงาน / Reports',
      items: [
        { href: '/app/accounting/reports/trial-balance', label: 'งบทดลอง / Trial Balance', icon: Scale, permission: 'reports:accounting' },
        { href: '/app/accounting/reports/profit-loss',   label: 'กำไรขาดทุน / P&L',       icon: TrendingDown, permission: 'reports:accounting' },
        { href: '/app/accounting/reports/balance-sheet', label: 'งบดุล / Balance Sheet',   icon: Landmark, permission: 'reports:accounting' },
        { href: '/app/accounting/reports/ar-aging',      label: 'ลูกหนี้ / AR Aging',      icon: Clock, permission: 'reports:accounting' },
        { href: '/app/accounting/reports/ap-aging',      label: 'เจ้าหนี้ / AP Aging',     icon: Banknote, permission: 'reports:accounting' },
      ],
    },
  ],

  hr: [
    {
      label: 'ทรัพยากรบุคคล / HR',
      items: [
        { href: '/app/hr',                  label: 'ภาพรวม / Dashboard',   icon: BarChart3, permission: 'hr:employees:view' },
        { href: '/app/hr/employees',        label: 'พนักงาน / Employees',  icon: Users, permission: 'hr:employees:view' },
        { href: '/app/hr/departments',      label: 'แผนก / Departments',   icon: Building, permission: 'hr:departments:view' },
        { href: '/app/hr/leave-requests',   label: 'วันลา / Leave',        icon: Calendar, permission: 'hr:leave:view' },
        { href: '/app/hr/attendance/my',    label: 'เข้างาน / Attendance', icon: Timer, permission: 'hr:attendance:view' },
        { href: '/app/hr/payroll',          label: 'เงินเดือน / Payroll',  icon: Wallet, permission: 'hr:payroll:view' },
        { href: '/app/hr/payroll/settings', label: 'ตั้งค่า Payroll',      icon: Settings, permission: 'admin' },
      ],
    },
  ],

  admin: [
    {
      label: 'ผู้ดูแลระบบ / Admin',
      items: [
        { href: '/app/admin/users',      label: 'พนักงาน / Employees', icon: Users, roles: ['admin'] },
        { href: '/app/admin/roles',      label: 'บทบาท / Roles',       icon: KeyRound, roles: ['admin'] },
        { href: '/app/admin/warehouses', label: 'Warehouses',           icon: Warehouse, roles: ['admin'] },
        { href: '/app/admin/uom',        label: 'หน่วยนับ / UoM',       icon: Scale,    roles: ['admin'] },
      ],
    },
  ],
};

function detectModule(pathname: string): ModuleKey | null {
  if (pathname === '/app/menu' || pathname.startsWith('/app/menu/')) return null;

  const WMS_PREFIXES = [
    '/app/dashboard', '/app/purchase-requests', '/app/purchase-orders',
    '/app/inbound-orders', '/app/grn', '/app/rma', '/app/claims',
    '/app/transfers', '/app/cycle-counts', '/app/inventory',
    '/app/products', '/app/vendors', '/app/bom', '/app/inventory/reorder',
    '/app/picking', '/app/shipments', '/app/ap',
  ];

  if (WMS_PREFIXES.some(p => pathname === p || pathname.startsWith(p + '/'))) return 'wms';
  if (pathname.startsWith('/app/pos'))         return 'pos';
  if (pathname.startsWith('/app/sales-') || pathname.startsWith('/app/customers') || pathname.startsWith('/app/delivery-orders')) return 'sales';
  if (pathname.startsWith('/app/accounting'))  return 'accounting';
  if (pathname.startsWith('/app/hr'))          return 'hr';
  if (pathname.startsWith('/app/admin'))       return 'admin';

  return null;
}

function initials(name: string) {
  if (!name) return 'อ';
  const parts = name.trim().split(' ');
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
}

interface SidebarProps {
  open?: boolean;
  onClose?: () => void;
  userRole?: string;
  permissions?: string[];
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  userName?: string;
}

interface SidebarGroupProps {
  label: string;
  items: NavItem[];
  collapsed?: boolean;
  editing: boolean;
  pathname: string;
  hiddenItems: string[];
  toggleHidden: (href: string) => void;
}

function SidebarGroup({
  label,
  items,
  collapsed,
  editing,
  pathname,
  hiddenItems,
  toggleHidden,
}: SidebarGroupProps) {
  const [isOpen, setIsOpen] = useState(true);

  useEffect(() => {
    if (collapsed) return;
    try {
      const stored = localStorage.getItem(`sidebar-group-${label}`);
      if (stored !== null) {
        setIsOpen(JSON.parse(stored));
      }
    } catch (e) {
      console.error('Failed to load group state', e);
    }
  }, [label, collapsed]);

  const toggleOpen = () => {
    if (collapsed) return;
    const next = !isOpen;
    setIsOpen(next);
    try {
      localStorage.setItem(`sidebar-group-${label}`, JSON.stringify(next));
    } catch (e) {
      console.error('Failed to save group state', e);
    }
  };

  return (
    <div className="mb-6">
      {!collapsed ? (
        <button
          onClick={toggleOpen}
          aria-expanded={isOpen}
          className="flex items-center justify-between w-full px-4 mb-2 group/btn"
        >
          <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-4 select-none whitespace-nowrap group-hover/btn:text-ink-2 transition-colors">
            {label}
          </p>
          <ChevronDown 
            className={cn(
              "w-3.5 h-3.5 text-ink-4 transition-transform duration-200 group-hover/btn:text-ink-2",
              !isOpen && "-rotate-90"
            )}
          />
        </button>
      ) : (
        <div className="h-px bg-line-soft mx-4 mb-4" />
      )}
      
      {(isOpen || collapsed) && (
        <ul className="space-y-0.5">
          {items.map((item) => {
            const isActive = !editing && (pathname === item.href || (item.href !== '/app/dashboard' && pathname.startsWith(item.href + '/')));
            const isHidden = hiddenItems.includes(item.href);
            
            return (
              <li key={item.href}>
                {editing ? (
                  <button
                    onClick={() => toggleHidden(item.href)}
                    className={cn(
                      'flex items-center gap-[10px] w-full py-0 mx-2 px-3 h-[34px] rounded-md text-[13.5px] font-medium transition-all group overflow-hidden',
                      isHidden ? 'text-ink-4 opacity-50' : 'text-ink-2 hover:bg-surface-sunken hover:text-ink'
                    )}
                  >
                    <span className="text-[16px] w-5 shrink-0 text-center flex justify-center text-ink-3 group-hover:text-ink">
                      {isHidden ? <Square className="w-4 h-4" /> : <CheckSquare className="w-4 h-4 text-emerald-600" />}
                    </span>
                    <span className="truncate">{item.label}</span>
                  </button>
                ) : (
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
                    <span className={cn(
                      "text-[16px] w-5 shrink-0 text-center flex justify-center group-hover:scale-110 transition-transform",
                      isActive ? 'text-ink' : 'text-ink-3 group-hover:text-ink-2'
                    )}>
                      <item.icon className="w-[17px] h-[17px]" strokeWidth={1.6} />
                    </span>
                    {!collapsed && <span className="truncate">{item.label}</span>}
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export function Sidebar({ open, onClose, userRole, permissions, collapsed, onToggleCollapse, userName }: SidebarProps) {
  const pathname = usePathname();
  const [editing, setEditing] = useState(false);
  const [hiddenItems, setHiddenItems] = useState<string[]>([]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('sidebar_hidden_items');
      if (stored) setHiddenItems(JSON.parse(stored));
    } catch (e) {
      console.error('Failed to load hidden items', e);
    }
  }, []);

  useEffect(() => {
    onClose?.();
  }, [pathname, onClose]); 

  function toggleHidden(href: string) {
    setHiddenItems(prev => {
      const next = prev.includes(href) ? prev.filter(h => h !== href) : [...prev, href];
      try {
        localStorage.setItem('sidebar_hidden_items', JSON.stringify(next));
      } catch (e) {
        console.error('Failed to save hidden items', e);
      }
      return next;
    });
  }

  const isVisible = useCallback((item: NavItem): boolean => {
    if (item.roles && !item.roles.includes(userRole ?? '')) return false;
    if (item.permission) {
      if (userRole === 'admin') return true;
      if (!(permissions ?? []).includes(item.permission)) return false;
    }
    return true;
  }, [userRole, permissions]);

  const activeModule = detectModule(pathname);
  
  const visibleGroups = useMemo(() => {
    if (!activeModule) return [];
    return MODULE_NAV[activeModule].map(group => ({
      ...group,
      items: group.items.filter(item => isVisible(item) && (editing || !hiddenItems.includes(item.href)))
    })).filter(group => group.items.length > 0);
  }, [activeModule, editing, hiddenItems, isVisible]);

  const totalItemsCount = activeModule ? MODULE_NAV[activeModule].filter(g => g.items.some(isVisible)).reduce((sum, g) => sum + g.items.filter(isVisible).length, 0) : 0;
  const visibleItemsCount = totalItemsCount - hiddenItems.filter(h => activeModule && MODULE_NAV[activeModule].some(g => g.items.some(i => i.href === h && isVisible(i)))).length;

  return (
    <aside
      id="main-sidebar"
      style={{ viewTransitionName: 'site-sidebar' }}
      className={cn(
        'fixed inset-y-0 left-0 z-50 flex h-full flex-col border-r border-line-soft bg-surface-soft transition-all duration-300 ease-in-out md:static md:translate-x-0 md:z-auto',
        open ? 'translate-x-0' : '-translate-x-full',
        collapsed ? 'w-[64px]' : 'w-64'
      )}
    >
      {/* Brand / Logo */}
      <div className={cn(
        'flex h-16 items-center border-b border-line-soft transition-all duration-300 shrink-0',
        collapsed ? 'justify-center px-0' : 'justify-between px-6'
      )}>
        {!collapsed && <span className="text-[18px] font-bold tracking-tight text-ink font-sans">BUYMORETH ERP</span>}
        {collapsed && <span className="text-[20px] font-bold text-accent">B</span>}
        
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

      <nav className="flex-1 overflow-y-auto py-6 overflow-x-hidden relative">
        {activeModule && !collapsed && (
          <div className="px-4 mb-4">
            <Link
              href="/app/menu"
              className="flex items-center gap-1.5 text-[12px] text-ink-3 hover:text-ink transition-colors mb-3"
            >
              <ChevronLeft className="w-3.5 h-3.5" /> เมนูหลัก
            </Link>
            <div className="flex items-center gap-2 px-1">
              <span className="text-[18px] text-ink-2">
                {(() => {
                  const Icon = MODULE_META[activeModule].icon;
                  return <Icon className="w-[18px] h-[18px]" strokeWidth={1.6} />;
                })()}
              </span>
              <div>
                <div className="text-[13px] font-semibold text-ink leading-tight">{MODULE_META[activeModule].nameTh}</div>
                <div className="text-[10.5px] text-ink-4 uppercase tracking-widest">{MODULE_META[activeModule].nameEn}</div>
              </div>
            </div>
            <div className="h-px bg-line-soft mt-4" />
          </div>
        )}

        {activeModule && collapsed && (
          <div className="flex flex-col items-center gap-3 pt-2 pb-2">
            <Link href="/app/menu" title="เมนูหลัก" className="text-ink-3 hover:text-ink">
              <ChevronLeft className="w-4 h-4" />
            </Link>
            <span className="text-[16px] text-ink-2" title={MODULE_META[activeModule].nameTh}>
              {(() => {
                const Icon = MODULE_META[activeModule].icon;
                return <Icon className="w-[18px] h-[18px]" strokeWidth={1.6} />;
              })()}
            </span>
            <div className="h-px w-8 bg-line-soft mt-1" />
          </div>
        )}

        {editing && !collapsed && activeModule && (
          <div className="mx-4 mb-4 px-3 py-2 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-[11.5px] font-semibold text-yellow-800 flex items-center justify-between">
              <span>จัดการเมนู</span>
              <span className="font-mono">{visibleItemsCount}/{totalItemsCount}</span>
            </p>
            <p className="text-[10.5px] text-yellow-700 mt-0.5">ติ๊กเพื่อเปิด-ปิดเมนูที่ใช้งานบ่อย</p>
          </div>
        )}

        {visibleGroups.map((group) => (
          <SidebarGroup
            key={group.label}
            label={group.label}
            items={group.items}
            collapsed={collapsed}
            editing={editing}
            pathname={pathname}
            hiddenItems={hiddenItems}
            toggleHidden={toggleHidden}
          />
        ))}
      </nav>

      {/* Footer / User Profile */}
      <div className="shrink-0 border-t border-line-soft p-3 bg-surface-soft">
        {!collapsed && activeModule && (
          <button 
            onClick={() => setEditing(!editing)}
            className={cn(
              "flex items-center justify-center gap-1.5 w-full px-2.5 py-[7px] mb-2.5 text-[12.5px] font-medium rounded-lg transition-colors border",
              editing 
                ? "bg-yellow-100 border-yellow-300 text-yellow-800 hover:bg-yellow-200"
                : "text-ink-2 bg-surface-sunken border-dashed border-line hover:bg-white hover:text-ink"
            )}
          >
            {editing ? (
              <span>เสร็จสิ้น</span>
            ) : (
              <>
                <Settings className="w-3.5 h-3.5" />
                <span>จัดการเมนู</span>
              </>
            )}
          </button>
        )}
        
        <div className="flex items-center justify-center md:justify-start gap-2.5 px-1.5 py-1.5 rounded-lg hover:bg-surface-sunken cursor-pointer transition-colors">
          <div className="w-7 h-7 rounded-[7px] shrink-0 grid place-items-center font-semibold text-[12px] bg-[#efece4] border border-[#e4e0d6] text-[#44403c]">
            {initials(userName || 'User')}
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <div className="text-[13px] font-medium text-ink truncate leading-tight">{userName || 'ผู้ใช้งาน'}</div>
              <div className="text-[11px] text-ink-3 uppercase tracking-wider">{userRole || 'Staff'}</div>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}

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
  Clock, Banknote, Users, Timer, Settings, KeyRound,
  Warehouse, ChevronLeft, ChevronDown, CheckSquare, Square,
  GitBranch, UserPlus, CalendarRange, CalendarCheck, CalendarDays, ListChecks,
  Briefcase, UserSearch, Tag, TrendingUp
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useT } from '@/lib/i18n';
import { LanguageSwitcher } from '@/components/ui';

type ModuleKey = 'wms' | 'pos' | 'sales' | 'accounting' | 'hr' | 'admin';

interface ModuleMeta {
  nameTh: string;
  nameEn: string;
  icon: LucideIcon;
  entryHref: string;
}

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
                    viewTransition
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
  const t = useT();

  const moduleMeta: Record<ModuleKey, ModuleMeta> = {
    wms:        { nameTh: t('module.wms'),        nameEn: t('module.wms'),        icon: Warehouse, entryHref: '/app/dashboard' },
    pos:        { nameTh: t('module.pos'),        nameEn: t('module.pos'),        icon: ShoppingBag, entryHref: '/app/pos' },
    sales:      { nameTh: t('module.sales'),      nameEn: t('module.sales'),      icon: Package, entryHref: '/app/sales-quotations' },
    accounting: { nameTh: t('module.accounting'), nameEn: t('module.accounting'), icon: BarChart3, entryHref: '/app/accounting/chart-of-accounts' },
    hr:         { nameTh: t('module.hr'),         nameEn: t('module.hr'),         icon: Users, entryHref: '/app/hr/employees' },
    admin:      { nameTh: t('module.admin'),      nameEn: t('module.admin'),      icon: Settings, entryHref: '/app/admin/users' },
  };

  const moduleNav: Record<ModuleKey, NavGroup[]> = useMemo(() => ({
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
          { href: '/app/ap/wht',      label: t('page.wht_certificates'), icon: FileText,   permission: 'vendors:view' },
          { href: '/app/ap/aging',    label: t('page.ap_aging'),    icon: Clock,      permission: 'vendors:view' },
        ],
      },
      {
        label: t('nav.master_data'),
        items: [
          { href: '/app/products', label: t('page.products'), icon: Package,  permission: 'products:view' },
          { href: '/app/bom',      label: t('page.bom'),      icon: Layers,   permission: 'products:view' },
          { href: '/app/repack',   label: 'การแบ่งบรรจุ (Repack)', icon: ClipboardList, permission: 'inventory:view' },
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
          { href: '/app/accounting/export',            label: 'ส่งออกข้อมูล / Export Adapters', icon: Landmark,  permission: 'reports:accounting' },
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
        label: 'ภาพรวม',
        items: [
          { href: '/app/hr', label: t('page.hr_dashboard'), icon: LayoutDashboard, permission: 'hr:employees:view' },
        ]
      },
      {
        label: t('nav.hr_employees'),
        items: [
          { href: '/app/hr/employees', label: t('nav.hr_employees'), icon: Users, permission: 'hr:employees:view' },
          { href: '/app/hr/org', label: t('nav.hr_org'), icon: GitBranch, permission: 'hr:employees:view' },
          { href: '/app/hr/onboarding', label: t('nav.hr_onboarding'), icon: UserPlus, permission: 'hr:employees:view' },
        ]
      },
      {
        label: t('nav.hr_time'),
        items: [
          { href: '/app/hr/attendance', label: t('page.attendance'), icon: Clock, permission: 'hr:employees:view' },
          { href: '/app/hr/shifts', label: t('nav.hr_shifts'), icon: CalendarRange, permission: 'hr:employees:view' },
          { href: '/app/hr/overtime', label: t('nav.hr_overtime'), icon: Timer, permission: 'hr:employees:view' },
        ]
      },
      {
        label: t('nav.hr_leave'),
        items: [
          { href: '/app/hr/leave-requests', label: t('page.leave'), icon: CalendarCheck, permission: 'hr:employees:view' },
          { href: '/app/hr/leave/calendar', label: t('nav.hr_leave_calendar'), icon: CalendarDays, permission: 'hr:employees:view' },
          { href: '/app/hr/leave/quota', label: t('nav.hr_leave_quota'), icon: ListChecks, permission: 'hr:employees:view' },
        ]
      },
      {
        label: t('nav.hr_payroll'),
        items: [
          { href: '/app/hr/payroll', label: t('page.payroll'), icon: Banknote, permission: 'hr:employees:view' },
          { href: '/app/hr/payroll/slips', label: t('nav.hr_payroll_slips'), icon: FileText, permission: 'hr:employees:view' },
          { href: '/app/hr/payroll/tax', label: t('nav.hr_payroll_tax'), icon: Receipt, permission: 'hr:employees:view' },
        ]
      },
      {
        label: t('nav.hr_development'),
        items: [
          { href: '/app/hr/performance', label: t('nav.hr_performance'), icon: TrendingUp, permission: 'hr:employees:view' },
          { href: '/app/hr/training', label: t('nav.hr_training'), icon: BookOpen, permission: 'hr:employees:view' },
        ]
      },
      {
        label: t('nav.hr_recruitment'),
        items: [
          { href: '/app/hr/jobs', label: t('nav.hr_jobs'), icon: Briefcase, permission: 'hr:employees:view' },
          { href: '/app/hr/candidates', label: t('nav.hr_candidates'), icon: UserSearch, permission: 'hr:employees:view' },
        ]
      },
      {
        label: t('nav.hr_masterdata'),
        items: [
          { href: '/app/hr/positions', label: t('nav.hr_positions'), icon: Tag, permission: 'hr:employees:view' },
          { href: '/app/hr/departments', label: t('nav.hr_departments'), icon: Building2, permission: 'hr:employees:view' },
        ]
      },
    ],

    admin: [
      {
        label: t('nav.admin_section'),
        items: [
          { href: '/app/admin/users',      label: t('page.users'),      icon: UserCircle, roles: ['admin'] },
          { href: '/app/admin/roles',      label: t('page.roles'),      icon: KeyRound,   roles: ['admin'] },
          { href: '/app/admin/warehouses', label: t('page.warehouses'), icon: Warehouse,  roles: ['admin'] },
          { href: '/app/admin/uom',        label: t('page.uom'),        icon: Scale,      roles: ['admin'] },
        ],
      },
    ],
  }), [t]);

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
    return moduleNav[activeModule].map(group => ({
      ...group,
      items: group.items.filter(item => isVisible(item) && (editing || !hiddenItems.includes(item.href)))
    })).filter(group => group.items.length > 0);
  }, [activeModule, editing, hiddenItems, isVisible, moduleNav]);

  const totalItemsCount = activeModule ? moduleNav[activeModule].filter(g => g.items.some(isVisible)).reduce((sum, g) => sum + g.items.filter(isVisible).length, 0) : 0;
  const visibleItemsCount = totalItemsCount - hiddenItems.filter(h => activeModule && moduleNav[activeModule].some(g => g.items.some(i => i.href === h && isVisible(i)))).length;

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
          aria-label={t('topbar.open_menu')}
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
              viewTransition
              className="flex items-center gap-1.5 text-[12px] text-ink-3 hover:text-ink transition-colors mb-3"
            >
              <ChevronLeft className="w-3.5 h-3.5" /> {t('action.back')}
            </Link>
            <div className="flex items-center gap-2 px-1">
              <span className="text-[18px] text-ink-2">
                {(() => {
                  const Icon = moduleMeta[activeModule].icon;
                  return <Icon className="w-[18px] h-[18px]" strokeWidth={1.6} />;
                })()}
              </span>
              <div>
                <div className="text-[13px] font-semibold text-ink leading-tight">{moduleMeta[activeModule].nameTh}</div>
                <div className="text-[10.5px] text-ink-4 uppercase tracking-widest">{moduleMeta[activeModule].nameEn}</div>
              </div>
            </div>
            <div className="h-px bg-line-soft mt-4" />
          </div>
        )}

        {activeModule && collapsed && (
          <div className="flex flex-col items-center gap-3 pt-2 pb-2">
            <Link href="/app/menu" viewTransition title={t('topbar.open_menu')} className="text-ink-3 hover:text-ink">
              <ChevronLeft className="w-4 h-4" />
            </Link>
            <span className="text-[16px] text-ink-2" title={moduleMeta[activeModule].nameTh}>
              {(() => {
                const Icon = moduleMeta[activeModule].icon;
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
        {!collapsed && (
          <LanguageSwitcher className="mb-2" />
        )}

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

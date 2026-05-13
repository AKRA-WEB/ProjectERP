'use client';

import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { Button } from '@/components/ui';

interface ModuleCard {
  id: string;
  nameTh: string;
  nameEn: string;
  icon: string;
  description: string;
  href: string;
  quickLinks: { label: string; href: string }[];
  permission?: string;
  adminOnly?: boolean;
}

const MODULE_CONFIG: ModuleCard[] = [
  {
    id: 'wms',
    nameTh: 'คลังสินค้า',
    nameEn: 'WMS',
    icon: '🏭',
    description: 'จัดการสต็อกสินค้า การรับเข้า และการโอนย้าย',
    href: '/app/dashboard',
    permission: 'dashboard:view',
    quickLinks: [
      { label: 'รับสินค้า (GRN)', href: '/app/grn' },
      { label: 'เช็คสต็อก', href: '/app/inventory' },
    ],
  },
  {
    id: 'pos',
    nameTh: 'ขายหน้าร้าน',
    nameEn: 'POS',
    icon: '🛍️',
    description: 'ระบบขายหน้าร้านและจัดการกะการขาย',
    href: '/app/pos',
    permission: 'pos:cashier',
    quickLinks: [
      { label: 'เปิดจุดขาย', href: '/app/pos' },
      { label: 'ประวัติการขาย', href: '/app/pos/sessions' },
    ],
  },
  {
    id: 'sales',
    nameTh: 'การขาย',
    nameEn: 'Sales',
    icon: '📦',
    description: 'จัดการใบเสนอราคา ใบสั่งขาย และการส่งสินค้า',
    href: '/app/sales-quotations',
    permission: 'sq:view',
    quickLinks: [
      { label: 'ใบเสนอราคา', href: '/app/sales-quotations' },
      { label: 'ใบสั่งขาย', href: '/app/sales-orders' },
    ],
  },
  {
    id: 'accounting',
    nameTh: 'การบัญชี',
    nameEn: 'Accounting',
    icon: '📊',
    description: 'สมุดรายวัน ผังบัญชี และงบการเงิน',
    href: '/app/accounting/chart-of-accounts',
    permission: 'accounts:view',
    quickLinks: [
      { label: 'สมุดรายวัน', href: '/app/accounting/journal-entries' },
      { label: 'งบทดลอง', href: '/app/accounting/reports/trial-balance' },
    ],
  },
  {
    id: 'hr',
    nameTh: 'ทรัพยากรบุคคล',
    nameEn: 'HR',
    icon: '👥',
    description: 'จัดการข้อมูลพนักงาน วันลา และเงินเดือน',
    href: '/app/hr',
    permission: 'hr:employees:view',
    quickLinks: [
      { label: 'ข้อมูลพนักงาน', href: '/app/hr/employees' },
      { label: 'คำขอลา', href: '/app/hr/leave-requests' },
    ],
  },
  {
    id: 'admin',
    nameTh: 'ผู้ดูแลระบบ',
    nameEn: 'Admin',
    icon: '⚙️',
    description: 'ตั้งค่าผู้ใช้ บทบาท และระบบพื้นฐาน',
    href: '/app/admin/users',
    adminOnly: true,
    quickLinks: [
      { label: 'จัดการผู้ใช้', href: '/app/admin/users' },
      { label: 'บทบาทและสิทธิ์', href: '/app/admin/roles' },
    ],
  },
];

export default function MainMenuPage() {
  const { data: session, status } = useSession();
  const loading = status === 'loading';

  const user = session?.user as { role: string; permissions: string[]; name: string } | undefined;
  const role = user?.role ?? '';
  const permissions = user?.permissions ?? [];

  function isModuleVisible(mod: ModuleCard) {
    if (role === 'admin') return true;
    if (mod.adminOnly) return false;
    if (!mod.permission) return true;
    return permissions.includes(mod.permission);
  }

  const visibleModules = MODULE_CONFIG.filter(isModuleVisible);

  const today = new Date().toLocaleDateString('th-TH', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'Asia/Bangkok'
  });

  return (
    <div className="max-w-[1200px] mx-auto py-10 px-4 space-y-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-stone-200 pb-8">
        <div>
          <h1 className="text-3xl font-bold text-stone-900 tracking-tight">
            สวัสดี, {loading ? '...' : user?.name || 'ผู้ใช้งาน'}
          </h1>
          <div className="flex items-center gap-2 mt-2">
            <span className="bg-stone-100 text-stone-600 px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider border border-stone-200">
              {role || '...'}
            </span>
            <span className="text-stone-400">·</span>
            <p className="text-stone-500 text-sm font-medium">เลือกระบบที่ต้องการใช้งาน / Select a module</p>
          </div>
        </div>
        <div className="text-stone-400 text-sm font-mono bg-stone-50 px-3 py-1.5 rounded-lg border border-stone-100">
          {today}
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-[280px] rounded-[12px] bg-stone-100 animate-pulse border border-stone-200" />
          ))
        ) : visibleModules.length === 0 ? (
          <div className="col-span-full py-20 text-center space-y-4">
            <div className="text-4xl">🚫</div>
            <p className="text-stone-500 font-medium text-lg">ขออภัย คุณยังไม่มีสิทธิ์เข้าถึงระบบใดๆ</p>
            <p className="text-stone-400 text-sm">กรุณาติดต่อผู้ดูแลระบบเพื่อขอรับสิทธิ์ใช้งาน</p>
          </div>
        ) : (
          visibleModules.map((mod) => (
            <div key={mod.id} className="group bg-white border border-stone-200 rounded-[12px] shadow-sm hover:shadow-md hover:border-stone-300 transition-all flex flex-col h-[280px] overflow-hidden relative">
              {mod.adminOnly && (
                <div className="absolute top-3 right-3 bg-amber-50 text-amber-700 text-[10px] font-bold px-2 py-0.5 rounded-full border border-amber-100 uppercase tracking-tighter">
                  Admin Only
                </div>
              )}
              
              <div className="p-6 flex-1 flex flex-col items-center text-center">
                <div className="w-16 h-16 rounded-2xl bg-stone-50 flex items-center justify-center text-3xl mb-4 group-hover:scale-110 transition-transform">
                  {mod.icon}
                </div>
                <h3 className="text-[18px] font-bold text-stone-900 leading-tight">{mod.nameTh}</h3>
                <p className="text-[12px] text-stone-400 font-mono uppercase tracking-widest mt-0.5 mb-2">{mod.nameEn}</p>
                <p className="text-[13px] text-stone-500 line-clamp-2 px-2">{mod.description}</p>
              </div>

              <div className="px-6 pb-6 pt-2 bg-stone-50/30 border-t border-stone-50 space-y-4">
                <Link href={mod.href}>
                  <Button className="w-full bg-stone-950 hover:bg-stone-800 text-[13.5px] font-medium h-10 shadow-sm">
                    เข้าสู่ระบบ →
                  </Button>
                </Link>
                
                <div className="flex items-center justify-center gap-4">
                  {mod.quickLinks.map((ql) => (
                    <Link key={ql.label} href={ql.href} className="text-stone-500 hover:text-stone-950 text-[12.5px] font-medium transition-colors">
                      {ql.label}
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

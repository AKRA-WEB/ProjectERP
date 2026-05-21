'use client';

import { useSession } from 'next-auth/react';
import Link from 'next/link';
import React, { useState, useEffect } from 'react';
import { ViewTransition } from '@/lib/react-vts';

// SVG components for modules
const PosIcon = () => (
  <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10 22 L14 12 H50 L54 22"/>
    <path d="M12 22 V52 H52 V22"/>
    <path d="M10 22 H54"/>
    <path d="M16 22 V28 a4 4 0 0 1 -8 0"/>
    <path d="M24 22 V28 a4 4 0 0 1 -8 0"/>
    <path d="M32 22 V28 a4 4 0 0 1 -8 0"/>
    <path d="M40 22 V28 a4 4 0 0 1 -8 0"/>
    <path d="M48 22 V28 a4 4 0 0 1 -8 0"/>
    <path d="M56 22 V28 a4 4 0 0 1 -8 0"/>
    <rect x="26" y="36" width="12" height="16"/>
    <circle cx="36" cy="44" r=".8" fill="currentColor"/>
  </svg>
);

const WmsIcon = () => (
  <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round">
    <path d="M8 34 L20 28 L32 34 L20 40 Z"/>
    <path d="M20 28 V40"/>
    <path d="M32 34 L44 28 L56 34 L44 40 Z"/>
    <path d="M44 28 V40"/>
    <path d="M20 40 L32 46 L44 40"/>
    <path d="M32 46 V58"/>
    <path d="M20 40 L32 46 L32 58 L20 52 Z"/>
    <path d="M44 40 L32 46 L32 58 L44 52 Z"/>
    <path d="M20 28 L26 25"/>
    <path d="M44 28 L38 25"/>
  </svg>
);

const AccIcon = () => (
  <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 10 H46 a4 4 0 0 1 4 4 V54 H18 a4 4 0 0 1 -4 -4 Z"/>
    <path d="M18 50 H50"/>
    <path d="M14 14 a4 4 0 0 1 4 -4 H46"/>
    <path d="M24 22 H40"/>
    <path d="M24 30 H40"/>
    <path d="M24 38 H34"/>
    <circle cx="32" cy="14" r="0" />
  </svg>
);

const HrIcon = () => (
  <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="32" cy="22" r="8"/>
    <path d="M16 54 a16 16 0 0 1 32 0"/>
    <circle cx="32" cy="32" r="26"/>
    <path d="M28 22 h8" opacity="0"/>
  </svg>
);

const AdminIcon = () => (
  <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="32" cy="32" r="22"/>
    <circle cx="32" cy="32" r="14"/>
    <circle cx="32" cy="32" r="6"/>
    <circle cx="32" cy="32" r="1.4" fill="currentColor" stroke="none"/>
    <path d="M32 4 V12"/>
    <path d="M32 52 V60"/>
    <path d="M4 32 H12"/>
    <path d="M52 32 H60"/>
  </svg>
);

interface ModuleCard {
  id: string;
  nameTh: string;
  nameEn: string;
  icon: React.FC;
  href: string;
  permission?: string;
  adminOnly?: boolean;
}

const MODULE_CONFIG: ModuleCard[] = [
  { id: 'pos', nameTh: 'POS', nameEn: 'หน้าร้าน', icon: PosIcon, href: '/app/pos', permission: 'pos:cashier' },
  { id: 'wms', nameTh: 'คลังสินค้า', nameEn: 'Warehouse', icon: WmsIcon, href: '/app/dashboard', permission: 'dashboard:view' },
  { id: 'accounting', nameTh: 'บัญชี', nameEn: 'Accounting', icon: AccIcon, href: '/app/accounting/chart-of-accounts', permission: 'accounts:view' },
  { id: 'hr', nameTh: 'บุคคล', nameEn: 'HR', icon: HrIcon, href: '/app/hr/employees', permission: 'hr:employees:view' },
  { id: 'admin', nameTh: 'ผู้ดูแลระบบ', nameEn: 'Admin', icon: AdminIcon, href: '/app/admin/users', adminOnly: true },
];

function initials(name: string) {
  if (!name) return 'อ';
  const parts = name.trim().split(' ');
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
}

export default function MainMenuPage() {
  const { data: session, status } = useSession();
  const loading = status === 'loading';
  const [isMounted, setIsMounted] = useState(false);
  const [currentThaiMonth, setCurrentThaiMonth] = useState('');

  useEffect(() => {
    setIsMounted(true);
    const now = new Date();
    const thaiMonths = [
      'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
      'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
    ];
    setCurrentThaiMonth(`${thaiMonths[now.getMonth()]} ${now.getFullYear() + 543}`);
  }, []);

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

  if (loading || !isMounted) {
    return <div className="min-h-screen bg-[#f6f4ef] flex items-center justify-center text-[#78716c]">กำลังโหลด...</div>;
  }

  return (
    <ViewTransition default="none" enter="fade-in" exit="fade-out">
      <div className="flex flex-col items-center justify-center w-full max-w-[1000px] mx-auto min-h-[calc(100vh-120px)] font-sans">
        <div className="text-center mb-14">
          <div className="inline-flex items-center gap-3 px-3 pr-4 py-1.5 border border-[#e4e0d6] bg-white/55 rounded-full mb-6">
            <div className="w-7 h-7 rounded-full bg-[#1c1917] text-[#f6f4ef] grid place-items-center text-[13px] font-semibold">B</div>
            <span className="text-[11.5px] uppercase tracking-[0.18em] text-[#44403c] font-medium">BUYMORETH ERP</span>
          </div>
          <h1 className="font-display text-[34px] font-medium tracking-[-0.025em] text-[#1c1917] m-0">เลือกระบบงาน</h1>
          <div className="text-[13px] color-[#78716c] mt-2.5 tracking-[0.02em] text-[#78716c]">Choose a workspace to continue</div>
        </div>

        <nav className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 border-t border-b border-[#e4e0d6] w-full max-w-[900px]" aria-label="ระบบงาน">
          {visibleModules.length === 0 ? (
            <div className="col-span-full py-20 text-center text-[#78716c]">
              <p>ขออภัย คุณยังไม่มีสิทธิ์เข้าถึงระบบใดๆ</p>
            </div>
          ) : (
            visibleModules.map((mod, i) => (
              <Link key={mod.id} href={mod.href} className={`relative flex flex-col items-center px-5 pt-[44px] pb-[32px] no-underline text-inherit border-r border-[#e4e0d6] transition-colors duration-150 hover:bg-white/55 group ${i === visibleModules.length - 1 ? 'border-r-0' : ''} lg:border-r`}>
                <div className="w-24 h-24 grid place-items-center text-[#44403c] transition-all duration-250 ease-out mb-6 group-hover:text-[#1c1917] group-hover:-translate-y-0.5">
                  <mod.icon />
                </div>
                <div className="font-display text-[17px] font-medium tracking-[-0.005em] text-[#1c1917] text-center">{mod.nameTh}</div>
                <div className="font-mono text-[10.5px] tracking-[0.14em] uppercase text-[#78716c] mt-2">{mod.nameEn}</div>
                <svg className="absolute bottom-[14px] right-[14px] w-4 h-4 text-[#78716c] opacity-0 transition-all duration-250 ease-out group-hover:opacity-100 group-hover:translate-x-0.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><path d="M3 8h10M9 4l4 4-4 4"/></svg>
              </Link>
            ))
          )}
        </nav>

        <div className="mt-10 flex items-center gap-3.5 text-[12.5px] text-[#78716c]">
          <div className="w-[30px] h-[30px] rounded-full bg-[#efece4] border border-[#e4e0d6] grid place-items-center text-[11px] font-semibold text-[#44403c]">
            {initials(user?.name || '')}
          </div>
          <span className="font-medium text-[#44403c]">{user?.name || 'ผู้ใช้งาน'}</span>
          <span className="w-1 h-1 rounded-full bg-[#e4e0d6]" />
          <span>{role || 'Staff'}</span>
        </div>

        <div className="flex items-center gap-3.5 mt-14 text-[10.5px] font-mono uppercase tracking-[0.22em] text-[#78716c] w-full max-w-[400px] before:content-[''] before:flex-1 before:h-px before:bg-[#e4e0d6] before:min-w-[48px] after:content-[''] after:flex-1 after:h-px after:bg-[#e4e0d6] after:min-w-[48px]">
          v 2.0 · {currentThaiMonth}
        </div>
      </div>
    </ViewTransition>
  );
}

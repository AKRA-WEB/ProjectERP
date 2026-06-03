'use client';

import { useSession } from 'next-auth/react';
import Link from 'next/link';
import React, { useState, useEffect } from 'react';
import { ViewTransition } from '@/lib/react-vts';
import { useToast } from '@/components/ui';
import { useT, useLanguage } from '@/lib/i18n';

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

const SalesIcon = () => (
  <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round">
    <path d="M34 6 H54 V26 L28 52 a4 4 0 0 1 -5.6 0 L12 41.6 a4 4 0 0 1 0 -5.6 Z"/>
    <circle cx="45" cy="19" r="3.2"/>
    <path d="M22 36 L36 50" opacity=".55"/>
  </svg>
);

const PurchasingIcon = () => (
  <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 22 H50 L48 58 H16 Z"/>
    <path d="M14 22 L18 14 H46 L50 22"/>
    <path d="M24 22 V30 a8 8 0 0 0 16 0 V22"/>
    <path d="M14 22 H50"/>
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
  isStub?: boolean;
  accent: string;
}

// eslint-disable-next-line local-rules/no-hardcoded-thai
const MODULE_CONFIG: ModuleCard[] = [
  { id: 'pos', nameTh: 'หน้าร้าน', nameEn: 'POS', icon: PosIcon, href: '/app/pos', permission: 'pos:cashier', accent: '#b85c3c' },
  { id: 'sales', nameTh: 'ขาย', nameEn: 'Sales', icon: SalesIcon, href: '/app/sales-quotations', permission: 'sales:view', accent: '#3a7a7a' },
  { id: 'purchasing', nameTh: 'จัดซื้อ', nameEn: 'Purchasing', icon: PurchasingIcon, href: '/app/purchase-requests', permission: 'purchasing:view', accent: '#4f5d8a' },
  { id: 'wms', nameTh: 'คลังสินค้า', nameEn: 'Warehouse', icon: WmsIcon, href: '/app/dashboard', permission: 'dashboard:view', accent: '#5b7a99' },
  { id: 'accounting', nameTh: 'บัญชี', nameEn: 'Accounting', icon: AccIcon, href: '/app/accounting/chart-of-accounts', permission: 'accounts:view', accent: '#a98038' },
  { id: 'hr', nameTh: 'บุคคล', nameEn: 'HR', icon: HrIcon, href: '/app/hr/employees', permission: 'hr:employees:view', accent: '#6b8e6f' },
  { id: 'admin', nameTh: 'ผู้ดูแลระบบ', nameEn: 'Admin', icon: AdminIcon, href: '/app/admin', adminOnly: true, accent: '#7a5a7e' },
];

function initials(name: string) {
  // eslint-disable-next-line local-rules/no-hardcoded-thai
  if (!name) return 'อ';
  const parts = name.trim().split(' ');
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
}

const MONTH_KEYS = [
  'month.jan', 'month.feb', 'month.mar', 'month.apr',
  'month.may', 'month.jun', 'month.jul', 'month.aug',
  'month.sep', 'month.oct', 'month.nov', 'month.dec',
] as const;

export default function MainMenuPage() {
  const { data: session, status } = useSession();
  const toast = useToast();
  const t = useT();
  const { lang } = useLanguage();
  const loading = status === 'loading';
  const [isMounted, setIsMounted] = useState(false);
  const [currentThaiMonth, setCurrentThaiMonth] = useState('');

  useEffect(() => {
    setIsMounted(true);
    const now = new Date();
    const monthKey = MONTH_KEYS[now.getMonth()];
    setCurrentThaiMonth(`${t(monthKey)} ${lang === 'th' ? now.getFullYear() + 543 : now.getFullYear()}`);
  }, [t, lang]);

  const user = session?.user as { role: string; permissions: string[]; name: string } | undefined;
  const role = user?.role ?? '';
  const permissions = user?.permissions ?? [];

  function isModuleVisible(mod: ModuleCard) {
    if (role === 'admin') return true;
    if (mod.adminOnly) return false;
    if (mod.isStub) return true; // Show Sales and Purchasing stubs to everyone for the Toast preview
    if (!mod.permission) return true;
    return permissions.includes(mod.permission);
  }

  const visibleModules = MODULE_CONFIG.filter(isModuleVisible);

  // Helper to determine responsive grid column spans for visual balance
  const getGridColSpan = (index: number, total: number) => {
    const isLastOdd = total % 2 !== 0 && index === total - 1;
    const mobileSpan = isLastOdd ? 'col-span-12' : 'col-span-6';
    
    if (total === 7) {
      // 4 on top row (span 3), 3 on bottom row (span 4)
      return index < 4 
        ? `${mobileSpan} md:col-span-6 lg:col-span-3` 
        : `${mobileSpan} md:col-span-4 lg:col-span-4`;
    }
    if (total === 6) {
      return 'col-span-6 md:col-span-4 lg:col-span-4';
    }
    if (total === 5) {
      return index < 3
        ? `${mobileSpan} md:col-span-4 lg:col-span-4`
        : `${mobileSpan} md:col-span-6 lg:col-span-6`;
    }
    if (total === 4) {
      return 'col-span-6 md:col-span-6 lg:col-span-3';
    }
    if (total === 3) {
      return `${mobileSpan} md:col-span-4 lg:col-span-4`;
    }
    if (total === 2) {
      return 'col-span-6 lg:col-span-6';
    }
    return 'col-span-12';
  };

  const handleCardClick = (e: React.MouseEvent, mod: ModuleCard) => {
    if (mod.isStub) {
      e.preventDefault();
      toast('info', `🚧 ${t('msg.under_development').replace('{name}', lang === 'th' ? mod.nameTh : mod.nameEn)}`);
    }
  };

  if (loading || !isMounted) {
    return <div className="min-h-screen bg-[#f6f4ef] flex items-center justify-center text-[#78716c]">{t('msg.loading_data')}</div>;
  }

  return (
    <ViewTransition default="none" enter="fade-in" exit="fade-out">
      <div className="flex flex-col items-center justify-center w-full max-w-[1000px] mx-auto min-h-[calc(100vh-120px)] font-sans px-4 py-8">
        <style dangerouslySetInnerHTML={{ __html: `
          .mm-grid {
            display: grid;
            grid-template-columns: repeat(12, minmax(0, 1fr));
            gap: 20px;
            max-width: 900px;
            width: 100%;
          }
          .mm-card {
            width: 100%;
            position: relative;
            display: flex;
            flex-direction: column;
            align-items: center;
            padding: 32px 18px 24px;
            text-decoration: none;
            color: inherit;
            background: #fdfcf9;
            border: 1px solid var(--hair, #e4e0d6);
            border-radius: 12px;
            box-shadow: 0 1px 2px rgba(28,25,23,.03);
            overflow: hidden;
            transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
          }
          .mm-card::before {
            content: "";
            position: absolute;
            left: 0;
            right: 0;
            top: 0;
            height: 2px;
            background: var(--accent, #1c1917);
            opacity: .65;
            transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
          }
          .mm-card:hover {
            background: linear-gradient(135deg, #ffffff 0%, var(--accent-light) 100%);
            border-color: var(--accent);
            transform: translateY(-4px);
            box-shadow: 0 20px 35px -10px var(--accent-glow), 0 2px 8px rgba(28,25,23,.03);
          }
          .mm-card:hover::before {
            opacity: 1;
            height: 3px;
          }
          .mm-card:hover .mm-ico {
            color: var(--accent);
            background: var(--accent-light);
            transform: scale(1.05);
          }
          .mm-card:hover .mm-arrow {
            opacity: 1;
            transform: translate(2px, -2px);
          }
          .mm-ico {
            width: 72px;
            height: 72px;
            display: grid;
            place-items: center;
            color: #44403c;
            background: #f4f2eb;
            border-radius: 16px;
            transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
            margin-bottom: 20px;
            padding: 18px;
          }
          .mm-ico svg {
            width: 100%;
            height: 100%;
            display: block;
          }
          .mm-arrow {
            position: absolute;
            bottom: 14px;
            right: 14px;
            width: 16px;
            height: 16px;
            color: #78716c;
            opacity: 0;
            transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
          }
        ` }} />

        <div className="text-center mb-14">
          <div className="inline-flex items-center gap-3 px-3 pr-4 py-1.5 border border-[#e4e0d6] bg-white/55 rounded-full mb-6">
            {/* eslint-disable-next-line local-rules/no-hardcoded-thai */}
            <div className="w-7 h-7 rounded-full bg-[#1c1917] text-[#f6f4ef] grid place-items-center text-[13px] font-semibold">อ</div>
            <span className="text-[11.5px] uppercase tracking-[0.18em] text-[#44403c] font-medium">Arun · ERP</span>
          </div>
          <h1 className="font-display text-[34px] font-medium tracking-[-0.025em] text-[#1c1917] m-0">{t('page.select_module')}</h1>
          <div className="text-[13px] text-[#78716c] mt-2.5 tracking-[0.02em]">Choose a workspace to continue</div>
        </div>

        <nav className="mm-grid" aria-label={t('page.select_module')}>
          {visibleModules.length === 0 ? (
            <div className="w-full py-20 text-center text-[#78716c]">
              <p>{t('msg.no_access')}</p>
            </div>
          ) : (
            visibleModules.map((mod, index) => (
              <Link
                key={mod.id}
                href={mod.href}
                onClick={(e) => handleCardClick(e, mod)}
                className={`mm-card ${getGridColSpan(index, visibleModules.length)}`}
                style={{
                  '--accent': mod.accent,
                  '--accent-light': `${mod.accent}08`,
                  '--accent-glow': `${mod.accent}20`
                } as React.CSSProperties}
              >
                <div className="mm-ico" aria-hidden="true">
                  <mod.icon />
                </div>
                <div className="font-display text-[17px] font-medium tracking-[-0.005em] text-[#1c1917] text-center">{mod.nameTh}</div>
                <div className="font-mono text-[10.5px] tracking-[0.14em] uppercase text-[#78716c] mt-2">{mod.nameEn}</div>
                <svg className="mm-arrow" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 8h10M9 4l4 4-4 4"/>
                </svg>
              </Link>
            ))
          )}
        </nav>

        <div className="mt-10 flex items-center gap-3.5 text-[12.5px] text-[#78716c]">
          <div className="w-[30px] h-[30px] rounded-full bg-[#efece4] border border-[#e4e0d6] grid place-items-center text-[11px] font-semibold text-[#44403c]">
            {initials(user?.name || '')}
          </div>
          <span className="font-medium text-[#44403c]">{user?.name || t('label.user')}</span>
          <span className="w-1 h-1 rounded-full bg-[#e4e0d6]" />
          <span>{role || 'Staff'}</span>
        </div>

        <div className="flex items-center gap-3.5 mt-14 text-[10.5px] font-mono uppercase tracking-[0.22em] text-[#78716c] w-full max-w-[400px] before:content-[''] before:flex-1 before:h-px before:bg-[#e4e0d6] before:min-w-[48px] after:content-[''] after:flex-1 after:h-px after:bg-[#e4e0d6] after:min-w-[48px]">
          v 2.4 · {currentThaiMonth}
        </div>
      </div>
    </ViewTransition>
  );
}

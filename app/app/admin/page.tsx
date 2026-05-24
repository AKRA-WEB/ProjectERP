'use client';

import { useSession } from 'next-auth/react';
import Link from 'next/link';
import React, { useState, useEffect } from 'react';
import { Users, Shield, Scale, Warehouse as WarehouseIcon, ArrowRight, Loader2, Tag } from 'lucide-react';
import { get } from '@/lib/api-client';
import { DirectionalTransition } from '@/components/ui/directional-transition';

interface Stats {
  usersCount: number | null;
  warehousesCount: number | null;
  rolesCount: number | null;
  uomsCount: number | null;
  pricesCount: number | null;
  productChannelUomsCount: number | null;
}

export default function AdminHubPage() {
  const { data: session } = useSession();
  const [stats, setStats] = useState<Stats>({
    usersCount: null,
    warehousesCount: null,
    rolesCount: null,
    uomsCount: null,
    pricesCount: null,
    productChannelUomsCount: null,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      try {
        setLoading(true);
        const [usersRes, warehousesRes, rolesRes, uomsRes, pricesRes, channelUomsRes] = await Promise.all([
          get<{ total: number }>('/api/hr/employees?pageSize=1').catch(() => ({ total: 0 })),
          get<unknown[]>('/api/admin/warehouses').catch(() => []),
          get<unknown[]>('/api/admin/roles').catch(() => []),
          get<unknown[]>('/api/admin/uom').catch(() => []),
          get<{ total: number }>('/api/admin/product-prices?limit=1').catch(() => ({ total: 0 })),
          get<unknown[]>('/api/admin/product-channel-uoms').catch(() => []),
        ]);

        setStats({
          usersCount: usersRes?.total ?? 0,
          warehousesCount: Array.isArray(warehousesRes) ? warehousesRes.length : 0,
          rolesCount: Array.isArray(rolesRes) ? rolesRes.length : 0,
          uomsCount: Array.isArray(uomsRes) ? uomsRes.length : 0,
          pricesCount: pricesRes?.total ?? 0,
          productChannelUomsCount: Array.isArray(channelUomsRes) ? channelUomsRes.length : 0,
        });
      } catch (err) {
        console.error('Failed to fetch admin stats:', err);
      } finally {
        setLoading(false);
      }
    }

    if (session?.user) {
      fetchStats();
    }
  }, [session]);

  const cards = [
    {
      title: 'จัดการผู้ใช้งาน',
      titleEn: 'Users Management',
      desc: 'เพิ่ม แก้ไข ลบข้อมูลผู้ใช้งานในระบบ กำหนดแผนก และตำแหน่งงาน',
      href: '/app/admin/users',
      icon: Users,
      stat: stats.usersCount,
    },
    {
      title: 'ตั้งค่าสิทธิ์การใช้งาน',
      titleEn: 'Roles & Permissions',
      desc: 'กำหนดสิทธิ์การเข้าถึงข้อมูลและเครื่องมือต่างๆ ในแต่ละระดับงาน',
      href: '/app/admin/roles',
      icon: Shield,
      stat: stats.rolesCount,
    },
    {
      title: 'จัดการหน่วยนับ',
      titleEn: 'Units of Measure',
      desc: 'ตั้งค่าหน่วยหลัก หน่วยเสริม และสัดส่วนการคำนวณ UoM ของคลังสินค้า',
      href: '/app/admin/uom',
      icon: Scale,
      stat: stats.uomsCount,
    },
    {
      title: 'จัดการคลังสินค้า',
      titleEn: 'Warehouses',
      desc: 'เพิ่มสาขา กำหนดคลัง และบริหารจัดการพื้นที่จัดเก็บสินค้า',
      href: '/app/admin/warehouses',
      icon: WarehouseIcon,
      stat: stats.warehousesCount,
    },
    {
      title: 'ราคาสินค้าและสัญญา',
      titleEn: 'Pricing & Contracts',
      desc: 'กำหนดราคาสินค้าตามช่องทาง/ระดับสมาชิก และจัดการสัญญาล็อคราคาลูกค้า',
      href: '/app/admin/pricing',
      icon: Tag,
      stat: stats.pricesCount,
    },
    {
      title: 'การจำกัดหน่วยขายสินค้า',
      titleEn: 'Allowed Sales UoMs Whitelist',
      desc: 'จำกัดหน่วยขายสำหรับช่องทาง AKRA (Wholesale) และช่องทางทั่วไปของแต่ละสินค้า',
      href: '/app/admin/product-channel-uoms',
      icon: Scale,
      stat: stats.productChannelUomsCount,
    },
  ];

  return (
    <DirectionalTransition>
      <div className="max-w-[1000px] mx-auto min-h-[calc(100vh-140px)] font-sans px-4 py-8">
        <style dangerouslySetInnerHTML={{ __html: `
          .admin-card {
            background: #ffffff;
            border: 1px solid #e4e0d6;
            border-left: 4px solid #7a5a7e;
            border-radius: 6px;
            box-shadow: 0 1px 2px rgba(28,25,23,.03);
            transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
          }
          .admin-card:hover {
            transform: translateY(-2px);
            box-shadow: 0 12px 24px -10px rgba(122,90,126,0.15), 0 2px 4px rgba(28,25,23,0.02);
            border-color: #d3cdbd;
          }
          .admin-card:hover .arrow-icon {
            transform: translateX(4px);
            color: #7a5a7e;
          }
        ` }} />

        {/* Header Section */}
        <div className="mb-10 flex items-center justify-between border-b border-[#e4e0d6] pb-6">
          <div>
            <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-[#7a5a7e] font-semibold mb-1">
              <span>ADMIN PANEL</span>
              <span className="w-1.5 h-1.5 rounded-full bg-[#7a5a7e]/40" />
              <span>ผู้ดูแลระบบ</span>
            </div>
            <h1 className="font-display text-[28px] font-semibold tracking-tight text-[#1c1917] m-0">ศูนย์กลางการจัดการระบบ</h1>
          </div>
          <Link
            href="/app/menu"
            className="px-4 py-2 border border-[#e4e0d6] hover:bg-stone-50 rounded text-sm text-[#44403c] transition-colors"
          >
            กลับหน้าเมนูหลัก
          </Link>
        </div>

        {/* Card Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {cards.map((card) => {
            const Icon = card.icon;
            return (
              <Link key={card.href} href={card.href} className="admin-card block p-6 no-underline">
                <div className="flex items-start justify-between gap-4">
                  {/* Left Column: Icon and Info */}
                  <div className="flex gap-4">
                    <div className="w-12 h-12 rounded bg-[#7a5a7e]/10 text-[#7a5a7e] flex items-center justify-center shrink-0">
                      <Icon className="w-6 h-6" />
                    </div>
                    <div>
                      <h2 className="text-lg font-medium text-[#1c1917] m-0 flex items-center gap-2">
                        {card.title}
                      </h2>
                      <div className="font-mono text-[11px] tracking-wider uppercase text-[#7a5a7e] mt-0.5">
                        {card.titleEn}
                      </div>
                      <p className="text-xs text-[#78716c] mt-2.5 leading-relaxed max-w-[280px]">
                        {card.desc}
                      </p>
                    </div>
                  </div>

                  {/* Right Column: Stat and Arrow */}
                  <div className="flex flex-col items-end justify-between h-20 shrink-0 select-none">
                    <div className="text-right">
                      {loading ? (
                        <Loader2 className="w-5 h-5 text-[#7a5a7e]/40 animate-spin" />
                      ) : (
                        <span className="text-3xl font-light font-display tracking-tight text-[#7a5a7e]">
                          {card.stat !== null ? card.stat : 0}
                        </span>
                      )}
                      <div className="text-[10px] text-[#78716c] uppercase tracking-wider font-medium mt-1">
                        รายการ
                      </div>
                    </div>
                    <ArrowRight className="arrow-icon w-4 h-4 text-[#78716c]/40 transition-transform duration-200" />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </DirectionalTransition>
  );
}

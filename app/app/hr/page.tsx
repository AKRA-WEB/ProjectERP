'use client';

import { useState, useEffect } from 'react';
import { get } from '@/lib/api-client';
import { KpiCard, KpiGrid, Button } from '@/components/ui';
import Link from 'next/link';

interface HRStats {
  employees: { total: number; active: number };
  departments: number;
  leave: { pending: number };
  attendance: { present: number; late: number; absent: number };
  payroll: { run_number: string; period_month: number; period_year: number; status: string } | null;
}

const CARD = 'bg-white border border-stone-200 rounded-[10px] shadow-sm overflow-hidden';

export default function HrDashboardPage() {
  const [stats, setStats] = useState<HRStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    get<HRStats>('/api/hr/stats').then(setStats).finally(() => setLoading(false));
  }, []);

  const d = (v: number | undefined | null) => v ?? 0;

  return (
    <div className="max-w-[1440px] mx-auto pb-12 space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-[26px] font-semibold tracking-tight text-stone-950">ภาพรวมทรัพยากรบุคคล / HR Dashboard</h1>
          <p className="text-[14px] text-stone-500">สรุปข้อมูลพนักงาน วันลา การเข้างาน และเงินเดือน</p>
        </div>
        <div className="flex gap-2">
          <Link href="/app/hr/employees">
            <Button variant="ghost">จัดการพนักงาน</Button>
          </Link>
          <Link href="/app/hr/leave-requests">
            <Button variant="ghost">อนุมัติวันลา</Button>
          </Link>
        </div>
      </div>

      <KpiGrid>
        <KpiCard
          label="พนักงานทั้งหมด"
          value={d(stats?.employees.total)}
          subValue={<>กำลังใช้งาน: <span className="font-mono">{d(stats?.employees.active)}</span></>}
          href="/app/hr/employees"
          loading={loading}
        />
        <KpiCard
          label="วันลาที่รออนุมัติ"
          value={d(stats?.leave.pending)}
          subValue="รายการที่ยื่นคำขอแล้ว"
          href="/app/hr/leave-requests?status=submitted"
          loading={loading}
          className={stats?.leave.pending ? '[&_.text-ink]:text-amber-600' : ''}
        />
        <KpiCard
          label="เข้างานวันนี้"
          value={d(stats?.attendance.present + stats?.attendance.late)}
          subValue={<>มาสาย: <span className="font-mono">{d(stats?.attendance.late)}</span> | ขาด: <span className="font-mono">{d(stats?.attendance.absent)}</span></>}
          href="/app/hr/attendance"
          loading={loading}
        />
        <KpiCard
          label="แผนกทั้งหมด"
          value={d(stats?.departments)}
          subValue="แผนกที่เปิดใช้งานอยู่"
          href="/app/hr/departments"
          loading={loading}
        />
      </KpiGrid>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Latest Payroll Run */}
        <div className={CARD}>
          <div className="px-5 py-4 border-b border-stone-100 flex items-center justify-between bg-stone-50/50">
            <h3 className="text-[14px] font-semibold text-stone-950">รอบการจ่ายเงินเดือนล่าสุด</h3>
            <Link href="/app/hr/payroll" className="text-xs text-stone-500 hover:text-stone-950">ดูทั้งหมด</Link>
          </div>
          <div className="p-5">
            {loading ? (
              <p className="text-sm text-stone-400">กำลังโหลด...</p>
            ) : stats?.payroll ? (
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[18px] font-bold text-stone-900">{stats.payroll.run_number}</p>
                  <p className="text-sm text-stone-500">ประจำรอบ {stats.payroll.period_month}/{stats.payroll.period_year}</p>
                </div>
                <div className="text-right">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border
                    ${stats.payroll.status === 'paid' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 
                      stats.payroll.status === 'approved' ? 'bg-blue-50 text-blue-700 border-blue-100' :
                      'bg-amber-50 text-amber-700 border-amber-100'}`}>
                    {stats.payroll.status.toUpperCase()}
                  </span>
                  <Link href={`/app/hr/payroll`} className="block mt-2 text-[13px] text-emerald-600 hover:underline">
                    ดูรายละเอียด →
                  </Link>
                </div>
              </div>
            ) : (
              <p className="text-sm text-stone-500 italic">ยังไม่มีรายการเงินเดือน</p>
            )}
          </div>
        </div>

        {/* Quick Links */}
        <div className={CARD}>
          <div className="px-5 py-4 border-b border-stone-100 bg-stone-50/50">
            <h3 className="text-[14px] font-semibold text-stone-950">เข้าถึงด่วน / Quick Links</h3>
          </div>
          <div className="p-5 grid grid-cols-2 gap-3">
            {[
              { label: 'เพิ่มพนักงานใหม่', href: '/app/hr/employees', icon: '👤+' },
              { label: 'ตั้งค่าวันลา', href: '/app/hr/leave-requests', icon: '📅⚙️' },
              { label: 'จัดการแผนก', href: '/app/hr/departments', icon: '🏢' },
              { label: 'ตั้งค่าบัญชีเงินเดือน', href: '/app/hr/payroll/settings', icon: '💰⚙️' },
            ].map((link) => (
              <Link key={link.label} href={link.href} className="flex items-center gap-3 p-3 rounded-lg border border-stone-100 hover:bg-stone-50 hover:border-stone-200 transition-all group">
                <span className="text-lg">{link.icon}</span>
                <span className="text-[13px] font-medium text-stone-600 group-hover:text-stone-900">{link.label}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

'use client';

/* eslint-disable local-rules/no-hardcoded-thai */
import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { get, patch } from '@/lib/api-client';
import { formatDate } from '@/lib/utils';
import { useSession } from 'next-auth/react';
import { useLanguage } from '@/lib/i18n';
import { DirectionalTransition } from '@/components/ui/directional-transition';
import type { LeaveRequest, SessionUser } from '@/types';

// --- Local Components ---

const AVATAR_PALETTE = [
  { bg: '#fde68a', txt: '#92400e' }, { bg: '#bbf7d0', txt: '#14532d' },
  { bg: '#bfdbfe', txt: '#1e3a8a' }, { bg: '#fecaca', txt: '#7f1d1d' },
  { bg: '#e9d5ff', txt: '#581c87' }, { bg: '#fed7aa', txt: '#7c2d12' },
  { bg: '#cffafe', txt: '#164e63' }, { bg: '#fce7f3', txt: '#831843' },
];

function nameToColor(name: string) {
  if (!name) return AVATAR_PALETTE[0];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_PALETTE[h % AVATAR_PALETTE.length];
}

function nameToInitials(name: string) {
  if (!name) return '??';
  const parts = name.trim().split(/\s+/);
  return parts.length >= 2 ? (parts[0][0] + parts[1][0]).toUpperCase() : name.slice(0, 2).toUpperCase();
}

function Avatar({ name, size = 32 }: { name: string; size?: number }) {
  const { bg, txt } = nameToColor(name);
  return (
    <div
      className="rounded-full flex items-center justify-center font-bold text-[11px] shrink-0"
      style={{ backgroundColor: bg, color: txt, width: size, height: size }}
    >
      {nameToInitials(name)}
    </div>
  );
}

function KpiCard({ label, value, sub, accent = 'text-stone-900', loading = false }: { label: string; value: string | number; sub: string; accent?: string; loading?: boolean }) {
  return (
    <div className="flex-1 px-5 py-4 border-r border-stone-100 last:border-r-0">
      <div className="text-[11px] font-semibold text-stone-500 uppercase tracking-wider">{label}</div>
      <div className={`text-[20px] font-bold mt-0.5 ${accent}`}>
        {loading ? <span className="animate-pulse bg-stone-100 rounded w-12 h-6 inline-block" /> : value}
      </div>
      <div className="text-[11px] text-stone-400 mt-0.5">{sub}</div>
    </div>
  );
}

// --- Page Logic ---

interface LeaveStats {
  pending: number;
  on_leave_now: number;
  upcoming_7d: number;
  approved_this_month: number;
}

interface CalendarTeamMember {
  employee_id: string;
  name_th: string;
  department_name_en: string;
}

interface CalendarLeave {
  employee_id: string;
  from_day: number;
  to_day: number;
  type: string;
  color: string;
}

interface CalendarData {
  team: CalendarTeamMember[];
  leaves: CalendarLeave[];
  month_days: number;
  first_weekday: number;
}

export default function LeaveManagementPage() {
  const { data: session } = useSession();
  const { lang } = useLanguage();
  const [stats, setStats] = useState<LeaveStats | null>(null);
  const [calendar, setCalendar] = useState<CalendarData | null>(null);
  const [pending, setPending] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReq, setSelectedReq] = useState<LeaveRequest | null>(null);
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
  
  const user = session?.user as unknown as SessionUser;
  const canApprove = user?.role === 'admin' || user?.role === 'manager';

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [s, c, p] = await Promise.all([
        get<LeaveStats>('/api/hr/leave-requests/stats'),
        get<CalendarData>(`/api/hr/leave-requests/calendar?month=${month}`),
        get<{ data: LeaveRequest[] }>(`/api/hr/leave-requests?status=submitted&pageSize=50`)
      ]);
      setStats(s);
      setCalendar(c);
      setPending(p.data);
    } finally { setLoading(false); }
  }, [month]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleAction = async (id: string, action: 'approve' | 'reject', reason?: string) => {
    try {
      await patch(`/api/hr/leave-requests/${id}`, { action, reject_reason: reason });
      setSelectedReq(null);
      fetchData();
    } catch {
      alert('เกิดข้อผิดพลาดในการดำเนินการ');
    }
  };

  const nextMonth = () => {
    const [y, m] = month.split('-').map(Number);
    const date = new Date(y, m, 1);
    setMonth(date.toISOString().slice(0, 7));
  };

  const prevMonth = () => {
    const [y, m] = month.split('-').map(Number);
    const date = new Date(y, m - 2, 1);
    setMonth(date.toISOString().slice(0, 7));
  };

  const monthNames = [
    'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
    'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
  ];

  return (
    <DirectionalTransition>
      <div className="max-w-[1440px] mx-auto pb-12 space-y-6">
        {/* Header */}
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-[26px] font-semibold tracking-tight text-stone-900">
              จัดการการลา <span className="text-stone-400 font-normal">/ Leave Management</span>
            </h1>
            <p className="text-[13.5px] text-stone-500 mt-1">อนุมัติคำขอและตรวจสอบปฏิทินทีม</p>
          </div>
          <div className="flex gap-2">
            <Link href="/app/hr/leave-requests/new" className="h-9 px-3.5 rounded-md text-[13px] font-medium text-white bg-stone-900 hover:bg-stone-800 inline-flex items-center gap-1.5 transition-colors">
              + สร้างใบลา
            </Link>
          </div>
        </div>

        {/* KPI Strip */}
        <div className="flex bg-white border border-stone-200 rounded-[10px] shadow-sm overflow-hidden text-center sm:text-left">
          <KpiCard
            label="รออนุมัติ"
            value={stats?.pending ?? 0}
            sub="รายการที่ยังไม่ดำเนินการ"
            accent={stats?.pending ? 'text-amber-600' : 'text-stone-900'}
            loading={loading}
          />
          <KpiCard
            label="ลางานวันนี้"
            value={stats?.on_leave_now ?? 0}
            sub="พนักงานที่ไม่อยู่ในขณะนี้"
            accent="text-indigo-600"
            loading={loading}
          />
          <KpiCard
            label="ล่วงหน้า (7 วัน)"
            value={stats?.upcoming_7d ?? 0}
            sub="รายการที่อนุมัติแล้ว"
            loading={loading}
          />
          <KpiCard
            label="อนุมัติแล้วเดือนนี้"
            value={stats?.approved_this_month ?? 0}
            sub="ยอดรวมพนักงานที่ได้หยุด"
            accent="text-emerald-700"
            loading={loading}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Pending List */}
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-white border border-stone-200 rounded-[10px] shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-stone-100 flex items-center justify-between">
                <h2 className="font-semibold text-stone-900 text-[15px]">คำขอลารออนุมัติ ({pending.length})</h2>
              </div>
              <div className="divide-y divide-stone-100 max-h-[600px] overflow-y-auto custom-scrollbar">
                {pending.length === 0 ? (
                  <div className="py-20 text-center text-[13.5px] text-stone-400 italic">ไม่มีคำขอลารออนุมัติ</div>
                ) : pending.map((req) => (
                  <button
                    key={req.id}
                    onClick={() => setSelectedReq(req)}
                    className={`w-full text-left px-5 py-4 hover:bg-stone-50 transition-colors flex items-start gap-4 ${selectedReq?.id === req.id ? 'bg-stone-50' : ''}`}
                  >
                    <Avatar name={req.employee_name_th || '??'} size={36} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-[14px] text-stone-900 truncate">{req.employee_name_th}</span>
                        <span className="text-[11px] font-mono text-stone-400">{req.request_number}</span>
                      </div>
                      <div className="text-[12.5px] text-indigo-600 font-medium mt-0.5">{req.leave_type_name_th} · {req.days_requested} วัน</div>
                      <div className="text-[12px] text-stone-500 mt-0.5">{formatDate(req.start_date, lang)} – {formatDate(req.end_date, lang)}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Selection Detail Card (shows when a request is selected) */}
            {selectedReq && (
              <div className="bg-stone-900 text-white rounded-[10px] shadow-xl p-6 space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-[16px]">รายละเอียดคำขอ</h3>
                  <button onClick={() => setSelectedReq(null)} className="text-stone-400 hover:text-white">✕</button>
                </div>
                <div className="space-y-3 border-y border-stone-800 py-4">
                  <div className="flex justify-between text-[13px]">
                    <span className="text-stone-400">พนักงาน</span>
                    <span>{selectedReq.employee_name_th}</span>
                  </div>
                  <div className="flex justify-between text-[13px]">
                    <span className="text-stone-400">ประเภท</span>
                    <span>{selectedReq.leave_type_name_th}</span>
                  </div>
                  <div className="flex justify-between text-[13px]">
                    <span className="text-stone-400">ระยะเวลา</span>
                    <span>{formatDate(selectedReq.start_date, lang)} - {formatDate(selectedReq.end_date, lang)}</span>
                  </div>
                  <div className="flex justify-between text-[13px]">
                    <span className="text-stone-400">จำนวนวัน</span>
                    <span className="text-amber-400 font-bold">{selectedReq.days_requested} วัน</span>
                  </div>
                  {selectedReq.notes && (
                    <div className="text-[13px]">
                      <div className="text-stone-400 mb-1">เหตุผล:</div>
                      <p className="bg-stone-800 p-2 rounded text-stone-300 italic">&quot;{selectedReq.notes}&quot;</p>
                    </div>
                  )}
                </div>
                {canApprove && (
                  <div className="flex gap-2 pt-2">
                    <button
                      onClick={() => handleAction(selectedReq.id, 'reject', 'ไม่อนุมัติโดยผู้บริหาร')}
                      className="flex-1 h-9 rounded-md bg-stone-800 hover:bg-red-900 text-stone-300 hover:text-white text-[13px] font-medium transition-colors"
                    >
                      ปฏิเสธ
                    </button>
                    <button
                      onClick={() => handleAction(selectedReq.id, 'approve')}
                      className="flex-2 h-9 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white text-[13px] font-bold px-8 transition-colors"
                    >
                      อนุมัติใบลา
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right Column: Calendar */}
          <div className="lg:col-span-7 bg-white border border-stone-200 rounded-[10px] shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-stone-100 flex items-center justify-between bg-stone-50/50">
              <div className="flex items-center gap-3">
                <h2 className="font-semibold text-stone-900 text-[15px]">ปฏิทินทีม</h2>
                <div className="flex items-center bg-white border border-stone-200 rounded-md overflow-hidden">
                  <button onClick={prevMonth} className="p-1 hover:bg-stone-50 border-r border-stone-100 text-stone-400">‹</button>
                  <span className="px-3 text-[12px] font-bold text-stone-700 min-w-[100px] text-center">
                    {monthNames[parseInt(month.split('-')[1]) - 1]} {parseInt(month.split('-')[0]) + 543}
                  </span>
                  <button onClick={nextMonth} className="p-1 hover:bg-stone-50 border-l border-stone-100 text-stone-400">›</button>
                </div>
              </div>
              <div className="flex gap-2">
                {['ลาป่วย', 'ลาพักร้อน'].map(t => (
                  <div key={t} className="flex items-center gap-1.5">
                    <div className={`w-2 h-2 rounded-full ${t === 'ลาป่วย' ? 'bg-red-500' : 'bg-emerald-500'}`} />
                    <span className="text-[11px] text-stone-500">{t}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="overflow-x-auto pb-4 custom-scrollbar">
              {calendar ? (
                <div className="min-w-fit border-l border-t border-stone-200 mt-4 mx-5">
                  {/* Header row with day numbers */}
                  <div className="grid" style={{ gridTemplateColumns: `170px repeat(${calendar.month_days}, 30px)` }}>
                    <div className="px-3 py-2 border-r border-b border-stone-200 bg-stone-50 text-[10.5px] font-semibold text-stone-400 uppercase tracking-wider flex items-center">พนักงาน</div>
                    {Array.from({ length: calendar.month_days }).map((_, i) => {
                      const day = i + 1;
                      const dow = (calendar.first_weekday + i) % 7;
                      const we = dow === 0 || dow === 6;
                      const isToday = new Date().toISOString().slice(0, 7) === month && day === new Date().getDate();
                      const weekdayLabels = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];
                      return (
                        <div key={day} className={'border-r border-b border-stone-200 px-1 py-1 text-center ' + (we ? 'bg-stone-100/70' : 'bg-stone-50') + (isToday ? ' bg-amber-50' : '')}>
                          <div className={'text-[10px] font-medium ' + (isToday ? 'text-amber-700' : 'text-stone-400')}>{weekdayLabels[dow]}</div>
                          <div className={'text-[11.5px] font-mono tabular-nums ' + (isToday ? 'font-bold text-amber-900' : we ? 'text-stone-500' : 'text-stone-700')}>{day}</div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Body rows */}
                  {calendar.team.map((e) => {
                    const empLeaves = calendar.leaves.filter((l) => l.employee_id === e.employee_id);
                    return (
                      <div key={e.employee_id} className="grid relative" style={{ gridTemplateColumns: `170px repeat(${calendar.month_days}, 30px)`, height: '36px' }}>
                        <div className="px-3 flex items-center gap-2 border-r border-b border-stone-100 bg-white">
                          <Avatar name={e.name_th} size={22} />
                          <div className="min-w-0">
                            <div className="text-[12px] font-medium text-stone-900 truncate leading-tight">{e.name_th.split(' ')[0]}</div>
                            <div className="text-[9.5px] text-stone-400 truncate uppercase tracking-wider">{e.department_name_en}</div>
                          </div>
                        </div>
                        {Array.from({ length: calendar.month_days }).map((_, i) => {
                          const day = i + 1;
                          const dow = (calendar.first_weekday + i) % 7;
                          const we = dow === 0 || dow === 6;
                          const isToday = new Date().toISOString().slice(0, 7) === month && day === new Date().getDate();
                          return <div key={day} className={'border-r border-b border-stone-100 ' + (we ? 'bg-stone-50/70' : '') + (isToday ? ' bg-amber-50/40' : '')}></div>;
                        })}

                        {/* Overlaid leave bars */}
                        {empLeaves.map((lv, idx) => {
                          const left = 170 + (lv.from_day - 1) * 30 + 2;
                          const width = (lv.to_day - lv.from_day + 1) * 30 - 4;
                          return (
                            <div key={idx}
                              className="absolute top-1/2 -translate-y-1/2 rounded text-[10px] font-semibold text-white px-1.5 flex items-center shadow-sm"
                              style={{ left, width, height: 18, background: lv.color }}>
                              <span className="truncate">{lv.type}</span>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                  {calendar.team.length === 0 && (
                    <div className="py-8 text-center text-stone-400 text-[12px] italic border-b border-stone-100">
                      ไม่พบข้อมูลพนักงาน
                    </div>
                  )}
                </div>
              ) : (
                <div className="py-24 text-center text-[13.5px] text-stone-400">กำลังโหลดปฏิทิน...</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </DirectionalTransition>
  );
}

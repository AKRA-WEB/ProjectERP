'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { get } from '@/lib/api-client';
import { formatCurrency, formatDate } from '@/lib/utils';
import { useLanguage, useT } from '@/lib/i18n';
import { DirectionalTransition } from '@/components/ui/directional-transition';

// --- Shared Components ---

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

const STATUS_BADGE: Record<string, string> = {
  present: 'bg-green-50 text-green-700 border border-green-200',
  late: 'bg-amber-50 text-amber-700 border border-amber-200',
  on_leave: 'bg-blue-50 text-blue-700 border border-blue-200',
  absent: 'bg-red-50 text-red-700 border border-red-200',
};

const STATUS_LABEL_KEYS: Record<string, string> = {
  present: 'hr.attendance.status.present',
  late: 'hr.attendance.status.late',
  on_leave: 'hr.attendance.status.on_leave',
  absent: 'hr.attendance.status.absent',
};

function StatusBadge({ status, lateMinutes }: { status: string; lateMinutes: number }) {
  const t = useT();
  return (
    <span className={`px-2 py-0.5 rounded-full text-[10.5px] font-medium border ${STATUS_BADGE[status] ?? ''}`}>
      {t(STATUS_LABEL_KEYS[status] ?? status)}{status === 'late' && lateMinutes > 0 ? ` ${lateMinutes}${t('hr.attendance.minutes_suffix')}` : ''}
    </span>
  );
}

function KpiCard({ label, value, sub, accent = 'text-stone-900' }: { label: string; value: string | number; sub: string; accent?: string }) {
  return (
    <div className="flex-1 px-5 py-4 border-r border-stone-100 last:border-r-0">
      <div className="text-[11.5px] font-medium text-stone-500 uppercase tracking-wider">{label}</div>
      <div className={`text-[22px] font-bold mt-1 ${accent}`}>{value}</div>
      <div className="text-[11.5px] text-stone-400 mt-0.5">{sub}</div>
    </div>
  );
}

// --- Main Page ---

interface AttendanceFeedRow {
  employee_id: string;
  name_th: string;
  position: string;
  department_name_th: string;
  clock_in: string | null;
  clock_out: string | null;
  status: string;
  late_minutes: number;
  shift_label: string;
}

interface PendingLeaveRow {
  id: string;
  employee_name_th: string;
  leave_type_name_th: string;
  start_date: string;
  end_date: string;
  days_requested: number;
  is_urgent: boolean;
}

interface DeptHeadcountRow {
  department_id: string;
  name_th: string;
  count: number;
  color: string;
}

interface UpcomingEventRow {
  employee_id: string;
  name_th: string;
  event_date: string;
  kind: string;
  label: string;
  sub: string;
}

interface HRStats {
  totalEmployees: number;
  probationCount: number;
  resignedThisMonth: number;
  presentToday: number;
  lateCount: number;
  absentCount: number;
  onLeaveToday: number;
  pendingLeaveCount: number;
  latestPayrollNet: number | null;
  latestPayrollDate: string | null;
  attendanceFeed: AttendanceFeedRow[];
  pendingLeaveQueue: PendingLeaveRow[];
  headcountByDept: DeptHeadcountRow[];
  upcoming: UpcomingEventRow[];
}

export default function HrDashboardPage() {
  const { lang } = useLanguage();
  const t = useT();
  const [stats, setStats] = useState<HRStats | null>(null);
  const [loading, setLoading] = useState(true);
  const formattedDate = formatDate(new Date(), lang);

  useEffect(() => {
    get<HRStats>('/api/hr/stats').then(setStats).finally(() => setLoading(false));
  }, []);

  if (loading || !stats) {
    return (
      <div className="flex-1 p-8 text-stone-400 text-sm">{t('label.loading')}</div>
    );
  }

  const onTimeCount = stats.presentToday - stats.lateCount;

  return (
    <DirectionalTransition>
      <div className="max-w-[1440px] mx-auto pb-12 space-y-6">
        {/* Page Header */}
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-[26px] font-semibold tracking-tight text-stone-900">
              {t('page.hr_dashboard')} <span className="text-stone-400 font-normal">/ HR Dashboard</span>
            </h1>
            <p className="text-[13.5px] text-stone-500 mt-1">{formattedDate}</p>
          </div>
          <div className="flex gap-2">
            <button className="h-9 px-3.5 rounded-md text-[13px] font-medium text-stone-700 bg-white border border-stone-200 hover:bg-stone-50">
              {t('hr.dashboard.monthly_report')}
            </button>
            <Link href="/app/hr/employees/new" className="h-9 px-3.5 rounded-md text-[13px] font-medium text-white bg-stone-900 hover:bg-stone-800 inline-flex items-center gap-1.5">
              + {t('hr.dashboard.add_employee')}
            </Link>
          </div>
        </div>

        {/* KPI Strip */}
        <div className="flex bg-white border border-stone-200 rounded-[10px] shadow-sm overflow-hidden">
          <KpiCard
            label={t('hr.dashboard.kpi.total_employees')}
            value={stats.totalEmployees}
            sub={`${stats.probationCount} ${t('hr.dashboard.kpi.probation')} · ${stats.resignedThisMonth} ${t('hr.dashboard.kpi.resigned_month')}`}
          />
          <KpiCard
            label={t('hr.dashboard.kpi.present_today')}
            value={`${stats.presentToday} / ${stats.totalEmployees - stats.onLeaveToday}`}
            sub={`${t('hr.dashboard.kpi.on_time')} ${onTimeCount} · ${t('hr.attendance.status.late')} ${stats.lateCount}`}
          />
          <KpiCard
            label={t('hr.dashboard.kpi.pending_leave')}
            value={stats.pendingLeaveCount}
            sub={t('hr.dashboard.kpi.pending_leave_sub')}
            accent={stats.pendingLeaveCount > 0 ? 'text-amber-600' : 'text-stone-900'}
          />
          <KpiCard
            label={t('hr.dashboard.kpi.payroll_this_period')}
            value={stats.latestPayrollNet ? formatCurrency(stats.latestPayrollNet, lang) : '—'}
            sub={stats.latestPayrollDate ? `${t('hr.dashboard.kpi.payroll_period')} ${stats.latestPayrollDate}` : t('hr.dashboard.kpi.no_data')}
            accent="text-emerald-700"
          />
        </div>

        {/* Row 1 */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Attendance Feed Table */}
          <div className="lg:col-span-7 bg-white border border-stone-200 rounded-[10px] shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-stone-100 flex items-center justify-between">
              <h2 className="font-semibold text-stone-900 text-[15px]">{t('hr.dashboard.attendance_today')}</h2>
              <Link href="/app/hr/attendance" className="text-[12.5px] text-stone-500 hover:text-stone-900">{t('hr.dashboard.view_all')} →</Link>
            </div>
            <table className="w-full text-left border-collapse">
              <thead className="bg-stone-50 border-b border-stone-100">
                <tr className="text-[10.5px] font-semibold text-stone-500 uppercase tracking-wider">
                  <th className="px-4 py-2.5">{t('label.employee')}</th>
                  <th className="px-4 py-2.5">{t('label.department')}</th>
                  <th className="px-4 py-2.5">{t('hr.attendance.clock_in')}</th>
                  <th className="px-4 py-2.5">{t('hr.attendance.clock_out')}</th>
                  <th className="px-4 py-2.5">{t('label.status')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-50">
                {stats.attendanceFeed?.map((emp) => (
                  <tr key={emp.employee_id} className="hover:bg-stone-50/60 transition-colors">
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <Avatar name={emp.name_th} size={28} />
                        <div>
                          <div className="text-[13px] font-medium text-stone-900">{emp.name_th}</div>
                          <div className="text-[10.5px] text-stone-400">{emp.position}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-[12.5px] text-stone-600">{emp.department_name_th}</td>
                    <td className="px-4 py-2.5 font-mono text-[12.5px] text-stone-700">{emp.clock_in ?? '—'}</td>
                    <td className="px-4 py-2.5 font-mono text-[12.5px] text-stone-500">{emp.clock_out ?? '—'}</td>
                    <td className="px-4 py-2.5">
                      <StatusBadge status={emp.status} lateMinutes={emp.late_minutes} />
                    </td>
                  </tr>
                ))}
                {(!stats.attendanceFeed || stats.attendanceFeed.length === 0) && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-[13px] text-stone-400 italic">{t('hr.dashboard.no_attendance_today')}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pending Leave Queue */}
          <div className="lg:col-span-5 bg-white border border-stone-200 rounded-[10px] shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-stone-100 flex items-center justify-between">
              <h2 className="font-semibold text-stone-900 text-[15px]">{t('hr.dashboard.pending_leave_title')}</h2>
              <Link href="/app/hr/leave-requests" className="text-[12.5px] text-stone-500 hover:text-stone-900">{t('hr.dashboard.view_all')} →</Link>
            </div>
            <div className="divide-y divide-stone-100">
              {stats.pendingLeaveQueue?.map((req) => (
                <div key={req.id} className="px-5 py-3.5 hover:bg-stone-50 transition-colors">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-[13px] text-stone-900">{req.employee_name_th}</span>
                        {req.is_urgent && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-red-500 text-white uppercase">{t('hr.leave.urgent')}</span>
                        )}
                      </div>
                      <div className="text-[11.5px] text-stone-500 mt-0.5">{req.leave_type_name_th} · {req.days_requested} {t('hr.leave.days')}</div>
                      <div className="text-[11px] text-stone-400 font-mono mt-0.5">{req.start_date} – {req.end_date}</div>
                    </div>
                    <Link href="/app/hr/leave-requests" className="text-[11px] text-stone-400 hover:text-stone-900 underline">{t('hr.dashboard.review')}</Link>
                  </div>
                </div>
              ))}
              {(!stats.pendingLeaveQueue || stats.pendingLeaveQueue.length === 0) && (
                <div className="px-5 py-12 text-center text-[13px] text-stone-400 italic">{t('hr.dashboard.no_pending_leave')}</div>
              )}
            </div>
          </div>
        </div>

        {/* Row 2 */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Headcount Bar Chart */}
          <div className="lg:col-span-7 bg-white border border-stone-200 rounded-[10px] shadow-sm p-5">
            <h2 className="font-semibold text-stone-900 mb-4 text-[15px]">{t('hr.dashboard.headcount_by_dept')}</h2>
            <div className="space-y-3">
              {stats.headcountByDept?.map((d) => {
                const maxCount = Math.max(...(stats.headcountByDept?.map((x) => x.count) ?? [1]));
                const pct = maxCount > 0 ? (d.count / maxCount) * 100 : 0;
                return (
                  <div key={d.department_id} className="flex items-center gap-3">
                    <div className="w-32 text-[12.5px] text-stone-600 truncate text-right">{d.name_th}</div>
                    <div className="flex-1 h-6 bg-stone-100 rounded-md overflow-hidden">
                      <div className="h-full rounded-md transition-all duration-500" style={{ width: `${pct}%`, background: d.color }} />
                    </div>
                    <div className="w-8 text-[12.5px] font-mono text-stone-700 text-right">{d.count}</div>
                  </div>
                );
              })}
              {(!stats.headcountByDept || stats.headcountByDept.length === 0) && (
                <div className="py-12 text-center text-[13px] text-stone-400 italic">{t('hr.dashboard.no_employee_data')}</div>
              )}
            </div>
          </div>

          {/* Upcoming Events */}
          <div className="lg:col-span-5 bg-white border border-stone-200 rounded-[10px] shadow-sm p-5">
            <h2 className="font-semibold text-stone-900 mb-4 text-[15px]">{t('hr.dashboard.upcoming_events')}</h2>
            <div className="space-y-3">
              {(!stats.upcoming || stats.upcoming.length === 0) && (
                <p className="text-[12.5px] text-stone-400 italic py-12 text-center">{t('hr.dashboard.no_upcoming_events')}</p>
              )}
              {stats.upcoming?.map((ev) => (
                <div key={`${ev.employee_id}-${ev.kind}`} className="flex items-center gap-3 p-2 rounded-lg hover:bg-stone-50 transition-colors">
                  <div className="w-10 h-10 rounded-lg bg-stone-50 border border-stone-200 grid place-items-center text-lg shadow-sm">
                    {ev.kind === 'anniv' ? '🎂' : '🗓️'}
                  </div>
                  <div className="min-w-0">
                    <div className="text-[13px] font-medium text-stone-900 truncate">{ev.name_th}</div>
                    <div className="text-[11.5px] text-stone-500 truncate">{ev.label} · {ev.sub}</div>
                  </div>
                  <div className="ml-auto text-[11px] font-mono text-stone-400 whitespace-nowrap">{ev.event_date}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </DirectionalTransition>
  );
}

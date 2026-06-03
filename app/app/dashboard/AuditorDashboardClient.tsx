'use client';

import { useState, useEffect } from 'react';
import { ViewTransition } from '@/lib/react-vts';
import { useSession } from 'next-auth/react';
import { get } from '@/lib/api-client';
import { formatCurrency } from '@/lib/format';
import Link from 'next/link';
import { useT, useLanguage } from '@/lib/i18n';
import type { AuditorDashboardData } from '@/lib/queries/dashboard';

interface DashboardPeriod {
  status: string;
}

interface DashboardJournalEntry {
  id: string;
  entry_number: string;
  entry_date: string;
  description: string;
  entry_type: string;
  total_debit: number;
  status: string;
}

interface DashboardWhtResponse {
  total: number;
}

interface DashboardInvoice {
  outstanding_amount: number | string;
}

interface DashboardApResponse {
  invoices: DashboardInvoice[];
}

interface Props {
  initialData: AuditorDashboardData | null;
  session: { user?: unknown } | null;
}

export function AuditorDashboardClient({ initialData, session: serverSession }: Props) {
  const { data: clientSession } = useSession();
  const activeSession = clientSession ?? serverSession;

  const [stats, setStats] = useState<AuditorDashboardData | null>(initialData);
  const [loading, setLoading] = useState(initialData === null);
  const { lang } = useLanguage();
  const t = useT();

  useEffect(() => {
    if (initialData !== null) return;
    async function fetchAuditorStats() {
      try {
        const [periods, jeResponse, whtResponse, apResponse] = await Promise.all([
          get<DashboardPeriod[]>('/api/accounting/fiscal-periods'),
          get<{ data?: DashboardJournalEntry[] }>('/api/accounting/journal-entries?limit=5'),
          get<DashboardWhtResponse>('/api/ap/wht?limit=1'),
          get<DashboardApResponse>('/api/ap/invoices?is_paid=false'),
        ]);

        const activePeriods = periods.filter((p: DashboardPeriod) => p.status === 'open').length;
        const jeList = jeResponse?.data || [];
        const whtCount = whtResponse?.total ?? 0;
        const outstandingAp = apResponse?.invoices?.reduce(
          (sum: number, inv: DashboardInvoice) => sum + Number(inv.outstanding_amount), 0
        ) ?? 0;

        setStats({
          periodsCount: activePeriods,
          unpostedJeCount: jeList.filter((j: DashboardJournalEntry) => j.status === 'draft').length,
          postedJeCount: jeList.filter((j: DashboardJournalEntry) => j.status === 'posted').length,
          outstandingAp,
          whtCertificatesCount: whtCount,
          recentJe: jeList.slice(0, 5),
        });
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    fetchAuditorStats();
  }, [initialData]);

  const d = (v: unknown) => v === undefined || v === null ? '—' : String(v);
  const userName = (activeSession?.user as { name?: string } | undefined)?.name ?? '';

  return (
    <ViewTransition default="none" enter="fade-in" exit="fade-out">
      <div className="max-w-[1440px] mx-auto pb-12 space-y-8 animate-fade-in">
        {/* Premium Header Banner */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-stone-900 via-stone-800 to-stone-950 p-6 md:p-8 text-white shadow-md border border-stone-850">
          <div className="absolute right-0 top-0 -mt-4 -mr-4 w-56 h-56 rounded-full bg-stone-800/10 blur-xl pointer-events-none" />
          <div className="absolute left-1/3 bottom-0 -mb-8 w-44 h-44 rounded-full bg-stone-700/5 blur-lg pointer-events-none" />
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-stone-800 text-stone-300 text-[11px] font-semibold tracking-wider uppercase border border-stone-700/50">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Auditor Portal
              </div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
                {t('dashboard.auditor.welcome')}{userName ? `, ${userName}` : ''} 👋
              </h1>
              <p className="text-stone-300 text-sm max-w-xl font-normal leading-relaxed">
                {t('dashboard.auditor.role_access')} <strong className="text-emerald-400">{t('dashboard.auditor.role_name')}</strong>.{' '}
                {t('dashboard.auditor.role_access_detail')}
              </p>
            </div>
            <div className="shrink-0 flex flex-col items-start md:items-end justify-center font-mono text-xs text-stone-400 pl-4 md:pl-0 pr-4">
              <span className="text-stone-300 font-semibold">{t('dashboard.auditor.current_time')}</span>
              <span>{new Date().toLocaleString(lang === 'th' ? 'th-TH' : 'en-US', { dateStyle: 'medium', timeStyle: 'short' })}</span>
              <span className="mt-1 text-[10px] text-stone-500 uppercase tracking-widest">Secured Audit Session</span>
            </div>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              label: t('dashboard.auditor.kpi_periods_label'),
              value: loading ? "..." : d(stats?.periodsCount),
              desc: t('dashboard.auditor.kpi_periods_desc'),
              color: "text-emerald-600",
            },
            {
              label: t('dashboard.auditor.kpi_ap_label'),
              value: loading ? "..." : formatCurrency(stats?.outstandingAp ?? 0, lang),
              desc: t('dashboard.auditor.kpi_ap_desc'),
              color: "text-amber-600 font-mono",
            },
            {
              label: t('dashboard.auditor.kpi_wht_label'),
              value: loading ? "..." : d(stats?.whtCertificatesCount),
              desc: t('dashboard.auditor.kpi_wht_desc'),
              color: "text-blue-600",
            },
            {
              label: t('dashboard.auditor.kpi_je_label'),
              value: loading ? "..." : d(stats?.recentJe?.length),
              desc: t('dashboard.auditor.kpi_je_desc'),
              color: "text-purple-600",
            }
          ].map((k, i) => (
            <div key={i} className="bg-white border border-stone-200 rounded-xl p-5 shadow-sm hover:shadow-md hover:border-stone-300 transition-all flex flex-col justify-between">
              <div>
                <span className="text-xs font-semibold text-stone-500 uppercase tracking-wider">{k.label}</span>
                <div className={`text-2xl font-bold mt-2 ${k.color}`}>{k.value}</div>
              </div>
              <div className="text-xs text-stone-400 mt-2 font-normal">{k.desc}</div>
            </div>
          ))}
        </div>

        {/* Auditor Quick Links Grid */}
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-stone-900 flex items-center gap-2">
            <svg className="w-5 h-5 text-stone-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
            {t('dashboard.auditor.quick_links_heading')}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                title: t('dashboard.auditor.link_ledger_title'),
                desc: t('dashboard.auditor.link_ledger_desc'),
                href: "/app/accounting/audit/ledger",
                icon: "📖",
                tag: "Audit Route",
              },
              {
                title: t('dashboard.auditor.link_trial_balance_title'),
                desc: t('dashboard.auditor.link_trial_balance_desc'),
                href: "/app/accounting/audit/trial-balance",
                icon: "⚖️",
                tag: "Audit Route",
              },
              {
                title: t('dashboard.auditor.link_coa_title'),
                desc: t('dashboard.auditor.link_coa_desc'),
                href: "/app/accounting/chart-of-accounts",
                icon: "📊",
                tag: "Bilingual COA",
              },
              {
                title: t('dashboard.auditor.link_journal_title'),
                desc: t('dashboard.auditor.link_journal_desc'),
                href: "/app/accounting/journal-entries",
                icon: "📂",
                tag: "General Journal",
              },
              {
                title: t('dashboard.auditor.link_wht_title'),
                desc: t('dashboard.auditor.link_wht_desc'),
                href: "/app/ap/wht",
                icon: "🧾",
                tag: "WHT 50 Twi",
              },
              {
                title: t('dashboard.auditor.link_ap_aging_title'),
                desc: t('dashboard.auditor.link_ap_aging_desc'),
                href: "/app/ap/aging",
                icon: "⏳",
                tag: "AP Aging Log",
              }
            ].map((l, i) => (
              <Link key={i} href={l.href} className="group relative block bg-white border border-stone-200 hover:border-stone-400 rounded-2xl p-6 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all">
                <div className="flex items-start justify-between gap-4">
                  <div className="text-3xl shrink-0 p-2.5 rounded-xl bg-stone-50 group-hover:bg-stone-100 transition-colors">
                    {l.icon}
                  </div>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-[5px] bg-stone-100 text-stone-600 text-[10px] font-semibold uppercase font-mono tracking-wider">
                    {l.tag}
                  </span>
                </div>
                <h3 className="text-base font-bold text-stone-900 mt-4 group-hover:text-stone-950 transition-colors">
                  {l.title}
                </h3>
                <p className="text-xs text-stone-500 mt-2 font-normal leading-relaxed">
                  {l.desc}
                </p>
                <div className="flex items-center gap-1 text-xs font-semibold text-stone-900 mt-4 group-hover:underline">
                  {t('dashboard.auditor.access_portal')}
                  <svg className="w-3.5 h-3.5 transform group-hover:translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Recent Ledger Postings */}
        <div className="bg-white border border-stone-200 rounded-2xl p-6 shadow-sm space-y-4">
          <div>
            <h2 className="text-lg font-bold text-stone-900">{t('dashboard.auditor.recent_je_heading')}</h2>
            <p className="text-xs text-stone-500">{t('dashboard.auditor.recent_je_desc')}</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-stone-200 text-stone-500 font-semibold uppercase">
                  <th className="py-3 px-2">{t('dashboard.auditor.col_je_no')}</th>
                  <th className="py-3 px-2">{t('label.date')}</th>
                  <th className="py-3 px-2">{t('label.type')}</th>
                  <th className="py-3 px-2">{t('dashboard.auditor.col_description')}</th>
                  <th className="py-3 px-2 text-right">{t('dashboard.auditor.col_debit')}</th>
                  <th className="py-3 px-2">{t('label.status')}</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={6} className="py-6 text-center text-stone-400 italic">{t('msg.loading_data')}</td></tr>
                ) : stats?.recentJe?.length === 0 ? (
                  <tr><td colSpan={6} className="py-6 text-center text-stone-400 italic">{t('dashboard.auditor.no_je')}</td></tr>
                ) : stats?.recentJe?.map((je: DashboardJournalEntry) => (
                  <tr key={je.id} className="border-b border-stone-100 hover:bg-stone-50/50 transition-colors">
                    <td className="py-3 px-2 font-mono font-semibold text-stone-900">
                      <Link href={`/app/accounting/journal-entries/${je.id}`} className="hover:underline text-blue-600">
                        {je.entry_number}
                      </Link>
                    </td>
                    <td className="py-3 px-2 text-stone-600">{new Date(je.entry_date).toLocaleDateString('th-TH')}</td>
                    <td className="py-3 px-2 uppercase font-semibold text-stone-500">{je.entry_type}</td>
                    <td className="py-3 px-2 text-stone-600 max-w-sm truncate">{je.description}</td>
                    <td className="py-3 px-2 text-right font-mono font-semibold text-stone-900">{formatCurrency(je.total_debit)}</td>
                    <td className="py-3 px-2">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                        je.status === 'posted' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-stone-50 border-stone-200 text-stone-600'
                      }`}>
                        {je.status === 'posted' ? 'Posted' : je.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </ViewTransition>
  );
}

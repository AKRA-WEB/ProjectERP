'use client';

import { useState, useEffect, useCallback } from 'react';
import { get } from '@/lib/api-client';
import { formatDate } from '@/lib/format';
import type { PaginatedResponse } from '@/types';
import Link from 'next/link';
import { DirectionalTransition } from '@/components/ui/directional-transition';
import { useT, useLanguage } from '@/lib/i18n';

interface PR {
  id: string;
  pr_number: string;
  status: string;
  warehouse_name: string;
  warehouse_code: string;
  requested_by_name: string;
  line_count: number;
  created_at: string;
}

const CARD = 'bg-white border border-stone-200 rounded-[10px] shadow-[0_1px_0_rgba(15,23,42,.03),0_1px_2px_rgba(15,23,42,.04)]';

export default function PurchaseRequestsPage() {
  const [data, setData] = useState<PaginatedResponse<PR> | null>(null);
  const [page, setPage] = useState(1);
  const [tab, setTab] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const t = useT();
  const { lang } = useLanguage();

  const fetchPRs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '25' });
      if (search) params.set('search', search);
      if (tab) params.set('status', tab);
      setData(await get<PaginatedResponse<PR>>(`/api/purchase-requests?${params}`));
    } finally { setLoading(false); }
  }, [page, search, tab]);

  useEffect(() => { fetchPRs(); }, [fetchPRs]);

  const TABS = [
    { id: '',               label: t('label.all') },
    { id: 'draft',          label: t('status.draft') },
    { id: 'submitted',      label: t('status.submitted') },
    { id: 'manager_approved', label: t('status.manager_approved') },
    { id: 'admin_approved', label: t('status.admin_approved') },
    { id: 'converted_to_po', label: t('status.converted_to_po') },
    { id: 'received',       label: t('status.received') },
    { id: 'rejected',       label: t('status.rejected') },
  ];

  return (
    <DirectionalTransition>
      <div className="max-w-[1440px] mx-auto pb-12 space-y-5">

        {/* Header */}
        <div className="flex items-end justify-between gap-6 flex-wrap">
          <div>
            <h1 className="text-[26px] font-semibold tracking-tight text-stone-950 leading-tight mb-1">
              {t('page.purchase_requests')}
            </h1>
            <p className="text-[13.5px] text-stone-500">
              Purchase Requests · {loading ? '—' : (data?.total ?? 0).toLocaleString(lang === 'th' ? 'th-TH' : 'en-US')} {t('label.total').toLowerCase()}
            </p>
          </div>
          <Link
            href="/app/purchase-requests/new"
            transitionTypes={['nav-forward']}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-[7px] bg-stone-950 text-white text-[13px] font-medium shadow-sm hover:bg-stone-800 transition-colors"
          >
            + {t('action.create')}
          </Link>
        </div>

        {/* Tabs */}
        <div className="flex gap-0 border-b border-stone-200 overflow-x-auto">
          {TABS.map((t_tab) => (
            <button
              key={t_tab.id}
              onClick={() => { setTab(t_tab.id); setPage(1); }}
              className={`px-3.5 py-2.5 text-[13.5px] font-medium border-b-2 -mb-px transition-colors whitespace-nowrap ${
                tab === t_tab.id
                  ? 'text-stone-950 border-stone-950'
                  : 'text-stone-400 border-transparent hover:text-stone-700'
              }`}
            >
              {t_tab.label}
            </button>
          ))}
        </div>

        {/* Search bar */}
        <div className="flex items-center gap-2 w-full max-w-[280px] bg-stone-50 border border-stone-200 rounded-[8px] px-3 py-[6px] text-stone-400 text-[13px] focus-within:border-stone-300 focus-within:bg-white transition-colors">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="shrink-0">
            <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.4"/>
            <path d="M10 10l2.5 2.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
          </svg>
          <input
            placeholder={t('label.search_placeholder')}
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="flex-1 bg-transparent border-0 outline-none text-stone-700 placeholder:text-stone-400 text-[13px]"
          />
        </div>

        {/* Table card */}
        <div className={CARD}>
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr>
                {[
                  { h: t('label.code') + ' PR',     sm: false },
                  { h: t('label.warehouse'), sm: true },
                  { h: t('label.employee'),       sm: true },
                  { h: t('label.total'),     sm: true },
                  { h: t('label.status'),      sm: false },
                  { h: t('label.created_at'), sm: true },
                  { h: '',           sm: false },
                ].map(({ h, sm }, i) => (
                  <th key={i} className={`text-left py-2.5 px-3.5 text-[11.5px] font-medium tracking-[.04em] uppercase text-stone-400 bg-stone-50 border-y border-stone-200 first:pl-5 last:pr-5 ${sm ? 'hidden lg:table-cell' : ''} ${i === 3 ? 'text-center' : ''}`}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="py-12 text-center text-[13px] text-stone-400">{t('label.loading')}</td></tr>
              ) : data?.data.length === 0 ? (
                <tr><td colSpan={7} className="py-12 text-center text-[13px] text-stone-400">{t('label.no_data')}</td></tr>
              ) : data?.data.map((pr) => (
                <tr key={pr.id} className="border-b border-stone-50 last:border-0 hover:bg-stone-50/60 cursor-default transition-colors">
                  <td className="py-0 h-11 px-3.5 pl-5 font-mono text-[12.5px] font-medium text-stone-700">{pr.pr_number}</td>
                  <td className="py-0 h-11 px-3.5 text-stone-500 hidden lg:table-cell">{pr.warehouse_code}</td>
                  <td className="py-0 h-11 px-3.5 text-stone-700 hidden lg:table-cell">{pr.requested_by_name}</td>
                  <td className="py-0 h-11 px-3.5 text-center tabular-nums text-stone-500 hidden lg:table-cell">{pr.line_count}</td>
                  <td className="py-0 h-11 px-3.5">
                    <span className="inline-flex items-center gap-[5px] px-2 py-[2px] text-[11.5px] font-medium rounded-full border leading-[1.5] bg-white">
                      <span className="w-1.5 h-1.5 rounded-full bg-current" />
                      {t(`status.${pr.status}` as never) || pr.status}
                    </span>
                  </td>
                  <td className="py-0 h-11 px-3.5 text-stone-400 font-mono text-[12.5px] hidden lg:table-cell">{formatDate(pr.created_at, lang)}</td>
                  <td className="py-0 h-11 px-3.5 pr-5">
                    <Link href={`/app/purchase-requests/${pr.id}`} transitionTypes={['nav-forward']} className="text-stone-300 hover:text-emerald-600 transition-colors">
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M5 3l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {data && data.total_pages > 1 && (
          <div className="flex items-center justify-between text-[13px] text-stone-500">
            <span>{t('label.all')} {page} {t('label.select_placeholder')} {data.total_pages}</span>
            <div className="flex gap-1">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                className="h-8 px-3 rounded-[7px] border border-stone-200 bg-white hover:bg-stone-50 disabled:opacity-40 disabled:pointer-events-none">
                ← {t('action.back')}
              </button>
              <button onClick={() => setPage((p) => Math.min(data.total_pages, p + 1))} disabled={page === data.total_pages}
                className="h-8 px-3 rounded-[7px] border border-stone-200 bg-white hover:bg-stone-50 disabled:opacity-40 disabled:pointer-events-none">
                {t('action.submit')} →
              </button>
            </div>
          </div>
        )}
      </div>
    </DirectionalTransition>
  );
}

'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { useT } from '@/lib/i18n';

const CARD = 'bg-white border border-stone-200 rounded-[12px] shadow-sm hover:border-stone-400 transition-all p-6 cursor-pointer relative overflow-hidden';

export default function AccountingExportPage() {
  const t = useT();
  const { data: session } = useSession();
  const role = (session?.user as { role?: string } | undefined)?.role;

  const [format, setFormat] = useState<'express' | 'flowaccount' | 'peak'>('express');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [exporting, setExporting] = useState(false);

  const handleExport = () => {
    if (!fromDate || !toDate) {
      alert(t('msg.select_date_range'));
      return;
    }
    setExporting(true);
    
    // Redirect or open in new tab to trigger native browser file download
    const url = `/api/accounting/export?format=${format}&from=${fromDate}&to=${toDate}`;
    
    try {
      window.location.href = url;
    } catch (e) {
      console.error(e);
      alert(t('msg.export_failed'));
    } finally {
      setTimeout(() => setExporting(false), 2000);
    }
  };

  const isAuthorized = ['admin', 'auditor'].includes(role ?? '');

  if (!isAuthorized && role) {
    return (
      <div className="max-w-md mx-auto my-16 bg-white border border-red-200 rounded-2xl p-8 text-center space-y-4 shadow-sm">
        <div className="text-4xl text-red-500">🚫</div>
        <h1 className="text-xl font-bold text-stone-900">{t('error.unauthorized')}</h1>
        <p className="text-stone-500 text-sm">
          {t('msg.only_auditor_admin')}
        </p>
        <Link href="/app/dashboard" className="inline-flex h-9 px-4 rounded-lg bg-stone-900 text-white text-xs font-semibold items-center justify-center hover:bg-stone-850">
          {t('action.back')}
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-[1200px] mx-auto pb-12 space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-stone-200 pb-5">
        <div>
          <span className="text-xs font-semibold text-emerald-600 uppercase tracking-widest">Accounting Exporter</span>
          <h1 className="text-2xl font-bold text-stone-900 mt-1">{t('page.accounting_export')}</h1>
          <p className="text-stone-500 text-sm mt-0.5">
            {t('page.accounting_export_desc')}
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/app/accounting/export/jobs"
            className="h-8 px-4 rounded-lg text-xs font-semibold text-stone-600 bg-stone-50 border border-stone-200 hover:bg-stone-100 flex items-center gap-1.5 shadow-[0_1px_0_rgba(15,23,42,.03)]"
          >
            📋 {t('action.view_logs')}
          </Link>
          <Link
            href="/app/dashboard"
            className="h-8 px-3 rounded-lg text-xs font-semibold text-stone-600 bg-white border border-stone-200 hover:bg-stone-50 flex items-center gap-1 shadow-[0_1px_0_rgba(15,23,42,.03)]"
          >
            ← {t('page.dashboard')}
          </Link>
        </div>
      </div>

      {/* Step 1: Format Selection */}
      <div className="space-y-3">
        <h2 className="text-sm font-bold text-stone-900 uppercase tracking-wider">
          {t('page.step1_select_software')}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            {
              id: 'express',
              name: 'Express Accounting',
              desc: t('desc.express'),
              color: 'from-emerald-50 to-emerald-100/30 border-emerald-400 text-emerald-950',
              logo: '🟩',
            },
            {
              id: 'flowaccount',
              name: 'FlowAccount',
              desc: t('desc.flowaccount'),
              color: 'from-blue-50 to-blue-100/30 border-blue-400 text-blue-950',
              logo: '🟦',
            },
            {
              id: 'peak',
              name: 'PEAK Account',
              desc: t('desc.peak'),
              color: 'from-indigo-50 to-indigo-100/30 border-indigo-400 text-indigo-950',
              logo: '🟪',
            },
          ].map((item) => {
            const isSelected = format === item.id;
            return (
              <div
                key={item.id}
                onClick={() => setFormat(item.id as 'express' | 'flowaccount' | 'peak')}
                className={`${CARD} ${
                  isSelected
                    ? `border-2 bg-gradient-to-br ${item.color} shadow-sm scale-[1.01]`
                    : 'bg-white hover:bg-stone-50/50'
                }`}
              >
                {isSelected && (
                  <div className="absolute top-3 right-3 w-4 h-4 rounded-full bg-stone-950 text-white flex items-center justify-center text-[10px] font-bold">
                    ✓
                  </div>
                )}
                <div className="text-3xl mb-4">{item.logo}</div>
                <h3 className="text-base font-bold text-stone-900">{item.name}</h3>
                <p className="text-xs text-stone-500 mt-2 font-normal leading-relaxed">{item.desc}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Step 2: Date Filters & Export Button */}
      <div className="bg-stone-50 border border-stone-200 rounded-2xl p-6 md:p-8 space-y-6">
        <h2 className="text-sm font-bold text-stone-900 uppercase tracking-wider">
          {t('page.step2_choose_range')}
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-xs font-bold text-stone-600 uppercase mb-2">{t('label.from_date')}</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-full h-10 rounded-lg border border-stone-200 bg-white px-3.5 text-sm text-stone-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-400/30 focus:border-emerald-400"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-stone-600 uppercase mb-2">{t('label.to_date')}</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="w-full h-10 rounded-lg border border-stone-200 bg-white px-3.5 text-sm text-stone-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-400/30 focus:border-emerald-400"
            />
          </div>
        </div>

        <div className="pt-2 flex justify-end">
          <button
            onClick={handleExport}
            disabled={exporting}
            className="w-full md:w-auto h-11 px-8 rounded-xl bg-stone-950 text-white font-bold text-sm shadow-md hover:bg-stone-850 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
          >
            {exporting ? (
              <>
                <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                {t('msg.generating_export')}
              </>
            ) : (
              <>
                📥 {t('action.download_gl_file').replace('{format}', format.toUpperCase())}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

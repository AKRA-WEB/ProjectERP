'use client';

import { useState, useEffect, useCallback } from 'react';
import { get } from '@/lib/api-client';
import { formatCurrency } from '@/lib/format';
import type { FiscalPeriod } from '@/types';
import Link from 'next/link';
import { useT, useLanguage } from '@/lib/i18n';

interface TrialBalanceRow {
  account_code: string;
  account_name_th: string;
  account_name_en: string;
  account_type: string;
  normal_balance: 'debit' | 'credit';
  total_debit: number;
  total_credit: number;
  balance: number;
}

export default function AuditTrialBalancePage() {
  const t = useT();
  const { lang } = useLanguage();
  const [periods, setPeriods] = useState<FiscalPeriod[]>([]);
  const [rows, setRows] = useState<TrialBalanceRow[]>([]);
  const [loading, setLoading] = useState(false);

  // Filters
  const [periodId, setPeriodId] = useState('');
  const [asOf, setAsOf] = useState('');

  useEffect(() => {
    get<FiscalPeriod[]>('/api/accounting/fiscal-periods').then(setPeriods).catch(console.error);
  }, []);

  const fetchTrialBalance = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (periodId) {
        params.set('period_id', periodId);
      } else if (asOf) {
        params.set('as_of', asOf);
      }
      const data = await get<TrialBalanceRow[]>(`/api/accounting/audit/trial-balance?${params}`);
      setRows(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [periodId, asOf]);

  useEffect(() => {
    fetchTrialBalance();
  }, [fetchTrialBalance]);

  // Totals calculation
  const totalDebit = rows.reduce((sum, r) => sum + Number(r.total_debit), 0);
  const totalCredit = rows.reduce((sum, r) => sum + Number(r.total_credit), 0);
  const totalBalance = rows.reduce((sum, r) => sum + Number(r.balance), 0);

  return (
    <div className="max-w-[1440px] mx-auto pb-12 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-stone-200 pb-5">
        <div>
          <span className="text-xs font-semibold text-emerald-600 uppercase tracking-widest">{t('label.auditor_access')}</span>
          <h1 className="text-2xl font-bold text-stone-900 mt-1">{t('page.audit_trial_balance')}</h1>
          <p className="text-stone-500 text-sm mt-0.5">{t('page.audit_trial_balance_desc')}</p>
        </div>
        <Link href="/app/dashboard" className="h-8 px-3 rounded-lg text-xs font-medium text-stone-600 bg-stone-50 border border-stone-200 hover:bg-stone-100 flex items-center gap-1.5">
          ← {t('page.dashboard')}
        </Link>
      </div>

      {/* Filter panel */}
      <div className="bg-white border border-stone-200 rounded-xl p-5 shadow-sm grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
        <div>
          <label className="block text-xs font-bold text-stone-600 uppercase mb-1.5">{t('label.fiscal_period')}</label>
          <select
            value={periodId}
            onChange={(e) => {
              setPeriodId(e.target.value);
              setAsOf(''); // Clear mutual exclusive
            }}
            className="w-full h-9 rounded-lg border border-stone-200 bg-white px-3 text-xs text-stone-700 focus:outline-none focus:ring-2 focus:ring-emerald-400/20"
          >
            <option value="">{t('label.all_periods_or_date')}</option>
            {periods.map((p) => (
              <option key={p.id} value={p.id}>{p.year}/{String(p.month).padStart(2, '0')} — {lang === 'th' ? p.name_th : (p.name_en || p.name_th)}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-bold text-stone-600 uppercase mb-1.5">{t('label.as_of_date')}</label>
          <input
            type="date"
            value={asOf}
            onChange={(e) => {
              setAsOf(e.target.value);
              setPeriodId(''); // Clear mutual exclusive
            }}
            className="w-full h-9 rounded-lg border border-stone-200 bg-white px-3 text-xs text-stone-700 focus:outline-none focus:ring-2 focus:ring-emerald-400/20"
          />
        </div>
      </div>

      {/* Trial Balance Table */}
      <div className="bg-white border border-stone-200 rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-stone-200 text-stone-600 bg-stone-50/70 font-semibold">
              <th className="py-3 px-5">{t('label.account_code')}</th>
              <th className="py-3 px-5">{t('label.account_name')}</th>
              <th className="py-3 px-5 uppercase text-stone-500 font-bold">{t('label.type')}</th>
              <th className="py-3 px-5 text-right">{t('label.total_debit')}</th>
              <th className="py-3 px-5 text-right">{t('label.total_credit')}</th>
              <th className="py-3 px-5 text-right">{t('label.balance')}</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="py-12 text-center text-stone-400 italic">{t('msg.calculating_trial_balance')}</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={6} className="py-12 text-center text-stone-400 italic">{t('msg.no_records')}</td></tr>
            ) : (
              <>
                {rows.map((row) => (
                  <tr key={row.account_code} className="border-b border-stone-100 hover:bg-stone-50/30 transition-colors">
                    <td className="py-3 px-5 font-mono font-bold text-stone-900">{row.account_code}</td>
                    <td className="py-3 px-5">
                      <div className="font-semibold text-stone-850">
                        {lang === 'th' ? row.account_name_th : (row.account_name_en || row.account_name_th)}
                      </div>
                      {row.account_name_en && (
                        <div className="text-[10px] text-stone-500 font-mono">
                          {lang === 'th' ? row.account_name_en : row.account_name_th}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-5 uppercase text-[10px] font-bold text-stone-400">{row.account_type}</td>
                    <td className="py-3 px-5 text-right font-mono text-stone-900 font-medium">
                      {row.total_debit > 0 ? formatCurrency(row.total_debit, lang) : '—'}
                    </td>
                    <td className="py-3 px-5 text-right font-mono text-emerald-700 font-medium">
                      {row.total_credit > 0 ? formatCurrency(row.total_credit, lang) : '—'}
                    </td>
                    <td className="py-3 px-5 text-right font-mono font-bold text-stone-900">
                      {formatCurrency(row.balance, lang)}
                      <span className="text-[9px] text-stone-400 font-semibold ml-1 uppercase">
                        ({row.normal_balance === 'debit' ? 'Dr' : 'Cr'})
                      </span>
                    </td>
                  </tr>
                ))}
                {/* Grand Total Row */}
                <tr className="bg-stone-950 text-white font-bold border-t-2 border-stone-800 text-xs">
                  <td colSpan={3} className="py-3.5 px-5 text-right">{t('label.totals')}:</td>
                  <td className="py-3.5 px-5 text-right font-mono">{formatCurrency(totalDebit, lang)}</td>
                  <td className="py-3.5 px-5 text-right font-mono text-emerald-300">{formatCurrency(totalCredit, lang)}</td>
                  <td className="py-3.5 px-5 text-right font-mono">{formatCurrency(totalBalance, lang)}</td>
                </tr>
              </>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

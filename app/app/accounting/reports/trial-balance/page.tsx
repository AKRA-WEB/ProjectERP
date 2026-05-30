'use client';

import { useState, useEffect, useCallback } from 'react';
import { get } from '@/lib/api-client';
import { Button } from '@/components/ui/Button';
import { Table } from '@/components/ui/Table';
import { Select } from '@/components/ui/Select';
import { formatCurrency } from '@/lib/format';
import { useLanguage, useT } from '@/lib/i18n';
import type { TrialBalanceRow, FiscalPeriod } from '@/types';

const CARD = 'bg-white border border-stone-200 rounded-[10px] shadow-sm overflow-hidden';

export default function TrialBalancePage() {
  const t = useT();
  const { lang } = useLanguage();
  const [periods, setPeriods] = useState<FiscalPeriod[]>([]);
  const [periodId, setPeriodId] = useState('');
  const [data, setData] = useState<TrialBalanceRow[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchReport = useCallback(async () => {
    if (!periodId) return;
    setLoading(true);
    try {
      const res = await get<TrialBalanceRow[]>(`/api/accounting/reports/trial-balance?period_id=${periodId}`);
      setData(res);
    } catch (error) {
      console.error('Failed to fetch trial balance:', error);
    } finally {
      setLoading(false);
    }
  }, [periodId]);

  useEffect(() => {
    get<FiscalPeriod[]>('/api/accounting/fiscal-periods').then(res => {
      setPeriods(res);
      if (res.length > 0) setPeriodId(res[0].id);
    }).catch(console.error);
  }, []);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const totals = data.reduce((acc, row) => ({
    debit: acc.debit + row.total_debit,
    credit: acc.credit + row.total_credit,
  }), { debit: 0, credit: 0 });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-stone-900">{t('page.trial_balance_title')}</h1>
          <p className="text-stone-500 text-sm">{t('page.trial_balance_subtitle')}</p>
        </div>
        <div className="flex gap-2">
           <Button variant="outline" onClick={() => window.print()}>{t('action.print_report')}</Button>
        </div>
      </div>

      <div className={`${CARD} p-4 flex gap-4 items-end no-print`}>
        <div className="w-64">
          <Select
            label={t('label.fiscal_period')}
            value={periodId}
            onChange={(e) => setPeriodId(e.target.value)}
          >
            {periods.map(p => (
              <option key={p.id} value={p.id}>{lang === 'th' ? p.name_th : (p.name_en || p.name_th)}</option>
            ))}
          </Select>
        </div>
      </div>

      <div className={CARD}>
        <Table
          loading={loading}
          headers={[
            t('label.account_code'),
            t('label.account_name'),
            t('label.debit'),
            t('label.credit'),
            t('label.balance'),
          ]}
        >
          {data.map((row) => (
            <tr key={row.account_code} className="hover:bg-stone-50 transition-colors text-sm">
              <td className="px-6 py-3 font-mono font-bold text-stone-900">{row.account_code}</td>
              <td className="px-6 py-3 text-stone-700">
                {lang === 'th' ? row.account_name_th : (row.account_name_en || row.account_name_th)}
              </td>
              <td className="px-6 py-3 text-right font-mono">{row.total_debit > 0 ? formatCurrency(row.total_debit, lang) : '-'}</td>
              <td className="px-6 py-3 text-right font-mono">{row.total_credit > 0 ? formatCurrency(row.total_credit, lang) : '-'}</td>
              <td className="px-6 py-3 text-right font-mono font-bold text-stone-900">{formatCurrency(row.balance, lang)}</td>
            </tr>
          ))}
          {!loading && data.length > 0 && (
            <tr className="bg-stone-900 text-white font-bold">
              <td colSpan={2} className="px-6 py-4 text-right uppercase tracking-widest text-[11px] text-stone-600">Total Balance</td>
              <td className="px-6 py-4 text-right font-mono">{formatCurrency(totals.debit, lang)}</td>
              <td className="px-6 py-4 text-right font-mono">{formatCurrency(totals.credit, lang)}</td>
              <td className="px-6 py-4 text-right font-mono text-emerald-400">
                {Math.abs(totals.debit - totals.credit) < 0.01 ? '✓ Balanced' : '✗ Unbalanced'}
              </td>
            </tr>
          )}
          {data.length === 0 && !loading && (
            <tr><td colSpan={5} className="px-6 py-12 text-center text-stone-400 italic">{t('msg.no_transactions_in_period')}</td></tr>
          )}
        </Table>
      </div>
    </div>
  );
}

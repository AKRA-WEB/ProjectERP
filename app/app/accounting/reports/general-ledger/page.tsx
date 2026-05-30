'use client';

import { useState, useEffect, useCallback } from 'react';
import { get } from '@/lib/api-client';
import { formatCurrency, formatDate } from '@/lib/format';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Table } from '@/components/ui/Table';
import type { Account, GeneralLedgerRow } from '@/types';
import { useT, useLanguage } from '@/lib/i18n';

const CARD = 'bg-white border border-stone-200 rounded-[10px] shadow-sm overflow-hidden';

export default function GeneralLedgerPage() {
  const t = useT();
  const { lang } = useLanguage();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [accountId, setAccountId] = useState('');
  const [fromDate, setFromDate] = useState(new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0]);
  const [toDate, setToDate] = useState(new Date().toISOString().split('T')[0]);
  
  const [data, setData] = useState<{ opening_balance: number; lines: GeneralLedgerRow[]; closing_balance: number } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    get<Account[]>('/api/accounting/accounts?is_active=true')
      .then(res => setAccounts(res.filter(a => a.allows_direct_posting)))
      .catch(console.error);
  }, []);

  const fetchReport = useCallback(async () => {
    if (!accountId) return;
    setLoading(true);
    try {
      const res = await get<{ opening_balance: number; lines: GeneralLedgerRow[]; closing_balance: number }>(
        `/api/accounting/reports/general-ledger?account_id=${accountId}&from_date=${fromDate}&to_date=${toDate}`
      );
      setData(res);
    } catch (error) {
      console.error('Failed to fetch GL:', error);
    } finally {
      setLoading(false);
    }
  }, [accountId, fromDate, toDate]);

  useEffect(() => {
    if (accountId) fetchReport();
  }, [fetchReport, accountId]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-stone-900">{t('page.general_ledger_title')}</h1>
          <p className="text-stone-500 text-sm">{t('page.general_ledger_subtitle')}</p>
        </div>
        <div className="flex gap-2">
           <Button variant="outline" onClick={() => window.print()}>{t('action.print_report')}</Button>
        </div>
      </div>

      <div className={`${CARD} p-4 flex gap-4 items-end no-print`}>
        <div className="flex-1">
          <Select
            label={t('label.select_account_label')}
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
          >
            <option value="">{t('placeholder.select_account')}</option>
            {accounts.map(a => (
              <option key={a.id} value={a.id}>{a.account_code} - {lang === 'th' ? a.name_th : (a.name_en || a.name_th)}</option>
            ))}
          </Select>
        </div>
        <div className="w-48">
          <Input label={t('label.from')} type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} />
        </div>
        <div className="w-48">
          <Input label={t('label.to')} type="date" value={toDate} onChange={e => setToDate(e.target.value)} />
        </div>
        <Button onClick={fetchReport} loading={loading} disabled={!accountId}>{t('action.show_report')}</Button>
      </div>

      {accountId && data ? (
        <div className={CARD}>
          <Table
            loading={loading}
            headers={[
              t('label.date'),
              t('label.ref'),
              t('label.description'),
              t('label.debit'),
              t('label.credit'),
              t('label.balance'),
            ]}
          >
            <tr className="bg-stone-50/50 italic text-stone-500">
               <td className="px-6 py-3" colSpan={5}>{t('label.opening_balance')}</td>
               <td className="px-6 py-3 text-right font-mono font-bold">{formatCurrency(data.opening_balance, lang)}</td>
            </tr>
            {data.lines.map((l, i) => (
              <tr key={i} className="hover:bg-stone-50 transition-colors text-sm border-b border-stone-50 last:border-0">
                <td className="px-6 py-3 whitespace-nowrap">{formatDate(l.entry_date, lang)}</td>
                <td className="px-6 py-3 font-mono font-bold text-blue-600">{l.entry_number}</td>
                <td className="px-6 py-3">{l.description}</td>
                <td className="px-6 py-3 text-right font-mono">{l.debit_amount > 0 ? formatCurrency(l.debit_amount, lang) : '-'}</td>
                <td className="px-6 py-3 text-right font-mono">{l.credit_amount > 0 ? formatCurrency(l.credit_amount, lang) : '-'}</td>
                <td className="px-6 py-3 text-right font-mono font-bold text-stone-900">{formatCurrency(l.running_balance, lang)}</td>
              </tr>
            ))}
            <tr className="bg-stone-900 text-white font-bold">
               <td className="px-6 py-4" colSpan={5}>{t('label.closing_balance')}</td>
               <td className="px-6 py-4 text-right font-mono text-lg">{formatCurrency(data.closing_balance, lang)}</td>
            </tr>
          </Table>
        </div>
      ) : accountId ? null : (
        <div className="p-12 text-center text-stone-600 italic">{t('msg.select_account_to_view')}</div>
      )}
    </div>
  );
}

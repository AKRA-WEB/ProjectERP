'use client';

import { useState, useEffect } from 'react';
import { get } from '@/lib/api-client';
import { Table } from '@/components/ui/Table';
import { formatCurrency, formatDate } from '@/lib/format';
import type { ArAgingRow } from '@/types';
import { useT, useLanguage } from '@/lib/i18n';

const CARD = 'bg-white border border-stone-200 rounded-[10px] shadow-sm overflow-hidden';

export default function ArAgingPage() {
  const t = useT();
  const { lang } = useLanguage();
  const [data, setData] = useState<{ rows: ArAgingRow[], total: number } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    get<{ rows: ArAgingRow[], total: number }>('/api/accounting/reports/ar-aging')
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const bucketTotals = (data?.rows || []).reduce((acc: Record<string, number>, row) => {
    acc[row.bucket] = (acc[row.bucket] || 0) + row.total_amount;
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-stone-900">{t('page.ar_aging_title')}</h1>
        <p className="text-stone-500 text-sm">{t('page.ar_aging_subtitle')}</p>
      </div>

      <div className={CARD}>
        <Table
          loading={loading}
          headers={[
            t('label.customer'),
            t('label.ref'),
            t('label.due_date'),
            t('label.days_overdue'),
            t('label.amount'),
            t('label.bucket'),
          ]}
        >
          {data?.rows.map((row, i) => (
            <tr key={i} className="hover:bg-stone-50 transition-colors text-sm">
              <td className="px-6 py-4 font-medium text-stone-900">
                {lang === 'th' ? row.customer_name_th : (row.customer_name_en || row.customer_name_th)}
              </td>
              <td className="px-6 py-4 font-mono text-stone-500">{row.si_number}</td>
              <td className="px-6 py-4">{row.due_date ? formatDate(row.due_date, lang) : '-'}</td>
              <td className={`px-6 py-4 font-bold ${row.days_overdue > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                {row.days_overdue > 0 ? t('label.overdue_days').replace('{days}', String(row.days_overdue)) : t('label.not_due_yet')}
              </td>
              <td className="px-6 py-4 font-mono font-bold text-right">{formatCurrency(row.total_amount, lang)}</td>
              <td className="px-6 py-4 uppercase font-bold text-[10px] tracking-widest text-stone-600">{row.bucket}</td>
            </tr>
          ))}
          {!loading && data?.rows.length === 0 && (
            <tr><td colSpan={6} className="px-6 py-12 text-center text-stone-600 italic">{t('msg.no_ar_aging_records')}</td></tr>
          )}
        </Table>

        {data && data.rows.length > 0 && (
          <div className="p-6 bg-stone-50 border-t border-stone-100">
             <div className="grid grid-cols-5 gap-4">
                {['current', '1-30', '31-60', '61-90', '90+'].map(b => (
                   <div key={b} className="p-4 bg-white border border-stone-200 rounded-lg shadow-sm">
                      <p className="text-[10px] uppercase font-bold text-stone-600 mb-1">{b} days</p>
                      <p className="text-lg font-mono font-bold text-stone-900">{formatCurrency(bucketTotals[b] || 0, lang)}</p>
                   </div>
                ))}
             </div>
             <div className="mt-6 flex justify-end items-end gap-4">
                <span className="text-sm font-bold uppercase text-stone-500">{t('label.total_ar')}</span>
                <span className="text-3xl font-mono font-black text-emerald-600">{formatCurrency(data.total, lang)}</span>
             </div>
          </div>
        )}
      </div>
    </div>
  );
}

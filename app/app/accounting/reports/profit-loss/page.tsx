'use client';

import { useState, useEffect, useCallback } from 'react';
import { get } from '@/lib/api-client';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { formatCurrency, formatDate } from '@/lib/format';
import { useT, useLanguage } from '@/lib/i18n';

const CARD = 'bg-white border border-stone-200 rounded-[10px] shadow-sm overflow-hidden';

interface Item {
  code: string;
  name: string;
  amount: number;
}

interface Section {
  items: Item[];
  total: number;
}

interface ProfitLossData {
  revenue: Section;
  cogs: Section;
  gross_profit: number;
  expenses: Section;
  operating_income: number;
  tax: Section;
  net_income: number;
}

export default function ProfitLossPage() {
  const t = useT();
  const { lang } = useLanguage();
  const [fromDate, setFromDate] = useState(new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0]);
  const [toDate, setToDate] = useState(new Date().toISOString().split('T')[0]);
  const [data, setData] = useState<ProfitLossData | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    try {
      const res = await get<ProfitLossData>(`/api/accounting/reports/profit-loss?from_date=${fromDate}&to_date=${toDate}`);
      setData(res);
    } catch (error) {
      console.error('Failed to fetch P&L:', error);
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  if (loading && !data) return <div className="p-24 text-center"><LoadingSpinner /></div>;

  const Row = ({ name, amount, bold = false, indent = false }: { name: string, amount: number, bold?: boolean, indent?: boolean }) => (
    <div className={`flex justify-between py-2 text-sm ${bold ? 'font-bold text-stone-900 border-t border-stone-100 mt-2 pt-4' : 'text-stone-600'} ${indent ? 'pl-6' : ''}`}>
      <span>{name}</span>
      <span className="font-mono">{formatCurrency(amount, lang)}</span>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-stone-900">{t('page.profit_loss_title')}</h1>
          <p className="text-stone-500 text-sm">{t('page.profit_loss_subtitle')}</p>
        </div>
        <div className="flex gap-2">
           <Button variant="outline" onClick={() => window.print()}>{t('action.print_report')}</Button>
        </div>
      </div>

      <div className={`${CARD} p-4 flex gap-4 items-end no-print`}>
        <div className="w-48">
          <Input label={t('label.from')} type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} />
        </div>
        <div className="w-48">
          <Input label={t('label.to')} type="date" value={toDate} onChange={e => setToDate(e.target.value)} />
        </div>
        <Button onClick={fetchReport} loading={loading}>{t('action.view_report')}</Button>
      </div>

      {data && (
        <div className={`${CARD} p-8 space-y-8`}>
          <div className="text-center space-y-1">
             <h2 className="text-xl font-bold uppercase tracking-widest">Profit & Loss Statement</h2>
             <p className="text-stone-500 text-sm">{t('label.for_the_period').replace('{from}', formatDate(fromDate, lang)).replace('{to}', formatDate(toDate, lang))}</p>
          </div>

          <section>
            <h3 className="text-xs font-bold text-stone-600 uppercase tracking-widest mb-4">{t('label.revenue')}</h3>
            {data.revenue.items.map((item) => (
              <Row key={item.code} name={`${item.code} - ${item.name}`} amount={item.amount} indent />
            ))}
            <Row name={t('label.total_revenue')} amount={data.revenue.total} bold />
          </section>

          <section>
            <h3 className="text-xs font-bold text-stone-400 uppercase tracking-widest mb-4 border-t border-stone-200 pt-8">{t('label.cogs')}</h3>
            {data.cogs.items.map((item) => (
              <Row key={item.code} name={`${item.code} - ${item.name}`} amount={item.amount} indent />
            ))}
            <Row name={t('label.total_cogs')} amount={data.cogs.total} bold />
          </section>

          <section className="bg-emerald-50 p-4 rounded-lg">
            <div className="flex justify-between items-center font-bold text-emerald-900">
               <span className="uppercase tracking-widest">{t('label.gross_profit')}</span>
               <span className="text-2xl font-mono">{formatCurrency(data.gross_profit, lang)}</span>
            </div>
          </section>

          <section>
            <h3 className="text-xs font-bold text-stone-400 uppercase tracking-widest mb-4 border-t border-stone-200 pt-8">{t('label.operating_expenses')}</h3>
            {data.expenses.items.map((item) => (
              <Row key={item.code} name={`${item.code} - ${item.name}`} amount={item.amount} indent />
            ))}
            <Row name={t('label.total_expenses')} amount={data.expenses.total} bold />
          </section>

          <section className="border-t-2 border-stone-900 pt-8">
            <div className="flex justify-between items-center font-black text-stone-900">
               <span className="text-lg uppercase tracking-[0.2em]">{t('label.net_income')}</span>
               <span className={`text-4xl font-mono ${data.net_income >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                 {formatCurrency(data.net_income, lang)}
               </span>
            </div>
          </section>

          <section>
             <h3 className="text-xs font-bold text-stone-400 uppercase tracking-widest mb-4 border-t border-stone-200 pt-8">{t('label.tax')}</h3>
             {data.tax.items.map((item) => (
               <Row key={item.code} name={`${item.code} - ${item.name}`} amount={item.amount} indent />
             ))}
             <Row name={t('label.total_tax')} amount={data.tax.total} bold />
          </section>
        </div>
      )}
    </div>
  );
}

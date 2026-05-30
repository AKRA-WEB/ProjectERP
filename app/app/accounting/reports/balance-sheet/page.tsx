'use client';

import { useState, useEffect, useCallback } from 'react';
import { get } from '@/lib/api-client';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { formatCurrency } from '@/lib/format';
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

interface BalanceSheetData {
  as_of: string;
  assets: Section;
  liabilities: Section;
  equity: Section;
  is_balanced: boolean;
}

export default function BalanceSheetPage() {
  const t = useT();
  const { lang } = useLanguage();
  const [asOf, setAsOf] = useState(new Date().toISOString().split('T')[0]);
  const [data, setData] = useState<BalanceSheetData | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    try {
      const res = await get<BalanceSheetData>(`/api/accounting/reports/balance-sheet?as_of=${asOf}`);
      setData(res);
    } catch (error) {
      console.error('Failed to fetch balance sheet:', error);
    } finally {
      setLoading(false);
    }
  }, [asOf]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  if (loading && !data) return <div className="p-24 text-center"><LoadingSpinner /></div>;

  const Row = ({ name, amount, bold = false, indent = false }: { name: string, amount: number, bold?: boolean, indent?: boolean }) => (
    <div className={`flex justify-between py-2 text-sm ${bold ? 'font-bold text-stone-900 border-t border-stone-100 mt-2 pt-2' : 'text-stone-600'} ${indent ? 'pl-6' : ''}`}>
      <span>{name}</span>
      <span className="font-mono">{formatCurrency(amount, lang)}</span>
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-stone-900">{t('page.balance_sheet_title')}</h1>
          <p className="text-stone-500 text-sm">{t('page.balance_sheet_subtitle')}</p>
        </div>
        <div className="flex gap-2">
           <Button variant="outline" onClick={() => window.print()}>{t('action.print_report')}</Button>
        </div>
      </div>

      <div className={`${CARD} p-4 flex gap-4 items-end no-print`}>
        <div className="w-48">
          <Input label={t('label.as_of')} type="date" value={asOf} onChange={e => setAsOf(e.target.value)} />
        </div>
        <Button onClick={fetchReport} loading={loading}>{t('action.view_report')}</Button>
      </div>

      {data && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
           {/* Left Column: Assets */}
           <div className={`${CARD} p-8 space-y-8`}>
              <div>
                 <h3 className="text-xs font-bold text-emerald-600 uppercase tracking-[0.2em] mb-6 border-b border-emerald-100 pb-2">{t('label.assets')}</h3>
                 {data.assets.items.map((item) => (
                   <Row key={item.code} name={`${item.code} - ${item.name}`} amount={item.amount} indent />
                 ))}
                 <div className="mt-auto pt-8 border-t-2 border-stone-900">
                    <div className="flex justify-between items-end font-black text-stone-900">
                       <span className="text-sm uppercase">{t('label.total_assets')}</span>
                       <span className="text-2xl font-mono">{formatCurrency(data.assets.total, lang)}</span>
                    </div>
                 </div>
              </div>
           </div>

           {/* Right Column: Liabilities & Equity */}
           <div className="space-y-6">
              <div className={`${CARD} p-8 space-y-8`}>
                 <div>
                    <h3 className="text-xs font-bold text-blue-600 uppercase tracking-[0.2em] mb-6 border-b border-blue-100 pb-2">{t('label.liabilities')}</h3>
                    {data.liabilities.items.map((item) => (
                      <Row key={item.code} name={`${item.code} - ${item.name}`} amount={item.amount} indent />
                    ))}
                    <Row name={t('label.total_liabilities')} amount={data.liabilities.total} bold />
                 </div>

                 <div>
                    <h3 className="text-xs font-bold text-amber-600 uppercase tracking-[0.2em] mb-6 border-b border-amber-100 pb-2 mt-8">{t('label.equity_section')}</h3>
                    {data.equity.items.map((item) => (
                      <Row key={item.code} name={`${item.code} - ${item.name}`} amount={item.amount} indent />
                    ))}
                    <Row name={t('label.total_equity')} amount={data.equity.total} bold />
                 </div>

                 <div className="mt-auto pt-8 border-t-2 border-stone-900">
                    <div className="flex justify-between items-end font-black text-stone-900">
                       <span className="text-sm uppercase text-right leading-tight">{t('label.total_liabilities_equity')}</span>
                       <span className="text-2xl font-mono">{formatCurrency(data.liabilities.total + data.equity.total, lang)}</span>
                    </div>
                 </div>
              </div>

              {!data.is_balanced && (
                <div className="bg-red-50 border border-red-100 p-4 rounded-lg text-red-700 text-sm font-bold text-center">
                   {t('msg.unbalanced_warning')}
                </div>
              )}
           </div>
        </div>
      )}
    </div>
  );
}

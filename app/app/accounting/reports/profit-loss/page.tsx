'use client';

import { useState, useEffect, useCallback } from 'react';
import { get } from '@/lib/api-client';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { formatCurrency } from '@/lib/format';

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
      <span className="font-mono">{formatCurrency(amount)}</span>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-stone-900">งบกำไรขาดทุน / Profit & Loss</h1>
          <p className="text-stone-500 text-sm">รายงานรายได้และค่าใช้จ่ายตามช่วงเวลา</p>
        </div>
        <div className="flex gap-2">
           <Button variant="outline" onClick={() => window.print()}>พิมพ์รายงาน / Print</Button>
        </div>
      </div>

      <div className={`${CARD} p-4 flex gap-4 items-end no-print`}>
        <div className="w-48">
          <Input label="เริ่มจาก / From" type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} />
        </div>
        <div className="w-48">
          <Input label="ถึงวันที่ / To" type="date" value={toDate} onChange={e => setToDate(e.target.value)} />
        </div>
        <Button onClick={fetchReport} loading={loading}>แสดงรายงาน / View</Button>
      </div>

      {data && (
        <div className={`${CARD} p-8 space-y-8`}>
          <div className="text-center space-y-1">
             <h2 className="text-xl font-bold uppercase tracking-widest">Profit & Loss Statement</h2>
             <p className="text-stone-500 text-sm">For the period {new Date(fromDate).toLocaleDateString()} to {new Date(toDate).toLocaleDateString()}</p>
          </div>

          <section>
            <h3 className="text-xs font-bold text-stone-600 uppercase tracking-widest mb-4">รายได้ / Revenue</h3>
            {data.revenue.items.map((item) => (
              <Row key={item.code} name={`${item.code} - ${item.name}`} amount={item.amount} indent />
            ))}
            <Row name="รวมรายได้ / Total Revenue" amount={data.revenue.total} bold />
          </section>

          <section>
            <h3 className="text-xs font-bold text-stone-400 uppercase tracking-widest mb-4 border-t border-stone-200 pt-8">ต้นทุนขาย / COGS</h3>
            {data.cogs.items.map((item) => (
              <Row key={item.code} name={`${item.code} - ${item.name}`} amount={item.amount} indent />
            ))}
            <Row name="รวมต้นทุนขาย / Total COGS" amount={data.cogs.total} bold />
          </section>

          <section className="bg-emerald-50 p-4 rounded-lg">
            <div className="flex justify-between items-center font-bold text-emerald-900">
               <span className="uppercase tracking-widest">กำไรขั้นต้น / Gross Profit</span>
               <span className="text-2xl font-mono">{formatCurrency(data.gross_profit)}</span>
            </div>
          </section>

          <section>
            <h3 className="text-xs font-bold text-stone-400 uppercase tracking-widest mb-4 border-t border-stone-200 pt-8">ค่าใช้จ่าย / Operating Expenses</h3>
            {data.expenses.items.map((item) => (
              <Row key={item.code} name={`${item.code} - ${item.name}`} amount={item.amount} indent />
            ))}
            <Row name="รวมค่าใช้จ่าย / Total Expenses" amount={data.expenses.total} bold />
          </section>

          <section className="border-t-2 border-stone-900 pt-8">
            <div className="flex justify-between items-center font-black text-stone-900">
               <span className="text-lg uppercase tracking-[0.2em]">กำไร(ขาดทุน)สุทธิ / Net Income</span>
               <span className={`text-4xl font-mono ${data.net_income >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                 {formatCurrency(data.net_income)}
               </span>
            </div>
          </section>

          <section>
             <h3 className="text-xs font-bold text-stone-400 uppercase tracking-widest mb-4 border-t border-stone-200 pt-8">ภาษี / Tax</h3>
             {data.tax.items.map((item) => (
               <Row key={item.code} name={`${item.code} - ${item.name}`} amount={item.amount} indent />
             ))}
             <Row name="รวมภาษี / Total Tax" amount={data.tax.total} bold />
          </section>
        </div>
      )}
    </div>
  );
}

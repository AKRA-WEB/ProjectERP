'use client';

import { useState, useEffect } from 'react';
import { get } from '@/lib/api-client';
import { Table } from '@/components/ui/Table';
import { formatCurrency } from '@/lib/format';
import type { ArAgingRow } from '@/types';

const CARD = 'bg-white border border-stone-200 rounded-[10px] shadow-sm overflow-hidden';

export default function ArAgingPage() {
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
        <h1 className="text-2xl font-semibold text-stone-900">ลูกหนี้ค้างชำระ / AR Aging</h1>
        <p className="text-stone-500 text-sm">วิเคราะห์ยอดค้างชำระจากลูกค้าแบ่งตามช่วงเวลา</p>
      </div>

      <div className={CARD}>
        <Table
          loading={loading}
          headers={[
            'ลูกค้า / Customer',
            'เลขที่ / Ref',
            'วันที่ครบกำหนด / Due Date',
            'จำนวนวันเกินกำหนด / Days Overdue',
            'ยอดรวม / Amount',
            'ช่วงอายุ / Bucket',
          ]}
        >
          {data?.rows.map((row, i) => (
            <tr key={i} className="hover:bg-stone-50 transition-colors text-sm">
              <td className="px-6 py-4 font-medium text-stone-900">{row.customer_name_th}</td>
              <td className="px-6 py-4 font-mono text-stone-500">{row.si_number}</td>
              <td className="px-6 py-4">{new Date(row.due_date).toLocaleDateString('th-TH')}</td>
              <td className={`px-6 py-4 font-bold ${row.days_overdue > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                {row.days_overdue > 0 ? `เกินกำหนด ${row.days_overdue} วัน` : 'ยังไม่ครบกำหนด'}
              </td>
              <td className="px-6 py-4 font-mono font-bold text-right">{formatCurrency(row.total_amount)}</td>
              <td className="px-6 py-4 uppercase font-bold text-[10px] tracking-widest text-stone-600">{row.bucket}</td>
            </tr>
          ))}
          {!loading && data?.rows.length === 0 && (
            <tr><td colSpan={6} className="px-6 py-12 text-center text-stone-600 italic">ไม่มีลูกหนี้ค้างชำระในขณะนี้</td></tr>
          )}
        </Table>

        {data && data.rows.length > 0 && (
          <div className="p-6 bg-stone-50 border-t border-stone-100">
             <div className="grid grid-cols-5 gap-4">
                {['current', '1-30', '31-60', '61-90', '90+'].map(b => (
                   <div key={b} className="p-4 bg-white border border-stone-200 rounded-lg shadow-sm">
                      <p className="text-[10px] uppercase font-bold text-stone-600 mb-1">{b} days</p>
                      <p className="text-lg font-mono font-bold text-stone-900">{formatCurrency(bucketTotals[b] || 0)}</p>
                   </div>
                ))}
             </div>
             <div className="mt-6 flex justify-end items-end gap-4">
                <span className="text-sm font-bold uppercase text-stone-500">รวมลูกหนี้ทั้งหมด / Total AR:</span>
                <span className="text-3xl font-mono font-black text-emerald-600">{formatCurrency(data.total)}</span>
             </div>
          </div>
        )}
      </div>
    </div>
  );
}

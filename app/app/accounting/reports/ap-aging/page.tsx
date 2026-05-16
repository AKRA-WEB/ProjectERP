'use client';

import { useState, useEffect } from 'react';
import { get } from '@/lib/api-client';
import { Table } from '@/components/ui/Table';
import { formatCurrency } from '@/lib/format';
import type { ApAgingRow } from '@/types';

const CARD = 'bg-white border border-stone-200 rounded-[10px] shadow-sm overflow-hidden';

export default function ApAgingPage() {
  const [data, setData] = useState<{ rows: ApAgingRow[], total: number } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    get<{ rows: ApAgingRow[], total: number }>('/api/accounting/reports/ap-aging')
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const bucketTotals = (data?.rows || []).reduce((acc: Record<string, number>, row) => {
    if (row.bucket && row.amount) {
      acc[row.bucket] = (acc[row.bucket] || 0) + row.amount;
    }
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-stone-900">เจ้าหนี้ค้างชำระ / AP Aging</h1>
        <p className="text-stone-500 text-sm">วิเคราะห์ยอดค้างชำระให้ผู้จำหน่ายแบ่งตามช่วงเวลา</p>
      </div>

      <div className={CARD}>
        <Table
          loading={loading}
          headers={[
            'ผู้จำหน่าย / Vendor',
            'เลขที่ / Ref',
            'วันที่ครบกำหนด / Due Date',
            'จำนวนวันเกินกำหนด / Days Overdue',
            'ยอดรวม / Amount',
            'ช่วงอายุ / Bucket',
          ]}
        >
          {data?.rows.map((row, i) => (
            <tr key={i} className="hover:bg-stone-50 transition-colors text-sm">
              <td className="px-6 py-4 font-medium text-stone-900">{row.vendor_name_th}</td>
              <td className="px-6 py-4 font-mono text-stone-500">{row.invoice_number}</td>
              <td className="px-6 py-4">{row.due_date ? new Date(row.due_date).toLocaleDateString('th-TH') : '-'}</td>
              <td className={`px-6 py-4 font-bold ${(row.days_overdue ?? 0) > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                {(row.days_overdue ?? 0) > 0 ? `เกินกำหนด ${row.days_overdue} วัน` : 'ยังไม่ครบกำหนด'}
              </td>
              <td className="px-6 py-4 font-mono font-bold text-right">{formatCurrency(row.amount)}</td>
              <td className="px-6 py-4 uppercase font-bold text-[10px] tracking-widest text-stone-400">{row.bucket}</td>
            </tr>
          ))}
          {!loading && data?.rows.length === 0 && (
            <tr><td colSpan={6} className="px-6 py-12 text-center text-stone-400 italic">ไม่มีเจ้าหนี้ค้างชำระในขณะนี้</td></tr>
          )}
        </Table>

        {data && data.rows.length > 0 && (
          <div className="p-6 bg-stone-50 border-t border-stone-100">
             <div className="grid grid-cols-5 gap-4">
                {['current', '1-30', '31-60', '61-90', '90+'].map(b => (
                   <div key={b} className="p-4 bg-white border border-stone-200 rounded-lg shadow-sm">
                      <p className="text-[10px] uppercase font-bold text-stone-400 mb-1">{b} days</p>
                      <p className="text-lg font-mono font-bold text-stone-900">{formatCurrency(bucketTotals[b] || 0)}</p>
                   </div>
                ))}
             </div>
             <div className="mt-6 flex justify-end items-end gap-4">
                <span className="text-sm font-bold uppercase text-stone-500">รวมเจ้าหนี้ทั้งหมด / Total AP:</span>
                <span className="text-3xl font-mono font-black text-blue-600">{formatCurrency(data.total)}</span>
             </div>
          </div>
        )}
      </div>
    </div>
  );
}

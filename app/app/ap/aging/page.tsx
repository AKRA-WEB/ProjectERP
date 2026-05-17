'use client';

import { useState, useEffect, useCallback } from 'react';
import { get } from '@/lib/api-client';
import { formatCurrency } from '@/lib/format';
import type { ApAgingRow } from '@/types';
import Link from 'next/link';
import { DirectionalTransition } from '@/components/ui/directional-transition';

const CARD = 'bg-white border border-stone-200 rounded-[10px] shadow-[0_1px_0_rgba(15,23,42,.03),0_1px_2px_rgba(15,23,42,.04)]';

export default function ApAgingReportPage() {
  const [data, setData] = useState<ApAgingRow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAging = useCallback(async () => {
    setLoading(true);
    try {
      const res = await get<ApAgingRow[]>('/api/ap/aging');
      setData(res);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAging(); }, [fetchAging]);

  const totals = data.reduce((acc, row) => ({
    total_outstanding: acc.total_outstanding + Number(row.total_outstanding),
    current_amount: acc.current_amount + Number(row.current_amount),
    days_1_30: acc.days_1_30 + Number(row.days_1_30),
    days_31_60: acc.days_31_60 + Number(row.days_31_60),
    days_61_90: acc.days_61_90 + Number(row.days_61_90),
    days_over_90: acc.days_over_90 + Number(row.days_over_90),
    invoice_count: acc.invoice_count + Number(row.invoice_count),
  }), {
    total_outstanding: 0,
    current_amount: 0,
    days_1_30: 0,
    days_31_60: 0,
    days_61_90: 0,
    days_over_90: 0,
    invoice_count: 0,
  });

  return (
    <DirectionalTransition>
    <div className="max-w-[1440px] mx-auto pb-12 space-y-6">
      {/* Header */}
      <div className="flex items-end justify-between gap-6 flex-wrap">
        <div>
          <h1 className="text-[26px] font-semibold tracking-tight text-stone-950 leading-tight mb-1">
            รายงานอายุเจ้าหนี้ / AP Aging Report
          </h1>
          <p className="text-[13.5px] text-stone-500">
            สรุปยอดหนี้ค้างชำระแยกตามช่วงเวลา
          </p>
        </div>
      </div>

      {/* Summary Table */}
      <div className={CARD}>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr className="bg-stone-50 border-b border-stone-200">
                <th className="text-left py-3 px-4 font-medium text-stone-500 min-w-[200px]">ผู้จำหน่าย / Vendor</th>
                <th className="text-right py-3 px-4 font-medium text-stone-500">คงเหลือรวม</th>
                <th className="text-right py-3 px-4 font-medium text-stone-500">ยังไม่ถึงกำหนด</th>
                <th className="text-right py-3 px-4 font-medium text-stone-600 bg-amber-50/50">1-30 วัน</th>
                <th className="text-right py-3 px-4 font-medium text-amber-700 bg-amber-50">31-60 วัน</th>
                <th className="text-right py-3 px-4 font-medium text-orange-700 bg-orange-50">61-90 วัน</th>
                <th className="text-right py-3 px-4 font-medium text-red-700 bg-red-50">เกิน 90 วัน</th>
                <th className="text-center py-3 px-4 font-medium text-stone-500">จำนวนใบ</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="py-12 text-center text-stone-600">กำลังโหลด...</td></tr>
              ) : data.length === 0 ? (
                <tr><td colSpan={8} className="py-12 text-center text-stone-600">ไม่มีรายการค้างชำระ</td></tr>
              ) : data.map((row) => (
                <tr key={row.vendor_id} className="border-b border-stone-50 hover:bg-stone-50/60 transition-colors">
                  <td className="py-3 px-4">
                    <Link href={`/app/vendors/${row.vendor_id}`} className="font-medium text-stone-900 hover:text-blue-600 hover:underline">
                      {row.vendor_name_th}
                    </Link>
                    <div className="text-[11px] text-stone-600 font-mono">{row.vendor_code}</div>
                  </td>
                  <td className="py-3 px-4 text-right font-mono font-semibold text-stone-900">{formatCurrency(row.total_outstanding)}</td>
                  <td className="py-3 px-4 text-right font-mono text-stone-500">{formatCurrency(row.current_amount)}</td>
                  <td className="py-3 px-4 text-right font-mono text-stone-700 bg-amber-50/30">{formatCurrency(row.days_1_30)}</td>
                  <td className="py-3 px-4 text-right font-mono text-amber-700 bg-amber-50/50">{formatCurrency(row.days_31_60)}</td>
                  <td className="py-3 px-4 text-right font-mono text-orange-700 bg-orange-50/50">{formatCurrency(row.days_61_90)}</td>
                  <td className="py-3 px-4 text-right font-mono text-red-700 bg-red-50/50 font-medium">{formatCurrency(row.days_over_90)}</td>
                  <td className="py-3 px-4 text-center tabular-nums text-stone-500">{row.invoice_count}</td>
                </tr>
              ))}
            </tbody>
            {!loading && data.length > 0 && (
              <tfoot className="bg-stone-50 font-bold border-t-2 border-stone-200">
                <tr>
                  <td className="py-4 px-4 text-stone-900">รวมทั้งสิ้น</td>
                  <td className="py-4 px-4 text-right font-mono text-stone-900">{formatCurrency(totals.total_outstanding)}</td>
                  <td className="py-4 px-4 text-right font-mono text-stone-500">{formatCurrency(totals.current_amount)}</td>
                  <td className="py-4 px-4 text-right font-mono text-stone-700 bg-amber-50/30">{formatCurrency(totals.days_1_30)}</td>
                  <td className="py-4 px-4 text-right font-mono text-amber-700 bg-amber-50/50">{formatCurrency(totals.days_31_60)}</td>
                  <td className="py-4 px-4 text-right font-mono text-orange-700 bg-orange-50/50">{formatCurrency(totals.days_61_90)}</td>
                  <td className="py-4 px-4 text-right font-mono text-red-700 bg-red-50/50">{formatCurrency(totals.days_over_90)}</td>
                  <td className="py-4 px-4 text-center tabular-nums text-stone-900">{totals.invoice_count}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
    </DirectionalTransition>
  );
}

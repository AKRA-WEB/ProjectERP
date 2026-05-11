'use client';

import { useState, useEffect } from 'react';
import { get, patch } from '@/lib/api-client';
import { Button } from '@/components/ui/Button';
import { Table } from '@/components/ui/Table';
import { StatusBadge } from '@/components/ui/StatusBadge';
import Link from 'next/link';
import type { FiscalPeriod } from '@/types';

const CARD = 'bg-white border border-stone-200 rounded-[10px] shadow-sm overflow-hidden';

export default function FiscalPeriodsPage() {
  const [periods, setPeriods] = useState<FiscalPeriod[]>([]);
  const [loading, setLoading] = useState(true);
  const [actioning, setActioning] = useState<string | null>(null);

  useEffect(() => {
    fetchPeriods();
  }, []);

  async function fetchPeriods() {
    setLoading(true);
    try {
      const res = await get<FiscalPeriod[]>('/api/accounting/fiscal-periods');
      setPeriods(res);
    } catch (error) {
      console.error('Failed to fetch periods:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleAction(id: string, action: string) {
    if (!confirm(`Are you sure you want to ${action} this period?`)) return;
    setActioning(id);
    try {
      await patch(`/api/accounting/fiscal-periods/${id}`, { action });
      fetchPeriods();
    } catch (error) {
      alert(error instanceof Error ? error.message : `Failed to ${action}`);
    } finally {
      setActioning(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-stone-900">รอบบัญชี / Fiscal Periods</h1>
          <p className="text-stone-500 text-sm">จัดการสถานะเปิด/ปิดการบันทึกรายการรายเดือน</p>
        </div>
        <Link href="/app/accounting/fiscal-periods/new">
          <Button>+ สร้างรอบใหม่ / New Period</Button>
        </Link>
      </div>

      <div className={CARD}>
        <Table
          loading={loading}
          headers={[
            'ปี / Year',
            'เดือน / Month',
            'ชื่อรอบ / Period Name',
            'ช่วงเวลา / Dates',
            'สถานะ / Status',
            'จำนวนรายการ / Entries',
            '',
          ]}
        >
          {periods.map((p) => (
            <tr key={p.id} className="hover:bg-stone-50 transition-colors text-[13px]">
              <td className="px-5 py-4 font-bold text-stone-900">{p.year}</td>
              <td className="px-5 py-4 text-stone-600">{p.month}</td>
              <td className="px-5 py-4 font-medium text-stone-700">{p.name}</td>
              <td className="px-5 py-4 text-stone-500">
                {new Date(p.start_date).toLocaleDateString('th-TH')} - {new Date(p.end_date).toLocaleDateString('th-TH')}
              </td>
              <td className="px-5 py-4"><StatusBadge status={p.status} /></td>
              <td className="px-5 py-4 text-center font-mono font-bold text-blue-600">{p.entry_count}</td>
              <td className="px-5 py-4 text-right">
                <div className="flex justify-end gap-2">
                  {p.status === 'open' && (
                    <Button variant="outline" size="sm" onClick={() => handleAction(p.id, 'close')} loading={actioning === p.id} className="text-red-600 border-red-100 hover:bg-red-50">
                      ปิดรอบ / Close
                    </Button>
                  )}
                  {p.status === 'closed' && (
                    <>
                      <Button variant="outline" size="sm" onClick={() => handleAction(p.id, 'reopen')} loading={actioning === p.id}>
                        เปิดใหม่ / Reopen
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => handleAction(p.id, 'lock')} loading={actioning === p.id} className="text-red-600 bg-red-50">
                        ล็อก / Lock
                      </Button>
                    </>
                  )}
                </div>
              </td>
            </tr>
          ))}
          {periods.length === 0 && !loading && (
            <tr><td colSpan={7} className="px-5 py-12 text-center text-stone-400 italic">ยังไม่มีรอบบัญชีในระบบ</td></tr>
          )}
        </Table>
      </div>
    </div>
  );
}

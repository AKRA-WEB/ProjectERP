'use client';

/* eslint-disable local-rules/no-hardcoded-thai */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { get } from '@/lib/api-client';
import { formatCurrency, formatDatetime } from '@/lib/format';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { useSession } from 'next-auth/react';
import type { PosSession, SessionUser } from '@/types';

const CARD = 'bg-white border border-stone-200 rounded-[10px] shadow-sm overflow-hidden';

export default function ShiftReportPage() {
  const { data: authSession } = useSession();
  const currentUser = authSession?.user as unknown as SessionUser;

  const [sessions, setSessions] = useState<PosSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [fromDate, setFromDate] = useState(new Date().toISOString().split('T')[0]);
  const [toDate, setToDate] = useState(new Date().toISOString().split('T')[0]);

  const fetchSessions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await get<{ data: PosSession[] }>(`/api/pos/sessions?from=${fromDate}&to=${toDate}&limit=100`);
      setSessions(res.data);
    } catch (error) {
      console.error('Failed to fetch sessions:', error);
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const groupedSessions = useMemo(() => {
    return sessions.reduce((acc, s) => {
      const shiftName = s.shift_name_th || 'ไม่ระบุ / No Shift';
      if (!acc[shiftName]) acc[shiftName] = [];
      acc[shiftName].push(s);
      return acc;
    }, {} as Record<string, PosSession[]>);
  }, [sessions]);

  if (currentUser && !currentUser.permissions.includes('pos:view') && currentUser.role !== 'admin') {
    return <div className="text-center py-24 text-stone-400">ไม่มีสิทธิ์ / Forbidden</div>;
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-stone-900 tracking-tight">รายงานสรุปกะ / Shift Report</h1>
        <p className="text-sm text-stone-500 mt-1">สรุปยอดขายตามกะและรอบการขาย</p>
      </div>

      <div className={`${CARD} p-4 flex flex-col md:flex-row gap-4 items-end`}>
        <div className="flex-1 w-full">
          <Input
            label="ตั้งแต่วันที่"
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
          />
        </div>
        <div className="flex-1 w-full">
          <Input
            label="ถึงวันที่"
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
          />
        </div>
        <Button onClick={fetchSessions} loading={loading}>แสดงรายงาน</Button>
      </div>

      {loading ? (
        <div className="py-24 text-center"><LoadingSpinner /></div>
      ) : sessions.length === 0 ? (
        <div className={`${CARD} p-12 text-center text-stone-400`}>ไม่พบข้อมูลในช่วงเวลาที่เลือก</div>
      ) : (
        <div className="space-y-8 pb-12">
          {Object.entries(groupedSessions).map(([shiftName, shiftSessions]) => {
            const totalTxns = shiftSessions.reduce((sum, s) => sum + (s.transaction_count || 0), 0);
            const totalSales = shiftSessions.reduce((sum, s) => sum + (s.total_sales || 0), 0);
            
            return (
              <div key={shiftName} className="space-y-4">
                <div className="flex items-center justify-between border-b-2 border-stone-200 pb-2 px-1">
                  <h2 className="text-lg font-bold text-emerald-800">{shiftName}</h2>
                  <div className="flex gap-6 text-sm">
                    <span className="text-stone-500">จำนวนบิล: <span className="font-bold text-stone-900">{totalTxns}</span></span>
                    <span className="text-stone-500">ยอดรวมกะ: <span className="font-bold text-emerald-600 text-lg">{formatCurrency(totalSales)}</span></span>
                  </div>
                </div>

                <div className={`${CARD}`}>
                  <table className="w-full text-left">
                    <thead className="bg-stone-50 border-b border-stone-200 text-[11px] font-bold text-stone-400 uppercase tracking-wider">
                      <tr>
                        <th className="px-6 py-3">เลขที่รอบ / Session</th>
                        <th className="px-6 py-3">แคชเชียร์ / Cashier</th>
                        <th className="px-6 py-3">เปิด / Opened</th>
                        <th className="px-6 py-3">ปิด / Closed</th>
                        <th className="px-6 py-3 text-right">จำนวนบิล</th>
                        <th className="px-6 py-3 text-right">ยอดขาย</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {shiftSessions.map((s) => (
                        <tr key={s.id} className="hover:bg-stone-50/50 transition-colors text-sm">
                          <td className="px-6 py-4 font-mono font-bold text-stone-600">{s.session_number}</td>
                          <td className="px-6 py-4 font-medium">{s.opened_by_name}</td>
                          <td className="px-6 py-4 text-xs text-stone-500">{formatDatetime(s.opened_at)}</td>
                          <td className="px-6 py-4 text-xs text-stone-500">{s.closed_at ? formatDatetime(s.closed_at) : '-'}</td>
                          <td className="px-6 py-4 text-right font-mono">{s.transaction_count}</td>
                          <td className="px-6 py-4 text-right font-mono font-bold text-emerald-600">{formatCurrency(s.total_sales || 0)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

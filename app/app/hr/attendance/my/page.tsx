'use client';

import { useState, useEffect } from 'react';
import { get, post } from '@/lib/api-client';
import type { AttendanceRecord } from '@/types';
import { Button } from '@/components/ui';

const CARD = 'bg-white border border-stone-200 rounded-[10px] shadow-[0_1px_0_rgba(15,23,42,.03),0_1px_2px_rgba(15,23,42,.04)]';

export default function MyAttendancePage() {
  const [todayRecord, setTodayRecord] = useState<AttendanceRecord | null>(null);
  const [history, setHistory] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));

  async function fetchToday() {
    const res = await get<AttendanceRecord | null>('/api/hr/attendance/today');
    setTodayRecord(res);
  }

  async function fetchHistory() {
    const res = await get<AttendanceRecord[]>(`/api/hr/attendance?month=${month}`);
    setHistory(res);
  }

  useEffect(() => {
    async function init() {
      setLoading(true);
      await Promise.all([fetchToday(), fetchHistory()]);
      setLoading(false);
    }
    init();
  }, [month]);

  async function handleClockIn() {
    setActing(true);
    try {
      await post('/api/hr/attendance/clock-in', {});
      await fetchToday();
      await fetchHistory();
    } catch (e: any) {
      alert(e.message || 'เกิดข้อผิดพลาด');
    } finally { setActing(false); }
  }

  async function handleClockOut() {
    setActing(true);
    try {
      await post('/api/hr/attendance/clock-out', {});
      await fetchToday();
      await fetchHistory();
    } catch (e: any) {
      alert(e.message || 'เกิดข้อผิดพลาด');
    } finally { setActing(false); }
  }

  if (loading) return <div className="py-12 text-center text-stone-400">กำลังโหลด...</div>;

  return (
    <div className="max-w-[800px] mx-auto pb-12 space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-[24px] font-semibold tracking-tight text-stone-950">ลงเวลาเข้างาน / Attendance</h1>
        <input
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="h-9 px-3 rounded-md border border-stone-200 bg-white text-sm outline-none"
        />
      </div>

      {/* Clock In/Out Section */}
      <div className={CARD}>
        <div className="p-8 text-center space-y-6">
          <div className="space-y-1">
            <p className="text-[14px] text-stone-500 uppercase tracking-widest">วันนี้ / Today</p>
            <p className="text-[32px] font-bold text-stone-950">{new Date().toLocaleDateString('th-TH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
          </div>

          <div className="flex justify-center gap-12">
            <div className="space-y-1">
              <p className="text-[12px] text-stone-400 uppercase font-semibold">เข้างาน (In)</p>
              <p className="text-[20px] font-mono text-stone-900">{todayRecord?.clock_in ? new Date(todayRecord.clock_in).toLocaleTimeString('th-TH') : '--:--'}</p>
            </div>
            <div className="space-y-1">
              <p className="text-[12px] text-stone-400 uppercase font-semibold">ออกงาน (Out)</p>
              <p className="text-[20px] font-mono text-stone-900">{todayRecord?.clock_out ? new Date(todayRecord.clock_out).toLocaleTimeString('th-TH') : '--:--'}</p>
            </div>
          </div>

          <div className="pt-4 flex justify-center">
            {!todayRecord?.clock_in ? (
              <button
                onClick={handleClockIn}
                disabled={acting}
                className="w-48 h-48 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white shadow-xl shadow-emerald-600/20 flex flex-col items-center justify-center gap-2 transition-transform hover:scale-105 active:scale-95 disabled:opacity-50"
              >
                <div className="text-4xl">📥</div>
                <span className="text-xl font-bold uppercase tracking-wider">Clock In</span>
                <span className="text-[13px] opacity-80">ลงเวลาเข้างาน</span>
              </button>
            ) : !todayRecord.clock_out ? (
              <button
                onClick={handleClockOut}
                disabled={acting}
                className="w-48 h-48 rounded-full bg-stone-950 hover:bg-stone-800 text-white shadow-xl shadow-stone-950/20 flex flex-col items-center justify-center gap-2 transition-transform hover:scale-105 active:scale-95 disabled:opacity-50"
              >
                <div className="text-4xl">📤</div>
                <span className="text-xl font-bold uppercase tracking-wider">Clock Out</span>
                <span className="text-[13px] opacity-80">ลงเวลาออกงาน</span>
              </button>
            ) : (
              <div className="bg-emerald-50 px-6 py-3 rounded-full border border-emerald-100 text-emerald-700 font-medium flex items-center gap-2">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/></svg>
                บันทึกเวลาของวันนี้เรียบร้อยแล้ว
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Monthly History */}
      <div className={CARD}>
        <div className="p-6">
          <h3 className="text-[16px] font-semibold text-stone-950 mb-4">ประวัติการเข้างานในเดือนนี้</h3>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[13px]">
              <thead>
                <tr>
                  <th className="text-left py-2 px-3 text-stone-400 font-medium uppercase tracking-wider">วันที่</th>
                  <th className="text-left py-2 px-3 text-stone-400 font-medium uppercase tracking-wider">เข้างาน</th>
                  <th className="text-left py-2 px-3 text-stone-400 font-medium uppercase tracking-wider">ออกงาน</th>
                  <th className="text-left py-2 px-3 text-stone-400 font-medium uppercase tracking-wider text-right">OT (ชั่วโมง)</th>
                  <th className="text-left py-2 px-3 text-stone-400 font-medium uppercase tracking-wider text-right">สถานะ</th>
                </tr>
              </thead>
              <tbody>
                {history.map((r) => (
                  <tr key={r.id} className="border-t border-stone-50">
                    <td className="py-3 px-3 font-medium text-stone-900">{new Date(r.work_date).toLocaleDateString('th-TH', { day: '2-digit', month: 'short' })}</td>
                    <td className="py-3 px-3 font-mono text-stone-600">{r.clock_in ? new Date(r.clock_in).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) : '--:--'}</td>
                    <td className="py-3 px-3 font-mono text-stone-600">{r.clock_out ? new Date(r.clock_out).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) : '--:--'}</td>
                    <td className="py-3 px-3 text-right text-stone-600 font-mono">{r.ot_hours > 0 ? r.ot_hours.toFixed(1) : '—'}</td>
                    <td className="py-3 px-3 text-right">
                      <span className={`inline-flex items-center gap-[5px] px-2 py-[2px] text-[11.5px] font-medium rounded-full border 
                        ${r.status === 'present' ? 'text-emerald-700 border-emerald-200 bg-emerald-50' : 
                          r.status === 'late' ? 'text-amber-700 border-amber-200 bg-amber-50' : 
                          r.status === 'absent' ? 'text-red-700 border-red-200 bg-red-50' :
                          'text-stone-500 border-stone-200 bg-stone-50'}`}>
                        {r.status === 'present' ? 'ปกติ' : r.status === 'late' ? 'สาย' : r.status === 'absent' ? 'ขาดงาน' : r.status}
                      </span>
                    </td>
                  </tr>
                ))}
                {history.length === 0 && (
                  <tr><td colSpan={5} className="py-12 text-center text-stone-400">ไม่พบประวัติในเดือนนี้</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

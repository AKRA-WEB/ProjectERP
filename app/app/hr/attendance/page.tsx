'use client';

import { useState, useEffect, useCallback } from 'react';
import { get } from '@/lib/api-client';
import type { AttendanceRecord, HrEmployee } from '@/types';

export default function AdminAttendancePage() {
  const [history, setHistory] = useState<AttendanceRecord[]>([]);
  const [employees, setEmployees] = useState<HrEmployee[]>([]);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [empId, setEmpId] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [allEmps, att] = await Promise.all([
        get<{ employees: HrEmployee[] }>('/api/hr/employees?limit=100'),
        get<AttendanceRecord[]>(`/api/hr/attendance?month=${month}${empId ? `&employee_id=${empId}` : ''}`),
      ]);
      setEmployees(allEmps.employees);
      setHistory(att);
    } finally { setLoading(false); }
  }, [month, empId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  return (
    <div className="max-w-[1200px] mx-auto pb-12 space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">การเข้างานของพนักงาน / Attendance</h1>
          <p className="text-sm text-stone-500">{history.length} รายการในเดือนนี้</p>
        </div>
        <div className="flex gap-2">
          <select
            value={empId}
            onChange={(e) => setEmpId(e.target.value)}
            className="h-9 px-3 rounded-md border border-stone-200 bg-white text-sm outline-none"
          >
            <option value="">ทุกคน</option>
            {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="h-9 px-3 rounded-md border border-stone-200 bg-white text-sm outline-none"
          />
        </div>
      </div>

      <div className="bg-white border border-stone-200 rounded-[10px] shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr className="bg-stone-50 border-b border-stone-200">
                <th className="text-left py-3 px-4 text-stone-500 font-semibold uppercase tracking-wider">วันที่</th>
                <th className="text-left py-3 px-4 text-stone-500 font-semibold uppercase tracking-wider">พนักงาน</th>
                <th className="text-left py-3 px-4 text-stone-500 font-semibold uppercase tracking-wider text-center">เข้างาน</th>
                <th className="text-left py-3 px-4 text-stone-500 font-semibold uppercase tracking-wider text-center">ออกงาน</th>
                <th className="text-left py-3 px-4 text-stone-500 font-semibold uppercase tracking-wider text-center">OT (ชม.)</th>
                <th className="text-left py-3 px-4 text-stone-500 font-semibold uppercase tracking-wider text-center">สถานะ</th>
                <th className="text-left py-3 px-4 text-stone-500 font-semibold uppercase tracking-wider">หมายเหตุ</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="py-12 text-center text-stone-400">กำลังโหลด...</td></tr>
              ) : history.length === 0 ? (
                <tr><td colSpan={7} className="py-12 text-center text-stone-400">ไม่พบข้อมูล</td></tr>
              ) : history.map((r) => (
                <tr key={r.id} className="border-b border-stone-50 last:border-0 hover:bg-stone-50/50 transition-colors">
                  <td className="py-3 px-4 font-medium text-stone-900">{new Date(r.work_date).toLocaleDateString('th-TH', { day: '2-digit', month: 'short' })}</td>
                  <td className="py-3 px-4 text-stone-700">{r.employee_name}</td>
                  <td className="py-3 px-4 text-center font-mono text-stone-600">{r.clock_in ? new Date(r.clock_in).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) : '--:--'}</td>
                  <td className="py-3 px-4 text-center font-mono text-stone-600">{r.clock_out ? new Date(r.clock_out).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) : '--:--'}</td>
                  <td className="py-3 px-4 text-center text-stone-600 font-mono">{r.ot_hours > 0 ? r.ot_hours.toFixed(1) : '—'}</td>
                  <td className="py-3 px-4 text-center">
                    <span className={`inline-flex items-center gap-[5px] px-2 py-[2px] text-[11px] font-medium rounded-full border 
                      ${r.status === 'present' ? 'text-emerald-700 border-emerald-200 bg-emerald-50' : 
                        r.status === 'late' ? 'text-amber-700 border-amber-200 bg-amber-50' : 
                        r.status === 'absent' ? 'text-red-700 border-red-200 bg-red-50' :
                        'text-stone-500 border-stone-200 bg-stone-50'}`}>
                      {r.status === 'present' ? 'ปกติ' : r.status === 'late' ? 'สาย' : r.status === 'absent' ? 'ขาดงาน' : r.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-stone-400 italic text-[12px]">{r.note || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

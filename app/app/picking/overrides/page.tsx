'use client';

import { useState, useEffect } from 'react';
import { get } from '@/lib/api-client';
import { formatDatetime } from '@/lib/format';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { ShieldAlert, Clock, User } from 'lucide-react';

const CARD = 'bg-white border border-stone-200 rounded-xl shadow-sm overflow-hidden';

interface OverrideLog {
  id: string;
  user_name_th: string;
  user_name_en: string;
  action: string;
  target_id: string;
  reason_code: string;
  original_value: { lot_id?: string; expiry?: string };
  override_value: { lot_id?: string; expiry?: string };
  created_at: string;
}

export default function FefoOverridesPage() {
  const [logs, setLogs] = useState<OverrideLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLogs();
  }, []);

  async function fetchLogs() {
    try {
      const res = await get<{ data: OverrideLog[] }>('/api/admin/override-audit?action=fefo_violation');
      setLogs(res.data);
    } catch (error) {
      console.error('Failed to fetch overrides:', error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-stone-900 flex items-center gap-2">
            <ShieldAlert className="w-7 h-7 text-amber-500" /> แดชบอร์ดการละเมิด FEFO
          </h1>
          <p className="text-stone-500 text-sm">ประวัติการใช้ Manager PIN เพื่อข้ามการหยิบสินค้าแบบ FEFO</p>
        </div>
        <button 
          onClick={fetchLogs}
          className="text-sm font-medium text-stone-600 hover:text-stone-900 flex items-center gap-2"
        >
          <Clock className="w-4 h-4" /> รีเฟรช
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><LoadingSpinner /></div>
      ) : logs.length === 0 ? (
        <div className={`${CARD} p-12 text-center text-stone-500 italic`}>
          ไม่มีประวัติการข้ามลำดับ FEFO
        </div>
      ) : (
        <div className={CARD}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-stone-50 text-stone-500 text-xs uppercase">
                <tr>
                  <th className="px-6 py-4 font-semibold">วัน-เวลา</th>
                  <th className="px-6 py-4 font-semibold">ผู้อนุมัติ (Manager)</th>
                  <th className="px-6 py-4 font-semibold">ข้อมูลเป้าหมาย</th>
                  <th className="px-6 py-4 font-semibold">รายละเอียดการข้าม</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-stone-50/50 transition-colors">
                    <td className="px-6 py-4 text-stone-500 whitespace-nowrap">
                      {formatDatetime(log.created_at, 'th')}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 font-medium text-stone-900">
                        <User className="w-4 h-4 text-stone-300" />
                        {log.user_name_th || log.user_name_en}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-xs font-mono text-stone-400">Target: {log.target_id.slice(0, 8)}...</p>
                      <p className="text-xs bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded border border-amber-100 inline-block mt-1 uppercase font-bold">
                        {log.reason_code}
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-xs space-y-1">
                        <p className="text-stone-400">จาก: <span className="text-stone-600 font-mono">{log.original_value?.lot_id?.slice(0, 8)}...</span> (Exp: {log.original_value?.expiry || '—'})</p>
                        <p className="text-stone-400">เป็น: <span className="text-stone-900 font-bold font-mono">{log.override_value?.lot_id?.slice(0, 8)}...</span> (Exp: {log.override_value?.expiry || '—'})</p>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

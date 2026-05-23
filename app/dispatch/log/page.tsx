'use client';

import { useState, useEffect } from 'react';
import { get } from '@/lib/api-client';
import { formatDatetime } from '@/lib/format';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Clock, User, FileText, CheckCircle2, XCircle } from 'lucide-react';

const CARD = 'bg-white border border-stone-200 rounded-xl shadow-sm overflow-hidden';

interface DispatchLog {
  id: string;
  scanned_at: string;
  si_number: string;
  product_name: string;
  sku: string;
  scanned_qty: number;
  expected_qty: number;
  result: 'matched' | 'mismatched';
  gate_user_name: string;
}

export default function DispatchLogPage() {
  const [logs, setLogs] = useState<DispatchLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLogs();
  }, []);

  async function fetchLogs() {
    try {
      const res = await get<DispatchLog[]>('/api/dispatch/logs');
      setLogs(res);
    } catch (error) {
      console.error('Failed to fetch logs:', error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">บันทึกการตรวจปล่อย (Dispatch Logs)</h1>
          <p className="text-stone-500 text-sm">ประวัติการสแกนและตรวจสอบสินค้าที่ประตูทางออก</p>
        </div>
        <button 
          onClick={fetchLogs}
          className="text-sm font-medium text-stone-600 hover:text-stone-900 flex items-center gap-2"
        >
          <Clock className="w-4 h-4" /> รีเฟรชข้อมูล
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <LoadingSpinner />
        </div>
      ) : logs.length === 0 ? (
        <div className={`${CARD} p-12 text-center`}>
          <FileText className="w-12 h-12 mx-auto mb-4 text-stone-200" />
          <p className="text-stone-500">ไม่พบประวัติการตรวจปล่อย</p>
        </div>
      ) : (
        <div className={CARD}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-stone-50 text-stone-500 text-xs uppercase">
                <tr>
                  <th className="px-6 py-4 font-semibold">วัน-เวลา</th>
                  <th className="px-6 py-4 font-semibold">ใบแจ้งหนี้</th>
                  <th className="px-6 py-4 font-semibold">สินค้า</th>
                  <th className="px-6 py-4 font-semibold text-right">จำนวน</th>
                  <th className="px-6 py-4 font-semibold">ผลการสแกน</th>
                  <th className="px-6 py-4 font-semibold">เจ้าหน้าที่</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-stone-50/50 transition-colors">
                    <td className="px-6 py-4 text-stone-500 whitespace-nowrap">
                      {formatDatetime(log.scanned_at, 'th')}
                    </td>
                    <td className="px-6 py-4 font-mono font-bold text-stone-900 whitespace-nowrap">
                      {log.si_number}
                    </td>
                    <td className="px-6 py-4 min-w-[200px]">
                      <p className="font-medium text-stone-800">{log.product_name}</p>
                      <p className="text-[10px] text-stone-400 font-mono uppercase">{log.sku}</p>
                    </td>
                    <td className="px-6 py-4 text-right font-mono">
                      <span className="text-stone-900 font-bold">{log.scanned_qty}</span>
                      <span className="text-stone-300 mx-1">/</span>
                      <span className="text-stone-400">{log.expected_qty}</span>
                    </td>
                    <td className="px-6 py-4">
                      {log.result === 'matched' ? (
                        <span className="inline-flex items-center gap-1.5 text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full text-[11px] font-bold border border-emerald-100">
                          <CheckCircle2 className="w-3 h-3" /> MATCHED
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-red-600 bg-red-50 px-2.5 py-1 rounded-full text-[11px] font-bold border border-red-100">
                          <XCircle className="w-3 h-3" /> MISMATCHED
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2 text-stone-600">
                        <User className="w-4 h-4 text-stone-300" />
                        {log.gate_user_name}
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

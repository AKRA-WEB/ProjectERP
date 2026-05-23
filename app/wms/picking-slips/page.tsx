'use client';

import { useState, useEffect } from 'react';
import { get, post } from '@/lib/api-client';
import { formatDatetime } from '@/lib/format';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Search, Package, CheckCircle, Clock } from 'lucide-react';
import { useLanguage } from '@/lib/i18n';
import type { PosPickingSlip } from '@/types';

const CARD = 'bg-white border border-stone-200 rounded-[10px] shadow-sm overflow-hidden';

export default function PickingSlipsQueuePage() {
  const [slips, setSlips] = useState<PosPickingSlip[]>([]);
  const [loading, setLoading] = useState(true);
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const { lang } = useLanguage();

  useEffect(() => {
    fetchSlips();
    const interval = setInterval(fetchSlips, 30000); // Poll every 30s
    return () => clearInterval(interval);
  }, []);

  async function fetchSlips() {
    try {
      const res = await get<PosPickingSlip[]>('/api/pos/picking-slips?status=printed');
      setSlips(res);
    } catch (error) {
      console.error('Failed to fetch picking slips:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleMarkPicked(id: string) {
    if (!confirm('ยืนยันว่าหยิบสินค้าครบถ้วนแล้ว?')) return;
    setSubmittingId(id);
    try {
      await post(`/api/pos/picking-slips/${id}/mark-picked`, {});
      setSlips(prev => prev.filter(s => s.id !== id));
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to mark as picked');
    } finally {
      setSubmittingId(null);
    }
  }

  const filteredSlips = slips.filter(s => 
    s.doc_no.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="max-w-5xl mx-auto space-y-6 p-4 md:p-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-stone-900">คิวหยิบสินค้า (POS Hybrid)</h1>
          <p className="text-stone-500 text-sm">รายการสินค้าที่ต้องหยิบจากคลัง W2 สำหรับหน้าร้าน</p>
        </div>
        <div className="relative w-full md:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ค้นหาเลขที่ใบหยิบ..."
            className="w-full h-10 pl-9 pr-4 border border-stone-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-stone-300"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <LoadingSpinner />
        </div>
      ) : filteredSlips.length === 0 ? (
        <div className={`${CARD} p-12 text-center`}>
          <div className="w-16 h-16 bg-stone-50 text-stone-300 rounded-full flex items-center justify-center mx-auto mb-4">
            <Package className="w-8 h-8" />
          </div>
          <p className="text-stone-500">ไม่มีรายการที่ต้องหยิบในขณะนี้</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {filteredSlips.map((slip) => (
            <div key={slip.id} className={`${CARD} p-4 md:p-5 flex flex-col md:flex-row md:items-center gap-4`}>
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-3">
                  <span className="font-mono font-bold text-lg text-stone-900">{slip.doc_no}</span>
                  <StatusBadge status={slip.status} />
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-stone-500">
                  <span className="flex items-center gap-1.5">
                    <Clock className="w-4 h-4" /> {formatDatetime(slip.printed_at, lang)}
                  </span>
                  <span>ผู้ออกบิล: <span className="text-stone-700 font-medium">Cashier</span></span>
                </div>
                
                {/* Lines summary */}
                <div className="mt-3 bg-stone-50 rounded-lg p-3">
                  <p className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-2">รายการสินค้า</p>
                  <ul className="space-y-1">
                    {(slip.lines as { name_th: string; qty: number }[]).map((line, idx) => (
                      <li key={idx} className="text-sm flex justify-between">
                        <span className="text-stone-700">{line.name_th}</span>
                        <span className="font-mono font-bold text-emerald-600">x {line.qty}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="flex flex-row md:flex-col gap-2 flex-shrink-0">
                <Button 
                  onClick={() => handleMarkPicked(slip.id)}
                  loading={submittingId === slip.id}
                  className="flex-1 md:flex-none flex items-center gap-2 justify-center"
                >
                  <CheckCircle className="w-4 h-4" /> ยืนยันว่าหยิบแล้ว
                </Button>
                <Button variant="outline" className="flex-1 md:flex-none">
                  ดูรายละเอียด
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

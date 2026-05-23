'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { get, post } from '@/lib/api-client';
import { Button } from '@/components/ui/Button';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { formatDatetime } from '@/lib/format';
import { Layers, ArrowLeft } from 'lucide-react';

const CARD = 'bg-white border border-stone-200 rounded-xl shadow-sm overflow-hidden';

interface PO {
  id: string;
  po_number: string;
  vendor_name: string;
  warehouse_name: string;
}

interface BR {
  id: string;
  br_number: string;
  counted_by_name: string;
  created_at: string;
}

export default function GRNMergePage() {
  const router = useRouter();
  const [pos, setPOs] = useState<PO[]>([]);
  const [selectedPO, setSelectedPO] = useState<PO | null>(null);
  const [brs, setBRs] = useState<BR[]>([]);
  const [selectedBRIds, setSelectedBRIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [merging, setMerging] = useState(false);

  useEffect(() => {
    fetchPOs();
  }, []);

  async function fetchPOs() {
    try {
      const res = await get<{ data: PO[] }>('/api/purchase-orders?status=pending_delivery&limit=50');
      setPOs(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSelectPO(po: PO) {
    setSelectedPO(po);
    setLoading(true);
    try {
      const res = await get<BR[]>(`/api/blind-receipts?po_id=${po.id}&status=submitted`);
      setBRs(res);
      setSelectedBRIds(res.map(b => b.id));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleMerge() {
    if (!selectedPO || selectedBRIds.length === 0) return;
    setMerging(true);
    try {
      const res = await post<{ grn_id: string }>('/api/grn/merge-brs', {
        po_id: selectedPO.id,
        br_ids: selectedBRIds,
        received_date: new Date().toISOString().split('T')[0]
      });
      alert('รวมข้อมูลสำเร็จ สร้าง GRN เรียบร้อยแล้ว');
      router.push(`/app/grn/${res.grn_id}`);
    } catch (err: unknown) {
      alert((err as Error).message || 'Failed to merge BRs');
    } finally {
      setMerging(false);
    }
  }

  if (loading && !selectedPO) return <div className="flex justify-center py-24"><LoadingSpinner /></div>;

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <div className="flex items-center gap-4">
        {selectedPO && <Button variant="ghost" size="sm" onClick={() => setSelectedPO(null)}><ArrowLeft /></Button>}
        <h1 className="text-2xl font-bold text-stone-900">รวมข้อมูลตรวจรับ (Merge BRs)</h1>
      </div>

      {!selectedPO ? (
         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
           {pos.length === 0 ? (
             <div className="col-span-full py-12 text-center text-stone-400 italic">ไม่มีใบสั่งซื้อที่รอรวมข้อมูล</div>
           ) : (
             pos.map(po => (
               <div key={po.id} className={`${CARD} p-4 hover:border-emerald-300 cursor-pointer transition-colors group`} onClick={() => handleSelectPO(po)}>
                 <p className="font-mono font-bold text-lg text-stone-900 group-hover:text-emerald-600 transition-colors">{po.po_number}</p>
                 <p className="text-sm text-stone-700">{po.vendor_name}</p>
                 <p className="text-xs text-stone-400 mt-2">{po.warehouse_name}</p>
               </div>
             ))
           )}
         </div>
      ) : (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
           <div className={`${CARD} p-6 bg-emerald-50/50 border-emerald-100`}>
              <h2 className="text-lg font-bold text-emerald-900">{selectedPO.po_number} — {selectedPO.vendor_name}</h2>
              <p className="text-sm text-emerald-700">{selectedPO.warehouse_name}</p>
           </div>

           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                 <h3 className="text-sm font-bold text-stone-400 uppercase tracking-wider">ใบตรวจนับ (BRs) ที่รอยืนยัน</h3>
                 {brs.length === 0 ? (
                   <p className="text-sm text-stone-500 italic">ไม่พบใบตรวจนับที่ส่งข้อมูลแล้วสำหรับ PO นี้</p>
                 ) : (
                   brs.map(br => (
                     <label key={br.id} className={`flex items-center gap-3 p-4 rounded-xl border cursor-pointer transition-all ${selectedBRIds.includes(br.id) ? 'bg-white border-emerald-500 shadow-sm' : 'bg-stone-50 border-stone-200 opacity-60'}`}>
                       <input 
                         type="checkbox" 
                         checked={selectedBRIds.includes(br.id)} 
                         onChange={(e) => setSelectedBRIds(prev => e.target.checked ? [...prev, br.id] : prev.filter(id => id !== br.id))}
                         className="w-5 h-5 rounded border-stone-300 text-emerald-600 focus:ring-emerald-500"
                       />
                       <div className="flex-1">
                          <p className="font-mono font-bold text-stone-900">{br.br_number}</p>
                          <p className="text-[11px] text-stone-500">นับโดย: {br.counted_by_name} · {formatDatetime(br.created_at, 'th')}</p>
                       </div>
                     </label>
                   ))
                 )}
              </div>

              <div className="space-y-4">
                 <h3 className="text-sm font-bold text-stone-400 uppercase tracking-wider">ดำเนินการ</h3>
                 <div className={`${CARD} p-6 space-y-4`}>
                    <p className="text-[13px] text-stone-600 leading-relaxed">
                      เลือกใบตรวจนับที่ต้องการรวมเข้าด้วยกันเพื่อสร้างเป็นใบรับสินค้า (GRN) อย่างเป็นทางการ
                    </p>
                    <div className="bg-stone-50 p-4 rounded-lg border border-stone-100 mb-4">
                      <div className="flex justify-between text-sm">
                        <span className="text-stone-500">เลือกแล้ว</span>
                        <span className="font-bold text-stone-900">{selectedBRIds.length} ใบ</span>
                      </div>
                    </div>
                    <Button 
                      className="w-full h-14 bg-stone-900 text-white text-lg rounded-xl shadow-lg shadow-stone-200" 
                      onClick={handleMerge}
                      loading={merging}
                      disabled={selectedBRIds.length === 0}
                    >
                       <Layers className="w-5 h-5 mr-2" /> รวมข้อมูลและสร้าง GRN
                    </Button>
                    <p className="text-[11px] text-stone-400 text-center uppercase font-medium">หลังสร้างแล้วสถานะ GRN จะเป็น Draft</p>
                 </div>
              </div>
           </div>
        </div>
      )}
    </div>
  );
}

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { get, patch } from '@/lib/api-client';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { CheckCircle, Save, ArrowLeft, Plus, Trash2 } from 'lucide-react';

interface BRLine {
  id?: string;
  product_id: string;
  product_name: string;
  product_sku: string;
  qty_counted: number | string;
  notes?: string;
}

interface BRRecord {
  id: string;
  br_number: string;
  po_number: string;
  warehouse_name: string;
  lines: BRLine[];
}

export default function HandheldBRDetailPage() {
  const { id } = useParams() as { id: string };
  const router = useRouter();
  const [br, setBR] = useState<BRRecord | null>(null);
  const [lines, setLines] = useState<BRLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [scanValue, setScanValue] = useState('');

  const fetchBR = useCallback(async () => {
    try {
      const res = await get<BRRecord>(`/api/blind-receipts/${id}`);
      setBR(res);
      setLines(res.lines);
    } catch (err) {
      console.error(err);
      router.push('/app/handheld/blind-receipts');
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => {
    fetchBR();
  }, [fetchBR]);

  async function handleSave(status?: string) {
    if (status === 'submitted' && !confirm('ยืนยันการส่งข้อมูล? หลังส่งแล้วจะไม่สามารถแก้ไขได้')) return;
    setSaving(true);
    try {
      await patch(`/api/blind-receipts/${id}`, {
        status,
        lines: lines.map(l => ({
          product_id: l.product_id,
          qty_counted: Number(l.qty_counted || 0),
          notes: l.notes
        }))
      });
      if (status === 'submitted') {
        alert('ส่งรายการตรวจนับเรียบร้อยแล้ว');
        router.push('/app/handheld/blind-receipts');
      } else {
        alert('บันทึกร่างเรียบร้อยแล้ว');
      }
    } catch (err: unknown) {
      alert((err as Error).message || 'Failed to save BR');
    } finally {
      setSaving(false);
    }
  }

  async function handleAddItem(sku: string) {
    if (!sku) return;
    try {
      const res = await get<{ id: string; name_th: string; sku: string }[]>(`/api/products?search=${sku}`);
      if (res.length === 0) {
        alert('ไม่พบสินค้า');
        return;
      }
      const product = res[0];
      
      // Check if already in list
      const existingIdx = lines.findIndex(l => l.product_id === product.id);
      if (existingIdx >= 0) {
        // Increment qty
        const newLines = [...lines];
        newLines[existingIdx].qty_counted = Number(newLines[existingIdx].qty_counted || 0) + 1;
        setLines(newLines);
      } else {
        setLines(prev => [...prev, {
          product_id: product.id,
          product_name: product.name_th,
          product_sku: product.sku,
          qty_counted: 1
        }]);
      }
      setScanValue('');
    } catch (err: unknown) {
      console.error('Add item error:', err);
      alert('เกิดข้อผิดพลาดในการเพิ่มสินค้า');
    }
  }

  const updateLine = (idx: number, key: keyof BRLine, val: number | string) => {
    setLines(prev => prev.map((l, i) => i === idx ? { ...l, [key]: val } : l));
  };

  const removeLine = (idx: number) => {
    if (!confirm('ลบรายการนี้?')) return;
    setLines(prev => prev.filter((_, i) => i !== idx));
  };

  if (loading) return <div className="flex justify-center py-24"><LoadingSpinner /></div>;

  return (
    <div className="max-w-md mx-auto p-4 space-y-6 pb-24">
      <div className="flex items-center gap-3 py-2">
        <Button variant="ghost" size="sm" onClick={() => router.back()}><ArrowLeft /></Button>
        <h1 className="text-xl font-bold flex-1">ตรวจรับ #{br?.br_number}</h1>
      </div>

      <div className="bg-stone-50 p-4 rounded-xl space-y-1">
        <p className="text-[10px] text-stone-500 uppercase font-bold tracking-wider">อ้างอิงใบสั่งซื้อ</p>
        <p className="text-lg font-mono font-bold text-stone-900">{br?.po_number}</p>
        <p className="text-xs text-stone-600 font-medium">{br?.warehouse_name}</p>
      </div>

      <div className="flex gap-2">
        <Input 
          value={scanValue}
          onChange={(e) => setScanValue(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAddItem(scanValue)}
          placeholder="สแกน SKU สินค้า..."
          className="h-14 text-lg font-mono"
        />
        <Button onClick={() => handleAddItem(scanValue)} className="h-14 px-6 bg-stone-900">
           <Plus />
        </Button>
      </div>

      <div className="space-y-4">
        {lines.length === 0 ? (
          <div className="text-center py-12 text-stone-400 italic text-sm">
            ยังไม่มีรายการที่ตรวจนับ
          </div>
        ) : (
          lines.map((line, idx) => (
            <div key={idx} className="bg-white border border-stone-200 rounded-xl p-4 shadow-sm space-y-3 relative group">
               <button 
                 onClick={() => removeLine(idx)}
                 className="absolute top-2 right-2 text-stone-300 hover:text-red-500 transition-colors"
               >
                 <Trash2 className="w-4 h-4" />
               </button>
               <div>
                 <p className="text-[10px] text-stone-400 font-mono uppercase leading-none mb-1">{line.product_sku}</p>
                 <p className="text-sm font-bold text-stone-900 leading-tight pr-6">{line.product_name}</p>
               </div>
               
               <div className="flex items-end gap-4">
                 <div className="flex-1">
                   <p className="text-[10px] text-stone-400 uppercase font-bold mb-1">จำนวนที่นับได้ (Qty)</p>
                   <div className="flex items-center gap-2">
                     <button 
                       className="w-10 h-10 rounded-lg bg-stone-100 text-stone-600 text-xl font-bold"
                       onClick={() => updateLine(idx, 'qty_counted', Math.max(0, Number(line.qty_counted || 0) - 1))}
                     >
                       -
                     </button>
                     <input 
                       type="number" 
                       value={line.qty_counted} 
                       onChange={(e) => updateLine(idx, 'qty_counted', e.target.value)}
                       className="flex-1 h-14 text-2xl font-mono font-bold text-emerald-600 text-center outline-none bg-stone-50 rounded-lg border-b-2 border-emerald-500"
                     />
                     <button 
                       className="w-10 h-10 rounded-lg bg-stone-100 text-stone-600 text-xl font-bold"
                       onClick={() => updateLine(idx, 'qty_counted', Number(line.qty_counted || 0) + 1)}
                     >
                       +
                     </button>
                   </div>
                 </div>
               </div>
            </div>
          ))
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/90 backdrop-blur-md border-t border-stone-100 flex gap-3 max-w-md mx-auto z-50">
        <Button variant="outline" className="h-14 flex-1" onClick={() => handleSave('draft')} loading={saving}>
          <Save className="w-4 h-4 mr-2" /> บันทึกร่าง
        </Button>
        <Button className="h-14 bg-emerald-600 hover:bg-emerald-700 text-white flex-[1.5]" onClick={() => handleSave('submitted')} loading={saving}>
          <CheckCircle className="w-4 h-4 mr-2" /> ส่งข้อมูล (Submit)
        </Button>
      </div>
    </div>
  );
}

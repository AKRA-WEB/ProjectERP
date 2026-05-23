'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { get, post } from '@/lib/api-client';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { CheckCircle, AlertTriangle, Barcode, ArrowRight } from 'lucide-react';

interface DispatchSession {
  id: string;
  si_number: string;
  customer_name: string;
}

interface DispatchLine {
  product_id: string;
  name_th: string;
  sku: string;
  expected_qty: number | string;
  scanned_total: number | string;
}

export default function DispatchScanPage() {
  const [barcode, setBarcode] = useState('');
  const [session, setSession] = useState<DispatchSession | null>(null);
  const [lines, setLines] = useState<DispatchLine[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const barcodeRef = useRef<HTMLInputElement>(null);

  const fetchSessionDetails = useCallback(async (sessionId: string) => {
    try {
      const sRes = await get<{ session: { id: string; si_number: string; customer_name: string }; lines: DispatchLine[] }>(`/api/dispatch/sessions/${sessionId}`);
      setSession({
        id: sRes.session.id,
        si_number: sRes.session.si_number,
        customer_name: sRes.session.customer_name
      });
      setLines(sRes.lines);
    } catch (err) {
      console.error('Failed to fetch session details:', err);
    }
  }, []);

  async function handleScanInvoice() {
    if (!barcode) return;
    setLoading(true);
    setError(null);
    try {
      const res = await post<{ session_id: string }>('/api/dispatch/scan-invoice', { barcode });
      await fetchSessionDetails(res.session_id);
      setBarcode('');
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'status' in err && err.status === 410) {
        const details = (err as { details?: { current_barcode: string } }).details;
        setError(`บาร์โค้ดนี้ถูกยกเลิกแล้ว กรุณาใช้บาร์โค้ดล่าสุด: ${details?.current_barcode}`);
      } else {
        setError((err as Error).message || 'ไม่พบข้อมูลใบแจ้งหนี้');
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleScanItem(itemBarcode: string) {
    if (!session) return;
    setLoading(true);
    try {
      // Find product by SKU
      const prods = await get<{ id: string }[]>(`/api/products?search=${itemBarcode}`);
      if (prods.length === 0) throw new Error('ไม่พบสินค้า');
      const product = prods[0];

      await post('/api/dispatch/scan-item', {
        session_id: session.id,
        product_id: product.id,
        qty: 1
      });

      await fetchSessionDetails(session.id);
      setBarcode('');
    } catch (err: unknown) {
      alert((err as Error).message || 'สแกนสินค้าไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  }

  async function handleRelease() {
    if (!session) return;
    setLoading(true);
    try {
      await post('/api/dispatch/release', { session_id: session.id });
      alert('ปล่อยสินค้าเรียบร้อยแล้ว');
      setSession(null);
      setLines([]);
    } catch (err: unknown) {
      alert((err as Error).message || 'ไม่สามารถปล่อยสินค้าได้');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    barcodeRef.current?.focus();
  }, [session]);

  return (
    <div className="max-w-md mx-auto p-4 space-y-6">
      <h1 className="text-xl font-bold flex items-center gap-2 py-4 border-b">
        <Barcode className="w-6 h-6 text-stone-400" /> จุดตรวจปล่อยสินค้า
      </h1>

      {!session ? (
        <div className="space-y-4">
          <div className="bg-stone-50 p-8 rounded-2xl border-2 border-dashed border-stone-200 text-center">
            <Barcode className="w-12 h-12 mx-auto mb-4 text-stone-300" />
            <p className="text-stone-500">สแกนบาร์โค้ดบนใบแจ้งหนี้เพื่อเริ่ม</p>
          </div>
          <div className="flex gap-2">
            <Input 
              ref={barcodeRef}
              value={barcode} 
              onChange={(e) => setBarcode(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleScanInvoice()}
              placeholder="สแกนบาร์โค้ดใบแจ้งหนี้..." 
              className="h-14 text-lg font-mono"
            />
            <Button onClick={handleScanInvoice} loading={loading} className="h-14 px-6 shrink-0">
              <ArrowRight />
            </Button>
          </div>
          {error && (
            <div className="p-4 bg-red-50 text-red-700 rounded-xl border border-red-100 text-sm flex gap-2">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              {error}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100">
            <p className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider">กำลังตรวจปล่อย</p>
            <p className="text-lg font-mono font-bold text-emerald-900">{session.si_number}</p>
            <p className="text-sm text-emerald-700 truncate">{session.customer_name}</p>
          </div>

          <div className="flex gap-2">
            <Input 
              ref={barcodeRef}
              value={barcode} 
              onChange={(e) => setBarcode(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleScanItem(barcode)}
              placeholder="สแกน SKU สินค้า..." 
              className="h-14 text-lg font-mono"
            />
            <Button onClick={() => handleScanItem(barcode)} loading={loading} className="h-14 px-6 shrink-0 bg-stone-900">
              <ArrowRight />
            </Button>
          </div>

          <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
            {lines.map((line) => {
              const scn = Number(line.scanned_total);
              const exp = Number(line.expected_qty);
              const progress = (scn / exp) * 100;
              const isDone = scn >= exp;
              return (
                <div key={line.product_id} className={`p-4 rounded-xl border transition-colors ${isDone ? 'bg-emerald-50/30 border-emerald-200' : 'bg-white border-stone-200'}`}>
                  <div className="flex justify-between items-start mb-2 gap-2">
                    <div className="min-w-0">
                      <p className="font-bold text-stone-900 truncate text-sm">{line.name_th}</p>
                      <p className="text-[10px] text-stone-500 font-mono uppercase">{line.sku}</p>
                    </div>
                    {isDone && <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0" />}
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-2 bg-stone-100 rounded-full overflow-hidden">
                      <div 
                        className={`h-full transition-all duration-500 ${isDone ? 'bg-emerald-500' : 'bg-amber-500'}`}
                        style={{ width: `${Math.min(100, progress)}%` }}
                      />
                    </div>
                    <span className="text-sm font-mono font-bold shrink-0">
                      {scn} / {exp}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="pt-4 border-t space-y-3">
            <Button 
              onClick={handleRelease} 
              loading={loading}
              className="w-full h-16 text-lg bg-stone-900 hover:bg-stone-800 disabled:opacity-50"
              disabled={!lines.every(l => Number(l.scanned_total) >= Number(l.expected_qty))}
            >
              ปล่อยสินค้า / Release
            </Button>
            
            <Button variant="ghost" onClick={() => setSession(null)} className="w-full h-12 text-stone-500 hover:text-red-600">
              ยกเลิก / Abort
            </Button>
          </div>
        </div>
      )}
      
      {loading && !session && (
        <div className="flex justify-center py-4">
          <LoadingSpinner />
        </div>
      )}
    </div>
  );
}

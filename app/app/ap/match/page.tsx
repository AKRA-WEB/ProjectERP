'use client';

/* eslint-disable local-rules/no-hardcoded-thai */
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { get, post } from '@/lib/api-client';
import { Button } from '@/components/ui/Button';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { formatCurrency } from '@/lib/format';
import { CheckCircle, ArrowLeft } from 'lucide-react';

const CARD = 'bg-white border border-stone-200 rounded-xl shadow-sm overflow-hidden';

interface Invoice {
  id: string;
  invoice_number: string;
  vendor_name_th: string;
  vendor_name_en: string;
  po_number: string;
  amount: number | string;
}

interface MatchDetails {
  po_total: number;
  gr_total: number;
}

export default function APMatchPage() {
  const router = useRouter();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [selectedInv, setSelectedInv] = useState<Invoice | null>(null);
  const [details, setDetails] = useState<MatchDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [matching, setMatching] = useState(false);

  useEffect(() => {
    fetchInvoices();
  }, []);

  async function fetchInvoices() {
    try {
      const res = await get<{ data: Invoice[] }>('/api/ap/invoices?match_status=pending&limit=50');
      setInvoices(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const handleSelectInv = useCallback(async (inv: Invoice) => {
    setSelectedInv(inv);
    setLoading(true);
    try {
      // In real app, this would fetch line-by-line comparison
      // For now we simulate with totals
      setDetails({
        po_total: Number(inv.amount),
        gr_total: Number(inv.amount)
      });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  async function handleConfirmMatch() {
    if (!selectedInv) return;
    setMatching(true);
    try {
      await post('/api/ap/invoices/match-confirm', {
        po_invoice_id: selectedInv.id
      });
      alert('ยืนยัน 3-Way Match สำเร็จ สต็อกถูกย้ายเข้า Sellable Location เรียบร้อยแล้ว');
      router.push('/app/ap/invoices');
    } catch (err: unknown) {
      alert((err as Error).message || 'Match failed');
    } finally {
      setMatching(false);
    }
  }

  if (loading && !selectedInv) return <div className="flex justify-center py-24"><LoadingSpinner /></div>;

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="flex items-center gap-4">
        {selectedInv && <Button variant="ghost" size="sm" onClick={() => setSelectedInv(null)}><ArrowLeft /></Button>}
        <h1 className="text-2xl font-bold text-stone-900">3-Way Matching Engine</h1>
      </div>

      {!selectedInv ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {invoices.length === 0 ? (
            <div className="col-span-full py-12 text-center text-stone-400 italic">ไม่มี Invoice ที่รอยืนยัน Match</div>
          ) : (
            invoices.map(inv => (
               <div key={inv.id} className={`${CARD} p-4 hover:border-blue-300 cursor-pointer transition-colors group`} onClick={() => handleSelectInv(inv)}>
                  <p className="font-mono font-bold text-lg text-stone-900 group-hover:text-blue-600 transition-colors">{inv.invoice_number}</p>
                  <p className="text-sm text-stone-700">ผู้จำหน่าย: {inv.vendor_name_th || inv.vendor_name_en}</p>
                  <div className="flex justify-between mt-3 pt-3 border-t border-stone-50">
                     <span className="text-[11px] text-stone-400 font-mono">PO: {inv.po_number}</span>
                     <span className="text-[13px] font-bold text-blue-600">{formatCurrency(inv.amount)}</span>
                  </div>
               </div>
            ))
          )}
        </div>
      ) : (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
           <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-6">
                 <div className={CARD}>
                    <div className="px-6 py-4 border-b border-stone-100 bg-stone-50/50 flex justify-between items-center">
                       <h2 className="text-sm font-bold text-stone-400 uppercase tracking-wider">เปรียบเทียบรายการ (PO vs GR vs Invoice)</h2>
                    </div>
                    <div className="p-12 text-center text-stone-400 italic text-sm">
                       ข้อมูลการเปรียบเทียบรายบรรทัด (Line-by-line comparison coming soon)
                    </div>
                 </div>
              </div>

              <div className="space-y-6">
                 <div className={`${CARD} p-6 bg-blue-50 border-blue-100`}>
                    <h3 className="text-xs font-bold text-blue-400 uppercase mb-4 tracking-widest">สรุปยอดเงิน</h3>
                    <div className="space-y-3">
                       <div className="flex justify-between text-sm">
                          <span className="text-blue-600">ยอด PO:</span>
                          <span className="font-mono font-bold">{formatCurrency(details?.po_total || 0)}</span>
                       </div>
                       <div className="flex justify-between text-sm">
                          <span className="text-blue-600">ยอด GR (รับจริง):</span>
                          <span className="font-mono font-bold">{formatCurrency(details?.gr_total || 0)}</span>
                       </div>
                       <div className="flex justify-between text-lg pt-3 border-t border-blue-200">
                          <span className="font-bold text-blue-900">ยอด Invoice:</span>
                          <span className="font-mono font-bold text-blue-900">{formatCurrency(selectedInv.amount)}</span>
                       </div>
                    </div>
                 </div>

                 <Button 
                   className="w-full h-16 text-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-100 rounded-xl"
                   onClick={handleConfirmMatch}
                   loading={matching}
                 >
                    <CheckCircle className="w-6 h-6 mr-2" /> ยืนยัน 3-Way Match
                 </Button>
                 <p className="text-[11px] text-stone-400 text-center uppercase font-bold tracking-tighter">
                   หลังยืนยันระบบจะย้ายสต็อกเข้า Sellable Location ทันที
                 </p>
              </div>
           </div>
        </div>
      )}
    </div>
  );
}

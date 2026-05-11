'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { get, patch } from '@/lib/api-client';
import { formatCurrency, formatQty } from '@/lib/format';
import { Button } from '@/components/ui/Button';
import { Table } from '@/components/ui/Table';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import Link from 'next/link';
import type { PosSession, PosTransaction, PosTransactionLine } from '@/types';

const CARD = 'bg-white border border-stone-200 rounded-[10px] shadow-sm overflow-hidden';

export default function SessionDetailPage() {
  const { id } = useParams() as { id: string };
  const router = useRouter();
  const [sessionData, setSessionData] = useState<PosSession & { transactions: PosTransaction[] } | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Void modal state
  const [voidingTxn, setVoidingTxn] = useState<PosTransaction | null>(null);
  const [voidReason, setVoidReason] = useState('');
  const [submittingVoid, setSubmittingVoid] = useState(false);

  // Selected transaction lines
  const [selectedTxn, setSelectedTxn] = useState<PosTransaction | null>(null);
  const [txnLines, setTxnLines] = useState<PosTransactionLine[]>([]);
  const [loadingLines, setLoadingLines] = useState(false);

  const fetchSession = useCallback(async () => {
    setLoading(true);
    try {
      const res = await get<PosSession & { transactions: PosTransaction[] }>(`/api/pos/sessions/${id}`);
      setSessionData(res);
    } catch (error) {
      console.error('Failed to fetch session detail:', error);
      router.push('/app/pos/sessions');
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => {
    fetchSession();
  }, [fetchSession]);

  async function fetchTxnLines(txn: PosTransaction) {
    if (selectedTxn?.id === txn.id) {
      setSelectedTxn(null);
      return;
    }
    setSelectedTxn(txn);
    setLoadingLines(true);
    try {
      const res = await get<PosTransaction & { lines: PosTransactionLine[] }>(`/api/pos/transactions/${txn.id}`);
      setTxnLines(res.lines || []);
    } catch (error) {
      console.error('Failed to fetch transaction lines:', error);
    } finally {
      setLoadingLines(false);
    }
  }

  async function handleVoid(e: React.FormEvent) {
    e.preventDefault();
    if (!voidingTxn) return;
    setSubmittingVoid(true);
    try {
      await patch(`/api/pos/transactions/${voidingTxn.id}`, {
        action: 'void',
        void_reason: voidReason,
      });
      setVoidingTxn(null);
      setVoidReason('');
      fetchSession(); // Refresh list
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Void failed');
    } finally {
      setSubmittingVoid(false);
    }
  }

  if (loading) return <div className="flex justify-center py-24"><LoadingSpinner /></div>;
  if (!sessionData) return <div className="text-center py-24">Session not found</div>;

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/app/pos/sessions" className="text-stone-400 hover:text-stone-600">←</Link>
          <div>
            <h1 className="text-2xl font-semibold text-stone-900">รายละเอียดรอบ / Session Details</h1>
            <p className="text-stone-500 font-mono text-sm">{sessionData.session_number}</p>
          </div>
        </div>
        <div className="flex gap-2">
          {sessionData.status === 'open' && (
            <Link href={`/app/pos/session/${sessionData.id}`}>
              <Button>เข้าสู่หน้าขาย / Go to Terminal</Button>
            </Link>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className={`${CARD} p-5 space-y-4`}>
          <h3 className="text-sm font-bold text-stone-400 uppercase tracking-wider">ข้อมูลรอบ / Info</h3>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-stone-500">สถานะ:</span>
              <StatusBadge status={sessionData.status} />
            </div>
            <div className="flex justify-between">
              <span className="text-stone-500">คลังสินค้า:</span>
              <span className="font-medium">{sessionData.warehouse_name_th}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-stone-500">แคชเชียร์:</span>
              <span className="font-medium">{sessionData.opened_by_name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-stone-500">เวลาเปิด:</span>
              <span className="font-medium">{new Date(sessionData.opened_at).toLocaleString('th-TH')}</span>
            </div>
            {sessionData.closed_at && (
              <div className="flex justify-between">
                <span className="text-stone-500">เวลาปิด:</span>
                <span className="font-medium">{new Date(sessionData.closed_at).toLocaleString('th-TH')}</span>
              </div>
            )}
          </div>
        </div>

        <div className={`${CARD} p-5 space-y-4`}>
          <h3 className="text-sm font-bold text-stone-400 uppercase tracking-wider">ยอดเงิน / Cash Control</h3>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between font-mono">
              <span className="text-stone-500 uppercase">เงินทอนเปิดรอบ:</span>
              <span className="font-bold">{formatCurrency(sessionData.opening_float)}</span>
            </div>
            <div className="flex justify-between font-mono">
              <span className="text-stone-500 uppercase">ยอดขาย (สุทธิ):</span>
              <span className="font-bold text-emerald-600">{formatCurrency(sessionData.total_sales ?? 0)}</span>
            </div>
            <div className="h-px bg-stone-100" />
            <div className="flex justify-between font-mono">
              <span className="text-stone-500 uppercase">เงินทอนปิดรอบ:</span>
              <span className="font-bold text-stone-900">
                {sessionData.closing_float !== null ? formatCurrency(sessionData.closing_float) : '—'}
              </span>
            </div>
          </div>
        </div>

        <div className={`${CARD} p-5 space-y-4`}>
          <h3 className="text-sm font-bold text-stone-400 uppercase tracking-wider">สถิติ / Statistics</h3>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-stone-500">จำนวนบิลทั้งหมด:</span>
              <span className="font-bold font-mono">{sessionData.transaction_count}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-stone-500">หมายเหตุ:</span>
              <span className="italic text-stone-600">{sessionData.notes || '—'}</span>
            </div>
          </div>
        </div>
      </div>

      <div className={CARD}>
        <div className="px-5 py-3 border-b border-stone-100 flex items-center justify-between bg-stone-50/50">
          <h3 className="font-semibold text-stone-900">รายการขาย / Transactions</h3>
        </div>
        <Table
          headers={[
            'เลขที่ใบเสร็จ / Receipt No.',
            'เวลา / Time',
            'วิธีจ่าย / Payment',
            'ยอดรวม / Total',
            'สถานะ / Status',
            'แคชเชียร์ / Cashier',
            '',
          ]}
        >
          {sessionData.transactions.map((t) => (
            <React.Fragment key={t.id}>
              <tr 
                className={`hover:bg-stone-50 transition-colors cursor-pointer ${selectedTxn?.id === t.id ? 'bg-emerald-50/30' : ''}`}
                onClick={() => fetchTxnLines(t)}
              >
                <td className="px-5 py-4 font-mono font-bold text-stone-900">{t.receipt_number}</td>
                <td className="px-5 py-4 text-xs text-stone-500">
                  {new Date(t.created_at).toLocaleTimeString('th-TH')}
                </td>
                <td className="px-5 py-4 uppercase text-xs font-medium text-stone-600">{t.payment_method}</td>
                <td className="px-5 py-4 font-mono font-bold text-stone-900 text-right">
                  {formatCurrency(t.total)}
                </td>
                <td className="px-5 py-4"><StatusBadge status={t.status} /></td>
                <td className="px-5 py-4 text-stone-600">{t.cashier_name}</td>
                <td className="px-5 py-4 text-right flex justify-end gap-2">
                  {t.status === 'completed' && (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="text-red-600 hover:text-red-700 h-7 text-[11px]"
                      onClick={(e) => {
                        e.stopPropagation();
                        setVoidingTxn(t);
                      }}
                    >
                      ยกเลิก / Void
                    </Button>
                  )}
                  <span className="text-stone-400 group-hover:text-stone-600 transition-colors">
                    {selectedTxn?.id === t.id ? '▼' : '▶'}
                  </span>
                </td>
              </tr>
              {selectedTxn?.id === t.id && (
                <tr>
                  <td colSpan={7} className="px-10 py-4 bg-stone-50/50">
                    {loadingLines ? (
                      <div className="flex justify-center py-4"><LoadingSpinner size="sm" /></div>
                    ) : (
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-8 text-sm text-stone-500 mb-4">
                          <div className="space-y-1">
                            <div className="flex justify-between">
                              <span>Subtotal (excl. VAT):</span>
                              <span className="font-mono">{formatCurrency(t.total - t.vat_amount)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>VAT (7%):</span>
                              <span className="font-mono">{formatCurrency(t.vat_amount)}</span>
                            </div>
                          </div>
                          <div className="space-y-1">
                            <div className="flex justify-between">
                              <span>Cash Tendered:</span>
                              <span className="font-mono">{formatCurrency(t.cash_tendered ?? 0)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Change Given:</span>
                              <span className="font-mono text-emerald-700 font-bold">{formatCurrency(t.change_given)}</span>
                            </div>
                          </div>
                        </div>
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b border-stone-200 text-stone-400 uppercase font-bold">
                              <th className="py-2 text-left">สินค้า / Product</th>
                              <th className="py-2 text-center">จำนวน / Qty</th>
                              <th className="py-2 text-right">ราคาหน่วย / Unit Price</th>
                              <th className="py-2 text-right">ส่วนลด / Disc</th>
                              <th className="py-2 text-right">รวม / Total</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-stone-100">
                            {txnLines.map((line) => (
                              <tr key={line.id}>
                                <td className="py-2">
                                  <div className="font-medium text-stone-900">{line.name_th}</div>
                                  <div className="font-mono text-[10px] text-stone-400">{line.sku}</div>
                                </td>
                                <td className="py-2 text-center font-mono">{formatQty(line.qty)}</td>
                                <td className="py-2 text-right font-mono">{formatCurrency(line.unit_price)}</td>
                                <td className="py-2 text-right font-mono text-red-500">-{formatCurrency(line.discount_amount)}</td>
                                <td className="py-2 text-right font-mono font-bold">{formatCurrency(line.line_total)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {t.status === 'voided' && (
                          <div className="mt-4 p-3 bg-red-50 border border-red-100 rounded text-red-700 text-xs">
                            <span className="font-bold uppercase tracking-wider">Voided Info:</span> {t.void_reason} 
                            <span className="ml-2 italic opacity-75">
                              by {t.voided_by_name} at {t.voided_at ? new Date(t.voided_at).toLocaleString('th-TH') : ''}
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              )}
            </React.Fragment>
          ))}
          {sessionData.transactions.length === 0 && (
            <tr><td colSpan={7} className="px-5 py-12 text-center text-stone-400 italic">ยังไม่มีรายการขายในรอบนี้</td></tr>
          )}
        </Table>
      </div>

      <Modal
        isOpen={!!voidingTxn}
        onClose={() => setVoidingTxn(null)}
        title="ยกเลิกรายการขาย / Void Transaction"
      >
        <form onSubmit={handleVoid} className="space-y-4 pt-2">
          <div className="p-3 bg-amber-50 border border-amber-100 rounded text-amber-800 text-sm">
            คำเตือน: การยกเลิกรายการจะคืนสินค้ากลับเข้าสต็อก และบันทึกประวัติการยกเลิกไว้ ไม่สามารถย้อนกลับได้
          </div>
          
          <div className="flex justify-between items-center text-sm font-bold">
            <span>เลขที่ใบเสร็จ: {voidingTxn?.receipt_number}</span>
            <span className="text-stone-900 font-mono">{formatCurrency(voidingTxn?.total ?? 0)}</span>
          </div>

          <Input
            label="เหตุผลในการยกเลิก / Reason"
            value={voidReason}
            onChange={(e) => setVoidReason(e.target.value)}
            placeholder="เช่น ใส่จำนวนผิด, คืนสินค้า"
            required
            autoFocus
          />

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => setVoidingTxn(null)} disabled={submittingVoid}>ยกเลิก / Cancel</Button>
            <Button className="bg-red-600 hover:bg-red-700" loading={submittingVoid} type="submit">ยืนยันการยกเลิก / Confirm Void</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

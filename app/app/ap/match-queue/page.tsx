'use client';

/* eslint-disable local-rules/no-hardcoded-thai */
import { useState, useEffect, useCallback } from 'react';
import { get } from '@/lib/api-client';
import { formatCurrency } from '@/lib/format';
import { Button, Table, Thead, Tbody, Th, Td, Pagination } from '@/components/ui';
import { AlertTriangle, ArrowRight, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { DirectionalTransition } from '@/components/ui/directional-transition';

const CARD = 'bg-white border border-stone-200 rounded-[10px] shadow-[0_1px_0_rgba(15,23,42,.03),0_1px_2px_rgba(15,23,42,.04)]';

interface MatchQueueItem {
  id: string;
  po_id: string;
  invoice_number: string;
  invoice_date: string;
  due_date: string;
  amount: number | string;
  match_status: string;
  created_at: string;
  po_number: string;
  vendor_name: string;
  vendor_code: string;
  po_value: number | string | null;
  gr_value: number | string | null;
  invoice_value: number | string | null;
  variance_type: string | null;
}

export default function APMatchQueuePage() {
  const [data, setData] = useState<MatchQueueItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(15);
  const [loading, setLoading] = useState(true);

  const fetchQueue = useCallback(async (p: number) => {
    setLoading(true);
    try {
      const res = await get<{ data: MatchQueueItem[]; total: number }>(`/api/ap/match-queue?page=${p}&limit=${limit}`);
      setData(res.data);
      setTotal(res.total);
    } catch (err) {
      console.error('Failed to fetch match queue:', err);
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    fetchQueue(page);
  }, [page, fetchQueue]);

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
  };

  return (
    <DirectionalTransition>
      <div className="max-w-6xl mx-auto pb-12 space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-stone-900 flex items-center gap-2">
              <AlertTriangle className="w-6 h-6 text-amber-500 animate-pulse" />
              <span>3-Way Match Queue</span>
            </h1>
            <p className="text-sm text-stone-500">คิวตรวจสอบและอนุมัติใบแจ้งหนี้ที่มีผลต่าง / Reconcile mismatched vendor invoices</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchQueue(page)}
            disabled={loading}
            className="flex items-center gap-1.5"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>โหลดใหม่ / Refresh</span>
          </Button>
        </div>

        {/* Warning Banner */}
        <div className="p-4 bg-amber-50/60 border border-amber-200 rounded-[10px] text-sm text-amber-800 leading-relaxed flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold text-amber-900">ระเบียบปฏิบัติ (STRICT ZERO VARIANCE):</span>{' '}
            ใบแจ้งหนี้ทุกใบจะต้องตรงกับจำนวนที่ตรวจรับจริงในระบบ Goods Receipt Note (GRN) หากมีผลต่าง (Variance)
            ระบบจะระงับการจ่ายเงินให้กับผู้จำหน่ายโดยอัตโนมัติ 
            กรุณาคลิกที่รายการเพื่อดูรายละเอียดของความคลาดเคลื่อนและประสานงานแก้ไข
          </div>
        </div>

        {/* Table Card */}
        <div className={CARD}>
          <div className="px-6 py-4 border-b border-stone-100 bg-stone-50/50 flex justify-between items-center">
            <h2 className="text-[13px] font-bold text-stone-400 uppercase tracking-wider">
              ใบแจ้งหนี้ที่มียอดคลาดเคลื่อน ({total} รายการ)
            </h2>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <Thead>
                <tr>
                  <Th>เลขที่ใบแจ้งหนี้ / Invoice No.</Th>
                  <Th>ผู้จำหน่าย / Vendor</Th>
                  <Th>อ้างอิง PO / GRN</Th>
                  <Th className="text-right">ยอดรับจริง (GR Total)</Th>
                  <Th className="text-right">ยอด Invoice</Th>
                  <Th className="text-right">ผลต่าง / Variance</Th>
                  <Th className="text-center">การดำเนินการ</Th>
                </tr>
              </Thead>
              <Tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-stone-400">
                      กำลังโหลดข้อมูล...
                    </td>
                  </tr>
                ) : data.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-stone-400 italic">
                      🎉 ไม่มีใบแจ้งหนี้ที่มียอดคลาดเคลื่อน ทุกใบผ่านเกณฑ์ 3-Way Match เรียบร้อย
                    </td>
                  </tr>
                ) : (
                  data.map((item) => {
                    const grValue = Number(item.gr_value ?? 0);
                    const invValue = Number(item.invoice_value ?? item.amount);
                    const diff = invValue - grValue;
                    
                    return (
                      <tr key={item.id} className="hover:bg-stone-50/60 transition-colors">
                        <Td className="font-mono font-bold text-stone-900">
                          {item.invoice_number}
                        </Td>
                        <Td>
                          <div className="text-[13px] font-medium text-stone-800">
                            {item.vendor_name}
                          </div>
                          <div className="text-[11px] text-stone-400 font-mono">
                            {item.vendor_code}
                          </div>
                        </Td>
                        <Td>
                          <div className="text-[12px] font-mono text-stone-600 bg-stone-100 px-2 py-0.5 rounded inline-block">
                            PO: {item.po_number}
                          </div>
                        </Td>
                        <Td className="text-right font-mono tabular-nums text-stone-900 font-semibold">
                          {formatCurrency(grValue)}
                        </Td>
                        <Td className="text-right font-mono tabular-nums text-stone-900">
                          {formatCurrency(invValue)}
                        </Td>
                        <Td className="text-right font-mono tabular-nums text-red-600 font-bold">
                          {formatCurrency(diff)}
                        </Td>
                        <Td className="text-center">
                          <Link href={`/app/ap/${item.id}`} className="inline-flex items-center gap-1 text-[12px] font-semibold text-blue-600 hover:underline">
                            <span>ตรวจดู / Review</span>
                            <ArrowRight className="w-3 h-3" />
                          </Link>
                        </Td>
                      </tr>
                    );
                  })
                )}
              </Tbody>
            </Table>
          </div>

            <div className="p-4 border-t border-stone-100 flex justify-end">
              <Pagination
                page={page}
                totalPages={Math.ceil(total / limit)}
                onPageChange={handlePageChange}
              />
            </div>
        </div>
      </div>
    </DirectionalTransition>
  );
}

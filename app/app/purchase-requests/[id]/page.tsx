'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button, StatusBadge, Modal, ModalHeader, ModalBody, ModalFooter, Input, Select } from '@/components/ui';
import { get, post } from '@/lib/api-client';
import { formatDate, formatCurrency, formatQty } from '@/lib/format';
import type { PrStatus, Vendor, PaginatedResponse } from '@/types';
import { ShoppingBag } from 'lucide-react';

interface PRLine {
  id: string;
  line_number: number;
  sku: string;
  name_th: string;
  name_en: string;
  qty_requested: number;
  uom_code: string;
  unit_cost: number;
  notes: string | null;
}

interface PRDetail {
  id: string;
  pr_number: string;
  status: PrStatus;
  warehouse_code: string;
  warehouse_name: string;
  requested_by_name: string;
  created_at: string;
  notes: string | null;
  rejection_reason: string | null;
  lines: PRLine[];
}

export default function PRDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [pr, setPr] = useState<PRDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [showReject, setShowReject] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [acting, setActing] = useState(false);
  const [error, setError] = useState('');

  // PR Receipt States
  const [showReceive, setShowReceive] = useState(false);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [receiveData, setReceiveData] = useState({
    vendor_id: '',
    notes: '',
    lines: [] as { pr_line_item_id: string; qty_received: number; unit_cost: number; name: string }[]
  });

  const fetchPR = useCallback(async () => {
    setLoading(true);
    try {
      const data = await get<PRDetail>(`/api/purchase-requests/${id}`);
      setPr(data);
      setReceiveData(prev => ({
        ...prev,
        lines: data.lines?.map(l => ({
          pr_line_item_id: l.id,
          qty_received: l.qty_requested,
          unit_cost: l.unit_cost,
          name: l.name_th
        })) || []
      }));
    } finally { setLoading(false); }
  }, [id]);

  useEffect(() => { fetchPR(); }, [fetchPR]);

  useEffect(() => {
    if (showReceive) {
      get<PaginatedResponse<Vendor>>('/api/vendors?limit=100').then(r => setVendors(r.data)).catch(() => {});
    }
  }, [showReceive]);

  async function action(path: string, body: object = {}) {
    setError('');
    setActing(true);
    try {
      await post(`/api/purchase-requests/${id}/${path}`, body);
      await fetchPR();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'เกิดข้อผิดพลาด');
    } finally {
      setActing(false);
    }
  }

  async function handleReceive() {
    if (receiveData.lines.some(l => l.unit_cost <= 0)) {
      setError('กรุณาระบุราคาทุนให้ถูกต้อง');
      return;
    }
    setError('');
    setActing(true);
    try {
      const result = await post<{ grn_id: string }>(`/api/purchase-requisitions/${id}/receive`, {
        vendor_id: receiveData.vendor_id || undefined,
        notes: receiveData.notes || undefined,
        lines: receiveData.lines.map(l => ({
          pr_line_item_id: l.pr_line_item_id,
          qty_received: l.qty_received,
          unit_cost: l.unit_cost
        }))
      });
      router.push(`/app/grn/${result.grn_id}`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'เกิดข้อผิดพลาด');
      setActing(false);
    }
  }

  function updateReceiveLine(i: number, key: 'qty_received' | 'unit_cost', val: number) {
    setReceiveData(prev => ({
      ...prev,
      lines: prev.lines.map((l, idx) => idx === i ? { ...l, [key]: val } : l)
    }));
  }

  if (loading) return <div className="py-16 text-center text-gray-400">กำลังโหลด...</div>;
  if (!pr) return <div className="py-16 text-center text-gray-400">ไม่พบข้อมูล</div>;

  return (
    <div className="max-w-4xl">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <button className="text-sm text-gray-500 hover:underline mb-1" onClick={() => router.back()}>← ย้อนกลับ</button>
          <h1 className="text-2xl font-bold text-gray-900 font-mono">{pr.pr_number}</h1>
        </div>
        <StatusBadge status={pr.status} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        {[
          { label: 'คลังสินค้า', value: `${pr.warehouse_code} — ${pr.warehouse_name}` },
          { label: 'ผู้ขอ / Requested By', value: pr.requested_by_name },
          { label: 'วันที่สร้าง', value: formatDate(pr.created_at) },
          { label: 'หมายเหตุ', value: pr.notes ?? '—' },
        ].map((f) => (
          <div key={f.label} className="rounded-lg bg-white border border-gray-100 p-4">
            <p className="text-xs text-gray-400 mb-1">{f.label}</p>
            <p className="text-sm font-medium">{f.value}</p>
          </div>
        ))}
      </div>

      {pr.rejection_reason && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-700">
          <strong>เหตุผลที่ปฏิเสธ:</strong> {pr.rejection_reason}
        </div>
      )}

      <div className="rounded-xl bg-white shadow-sm border border-gray-100 mb-6 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left p-3 font-medium text-gray-600">#</th>
              <th className="text-left p-3 font-medium text-gray-600">SKU</th>
              <th className="text-left p-3 font-medium text-gray-600">สินค้า</th>
              <th className="text-right p-3 font-medium text-gray-600">จำนวน</th>
              <th className="text-left p-3 font-medium text-gray-600">หน่วย</th>
              <th className="text-right p-3 font-medium text-gray-600">ราคาทุน</th>
              <th className="text-left p-3 font-medium text-gray-600">หมายเหตุ</th>
            </tr>
          </thead>
          <tbody>
            {pr.lines?.map((l: PRLine) => (
              <tr key={l.id} className="border-t">
                <td className="p-3 text-gray-400">{l.line_number}</td>
                <td className="p-3 font-mono">{l.sku}</td>
                <td className="p-3">
                  <div>{l.name_th}</div>
                  <div className="text-xs text-gray-400">{l.name_en}</div>
                </td>
                <td className="p-3 text-right">{formatQty(l.qty_requested)}</td>
                <td className="p-3">{l.uom_code}</td>
                <td className="p-3 text-right">{formatCurrency(l.unit_cost)}</td>
                <td className="p-3 text-gray-500">{l.notes ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      <div className="flex gap-3 justify-end flex-wrap">
        {pr.status === 'draft' && (
          <Button onClick={() => action('submit')} loading={acting}>ส่งอนุมัติ</Button>
        )}
        {['submitted', 'manager_approved'].includes(pr.status) && (
          <>
            <Button variant="danger" onClick={() => setShowReject(true)}>ปฏิเสธ</Button>
            <Button onClick={() => action('approve')} loading={acting}>อนุมัติ</Button>
          </>
        )}
        {pr.status === 'admin_approved' && (
          <>
            <Button variant="ghost" onClick={() => router.push(`/app/purchase-orders/new?pr_id=${pr.id}`)}>
              แปลงเป็น PO
            </Button>
            <Button onClick={() => setShowReceive(true)} className="bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-2">
              <ShoppingBag className="w-4 h-4" /> รับสินค้าตาม PR
            </Button>
          </>
        )}
      </div>

      {showReject && (
        <Modal open onClose={() => setShowReject(false)}>
          <ModalHeader onClose={() => setShowReject(false)}>ปฏิเสธคำขอ</ModalHeader>
          <ModalBody>
            <Input
              label="เหตุผล *"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
            />
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" onClick={() => setShowReject(false)}>ยกเลิก</Button>
            <Button variant="danger" onClick={async () => {
              await action('reject', { reason: rejectReason });
              setShowReject(false);
            }} loading={acting}>ยืนยันปฏิเสธ</Button>
          </ModalFooter>
        </Modal>
      )}

      {showReceive && (
        <Modal open onClose={() => setShowReceive(false)} size="lg">
          <ModalHeader onClose={() => setShowReceive(false)}>รับสินค้าตรงจาก PR (ข้าม PO)</ModalHeader>
          <ModalBody>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Select
                  label="ผู้จำหน่าย (ถ้ามี)"
                  value={receiveData.vendor_id}
                  onChange={(e) => setReceiveData(prev => ({ ...prev, vendor_id: e.target.value }))}
                  options={vendors.map(v => ({ value: v.id, label: `${v.code} — ${v.name_th}` }))}
                  placeholder="-- เลือกผู้จำหน่าย --"
                />
                <Input
                  label="หมายเหตุการรับ"
                  value={receiveData.notes}
                  onChange={(e) => setReceiveData(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="เช่น รับของแถม, รับด่วน..."
                />
              </div>

              <div className="border border-stone-200 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-stone-50">
                    <tr>
                      <th className="text-left p-2 font-medium text-stone-600">สินค้า</th>
                      <th className="text-right p-2 font-medium text-stone-600 w-32">จำนวนที่รับ</th>
                      <th className="text-right p-2 font-medium text-stone-600 w-32">ราคาทุน/หน่วย</th>
                    </tr>
                  </thead>
                  <tbody>
                    {receiveData.lines.map((l, i) => (
                      <tr key={l.pr_line_item_id} className="border-t border-stone-100">
                        <td className="p-2 text-stone-900">{l.name}</td>
                        <td className="p-2">
                          <input
                            type="number" min="0.0001" step="any"
                            value={l.qty_received}
                            onChange={(e) => updateReceiveLine(i, 'qty_received', parseFloat(e.target.value) || 0)}
                            className="w-full bg-stone-50 border border-stone-200 rounded-md px-2 py-1 text-right font-mono focus:ring-1 focus:ring-emerald-500 outline-none"
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="number" min="0" step="any"
                            value={l.unit_cost}
                            onChange={(e) => updateReceiveLine(i, 'unit_cost', parseFloat(e.target.value) || 0)}
                            className="w-full bg-stone-50 border border-stone-200 rounded-md px-2 py-1 text-right font-mono focus:ring-1 focus:ring-emerald-500 outline-none"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-[11px] text-stone-500 italic">* การรับด้วยวิธีนี้จะสร้างใบรับสินค้า (GRN) สถานะ &apos;เข้าคลังแล้ว&apos; และตัดยอด PR ทันที</p>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" onClick={() => setShowReceive(false)}>ยกเลิก</Button>
            <Button onClick={handleReceive} loading={acting} className="bg-emerald-600 text-white">บันทึกรับสินค้า</Button>
          </ModalFooter>
        </Modal>
      )}
    </div>
  );
}

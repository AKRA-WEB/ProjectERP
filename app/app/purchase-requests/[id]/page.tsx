'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button, StatusBadge, Modal, ModalHeader, ModalBody, ModalFooter, Input } from '@/components/ui';
import { get, post } from '@/lib/api-client';
import { formatDate, formatCurrency } from '@/lib/format';
import type { PrStatus } from '@/types';

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

  async function fetchPR() {
    setLoading(true);
    try { setPr(await get<PRDetail>(`/api/purchase-requests/${id}`)); } finally { setLoading(false); }
  }

  useEffect(() => { fetchPR(); }, [id]);

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

      <div className="rounded-xl bg-white shadow-sm border border-gray-100 mb-6">
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
                <td className="p-3 text-right">{l.qty_requested}</td>
                <td className="p-3">{l.uom_code}</td>
                <td className="p-3 text-right">{formatCurrency(l.unit_cost)}</td>
                <td className="p-3 text-gray-500">{l.notes ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      <div className="flex gap-3 justify-end">
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
          <Button onClick={() => router.push(`/app/purchase-orders/new?pr_id=${pr.id}`)}>
            แปลงเป็น PO
          </Button>
        )}
      </div>

      {showReject && (
        <Modal open onClose={() => setShowReject(false)}>
          <ModalHeader>ปฏิเสธคำขอ</ModalHeader>
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
    </div>
  );
}

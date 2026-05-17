'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button, StatusBadge, Input } from '@/components/ui';
import { get, patch } from '@/lib/api-client';
import { formatDate, formatQty } from '@/lib/format';
import type { RmaStatus, RmaCondition } from '@/types';

interface RMALine {
  id: string;
  line_number: number;
  sku: string;
  name_th: string;
  name_en: string;
  qty_returned: number;
  uom_code: string;
  condition: RmaCondition;
  notes: string | null;
}

interface RMADetail {
  id: string;
  rma_number: string;
  status: RmaStatus;
  vendor_code: string;
  vendor_name: string;
  warehouse_code: string;
  warehouse_name: string;
  initiated_by_name: string;
  created_at: string;
  notes: string | null;
  resolution_notes: string | null;
  lines: RMALine[];
}

export default function RMADetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [rma, setRma] = useState<RMADetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [error, setError] = useState('');
  const [showResolve, setShowResolve] = useState(false);
  const [resolutionNotes, setResolutionNotes] = useState('');

  const fetchRMA = useCallback(async () => {
    setLoading(true);
    try { setRma(await get<RMADetail>(`/api/rma/${id}`)); } finally { setLoading(false); }
  }, [id]);

  useEffect(() => { fetchRMA(); }, [fetchRMA]);

  async function action(body: object) {
    setError('');
    setActing(true);
    try {
      await patch(`/api/rma/${id}`, body);
      await fetchRMA();
      setShowResolve(false);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'เกิดข้อผิดพลาด');
    } finally { setActing(false); }
  }

  if (loading) return <div className="py-16 text-center text-gray-400">กำลังโหลด...</div>;
  if (!rma) return <div className="py-16 text-center text-gray-400">ไม่พบข้อมูล</div>;

  return (
    <div className="max-w-4xl">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <button className="text-sm text-gray-500 hover:underline mb-1" onClick={() => router.back()}>← ย้อนกลับ</button>
          <h1 className="text-2xl font-bold text-gray-900 font-mono">{rma.rma_number}</h1>
        </div>
        <StatusBadge status={rma.status} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'ผู้จำหน่าย', value: `${rma.vendor_code} — ${rma.vendor_name}` },
          { label: 'คลังสินค้า', value: `${rma.warehouse_code} — ${rma.warehouse_name}` },
          { label: 'ผู้แจ้ง', value: rma.initiated_by_name },
          { label: 'วันที่สร้าง', value: formatDate(rma.created_at) },
        ].map((f) => (
          <div key={f.label} className="rounded-lg bg-white border border-gray-100 p-4">
            <p className="text-xs text-gray-400 mb-1">{f.label}</p>
            <p className="text-sm font-medium">{f.value}</p>
          </div>
        ))}
      </div>

      {rma.notes && (
        <div className="mb-4 rounded-lg bg-gray-50 border border-gray-200 px-4 py-3 text-sm text-gray-700">
          <strong>หมายเหตุ:</strong> {rma.notes}
        </div>
      )}

      {rma.resolution_notes && (
        <div className="mb-4 rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">
          <strong>บันทึกการแก้ไข:</strong> {rma.resolution_notes}
        </div>
      )}

      <div className="rounded-xl bg-white shadow-sm border border-gray-100 mb-6 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left p-3 font-medium">#</th>
              <th className="text-left p-3 font-medium">SKU</th>
              <th className="text-left p-3 font-medium">สินค้า</th>
              <th className="text-right p-3 font-medium">จำนวนคืน</th>
              <th className="text-left p-3 font-medium">หน่วย</th>
              <th className="text-left p-3 font-medium">สภาพ</th>
              <th className="text-left p-3 font-medium">หมายเหตุ</th>
            </tr>
          </thead>
          <tbody>
            {rma.lines?.map((l: RMALine) => (
              <tr key={l.id} className="border-t">
                <td className="p-3 text-gray-400">{l.line_number}</td>
                <td className="p-3 font-mono text-xs">{l.sku}</td>
                <td className="p-3">
                  <div>{l.name_th}</div>
                  <div className="text-xs text-gray-400">{l.name_en}</div>
                </td>
                <td className="p-3 text-right">{formatQty(l.qty_returned)}</td>
                <td className="p-3">{l.uom_code}</td>
                <td className="p-3">
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                    l.condition === 'resaleable' ? 'bg-green-100 text-green-700' :
                    l.condition === 'repack_resell' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-red-100 text-red-700'
                  }`}>
                    {l.condition === 'resaleable' ? 'ขายได้' :
                     l.condition === 'repack_resell' ? 'บรรจุใหม่' : 'คืนผู้จำหน่าย'}
                  </span>
                </td>
                <td className="p-3 text-gray-500 text-xs">{l.notes ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showResolve && (
        <div className="rounded-xl bg-white shadow-sm border border-gray-100 p-6 mb-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">บันทึกการแก้ไข</h2>
          <Input
            label="รายละเอียดการแก้ไข *"
            value={resolutionNotes}
            onChange={(e) => setResolutionNotes(e.target.value)}
            placeholder="ระบุวิธีแก้ไขและผลลัพธ์..."
          />
          <div className="flex gap-3 justify-end mt-4">
            <Button variant="ghost" onClick={() => setShowResolve(false)}>ยกเลิก</Button>
            <Button onClick={() => action({ action: 'resolve', resolution_notes: resolutionNotes })} loading={acting}>บันทึก</Button>
          </div>
        </div>
      )}

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      <div className="flex gap-3 justify-end">
        {rma.status === 'open' && (
          <Button variant="secondary" onClick={() => action({ action: 'review' })} loading={acting}>เริ่มพิจารณา</Button>
        )}
        {['open', 'in_review'].includes(rma.status) && !showResolve && (
          <Button onClick={() => setShowResolve(true)}>แก้ไขแล้ว</Button>
        )}
        {rma.status === 'resolved' && (
          <Button variant="secondary" onClick={() => action({ action: 'close' })} loading={acting}>ปิด RMA</Button>
        )}
      </div>
    </div>
  );
}

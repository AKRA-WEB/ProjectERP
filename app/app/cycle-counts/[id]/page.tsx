'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button, StatusBadge, Badge } from '@/components/ui';
import { get, patch } from '@/lib/api-client';
import { formatQty } from '@/lib/format';
import type { CycleCountStatus } from '@/types';

interface CycleCountLine {
  id: string;
  line_number: number;
  product_id: string;
  sku: string;
  name_th: string;
  uom_code: string;
  qty_system: string | number;
  qty_counted: string | number | null;
  qty_variance: string | number | null;
  notes: string | null;
}

interface CycleCount {
  id: string;
  count_number: string;
  status: CycleCountStatus;
  warehouse_code: string;
  warehouse_name: string;
  rejection_reason: string | null;
  lines: CycleCountLine[];
}

interface CountedLineState {
  id: string;
  qty_counted: string | number;
  notes: string;
}

export default function CycleCountDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [cc, setCc] = useState<CycleCount | null>(null);
  const [loading, setLoading] = useState(true);
  const [countedLines, setCountedLines] = useState<CountedLineState[]>([]);
  const [acting, setActing] = useState(false);
  const [error, setError] = useState('');
  const [editMode, setEditMode] = useState(false);

  async function fetchCC() {
    setLoading(true);
    try {
      const data = await get<CycleCount>(`/api/cycle-counts/${id}`);
      setCc(data);
      setCountedLines(data.lines?.map((l) => ({
        id: l.id,
        qty_counted: l.qty_counted ?? '',
        notes: l.notes ?? '',
      })) ?? []);
    } finally { setLoading(false); }
  }

  useEffect(() => { fetchCC(); }, [id]);

  async function action(actionName: string, extra: object = {}) {
    setError('');
    setActing(true);
    try {
      await patch(`/api/cycle-counts/${id}`, { action: actionName, ...extra });
      await fetchCC();
      setEditMode(false);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'เกิดข้อผิดพลาด');
    } finally { setActing(false); }
  }

  function updateLine(i: number, key: string, val: string | number) {
    setCountedLines((prev) => prev.map((l, idx) => idx === i ? { ...l, [key]: val } : l));
  }

  if (loading) return <div className="py-16 text-center text-gray-400">กำลังโหลด...</div>;
  if (!cc) return <div className="py-16 text-center text-gray-400">ไม่พบข้อมูล</div>;

  return (
    <div className="max-w-5xl">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <button className="text-sm text-gray-500 hover:underline mb-1" onClick={() => router.back()}>← ย้อนกลับ</button>
          <h1 className="text-2xl font-bold text-gray-900 font-mono">{cc.count_number}</h1>
          <p className="text-sm text-gray-500">{cc.warehouse_code} — {cc.warehouse_name}</p>
        </div>
        <StatusBadge status={cc.status} />
      </div>

      {cc.rejection_reason && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-700">
          <strong>เหตุผลที่ส่งกลับ:</strong> {cc.rejection_reason}
        </div>
      )}

      <div className="rounded-xl bg-white shadow-sm border border-gray-100 mb-6 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left p-3 font-medium">#</th>
              <th className="text-left p-3 font-medium">SKU</th>
              <th className="text-left p-3 font-medium">สินค้า</th>
              <th className="text-right p-3 font-medium">ยอดระบบ</th>
              <th className="text-right p-3 font-medium">ยอดนับได้</th>
              <th className="text-right p-3 font-medium">ส่วนต่าง</th>
              {editMode && <th className="p-3 font-medium">หมายเหตุ</th>}
            </tr>
          </thead>
          <tbody>
            {cc.lines?.map((l, i) => {
              const variance = l.qty_variance;
              return (
                <tr key={l.id} className="border-t">
                  <td className="p-3 text-gray-400">{l.line_number}</td>
                  <td className="p-3 font-mono text-xs">{l.sku}</td>
                  <td className="p-3">{l.name_th}</td>
                  <td className="p-3 text-right">{formatQty(l.qty_system)} {l.uom_code}</td>
                  <td className="p-3">
                    {editMode ? (
                      <input type="number" min="0" step="any"
                        value={countedLines[i]?.qty_counted ?? ''}
                        onChange={(e) => updateLine(i, 'qty_counted', parseFloat(e.target.value))}
                        className="w-24 text-right rounded border px-2 py-1 ml-auto block" />
                    ) : (
                      <span className="float-right">{l.qty_counted != null ? formatQty(l.qty_counted) : '—'}</span>
                    )}
                  </td>
                  <td className="p-3 text-right">
                    {variance != null ? (
                      <Badge variant={Number(variance) === 0 ? 'gray' : Number(variance) > 0 ? 'green' : 'red'}>
                        {Number(variance) > 0 ? '+' : ''}{formatQty(variance)}
                      </Badge>
                    ) : '—'}
                  </td>
                  {editMode && (
                    <td className="p-2">
                      <input value={countedLines[i]?.notes ?? ''} onChange={(e) => updateLine(i, 'notes', e.target.value)} className="w-full rounded border px-2 py-1 text-sm" />
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      <div className="flex gap-3 justify-end">
        {['open', 'counting'].includes(cc.status) && !editMode && (
          <Button variant="secondary" onClick={() => setEditMode(true)}>บันทึกยอดนับ</Button>
        )}
        {editMode && (
          <>
            <Button variant="ghost" onClick={() => setEditMode(false)}>ยกเลิก</Button>
            <Button onClick={() => action('submit_counts', {
              lines: countedLines.filter((l) => l.qty_counted !== '').map((l) => ({
                id: l.id, qty_counted: Number(l.qty_counted), notes: l.notes || undefined,
              })),
            })} loading={acting}>บันทึก</Button>
          </>
        )}
        {cc.status === 'counting' && !editMode && (
          <Button onClick={() => action('submit_for_approval')} loading={acting}>ส่งขออนุมัติ</Button>
        )}
        {cc.status === 'pending_approval' && (
          <>
            <Button variant="danger" onClick={() => {
              const reason = prompt('เหตุผลที่ส่งกลับ:');
              if (reason) action('reject', { reason });
            }}>ส่งกลับแก้ไข</Button>
            <Button onClick={() => action('approve')} loading={acting}>อนุมัติและปรับยอด</Button>
          </>
        )}
      </div>
    </div>
  );
}

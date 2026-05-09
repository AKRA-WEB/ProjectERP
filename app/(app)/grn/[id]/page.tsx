'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button, StatusBadge, Badge, Input } from '@/components/ui';
import { get, post } from '@/lib/api-client';
import { formatDate, formatQty } from '@/lib/format';

export default function GRNDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [grn, setGrn] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [error, setError] = useState('');
  const [qcLines, setQcLines] = useState<any[]>([]);
  const [showQC, setShowQC] = useState(false);
  const [qcNotes, setQcNotes] = useState('');

  async function fetchGRN() {
    setLoading(true);
    try {
      const data = await get<any>(`/api/grn/${id}`);
      setGrn(data);
      setQcLines(data.lines?.map((l: any) => ({
        id: l.id,
        qty_accepted: l.qty_accepted ?? l.qty_received,
        qty_rejected: l.qty_rejected ?? 0,
        qc_status: l.qc_status ?? 'pass',
        qc_notes: l.qc_notes ?? '',
      })) ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchGRN(); }, [id]);

  async function action(path: string, body: object = {}) {
    setError('');
    setActing(true);
    try {
      await post(`/api/grn/${id}/${path}`, body);
      await fetchGRN();
      setShowQC(false);
    } catch (e: any) {
      setError(e.message ?? 'เกิดข้อผิดพลาด');
    } finally {
      setActing(false);
    }
  }

  function updateQcLine(i: number, key: string, val: number | string) {
    setQcLines((prev) => prev.map((l, idx) => idx === i ? { ...l, [key]: val } : l));
  }

  if (loading) return <div className="py-16 text-center text-gray-400">กำลังโหลด...</div>;
  if (!grn) return <div className="py-16 text-center text-gray-400">ไม่พบข้อมูล</div>;

  return (
    <div className="max-w-5xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <button className="text-sm text-gray-500 hover:underline mb-1" onClick={() => router.back()}>← ย้อนกลับ</button>
          <h1 className="text-2xl font-bold text-gray-900 font-mono">{grn.grn_number}</h1>
        </div>
        <StatusBadge status={grn.status} />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'เลข PO', value: grn.po_number },
          { label: 'คลังสินค้า', value: `${grn.warehouse_code} — ${grn.warehouse_name}` },
          { label: 'ผู้รับ', value: grn.received_by_name },
          { label: 'วันที่รับ', value: formatDate(grn.received_date) },
        ].map((f) => (
          <div key={f.label} className="rounded-lg bg-white border border-gray-100 p-4">
            <p className="text-xs text-gray-400 mb-1">{f.label}</p>
            <p className="text-sm font-medium">{f.value}</p>
          </div>
        ))}
      </div>

      {/* QC form */}
      {showQC ? (
        <div className="rounded-xl bg-white shadow-sm border border-gray-100 p-6 mb-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">QC Review</h2>
          <table className="w-full text-sm mb-4">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left p-2 font-medium">SKU / สินค้า</th>
                <th className="text-right p-2 font-medium w-24">รับมา</th>
                <th className="text-right p-2 font-medium w-24">ยอมรับ</th>
                <th className="text-right p-2 font-medium w-24">ปฏิเสธ</th>
                <th className="p-2 font-medium w-28">ผล QC</th>
              </tr>
            </thead>
            <tbody>
              {grn.lines?.map((l: any, i: number) => (
                <tr key={l.id} className="border-t">
                  <td className="p-2">
                    <div className="font-mono text-xs">{l.sku}</div>
                    <div>{l.name_th}</div>
                  </td>
                  <td className="p-2 text-right">{l.qty_received}</td>
                  <td className="p-2">
                    <input type="number" min="0" step="any" value={qcLines[i]?.qty_accepted ?? 0}
                      onChange={(e) => updateQcLine(i, 'qty_accepted', parseFloat(e.target.value) || 0)}
                      className="w-full text-right rounded border px-2 py-1" />
                  </td>
                  <td className="p-2">
                    <input type="number" min="0" step="any" value={qcLines[i]?.qty_rejected ?? 0}
                      onChange={(e) => updateQcLine(i, 'qty_rejected', parseFloat(e.target.value) || 0)}
                      className="w-full text-right rounded border px-2 py-1" />
                  </td>
                  <td className="p-2">
                    <select value={qcLines[i]?.qc_status ?? 'pass'}
                      onChange={(e) => updateQcLine(i, 'qc_status', e.target.value)}
                      className="w-full rounded border px-2 py-1 text-sm">
                      <option value="pass">ผ่าน</option>
                      <option value="partial">บางส่วน</option>
                      <option value="fail">ไม่ผ่าน</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <Input label="หมายเหตุ QC" value={qcNotes} onChange={(e) => setQcNotes(e.target.value)} />
          <div className="flex gap-3 justify-end mt-4">
            <Button variant="ghost" onClick={() => setShowQC(false)}>ยกเลิก</Button>
            <Button onClick={() => action('qc', { qc_notes: qcNotes, lines: qcLines })} loading={acting}>บันทึก QC</Button>
          </div>
        </div>
      ) : (
        <div className="rounded-xl bg-white shadow-sm border border-gray-100 mb-6">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left p-3 font-medium">#</th>
                <th className="text-left p-3 font-medium">SKU</th>
                <th className="text-left p-3 font-medium">สินค้า</th>
                <th className="text-right p-3 font-medium">รับมา</th>
                <th className="text-right p-3 font-medium">ยอมรับ</th>
                <th className="text-right p-3 font-medium">ปฏิเสธ</th>
                <th className="p-3 font-medium">Lot</th>
                <th className="p-3 font-medium">QC</th>
              </tr>
            </thead>
            <tbody>
              {grn.lines?.map((l: any) => (
                <tr key={l.id} className="border-t">
                  <td className="p-3 text-gray-400">{l.line_number}</td>
                  <td className="p-3 font-mono text-xs">{l.sku}</td>
                  <td className="p-3">{l.name_th}</td>
                  <td className="p-3 text-right">{formatQty(l.qty_received)} {l.uom_code}</td>
                  <td className="p-3 text-right text-green-600">{l.qty_accepted != null ? formatQty(l.qty_accepted) : '—'}</td>
                  <td className="p-3 text-right text-red-500">{l.qty_rejected != null ? formatQty(l.qty_rejected) : '—'}</td>
                  <td className="p-3 text-xs text-gray-500">{l.lot_number ?? '—'}</td>
                  <td className="p-3">
                    {l.qc_status ? (
                      <Badge variant={l.qc_status === 'pass' ? 'green' : l.qc_status === 'partial' ? 'yellow' : 'red'}>
                        {l.qc_status}
                      </Badge>
                    ) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      <div className="flex gap-3 justify-end">
        {grn.status === 'draft' && <Button onClick={() => action('receive')} loading={acting}>ยืนยันรับสินค้า</Button>}
        {grn.status === 'received' && <Button onClick={() => setShowQC(true)}>เริ่ม QC</Button>}
        {grn.status === 'qc_passed' && <Button onClick={() => action('stock')} loading={acting}>นำเข้าคลัง</Button>}
      </div>
    </div>
  );
}

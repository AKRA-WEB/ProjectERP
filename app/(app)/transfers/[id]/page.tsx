'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { StatusBadge } from '@/components/ui';
import { get } from '@/lib/api-client';
import { formatDate, formatQty } from '@/lib/format';

export default function TransferDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [transfer, setTransfer] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    get<any>(`/api/transfers/${id}`).then(setTransfer).finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="py-16 text-center text-gray-400">กำลังโหลด...</div>;
  if (!transfer) return <div className="py-16 text-center text-gray-400">ไม่พบข้อมูล</div>;

  return (
    <div className="max-w-4xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <button className="text-sm text-gray-500 hover:underline mb-1" onClick={() => router.back()}>← ย้อนกลับ</button>
          <h1 className="text-2xl font-bold text-gray-900 font-mono">{transfer.transfer_number}</h1>
        </div>
        <StatusBadge status={transfer.status} />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'คลังต้นทาง', value: `${transfer.source_code} — ${transfer.source_name}` },
          { label: 'คลังปลายทาง', value: `${transfer.dest_code} — ${transfer.dest_name}` },
          { label: 'ผู้โอน', value: transfer.initiated_by_name },
          { label: 'วันที่โอน', value: formatDate(transfer.created_at) },
        ].map((f) => (
          <div key={f.label} className="rounded-lg bg-white border border-gray-100 p-4">
            <p className="text-xs text-gray-400 mb-1">{f.label}</p>
            <p className="text-sm font-medium">{f.value}</p>
          </div>
        ))}
      </div>

      {transfer.notes && (
        <div className="mb-4 rounded-lg bg-gray-50 border border-gray-200 px-4 py-3 text-sm text-gray-700">
          <strong>หมายเหตุ:</strong> {transfer.notes}
        </div>
      )}

      <div className="rounded-xl bg-white shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left p-3 font-medium">#</th>
              <th className="text-left p-3 font-medium">SKU</th>
              <th className="text-left p-3 font-medium">สินค้า</th>
              <th className="text-left p-3 font-medium">Lot</th>
              <th className="text-right p-3 font-medium">จำนวน</th>
              <th className="text-left p-3 font-medium">หน่วย</th>
            </tr>
          </thead>
          <tbody>
            {transfer.lines?.map((l: any) => (
              <tr key={l.id} className="border-t">
                <td className="p-3 text-gray-400">{l.line_number}</td>
                <td className="p-3 font-mono text-xs">{l.sku}</td>
                <td className="p-3">
                  <div>{l.name_th}</div>
                  <div className="text-xs text-gray-400">{l.name_en}</div>
                </td>
                <td className="p-3 text-xs text-gray-500">{l.lot_number ?? '—'}</td>
                <td className="p-3 text-right font-medium">{formatQty(l.qty)}</td>
                <td className="p-3">{l.uom_code}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

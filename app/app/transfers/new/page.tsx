'use client';

/* eslint-disable local-rules/no-hardcoded-thai */
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Select, Input } from '@/components/ui';
import { get, post } from '@/lib/api-client';
import type { Warehouse, PaginatedResponse } from '@/types';

interface StockResult {
  product_id: string;
  sku: string;
  name_th: string;
  qty_available: string;
  uom_code: string;
}

interface TransferLine { product_id: string; product_label: string; lot_id?: string; qty: number; }

export default function NewTransferPage() {
  const router = useRouter();
  const [warehouses, setWarehouses] = useState<{ value: string; label: string }[]>([]);
  const [sourceId, setSourceId] = useState('');
  const [destId, setDestId] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<TransferLine[]>([]);
  const [stockSearch, setStockSearch] = useState('');
  const [stockResults, setStockResults] = useState<StockResult[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    get<Warehouse[]>('/api/admin/warehouses').then((data) =>
      setWarehouses(data.map((w) => ({ value: w.id, label: `${w.code} — ${w.name_th}` })))
    );
  }, []);

  async function searchStock(q: string) {
    setStockSearch(q);
    if (!q || !sourceId) { setStockResults([]); return; }
    const res = await get<PaginatedResponse<StockResult>>(`/api/stock?warehouse_id=${sourceId}&search=${encodeURIComponent(q)}&limit=10`);
    setStockResults(res.data ?? []);
  }

  function addLine(item: StockResult) {
    setLines((prev) => [...prev, { product_id: item.product_id, product_label: `${item.sku} — ${item.name_th} (พร้อมโอน: ${item.qty_available})`, qty: 1 }]);
    setStockSearch('');
    setStockResults([]);
  }

  function updateQty(i: number, qty: number) {
    setLines((prev) => prev.map((l, idx) => idx === i ? { ...l, qty } : l));
  }

  async function handleSubmit() {
    if (!sourceId || !destId) { setError('กรุณาเลือกคลังต้นทางและปลายทาง'); return; }
    if (sourceId === destId) { setError('คลังต้นทางและปลายทางต้องต่างกัน'); return; }
    if (lines.length === 0) { setError('กรุณาเพิ่มรายการสินค้า'); return; }
    setError('');
    setSaving(true);
    try {
      const result = await post<{ id: string }>('/api/transfers', {
        source_warehouse_id: sourceId,
        dest_warehouse_id: destId,
        notes: notes || undefined,
        lines: lines.map((l) => ({ product_id: l.product_id, lot_id: l.lot_id, qty: l.qty })),
      });
      router.push(`/app/transfers/${result.id}`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'เกิดข้อผิดพลาด');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-3xl">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-gray-900">สร้างการโอนสินค้า</h1>
        <button className="text-sm text-gray-500 hover:underline" onClick={() => router.back()}>← ย้อนกลับ</button>
      </div>

      <div className="rounded-xl bg-white shadow-sm border border-gray-100 p-6 space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Select label="คลังต้นทาง *" value={sourceId} onChange={(e) => { setSourceId(e.target.value); setLines([]); }} options={warehouses} placeholder="เลือกคลังต้นทาง" />
          <Select label="คลังปลายทาง *" value={destId} onChange={(e) => setDestId(e.target.value)} options={warehouses.filter((w) => w.value !== sourceId)} placeholder="เลือกคลังปลายทาง" />
          <div className="col-span-2"><Input label="หมายเหตุ" value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
        </div>

        <div>
          <h2 className="text-sm font-semibold text-gray-700 mb-3">รายการสินค้า</h2>
          {sourceId ? (
            <div className="relative mb-4">
              <Input label="ค้นหาสินค้าในคลังต้นทาง" value={stockSearch} onChange={(e) => searchStock(e.target.value)} placeholder="พิมพ์ SKU หรือชื่อสินค้า..." />
              {stockResults.length > 0 && (
                <div className="absolute z-10 mt-1 w-full rounded-lg border bg-white shadow-lg">
                  {stockResults.map((s, i) => (
                    <button key={i} type="button" className="w-full text-left px-4 py-2 hover:bg-gray-50 text-sm" onClick={() => addLine(s)}>
                      <span className="font-mono font-medium">{s.sku}</span> — {s.name_th}
                      <span className="ml-2 text-gray-400">พร้อมโอน: {s.qty_available} {s.uom_code}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : <p className="text-sm text-gray-400 mb-4">เลือกคลังต้นทางก่อน</p>}

          {lines.length > 0 && (
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left p-3 font-medium text-gray-600">สินค้า</th>
                    <th className="text-right p-3 font-medium text-gray-600 w-28">จำนวน</th>
                    <th className="w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l, i) => (
                    <tr key={i} className="border-t">
                      <td className="p-3">{l.product_label}</td>
                      <td className="p-2">
                        <input type="number" min="0.01" step="any" value={l.qty}
                          onChange={(e) => updateQty(i, parseFloat(e.target.value) || 0)}
                          className="w-full text-right rounded border px-2 py-1" />
                      </td>
                      <td className="p-2 text-center">
                        <button onClick={() => setLines((prev) => prev.filter((_, idx) => idx !== i))} className="text-red-400 hover:text-red-600">✕</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end">
          <Button onClick={handleSubmit} loading={saving}>ยืนยันการโอน</Button>
        </div>
      </div>
    </div>
  );
}

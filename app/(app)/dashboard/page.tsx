'use client';

import { useState, useEffect } from 'react';
import { get } from '@/lib/api-client';
import { formatCurrency, formatQty } from '@/lib/format';
import { Badge } from '@/components/ui';
import Link from 'next/link';
import type { Warehouse } from '@/types';

interface KPIData {
  pr: { pending_approval: number; last_30_days: number };
  po: { sent: number; value_30_days: string | number };
  grn: { pending: number; stocked_this_month: number; qc_failed: number };
  rma: { open_rmas: number; in_review: number };
  low_stock: Array<{
    sku: string;
    name_th: string;
    warehouse_code: string;
    qty_available: string | number;
    reorder_point: number;
  }>;
  recent_ledger: Array<{
    sku: string;
    name_th: string;
    warehouse_code: string;
    entry_type: string;
    qty_change: string | number;
  }>;
  claims: { open_claims: number; open_claim_value: string | number };
}

export default function DashboardPage() {
  const [kpi, setKpi] = useState<KPIData | null>(null);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [warehouseId, setWarehouseId] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    get<Warehouse[]>('/api/admin/warehouses').then(setWarehouses);
  }, []);

  useEffect(() => {
    setLoading(true);
    const params = warehouseId ? `?warehouse_id=${warehouseId}` : '';
    get<KPIData>(`/api/kpi${params}`).then(setKpi).finally(() => setLoading(false));
  }, [warehouseId]);

  const StatCard = ({ label, value, href, sub }: { label: string; value: string | number; href?: string; sub?: string }) => (
    <div className="rounded-xl bg-white border border-gray-100 p-5 shadow-sm">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
      <p className="mt-2 text-3xl font-bold text-gray-900">{loading ? '—' : value}</p>
      {sub && <p className="mt-1 text-sm text-gray-400">{sub}</p>}
      {href && <Link href={href} className="mt-3 inline-block text-xs text-blue-600 hover:underline">ดูทั้งหมด →</Link>}
    </div>
  );

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">ภาพรวม / Dashboard</h1>
        <select
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
          value={warehouseId}
          onChange={(e) => setWarehouseId(e.target.value)}
        >
          <option value="">ทุกคลัง</option>
          {warehouses.map((w) => <option key={w.id} value={w.id}>{w.code} — {w.name_th}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="PR รอนุมัติ" value={kpi?.pr?.pending_approval ?? '—'} href="/app/purchase-requests?status=submitted" sub={`สร้างใหม่ 30 วัน: ${kpi?.pr?.last_30_days ?? '—'}`} />
        <StatCard label="PO ส่งแล้ว" value={kpi?.po?.sent ?? '—'} href="/app/purchase-orders?status=sent" sub={`มูลค่า 30 วัน: ${kpi?.po?.value_30_days ? formatCurrency(kpi.po.value_30_days) : '—'}`} />
        <StatCard label="GRN รอดำเนินการ" value={kpi?.grn?.pending ?? '—'} href="/app/grn" sub={`นำเข้าเดือนนี้: ${kpi?.grn?.stocked_this_month ?? '—'}`} />
        <StatCard label="RMA เปิด" value={kpi?.rma?.open_rmas ?? '—'} href="/app/rma" sub={`กำลังพิจารณา: ${kpi?.rma?.in_review ?? '—'}`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Low stock */}
        <div className="rounded-xl bg-white border border-gray-100 shadow-sm">
          <div className="p-4 border-b flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-700">สินค้าใกล้หมด / Low Stock</h2>
            <Link href="/app/inventory?low_stock=true" className="text-xs text-blue-600 hover:underline">ดูทั้งหมด</Link>
          </div>
          <div className="divide-y">
            {loading ? (
              <p className="p-4 text-sm text-gray-400">กำลังโหลด...</p>
            ) : kpi?.low_stock?.length === 0 ? (
              <p className="p-4 text-sm text-gray-400">ไม่มีสินค้าต่ำกว่า reorder point</p>
            ) : kpi?.low_stock?.map((s, i) => (
              <div key={i} className="p-3 flex items-center justify-between">
                <div>
                  <span className="font-mono text-xs font-medium">{s.sku}</span>
                  <span className="ml-2 text-sm text-gray-600">{s.name_th}</span>
                  <span className="ml-2 text-xs text-gray-400">{s.warehouse_code}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="red">{formatQty(s.qty_available)}</Badge>
                  <span className="text-xs text-gray-400">/ {formatQty(s.reorder_point)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent ledger */}
        <div className="rounded-xl bg-white border border-gray-100 shadow-sm">
          <div className="p-4 border-b flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-700">ความเคลื่อนไหวล่าสุด</h2>
            <Link href="/app/inventory/ledger" className="text-xs text-blue-600 hover:underline">ดูทั้งหมด</Link>
          </div>
          <div className="divide-y">
            {loading ? (
              <p className="p-4 text-sm text-gray-400">กำลังโหลด...</p>
            ) : kpi?.recent_ledger?.map((l, i) => (
              <div key={i} className="p-3 flex items-center justify-between">
                <div>
                  <span className="font-mono text-xs font-medium">{l.sku}</span>
                  <span className="ml-2 text-sm text-gray-600">{l.name_th}</span>
                  <div className="text-xs text-gray-400 mt-0.5">{l.entry_type.replace(/_/g, ' ')} · {l.warehouse_code}</div>
                </div>
                <Badge variant={Number(l.qty_change) > 0 ? 'green' : 'red'}>
                  {Number(l.qty_change) > 0 ? '+' : ''}{formatQty(l.qty_change)}
                </Badge>
              </div>
            ))}
          </div>
        </div>

        {/* Claims */}
        <div className="rounded-xl bg-white border border-gray-100 shadow-sm">
          <div className="p-4 border-b">
            <h2 className="text-sm font-semibold text-gray-700">การเรียกร้อง / Open Claims</h2>
          </div>
          <div className="p-4">
            {loading ? <p className="text-sm text-gray-400">กำลังโหลด...</p> : (
              <div className="flex items-center gap-6">
                <div>
                  <p className="text-xs text-gray-400">จำนวน</p>
                  <p className="text-2xl font-bold">{kpi?.claims?.open_claims ?? '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">มูลค่าคงค้าง</p>
                  <p className="text-2xl font-bold text-red-600">{kpi?.claims?.open_claim_value ? formatCurrency(kpi.claims.open_claim_value) : '—'}</p>
                </div>
                <Link href="/app/claims" className="text-xs text-blue-600 hover:underline">จัดการ →</Link>
              </div>
            )}
          </div>
        </div>

        {/* QC Failed GRNs */}
        <div className="rounded-xl bg-white border border-gray-100 shadow-sm">
          <div className="p-4 border-b">
            <h2 className="text-sm font-semibold text-gray-700">GRN QC ไม่ผ่าน</h2>
          </div>
          <div className="p-4">
            {loading ? <p className="text-sm text-gray-400">กำลังโหลด...</p> : (
              <div className="flex items-center gap-6">
                <div>
                  <p className="text-xs text-gray-400">เดือนนี้</p>
                  <p className="text-2xl font-bold text-red-600">{kpi?.grn?.qc_failed ?? '—'}</p>
                </div>
                <Link href="/app/grn?status=qc_failed" className="text-xs text-blue-600 hover:underline">ดูรายการ →</Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

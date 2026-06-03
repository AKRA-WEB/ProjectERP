'use client';

/* eslint-disable local-rules/no-hardcoded-thai */
import { useState, useEffect, useCallback } from 'react';
import { Button, Pagination, StatusBadge } from '@/components/ui';
import { get } from '@/lib/api-client';
import { formatDate } from '@/lib/format';
import type { PaginatedResponse, InboundOrder, Warehouse } from '@/types';
import Link from 'next/link';
import { DirectionalTransition } from '@/components/ui/directional-transition';

const borderColor: Record<string, string> = {
  open: 'border-l-emerald-400',
  receiving: 'border-l-blue-400',
  pending_verification: 'border-l-amber-400',
  verified: 'border-l-violet-400',
  converted_to_po: 'border-l-gray-400',
  rejected: 'border-l-red-400',
  closed: 'border-l-gray-300',
};

const statusLabel: Record<string, string> = {
  open: 'รอรับสินค้า',
  receiving: 'กำลังรับ',
  pending_verification: 'รอยืนยัน',
  verified: 'ยืนยันแล้ว',
  converted_to_po: 'เปิด PO แล้ว',
  rejected: 'ถูกตีกลับ',
  closed: 'ปิดแล้ว',
};

export default function InboundOrdersPage() {
  const [data, setData] = useState<PaginatedResponse<InboundOrder> | null>(null);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    get<Warehouse[]>('/api/admin/warehouses').then(setWarehouses);
  }, []);

  const fetchIOs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '25' });
      if (status) params.set('status', status);
      if (warehouseId) params.set('warehouse_id', warehouseId);
      const res = await get<PaginatedResponse<InboundOrder>>(`/api/inbound-orders?${params}`);
      setData(res);
    } finally {
      setLoading(false);
    }
  }, [page, status, warehouseId]);

  useEffect(() => { fetchIOs(); }, [fetchIOs]);

  return (
    <DirectionalTransition>
      <div className="max-w-[1440px] mx-auto pb-12">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">รายการรับสินค้าจาก LINE / Inbound Orders</h1>
            <p className="text-sm text-gray-500">{data?.total ?? '—'} รายการ</p>
          </div>
          <Link href="/app/inbound-orders/new" transitionTypes={['nav-forward']}>
            <Button className="w-full sm:w-auto">+ สร้าง IO ใหม่</Button>
          </Link>
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-3">
          <select
            className="w-full sm:w-auto rounded-lg border border-gray-300 px-3 py-2 text-sm"
            value={status}
            onChange={(e) => { setStatus(e.target.value); setPage(1); }}
          >
            <option value="">ทุกสถานะ</option>
            <option value="open">รอรับสินค้า</option>
            <option value="receiving">กำลังรับ</option>
            <option value="pending_verification">รอยืนยัน</option>
            <option value="verified">ยืนยันแล้ว</option>
            <option value="converted_to_po">เปิด PO แล้ว</option>
            <option value="rejected">ถูกตีกลับ</option>
            <option value="closed">ปิดแล้ว</option>
          </select>
          <select
            className="w-full sm:w-auto rounded-lg border border-gray-300 px-3 py-2 text-sm"
            value={warehouseId}
            onChange={(e) => { setWarehouseId(e.target.value); setPage(1); }}
          >
            <option value="">ทุกคลังสินค้า</option>
            {warehouses.map((w) => <option key={w.id} value={w.id}>{w.code} — {w.name_th}</option>)}
          </select>
        </div>

        <div className="space-y-3">
          {loading ? (
            <div className="py-8 text-center text-gray-400">กำลังโหลด...</div>
          ) : data?.data.length === 0 ? (
            <div className="py-8 text-center text-gray-400">ไม่พบข้อมูล</div>
          ) : (
            data?.data.map((io) => (
              <Link
                key={io.id}
                href={`/app/inbound-orders/${io.id}`}
                transitionTypes={['nav-forward']}
                className="block"
              >
                <div className={`p-4 bg-white rounded-xl shadow-sm border border-gray-100 border-l-4 ${borderColor[io.status] || 'border-l-gray-300'} hover:shadow-md hover:border-gray-200 transition-all duration-200`}>
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-gray-900">{io.io_number}</span>
                        <StatusBadge status={io.status} labelOverride={statusLabel[io.status]} />
                      </div>
                      <div className="text-sm text-gray-600 font-medium">
                        {io.vendor_name}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-500 mt-1">
                        <span>วันที่สั่ง: {formatDate(io.order_date)}</span>
                        <span className="text-gray-300">•</span>
                        <span>คลังสินค้า: {io.warehouse_code}</span>
                        <span className="text-gray-300">•</span>
                        <span>{io.line_count} รายการ</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-end sm:justify-start">
                      <span className="text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors">
                        ดูรายละเอียด →
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            ))
          )}
        </div>

        {data && (
          <div className="mt-4">
            <Pagination page={page} totalPages={data.total_pages} onPageChange={setPage} />
          </div>
        )}
      </div>
    </DirectionalTransition>
  );
}

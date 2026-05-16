'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button, Table, Thead, Tbody, Th, Td, Pagination, StatusBadge } from '@/components/ui';
import { get } from '@/lib/api-client';
import { formatDate } from '@/lib/format';
import type { PaginatedResponse, InboundOrder, Warehouse } from '@/types';
import Link from 'next/link';
import { DirectionalTransition } from '@/components/ui/directional-transition';

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
            <option value="pending_verification">รอตรวจสอบ</option>
            <option value="verified">ตรวจสอบแล้ว</option>
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

        <div className="rounded-xl bg-white shadow-sm border border-gray-100">
          <Table>
            <Thead>
              <tr>
                <Th>เลข IO</Th>
                <Th>ผู้จำหน่าย / Vendor</Th>
                <Th className="hidden sm:table-cell">คลังสินค้า</Th>
                <Th className="hidden sm:table-cell">รายการ</Th>
                <Th>สถานะ</Th>
                <Th className="hidden sm:table-cell">วันที่สร้าง</Th>
                <Th></Th>
              </tr>
            </Thead>
            <Tbody>
              {loading ? (
                <tr><Td colSpan={7}><div className="py-8 text-center text-gray-400">กำลังโหลด...</div></Td></tr>
              ) : data?.data.length === 0 ? (
                <tr><Td colSpan={7}><div className="py-8 text-center text-gray-400">ไม่พบข้อมูล</div></Td></tr>
              ) : (
                data?.data.map((io) => (
                  <tr key={io.id} className="hover:bg-gray-50">
                    <Td className="font-mono font-medium text-sm">{io.io_number}</Td>
                    <Td className="text-sm">{io.vendor_name}</Td>
                    <Td className="hidden sm:table-cell text-sm">{io.warehouse_code}</Td>
                    <Td className="hidden sm:table-cell text-sm text-center">{io.line_count}</Td>
                    <Td><StatusBadge status={io.status} /></Td>
                    <Td className="hidden sm:table-cell text-sm text-gray-500">{formatDate(io.created_at)}</Td>
                    <Td>
                      <Link href={`/app/inbound-orders/${io.id}`} transitionTypes={['nav-forward']} className="text-sm text-blue-600 hover:underline">ดูรายละเอียด</Link>
                    </Td>
                  </tr>
                ))
              )}
            </Tbody>
          </Table>
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

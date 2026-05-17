'use client';

import { useState, useEffect, useCallback } from 'react';
import { get } from '@/lib/api-client';
import { Button } from '@/components/ui/Button';
import { Table } from '@/components/ui/Table';
import { Pagination } from '@/components/ui/Pagination';
import { Select } from '@/components/ui/Select';
import { StatusBadge } from '@/components/ui/StatusBadge';
import Link from 'next/link';
import type { DeliveryOrder, PaginatedResponse, Warehouse } from '@/types';

const CARD = 'bg-white border border-stone-200 rounded-[10px] shadow-sm overflow-hidden';

export default function DeliveryOrdersPage() {
  const [data, setData] = useState<PaginatedResponse<DeliveryOrder> | null>(null);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [warehouseId, setWarehouseId] = useState('');

  useEffect(() => {
    get<Warehouse[]>('/api/admin/warehouses').then(setWarehouses).catch(console.error);
  }, []);

  const fetchDOs = useCallback(async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams({
        page: page.toString(),
        limit: '20',
        ...(status && { status }),
        ...(warehouseId && { warehouse_id: warehouseId }),
      });
      const res = await get<PaginatedResponse<DeliveryOrder>>(`/api/delivery-orders?${query}`);
      setData(res);
    } catch (error) {
      console.error('Failed to fetch delivery orders:', error);
    } finally {
      setLoading(false);
    }
  }, [page, status, warehouseId]);

  useEffect(() => {
    fetchDOs();
  }, [fetchDOs]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-stone-900">ใบส่งสินค้า / Delivery Orders</h1>
          <p className="text-stone-500 text-sm">จัดการการจัดส่งสินค้าให้ลูกค้าและตัดสต็อก</p>
        </div>
        <Link href="/app/sales-orders">
          <Button variant="outline">สร้างจากใบสั่งขาย / New from SO</Button>
        </Link>
      </div>

      <div className={`${CARD} p-4 flex gap-4 items-end`}>
        <div className="w-48">
          <Select
            label="สถานะ / Status"
            value={status}
            onChange={(e) => { setStatus(e.target.value); setPage(1); }}
          >
            <option value="">ทั้งหมด / All</option>
            <option value="draft">ฉบับร่าง / Draft</option>
            <option value="ready">พร้อมส่ง / Ready</option>
            <option value="shipped">ส่งแล้ว / Shipped</option>
            <option value="delivered">ถึงลูกค้าแล้ว / Delivered</option>
            <option value="cancelled">ยกเลิก / Cancelled</option>
          </Select>
        </div>
        <div className="w-64">
          <Select
            label="คลังสินค้า / Warehouse"
            value={warehouseId}
            onChange={(e) => { setWarehouseId(e.target.value); setPage(1); }}
          >
            <option value="">ทั้งหมด / All</option>
            {warehouses.map(w => (
              <option key={w.id} value={w.id}>{w.code} — {w.name_th}</option>
            ))}
          </Select>
        </div>
      </div>

      <div className={CARD}>
        <Table
          loading={loading}
          headers={[
            'เลขที่ / DO No.',
            'อ้างอิง SO / SO Ref',
            'ลูกค้า / Customer',
            'คลัง / Warehouse',
            'สถานะ / Status',
            'วันที่ส่ง / Shipped At',
            'วันที่สร้าง / Date',
            '',
          ]}
        >
          {data?.data.map((do_) => (
            <tr key={do_.id} className="hover:bg-stone-50 transition-colors">
              <td className="px-5 py-4 font-mono font-bold text-stone-900">{do_.do_number}</td>
              <td className="px-5 py-4 font-mono text-stone-600">{do_.so_number}</td>
              <td className="px-5 py-4 text-stone-600">{do_.customer_name_th}</td>
              <td className="px-5 py-4 text-stone-600">{do_.warehouse_name_th}</td>
              <td className="px-5 py-4"><StatusBadge status={do_.status} /></td>
              <td className="px-5 py-4 text-sm text-emerald-600 font-medium">
                {do_.shipped_at ? new Date(do_.shipped_at).toLocaleDateString('th-TH') : '-'}
              </td>
              <td className="px-5 py-4 text-xs text-stone-500">
                {new Date(do_.created_at).toLocaleDateString('th-TH')}
              </td>
              <td className="px-5 py-4 text-right">
                <Link href={`/app/delivery-orders/${do_.id}`}>
                  <Button variant="outline" size="sm">รายละเอียด</Button>
                </Link>
              </td>
            </tr>
          ))}
          {data?.data.length === 0 && (
            <tr><td colSpan={8} className="px-5 py-8 text-center text-stone-500">ไม่พบใบส่งสินค้า</td></tr>
          )}
        </Table>

        {data && data.total_pages > 1 && (
          <div className="px-5 py-4 border-t border-stone-100">
            <Pagination
              currentPage={page}
              totalPages={data.total_pages}
              onPageChange={setPage}
            />
          </div>
        )}
      </div>
    </div>
  );
}

'use client';

import { useState, useEffect, useCallback } from 'react';
import { get } from '@/lib/api-client';
import { Button } from '@/components/ui/Button';
import { Table } from '@/components/ui/Table';
import { Pagination } from '@/components/ui/Pagination';
import { Select } from '@/components/ui/Select';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { formatCurrency } from '@/lib/format';
import Link from 'next/link';
import type { SalesOrder, PaginatedResponse, Warehouse } from '@/types';

const CARD = 'bg-white border border-stone-200 rounded-[10px] shadow-sm overflow-hidden';

export default function SalesOrdersPage() {
  const [data, setData] = useState<PaginatedResponse<SalesOrder> | null>(null);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [warehouseId, setWarehouseId] = useState('');

  const fetchSOs = useCallback(async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams({
        page: page.toString(),
        limit: '20',
        ...(status && { status }),
        ...(warehouseId && { warehouse_id: warehouseId }),
      });
      const res = await get<PaginatedResponse<SalesOrder>>(`/api/sales-orders?${query}`);
      setData(res);
    } catch (error) {
      console.error('Failed to fetch sales orders:', error);
    } finally {
      setLoading(false);
    }
  }, [page, status, warehouseId]);

  useEffect(() => {
    get<Warehouse[]>('/api/admin/warehouses').then(setWarehouses).catch(console.error);
  }, []);

  useEffect(() => {
    fetchSOs();
  }, [fetchSOs]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-stone-900">ใบสั่งขาย / Sales Orders</h1>
          <p className="text-stone-500 text-sm">จัดการรายการสั่งซื้อจากลูกค้าและเตรียมจัดส่ง</p>
        </div>
        <Link href="/app/sales-orders/new">
          <Button>+ สร้างใบสั่งขาย / New SO</Button>
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
            <option value="confirmed">ยืนยันแล้ว / Confirmed</option>
            <option value="partially_delivered">ส่งบางส่วน / Partial</option>
            <option value="fully_delivered">ส่งครบแล้ว / Delivered</option>
            <option value="invoiced">วางบิลแล้ว / Invoiced</option>
            <option value="paid">ชำระเงินแล้ว / Paid</option>
            <option value="closed">ปิดรายการ / Closed</option>
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
            'เลขที่ / SO No.',
            'ลูกค้า / Customer',
            'คลัง / Warehouse',
            'สถานะ / Status',
            'ยอดรวม / Total',
            'กำหนดส่ง / Delivery',
            'วันที่สร้าง / Date',
            '',
          ]}
        >
          {data?.data.map((so) => (
            <tr key={so.id} className="hover:bg-stone-50 transition-colors">
              <td className="px-5 py-4 font-mono font-bold text-stone-900">{so.so_number}</td>
              <td className="px-5 py-4 text-stone-600">{so.customer_name_th}</td>
              <td className="px-5 py-4 text-stone-600">{so.warehouse_name_th}</td>
              <td className="px-5 py-4"><StatusBadge status={so.status} /></td>
              <td className="px-5 py-4 font-mono font-bold text-right">
                {formatCurrency(so.total_amount)}
              </td>
              <td className="px-5 py-4 text-sm text-stone-600">
                {so.expected_delivery ? new Date(so.expected_delivery).toLocaleDateString('th-TH') : '-'}
              </td>
              <td className="px-5 py-4 text-xs text-stone-500">
                {new Date(so.created_at).toLocaleDateString('th-TH')}
              </td>
              <td className="px-5 py-4 text-right">
                <Link href={`/app/sales-orders/${so.id}`}>
                  <Button variant="outline" size="sm">รายละเอียด</Button>
                </Link>
              </td>
            </tr>
          ))}
          {data?.data.length === 0 && (
            <tr><td colSpan={8} className="px-5 py-8 text-center text-stone-500">ไม่พบใบสั่งขาย</td></tr>
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

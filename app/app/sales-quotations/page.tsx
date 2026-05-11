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
import type { SalesQuotation, PaginatedResponse, Warehouse } from '@/types';

const CARD = 'bg-white border border-stone-200 rounded-[10px] shadow-sm overflow-hidden';

export default function SalesQuotationsPage() {
  const [data, setData] = useState<PaginatedResponse<SalesQuotation> | null>(null);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [warehouseId, setWarehouseId] = useState('');

  const fetchSQs = useCallback(async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams({
        page: page.toString(),
        limit: '20',
        ...(status && { status }),
        ...(warehouseId && { warehouse_id: warehouseId }),
      });
      const res = await get<PaginatedResponse<SalesQuotation>>(`/api/sales-quotations?${query}`);
      setData(res);
    } catch (error) {
      console.error('Failed to fetch sales quotations:', error);
    } finally {
      setLoading(false);
    }
  }, [page, status, warehouseId]);

  useEffect(() => {
    get<Warehouse[]>('/api/admin/warehouses').then(setWarehouses).catch(console.error);
  }, []);

  useEffect(() => {
    fetchSQs();
  }, [fetchSQs]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-stone-900">ใบเสนอราคา / Sales Quotations</h1>
          <p className="text-stone-500 text-sm">จัดการและติดตามสถานะใบเสนอราคา</p>
        </div>
        <Link href="/app/sales-quotations/new">
          <Button>+ สร้างใบเสนอราคา / New SQ</Button>
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
            <option value="sent">ส่งแล้ว / Sent</option>
            <option value="accepted">ตอบรับ / Accepted</option>
            <option value="converted_to_so">เปิด SO แล้ว / Converted</option>
            <option value="rejected">ปฏิเสธ / Rejected</option>
            <option value="expired">หมดอายุ / Expired</option>
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
            'เลขที่ / SQ No.',
            'ลูกค้า / Customer',
            'คลัง / Warehouse',
            'สถานะ / Status',
            'ยืนราคาถึง / Valid Until',
            'ยอดรวม / Total',
            'วันที่สร้าง / Date',
            '',
          ]}
        >
          {data?.data.map((sq) => (
            <tr key={sq.id} className="hover:bg-stone-50 transition-colors">
              <td className="px-5 py-4 font-mono font-bold text-stone-900">{sq.sq_number}</td>
              <td className="px-5 py-4 text-stone-600">{sq.customer_name_th}</td>
              <td className="px-5 py-4 text-stone-600">{sq.warehouse_name_th}</td>
              <td className="px-5 py-4"><StatusBadge status={sq.status} /></td>
              <td className="px-5 py-4 text-sm text-stone-600">
                {sq.valid_until ? new Date(sq.valid_until).toLocaleDateString('th-TH') : '-'}
              </td>
              <td className="px-5 py-4 font-mono font-bold text-right">
                {formatCurrency(sq.total_amount)}
              </td>
              <td className="px-5 py-4 text-xs text-stone-500">
                {new Date(sq.created_at).toLocaleDateString('th-TH')}
              </td>
              <td className="px-5 py-4 text-right">
                <Link href={`/app/sales-quotations/${sq.id}`}>
                  <Button variant="outline" size="sm">รายละเอียด</Button>
                </Link>
              </td>
            </tr>
          ))}
          {data?.data.length === 0 && (
            <tr><td colSpan={8} className="px-5 py-8 text-center text-stone-500">ไม่พบใบเสนอราคา</td></tr>
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

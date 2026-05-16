'use client';

import { useState, useEffect, useCallback } from 'react';
import { get } from '@/lib/api-client';
import { Button } from '@/components/ui/Button';
import { Table } from '@/components/ui/Table';
import { Pagination } from '@/components/ui/Pagination';
import { Select } from '@/components/ui/Select';
import { StatusBadge } from '@/components/ui/StatusBadge';
import Link from 'next/link';
import type { SalesReturn, PaginatedResponse, Warehouse } from '@/types';
import { DirectionalTransition } from '@/components/ui/directional-transition';

const CARD = 'bg-white border border-stone-200 rounded-[10px] shadow-sm overflow-hidden';

export default function SalesReturnsPage() {
  const [data, setData] = useState<PaginatedResponse<SalesReturn> | null>(null);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [warehouseId, setWarehouseId] = useState('');

  const fetchSRs = useCallback(async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams({
        page: page.toString(),
        limit: '20',
        ...(status && { status }),
        ...(warehouseId && { warehouse_id: warehouseId }),
      });
      const res = await get<PaginatedResponse<SalesReturn>>(`/api/sales-returns?${query}`);
      setData(res);
    } catch (error) {
      console.error('Failed to fetch sales returns:', error);
    } finally {
      setLoading(false);
    }
  }, [page, status, warehouseId]);

  useEffect(() => {
    get<Warehouse[]>('/api/admin/warehouses').then(setWarehouses).catch(console.error);
  }, []);

  useEffect(() => {
    fetchSRs();
  }, [fetchSRs]);

  return (
    <DirectionalTransition>
      <div className="max-w-[1440px] mx-auto pb-12 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-stone-900">รับคืนสินค้า / Sales Returns</h1>
            <p className="text-stone-500 text-sm">จัดการรายการคืนสินค้าจากลูกค้าและคืนสต็อก</p>
          </div>
          <Link href="/app/sales-returns/new" transitionTypes={['nav-forward']}>
            <Button>+ สร้างใปรับคืน / New Return</Button>
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
              <option value="open">รอดำเนินการ / Open</option>
              <option value="received">รับของแล้ว / Received</option>
              <option value="restocked">คืนสต็อกแล้ว / Restocked</option>
              <option value="disposed">ทำลายทิ้ง / Disposed</option>
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
              'เลขที่ / SR No.',
              'อ้างอิง SO / SO Ref',
              'ลูกค้า / Customer',
              'คลัง / Warehouse',
              'สถานะ / Status',
              'สาเหตุ / Reason',
              'วันที่สร้าง / Date',
              '',
            ]}
          >
            {data?.data.map((sr) => (
              <tr key={sr.id} className="hover:bg-stone-50 transition-colors">
                <td className="px-5 py-4 font-mono font-bold text-stone-900">{sr.sr_number}</td>
                <td className="px-5 py-4 font-mono text-stone-600">{sr.so_number || '-'}</td>
                <td className="px-5 py-4 text-stone-600">{sr.customer_name_th}</td>
                <td className="px-5 py-4 text-stone-600">{sr.warehouse_name_th}</td>
                <td className="px-5 py-4"><StatusBadge status={sr.status} /></td>
                <td className="px-5 py-4 text-sm text-stone-600 max-w-[200px] truncate">
                  {sr.reason || '-'}
                </td>
                <td className="px-5 py-4 text-xs text-stone-500">
                  {new Date(sr.created_at).toLocaleDateString('th-TH')}
                </td>
                <td className="px-5 py-4 text-right">
                  <Link href={`/app/sales-returns/${sr.id}`} transitionTypes={['nav-forward']}>
                    <Button variant="outline" size="sm">รายละเอียด</Button>
                  </Link>
                </td>
              </tr>
            ))}
            {data?.data.length === 0 && (
              <tr><td colSpan={8} className="px-5 py-8 text-center text-stone-500">ไม่พบใปรับคืน</td></tr>
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
    </DirectionalTransition>
  );
}

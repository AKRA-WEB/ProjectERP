'use client';

import { useState, useEffect, useCallback } from 'react';
import { get } from '@/lib/api-client';
import { formatCurrency, formatDatetime } from '@/lib/format';
import { Button } from '@/components/ui/Button';
import { Table } from '@/components/ui/Table';
import { Pagination } from '@/components/ui/Pagination';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Select } from '@/components/ui/Select';
import Link from 'next/link';
import type { PosSession, Warehouse, PaginatedResponse } from '@/types';

const CARD = 'bg-white border border-stone-200 rounded-[10px] shadow-sm overflow-hidden';

export default function SessionHistoryPage() {
  const [data, setData] = useState<PaginatedResponse<PosSession> | null>(null);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [warehouseId, setWarehouseId] = useState('');

  const fetchSessions = useCallback(async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams({
        page: page.toString(),
        limit: '20',
        ...(status && { status }),
        ...(warehouseId && { warehouse_id: warehouseId }),
      });
      const res = await get<PaginatedResponse<PosSession>>(`/api/pos/sessions?${query}`);
      setData(res);
    } catch (error) {
      console.error('Failed to fetch sessions:', error);
    } finally {
      setLoading(false);
    }
  }, [page, status, warehouseId]);

  useEffect(() => {
    get<Warehouse[]>('/api/admin/warehouses').then(setWarehouses).catch(console.error);
  }, []);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-stone-900">ประวัติรอบการขาย / Session History</h1>
          <p className="text-stone-500 text-sm">รายการรอบการขาย POS ทั้งหมดในระบบ</p>
        </div>
        <Link href="/app/pos">
          <Button variant="outline">กลับไปหน้า POS / Back</Button>
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
            <option value="open">กำลังเปิด / Open</option>
            <option value="closed">ปิดแล้ว / Closed</option>
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
            'หมายเลขรอบ / Session No.',
            'คลังสินค้า / Warehouse',
            'แคชเชียร์ / Cashier',
            'สถานะ / Status',
            'เวลาเปิด / Opened At',
            'เวลาปิด / Closed At',
            'ยอดขาย / Total Sales',
            'รายการ / Txns',
            '',
          ]}
        >
          {data?.data.map((s) => (
            <tr key={s.id} className="hover:bg-stone-50 transition-colors">
              <td className="px-5 py-4 font-mono font-bold text-stone-900">{s.session_number}</td>
              <td className="px-5 py-4 text-stone-600">{s.warehouse_name_th}</td>
              <td className="px-5 py-4 text-stone-600">{s.opened_by_name}</td>
              <td className="px-5 py-4"><StatusBadge status={s.status} /></td>
              <td className="px-5 py-4 text-xs text-stone-500">
                {formatDatetime(s.opened_at)}
              </td>
              <td className="px-5 py-4 text-xs text-stone-500">
                {formatDatetime(s.closed_at)}
              </td>
              <td className="px-5 py-4 font-mono font-bold text-emerald-600 text-right">
                {formatCurrency(s.total_sales ?? 0)}
              </td>
              <td className="px-5 py-4 text-center font-mono">{s.transaction_count}</td>
              <td className="px-5 py-4 text-right">
                <Link href={`/app/pos/sessions/${s.id}`}>
                  <Button variant="outline" size="sm">รายละเอียด</Button>
                </Link>
              </td>
            </tr>
          ))}
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

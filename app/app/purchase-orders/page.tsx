'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button, SearchInput, Table, Thead, Tbody, Th, Td, Pagination, StatusBadge } from '@/components/ui';
import { get } from '@/lib/api-client';
import { formatDate, formatCurrency } from '@/lib/format';
import type { PaginatedResponse } from '@/types';
import Link from 'next/link';

interface PO {
  id: string;
  po_number: string;
  status: string;
  vendor_name: string;
  vendor_code: string;
  warehouse_name: string;
  warehouse_code: string;
  total_amount: number;
  expected_date: string | null;
  created_at: string;
}

const STATUS_OPTIONS = [
  { value: '', label: 'ทุกสถานะ' },
  { value: 'draft', label: 'ร่าง' },
  { value: 'sent', label: 'ส่งแล้ว' },
  { value: 'partially_received', label: 'รับบางส่วน' },
  { value: 'fully_received', label: 'รับครบ' },
  { value: 'invoiced', label: 'มีใบแจ้งหนี้' },
  { value: 'paid', label: 'ชำระแล้ว' },
  { value: 'cancelled', label: 'ยกเลิก' },
];

export default function PurchaseOrdersPage() {
  const [data, setData] = useState<PaginatedResponse<PO> | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchPOs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '25' });
      if (search) params.set('search', search);
      if (status) params.set('status', status);
      const res = await get<PaginatedResponse<PO>>(`/api/purchase-orders?${params}`);
      setData(res);
    } finally {
      setLoading(false);
    }
  }, [page, search, status]);

  useEffect(() => { fetchPOs(); }, [fetchPOs]);

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">ใบสั่งซื้อ / Purchase Orders</h1>
          <p className="text-sm text-gray-500">{data?.total ?? 'โ€”'} รายการ</p>
        </div>
        <Link href="/app/purchase-orders/new">
          <Button className="w-full sm:w-auto">+ สร้าง PO</Button>
        </Link>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SearchInput
          placeholder="ค้นหาเลข PO..."
          onSearch={(v) => { setSearch(v); setPage(1); }}
          className="w-full sm:w-60"
        />
        <select
          className="w-full sm:w-auto rounded-lg border border-gray-300 px-3 py-2 text-sm"
          value={status}
          onChange={(e) => { setStatus(e.target.value); setPage(1); }}
        >
          {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      <div className="rounded-xl bg-white shadow-sm border border-gray-100">
        <Table>
          <Thead>
            <tr>
              <Th>เลข PO</Th>
              <Th>ผู้จำหน่าย</Th>
              <Th className="hidden sm:table-cell">คลังสินค้า</Th>
              <Th className="hidden sm:table-cell">มูลค่ารวม</Th>
              <Th className="hidden sm:table-cell">วันที่คาดรับ</Th>
              <Th>สถานะ</Th>
              <Th className="hidden sm:table-cell">วันที่สร้าง</Th>
              <Th></Th>
            </tr>
          </Thead>
          <Tbody>
            {loading ? (
              <tr><Td colSpan={8}><div className="py-8 text-center text-gray-400">กำลังโหลด...</div></Td></tr>
            ) : data?.data.length === 0 ? (
              <tr><Td colSpan={8}><div className="py-8 text-center text-gray-400">ไม่พบข้อมูล</div></Td></tr>
            ) : (
              data?.data.map((po) => (
                <tr key={po.id} className="hover:bg-gray-50">
                  <Td className="font-mono font-medium text-sm">{po.po_number}</Td>
                  <Td className="text-sm">{po.vendor_code} โ€” {po.vendor_name}</Td>
                  <Td className="text-sm hidden sm:table-cell">{po.warehouse_code}</Td>
                  <Td className="text-sm text-right font-medium hidden sm:table-cell">{formatCurrency(po.total_amount)}</Td>
                  <Td className="text-sm hidden sm:table-cell">{po.expected_date ? formatDate(po.expected_date) : 'โ€”'}</Td>
                  <Td><StatusBadge status={po.status} /></Td>
                  <Td className="text-sm text-gray-500 hidden sm:table-cell">{formatDate(po.created_at)}</Td>
                  <Td>
                    <Link href={`/app/purchase-orders/${po.id}`} className="text-sm text-blue-600 hover:underline">ดู</Link>
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
  );
}


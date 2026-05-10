'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button, SearchInput, Table, Thead, Tbody, Th, Td, Pagination, StatusBadge } from '@/components/ui';
import { get } from '@/lib/api-client';
import { formatDate } from '@/lib/format';
import type { PaginatedResponse } from '@/types';
import Link from 'next/link';

interface PR {
  id: string;
  pr_number: string;
  status: string;
  warehouse_name: string;
  warehouse_code: string;
  requested_by_name: string;
  line_count: number;
  created_at: string;
}

const STATUS_OPTIONS = [
  { value: '', label: 'ทุกสถานะ' },
  { value: 'draft', label: 'ร่าง' },
  { value: 'submitted', label: 'รออนุมัติ' },
  { value: 'manager_approved', label: 'ผู้จัดการอนุมัติ' },
  { value: 'admin_approved', label: 'อนุมัติแล้ว' },
  { value: 'rejected', label: 'ปฏิเสธ' },
  { value: 'converted_to_po', label: 'แปลงเป็น PO แล้ว' },
];

export default function PurchaseRequestsPage() {
  const [data, setData] = useState<PaginatedResponse<PR> | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchPRs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '25' });
      if (search) params.set('search', search);
      if (status) params.set('status', status);
      const res = await get<PaginatedResponse<PR>>(`/api/purchase-requests?${params}`);
      setData(res);
    } finally {
      setLoading(false);
    }
  }, [page, search, status]);

  useEffect(() => { fetchPRs(); }, [fetchPRs]);

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">คำขอซื้อ / Purchase Requests</h1>
          <p className="text-sm text-gray-500">{data?.total ?? 'โ€”'} รายการ</p>
        </div>
        <Link href="/app/purchase-requests/new">
          <Button className="w-full sm:w-auto">+ สร้างคำขอ</Button>
        </Link>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SearchInput
          placeholder="ค้นหาเลข PR..."
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
              <Th>เลข PR</Th>
              <Th className="hidden sm:table-cell">คลังสินค้า</Th>
              <Th className="hidden sm:table-cell">ผู้ขอ</Th>
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
              data?.data.map((pr) => (
                <tr key={pr.id} className="hover:bg-gray-50">
                  <Td className="font-mono font-medium text-sm">{pr.pr_number}</Td>
                  <Td className="hidden sm:table-cell text-sm">{pr.warehouse_code} โ€” {pr.warehouse_name}</Td>
                  <Td className="hidden sm:table-cell text-sm">{pr.requested_by_name}</Td>
                  <Td className="hidden sm:table-cell text-sm text-center">{pr.line_count}</Td>
                  <Td><StatusBadge status={pr.status} /></Td>
                  <Td className="hidden sm:table-cell text-sm text-gray-500">{formatDate(pr.created_at)}</Td>
                  <Td>
                    <Link href={`/app/purchase-requests/${pr.id}`} className="text-sm text-blue-600 hover:underline">ดูรายละเอียด</Link>
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


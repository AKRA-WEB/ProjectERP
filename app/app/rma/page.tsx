'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button, Table, Thead, Tbody, Th, Td, Pagination, StatusBadge } from '@/components/ui';
import { get } from '@/lib/api-client';
import { formatDate } from '@/lib/format';
import type { PaginatedResponse } from '@/types';
import Link from 'next/link';

interface RMA { id: string; rma_number: string; status: string; vendor_name: string; vendor_code: string; warehouse_code: string; initiated_by_name: string; line_count: number; created_at: string; }

export default function RMAPage() {
  const [data, setData] = useState<PaginatedResponse<RMA> | null>(null);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchRMAs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '25' });
      if (status) params.set('status', status);
      setData(await get<PaginatedResponse<RMA>>(`/api/rma?${params}`));
    } finally { setLoading(false); }
  }, [page, status]);

  useEffect(() => { fetchRMAs(); }, [fetchRMAs]);

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">คืนสินค้า / RMA</h1>
          <p className="text-sm text-gray-500">{data?.total ?? 'โ€”'} รายการ</p>
        </div>
        <Link href="/app/rma/new"><Button className="w-full sm:w-auto">+ สร้าง RMA</Button></Link>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <select className="w-full sm:w-auto rounded-lg border border-gray-300 px-3 py-2 text-sm" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
          <option value="">ทุกสถานะ</option>
          <option value="open">เปิด</option>
          <option value="in_review">กำลังพิจารณา</option>
          <option value="resolved">แก้ไขแล้ว</option>
          <option value="closed">ปิด</option>
        </select>
      </div>

      <div className="rounded-xl bg-white shadow-sm border border-gray-100">
        <Table>
          <Thead>
            <tr>
              <Th>เลข RMA</Th>
              <Th className="hidden sm:table-cell">ผู้จำหน่าย</Th>
              <Th className="hidden sm:table-cell">คลัง</Th>
              <Th className="hidden sm:table-cell">ผู้แจ้ง</Th>
              <Th className="hidden sm:table-cell">รายการ</Th>
              <Th>สถานะ</Th>
              <Th className="hidden sm:table-cell">วันที่</Th>
              <Th></Th>
            </tr>
          </Thead>
          <Tbody>
            {loading ? (
              <tr><Td colSpan={8}><div className="py-8 text-center text-gray-400">กำลังโหลด...</div></Td></tr>
            ) : data?.data.length === 0 ? (
              <tr><Td colSpan={8}><div className="py-8 text-center text-gray-400">ไม่พบข้อมูล</div></Td></tr>
            ) : data?.data.map((r) => (
              <tr key={r.id} className="hover:bg-gray-50">
                <Td className="font-mono font-medium text-sm">{r.rma_number}</Td>
                <Td className="text-sm hidden sm:table-cell">{r.vendor_code} โ€” {r.vendor_name}</Td>
                <Td className="text-sm hidden sm:table-cell">{r.warehouse_code}</Td>
                <Td className="text-sm hidden sm:table-cell">{r.initiated_by_name}</Td>
                <Td className="text-sm text-center hidden sm:table-cell">{r.line_count}</Td>
                <Td><StatusBadge status={r.status} /></Td>
                <Td className="text-sm text-gray-500 hidden sm:table-cell">{formatDate(r.created_at)}</Td>
                <Td><Link href={`/app/rma/${r.id}`} className="text-sm text-blue-600 hover:underline">ดู</Link></Td>
              </tr>
            ))}
          </Tbody>
        </Table>
      </div>
      {data && <div className="mt-4"><Pagination page={page} totalPages={data.total_pages} onPageChange={setPage} /></div>}
    </div>
  );
}


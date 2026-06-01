'use client';

/* eslint-disable local-rules/no-hardcoded-thai */
import { useState, useEffect, useCallback } from 'react';
import { Button, Table, Thead, Tbody, Th, Td, Pagination, StatusBadge } from '@/components/ui';
import { get } from '@/lib/api-client';
import { formatDate, formatCurrency } from '@/lib/format';
import type { PaginatedResponse } from '@/types';
import Link from 'next/link';

interface Claim { id: string; claim_number: string; status: string; vendor_name: string; vendor_code: string; warehouse_code: string; claim_amount: number; resolution_type: string | null; created_by_name: string; created_at: string; }

export default function ClaimsPage() {
  const [data, setData] = useState<PaginatedResponse<Claim> | null>(null);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchClaims = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '25' });
      if (status) params.set('status', status);
      setData(await get<PaginatedResponse<Claim>>(`/api/vendor-claims?${params}`));
    } finally { setLoading(false); }
  }, [page, status]);

  useEffect(() => { fetchClaims(); }, [fetchClaims]);

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">เรียกร้องผู้จำหน่าย / Vendor Claims</h1>
          <p className="text-sm text-gray-500">{data?.total ?? 'โ€”'} รายการ</p>
        </div>
        <Link href="/app/claims/new"><Button className="w-full sm:w-auto">+ สร้างการเรียกร้อง</Button></Link>
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
              <Th>เลขที่</Th>
              <Th className="hidden sm:table-cell">ผู้จำหน่าย</Th>
              <Th className="hidden sm:table-cell">คลัง</Th>
              <Th className="hidden sm:table-cell">ผู้สร้าง</Th>
              <Th className="hidden sm:table-cell">มูลค่า</Th>
              <Th className="hidden sm:table-cell">วิธีแก้ไข</Th>
              <Th>สถานะ</Th>
              <Th className="hidden sm:table-cell">วันที่</Th>
              <Th></Th>
            </tr>
          </Thead>
          <Tbody>
            {loading ? (
              <tr><Td colSpan={9}><div className="py-8 text-center text-gray-400">กำลังโหลด...</div></Td></tr>
            ) : data?.data.length === 0 ? (
              <tr><Td colSpan={9}><div className="py-8 text-center text-gray-400">ไม่พบข้อมูล</div></Td></tr>
            ) : data?.data.map((c) => (
              <tr key={c.id} className="hover:bg-gray-50">
                <Td className="font-mono font-medium text-sm">{c.claim_number}</Td>
                <Td className="text-sm hidden sm:table-cell">{c.vendor_code} โ€” {c.vendor_name}</Td>
                <Td className="text-sm hidden sm:table-cell">{c.warehouse_code}</Td>
                <Td className="text-sm hidden sm:table-cell">{c.created_by_name}</Td>
                <Td className="text-sm font-medium hidden sm:table-cell">{formatCurrency(c.claim_amount)}</Td>
                <Td className="text-sm text-gray-500 hidden sm:table-cell">{c.resolution_type?.replace(/_/g, ' ') ?? 'โ€”'}</Td>
                <Td><StatusBadge status={c.status} /></Td>
                <Td className="text-sm text-gray-500 hidden sm:table-cell">{formatDate(c.created_at)}</Td>
                <Td><Link href={`/app/claims/${c.id}`} className="text-sm text-blue-600 hover:underline">ดู</Link></Td>
              </tr>
            ))}
          </Tbody>
        </Table>
      </div>
      {data && <div className="mt-4"><Pagination page={page} totalPages={data.total_pages} onPageChange={setPage} /></div>}
    </div>
  );
}


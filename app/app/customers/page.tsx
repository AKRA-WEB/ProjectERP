'use client';

/* eslint-disable local-rules/no-hardcoded-thai */
import { useState, useEffect, useCallback } from 'react';
import { get } from '@/lib/api-client';
import { Button } from '@/components/ui/Button';
import { Table } from '@/components/ui/Table';
import { SearchInput } from '@/components/ui/SearchInput';
import { Pagination } from '@/components/ui/Pagination';
import { Select } from '@/components/ui/Select';
import Link from 'next/link';
import type { Customer, PaginatedResponse } from '@/types';
import { DirectionalTransition } from '@/components/ui/directional-transition';

const CARD = 'bg-white border border-stone-200 rounded-[10px] shadow-sm overflow-hidden';

export default function CustomersPage() {
  const [data, setData] = useState<PaginatedResponse<Customer> | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [isActive, setIsActive] = useState('true');

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams({
        page: page.toString(),
        limit: '20',
        ...(search && { search }),
        ...(isActive !== '' && { is_active: isActive }),
      });
      const res = await get<PaginatedResponse<Customer>>(`/api/customers?${query}`);
      setData(res);
    } catch (error) {
      console.error('Failed to fetch customers:', error);
    } finally {
      setLoading(false);
    }
  }, [page, search, isActive]);

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      fetchCustomers();
    }, 300);
    return () => clearTimeout(delayDebounceFn);
  }, [fetchCustomers]);

  return (
    <DirectionalTransition>
      <div className="max-w-[1440px] mx-auto pb-12 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-stone-900">ลูกค้า / Customers</h1>
            <p className="text-stone-500 text-sm">จัดการฐานข้อมูลลูกค้าสำหรับใบสั่งขาย</p>
          </div>
          <Link href="/app/customers/new" transitionTypes={['nav-forward']}>
            <Button>+ เพิ่มลูกค้า / Add Customer</Button>
          </Link>
        </div>

        <div className={`${CARD} p-4 flex gap-4 items-end`}>
          <div className="w-80">
            <SearchInput
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="ค้นหา ชื่อ, รหัส..."
            />
          </div>
          <div className="w-48">
            <Select
              label="สถานะ / Status"
              value={isActive}
              onChange={(e) => { setIsActive(e.target.value); setPage(1); }}
            >
              <option value="">ทั้งหมด / All</option>
              <option value="true">ใช้งาน / Active</option>
              <option value="false">ยกเลิก / Inactive</option>
            </Select>
          </div>
        </div>

        <div className={CARD}>
          <Table
            loading={loading}
            headers={[
              'รหัส / Code',
              'ชื่อลูกค้า / Name',
              'เบอร์โทร / Phone',
              'อีเมล / Email',
              'เครดิต (วัน) / Terms',
              'สถานะ / Status',
              '',
            ]}
          >
            {data?.data.map((c) => (
              <tr key={c.id} className="hover:bg-stone-50 transition-colors">
                <td className="px-5 py-4 font-mono font-bold text-stone-900">{c.code}</td>
                <td className="px-5 py-4">
                  <div className="font-medium text-stone-900">{c.name_th}</div>
                  {c.name_en && <div className="text-sm text-stone-500">{c.name_en}</div>}
                </td>
                <td className="px-5 py-4 text-stone-600">{c.phone || '-'}</td>
                <td className="px-5 py-4 text-stone-600">{c.email || '-'}</td>
                <td className="px-5 py-4 text-stone-600">{c.payment_terms_days}</td>
                <td className="px-5 py-4">
                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${c.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-stone-100 text-stone-600'}`}>
                    {c.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-5 py-4 text-right">
                  <Link href={`/app/customers/${c.id}`} transitionTypes={['nav-forward']}>
                    <Button variant="outline" size="sm">จัดการ / Manage</Button>
                  </Link>
                </td>
              </tr>
            ))}
            {data?.data.length === 0 && (
              <tr><td colSpan={7} className="px-5 py-8 text-center text-stone-500">ไม่พบข้อมูลลูกค้า</td></tr>
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

'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button, SearchInput, Table, Thead, Tbody, Th, Td, Pagination, Badge } from '@/components/ui';
import { get } from '@/lib/api-client';
import type { PaginatedResponse, User } from '@/types';
import UserFormModal from './UserFormModal';
import UserWarehouseModal from './UserWarehouseModal';

export default function AdminUsersPage() {
  const [data, setData] = useState<PaginatedResponse<User> | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [warehouseUser, setWarehouseUser] = useState<User | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '25' });
      if (search) params.set('search', search);
      const res = await get<PaginatedResponse<User>>(`/api/admin/users?${params}`);
      setData(res);
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const roleLabels: Record<string, string> = { admin: 'ผู้ดูแล', manager: 'ผู้จัดการ', staff: 'พนักงาน' };
  const roleVariant: Record<string, 'red' | 'blue' | 'gray'> = { admin: 'red', manager: 'blue', staff: 'gray' };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">ผู้ใช้งาน / Users</h1>
          <p className="text-sm text-gray-500">{data?.total ?? '—'} บัญชี</p>
        </div>
        <Button onClick={() => setShowCreate(true)}>+ เพิ่มผู้ใช้</Button>
      </div>

      <div className="mb-4">
        <SearchInput
          placeholder="ค้นหาชื่อ / อีเมล..."
          onSearch={(v) => { setSearch(v); setPage(1); }}
          className="w-72"
        />
      </div>

      <div className="rounded-xl bg-white shadow-sm border border-gray-100">
        <Table>
          <Thead>
            <tr>
              <Th>อีเมล / Email</Th>
              <Th>ชื่อ / Name</Th>
              <Th>บทบาท / Role</Th>
              <Th>คลังสินค้า / Warehouses</Th>
              <Th>สถานะ / Status</Th>
              <Th></Th>
            </tr>
          </Thead>
          <Tbody>
            {loading ? (
              <tr><Td colSpan={6}><div className="py-8 text-center text-gray-400">กำลังโหลด...</div></Td></tr>
            ) : data?.data.length === 0 ? (
              <tr><Td colSpan={6}><div className="py-8 text-center text-gray-400">ไม่พบข้อมูล</div></Td></tr>
            ) : (
              data?.data.map((u) => (
                <tr key={u.id} className="hover:bg-gray-50">
                  <Td className="text-sm font-medium">{u.email}</Td>
                  <Td>
                    <div className="text-sm font-medium">{u.name_th ?? u.name_en}</div>
                    {u.name_th && <div className="text-xs text-gray-400">{u.name_en}</div>}
                  </Td>
                  <Td>
                    <Badge variant={roleVariant[u.role] ?? 'gray'}>
                      {roleLabels[u.role] ?? u.role}
                    </Badge>
                  </Td>
                  <Td className="text-sm text-gray-500">{(u as any).warehouse_count ?? 0} คลัง</Td>
                  <Td>
                    <Badge variant={u.is_active ? 'green' : 'gray'}>
                      {u.is_active ? 'ใช้งาน' : 'ปิด'}
                    </Badge>
                  </Td>
                  <Td>
                    <div className="flex gap-3">
                      <button className="text-sm text-blue-600 hover:underline" onClick={() => setEditUser(u)}>แก้ไข</button>
                      <button className="text-sm text-gray-500 hover:underline" onClick={() => setWarehouseUser(u)}>คลังสินค้า</button>
                    </div>
                  </Td>
                </tr>
              ))
            )}
          </Tbody>
        </Table>
      </div>

      {data && (
        <div className="mt-4">
          <Pagination currentPage={page} totalPages={data.total_pages} onPageChange={setPage} />
        </div>
      )}

      {(showCreate || editUser) && (
        <UserFormModal
          user={editUser}
          onClose={() => { setShowCreate(false); setEditUser(null); }}
          onSaved={() => { setShowCreate(false); setEditUser(null); fetchUsers(); }}
        />
      )}

      {warehouseUser && (
        <UserWarehouseModal
          user={warehouseUser}
          onClose={() => setWarehouseUser(null)}
          onSaved={() => { setWarehouseUser(null); fetchUsers(); }}
        />
      )}
    </div>
  );
}

'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button, SearchInput, Table, Thead, Tbody, Th, Td, Pagination, Badge } from '@/components/ui';
import { get } from '@/lib/api-client';
import type { PaginatedResponse, User } from '@/types';
import UserFormModal from './UserFormModal';
import UserWarehouseModal from './UserWarehouseModal';
import UserRoleModal from './UserRoleModal';

interface UserWithStats extends User {
  warehouse_count?: number;
}

export default function AdminUsersPage() {
  const [data, setData] = useState<PaginatedResponse<UserWithStats> | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [loading, setLoading] = useState(true);
  
  const [editUser, setEditUser] = useState<User | null>(null);
  const [warehouseUser, setWarehouseUser] = useState<User | null>(null);
  const [roleUser, setRoleUser] = useState<User | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '25' });
      if (search) params.set('search', search);
      if (roleFilter) params.set('role', roleFilter);
      const res = await get<PaginatedResponse<UserWithStats>>(`/api/admin/users?${params}`);
      setData(res);
    } finally {
      setLoading(false);
    }
  }, [page, search, roleFilter]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const roleLabels: Record<string, string> = { admin: 'ผู้ดูแล', manager: 'ผู้จัดการ', staff: 'พนักงาน' };
  const roleVariant: Record<string, 'red' | 'blue' | 'gray'> = { admin: 'red', manager: 'blue', staff: 'gray' };

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">พนักงาน / Employees</h1>
          <p className="text-sm text-gray-500">{data?.total ?? '—'} บัญชี</p>
        </div>
        <Button onClick={() => setShowCreate(true)} className="w-full sm:w-auto">+ เพิ่มพนักงาน</Button>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SearchInput
          placeholder="ค้นหาชื่อ / อีเมล / รหัสพนักงาน..."
          onSearch={(v) => { setSearch(v); setPage(1); }}
          className="w-full sm:w-80"
        />
        <select
          className="w-full sm:w-auto rounded-lg border border-gray-300 px-3 py-2 text-sm"
          value={roleFilter}
          onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}
        >
          <option value="">ทุกบทบาท</option>
          <option value="admin">ผู้ดูแลระบบ</option>
          <option value="manager">ผู้จัดการ</option>
          <option value="staff">พนักงานทั่วไป</option>
        </select>
      </div>

      <div className="rounded-xl bg-white shadow-sm border border-gray-100 overflow-hidden">
        <Table>
          <Thead>
            <tr>
              <Th>Employee ID</Th>
              <Th>อีเมล / Email</Th>
              <Th className="hidden sm:table-cell">ชื่อ / Position</Th>
              <Th>บทบาท / Role</Th>
              <Th className="hidden sm:table-cell text-center">สิทธิ์ / คลัง</Th>
              <Th>สถานะ</Th>
              <Th></Th>
            </tr>
          </Thead>
          <Tbody>
            {loading ? (
              <tr><Td colSpan={7}><div className="py-8 text-center text-gray-400">กำลังโหลด...</div></Td></tr>
            ) : data?.data.length === 0 ? (
              <tr><Td colSpan={7}><div className="py-8 text-center text-gray-400 italic">ไม่พบข้อมูล</div></Td></tr>
            ) : (
              data?.data.map((u) => (
                <tr key={u.id} className="hover:bg-gray-50">
                  <Td className="font-mono text-sm font-bold text-gray-600">{u.employee_id ?? '—'}</Td>
                  <Td>
                    <div className="text-sm font-medium text-gray-900">{u.email}</div>
                  </Td>
                  <Td className="hidden sm:table-cell">
                    <div className="text-sm font-medium text-gray-900">{u.name_th ?? u.name_en}</div>
                    <div className="text-xs text-gray-400 capitalize">{u.position ?? '—'} {u.department ? `· ${u.department}` : ''}</div>
                  </Td>
                  <Td>
                    <Badge variant={roleVariant[u.role] ?? 'gray'}>
                      {roleLabels[u.role] ?? u.role}
                    </Badge>
                  </Td>
                  <Td className="text-sm text-gray-500 hidden sm:table-cell text-center">
                    <div className="flex justify-center gap-2">
                       <Badge variant="blue">{u.warehouse_count ?? 0} WH</Badge>
                    </div>
                  </Td>
                  <Td>
                    <Badge variant={u.is_active ? 'green' : 'gray'}>
                      {u.is_active ? 'ใช้งาน' : 'ปิด'}
                    </Badge>
                  </Td>
                  <Td className="text-right">
                    <div className="flex justify-end gap-3">
                      <button className="text-sm text-blue-600 hover:underline" onClick={() => setEditUser(u)}>แก้ไข</button>
                      <button className="text-sm text-gray-600 hover:underline font-medium" onClick={() => setRoleUser(u)}>บทบาท</button>
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
          <Pagination page={page} totalPages={data.total_pages} onPageChange={setPage} />
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

      {roleUser && (
        <UserRoleModal
          user={roleUser}
          onClose={() => setRoleUser(null)}
          onSaved={() => { setRoleUser(null); fetchUsers(); }}
        />
      )}
    </div>
  );
}

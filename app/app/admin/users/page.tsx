'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button, SearchInput, Table, Thead, Tbody, Th, Td, Pagination, Badge } from '@/components/ui';
import { get } from '@/lib/api-client';
import type { PaginatedResponse, User } from '@/types';
import UserFormModal from './UserFormModal';
import UserWarehouseModal from './UserWarehouseModal';
import UserRoleModal from './UserRoleModal';
import { DirectionalTransition } from '@/components/ui/directional-transition';
import { useT } from '@/lib/i18n';

interface UserWithStats extends User {
  warehouse_count?: number;
}

export default function AdminUsersPage() {
  const t = useT();
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

  const roleLabels: Record<string, string> = {
    admin: t('users.role.admin'),
    manager: t('users.role.manager'),
    staff: t('users.role.staff'),
    auditor: t('users.role.auditor'),
  };
  const roleVariant: Record<string, 'red' | 'blue' | 'gray'> = { admin: 'red', manager: 'blue', staff: 'gray', auditor: 'gray' };

  return (
    <DirectionalTransition>
      <div className="max-w-[1440px] mx-auto pb-12">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{t('users.page.title')}</h1>
            <p className="text-sm text-gray-500">{data?.total ?? '—'} {t('users.accounts_suffix')}</p>
          </div>
          <Button onClick={() => setShowCreate(true)} className="w-full sm:w-auto">+ {t('users.add')}</Button>
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-3">
          <SearchInput
            placeholder={t('users.search_placeholder')}
            onSearch={(v) => { setSearch(v); setPage(1); }}
            className="w-full sm:w-80"
          />
          <select
            className="w-full sm:w-auto rounded-lg border border-gray-300 px-3 py-2 text-sm"
            value={roleFilter}
            onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}
          >
            <option value="">{t('users.filter.all_roles')}</option>
            <option value="admin">{t('users.filter.admin')}</option>
            <option value="manager">{t('users.filter.manager')}</option>
            <option value="staff">{t('users.filter.staff')}</option>
            <option value="auditor">{t('users.filter.auditor')}</option>
          </select>
        </div>

        <div className="rounded-xl bg-white shadow-sm border border-gray-100 overflow-hidden">
          <Table>
            <Thead>
              <tr>
                <Th>Employee ID</Th>
                <Th>{t('users.col.email')}</Th>
                <Th className="hidden sm:table-cell">{t('users.col.name_position')}</Th>
                <Th>{t('users.col.role')}</Th>
                <Th className="hidden sm:table-cell text-center">{t('users.col.rights_warehouse')}</Th>
                <Th>{t('users.col.status')}</Th>
                <Th></Th>
              </tr>
            </Thead>
            <Tbody>
              {loading ? (
                <tr>
                  <Td colSpan={7}>
                    <div className="py-8 text-center text-gray-600">{t('msg.loading_data')}</div>
                  </Td>
                </tr>
              ) : data?.data.length === 0 ? (
                <tr>
                  <Td colSpan={7}>
                    <div className="py-8 text-center text-gray-400 italic">{t('users.no_data')}</div>
                  </Td>
                </tr>
              ) : (
                data?.data.map((u) => (
                  <tr key={u.id} className="hover:bg-gray-50">
                    <Td className="font-mono text-sm font-bold text-gray-600">{u.employee_id || '—'}</Td>
                    <Td>
                      <div className="text-sm font-medium text-gray-900">{u.email}</div>
                    </Td>
                    <Td className="hidden sm:table-cell">
                      <div className="text-sm font-medium text-gray-900">{u.name_th || u.name_en}</div>
                      <div className="text-xs text-gray-400 capitalize">{u.position || '—'} {u.department ? `· ${u.department}` : ''}</div>
                    </Td>
                    <Td>
                      <Badge variant={roleVariant[u.role] || 'gray'}>
                        {roleLabels[u.role] || u.role}
                      </Badge>
                    </Td>
                    <Td className="text-sm text-gray-500 hidden sm:table-cell text-center">
                      <div className="flex justify-center gap-2">
                        <Badge variant="blue">{u.warehouse_count || 0} WH</Badge>
                      </div>
                    </Td>
                    <Td>
                      <Badge variant={u.is_active ? 'green' : 'gray'}>
                        {u.is_active ? t('status.active') : t('status.inactive')}
                      </Badge>
                    </Td>
                    <Td className="text-right">
                      <div className="flex justify-end gap-3">
                        <button className="text-sm text-blue-600 hover:underline" onClick={() => setEditUser(u)}>{t('action.edit')}</button>
                        <button className="text-sm text-gray-600 hover:underline font-medium" onClick={() => setRoleUser(u)}>{t('users.action.role')}</button>
                        <button className="text-sm text-gray-500 hover:underline" onClick={() => setWarehouseUser(u)}>{t('users.action.warehouse')}</button>
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
    </DirectionalTransition>
  );
}

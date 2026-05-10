'use client';

import { useState, useEffect } from 'react';
import { Button, Table, Thead, Tbody, Th, Td, Badge } from '@/components/ui';
import { get, del } from '@/lib/api-client';
import type { EmployeeRole } from '@/types';
import Link from 'next/link';

export default function RolesPage() {
  const [roles, setRoles] = useState<EmployeeRole[]>([]);
  const [loading, setLoading] = useState(true);

  async function fetchRoles() {
    setLoading(true);
    try {
      const data = await get<EmployeeRole[]>('/api/admin/roles');
      setRoles(data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchRoles(); }, []);

  async function handleDelete(id: string) {
    if (!confirm('ยืนยันการลบบทบาทนี้?')) return;
    try {
      await del(`/api/admin/roles/${id}`);
      fetchRoles();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'เกิดข้อผิดพลาด');
    }
  }

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">บทบาทพนักงาน / Employee Roles</h1>
          <p className="text-sm text-gray-500">จัดการชุดสิทธิ์การใช้งานสำหรับพนักงาน</p>
        </div>
        <Link href="/app/admin/roles/new">
          <Button className="w-full sm:w-auto">+ สร้างบทบาทใหม่</Button>
        </Link>
      </div>

      <div className="rounded-xl bg-white shadow-sm border border-gray-100 overflow-hidden">
        <Table>
          <Thead>
            <tr>
              <Th>รหัส / Code</Th>
              <Th>ชื่อบทบาท / Role Name</Th>
              <Th className="text-center">Permissions</Th>
              <Th className="text-center">Users</Th>
              <Th></Th>
            </tr>
          </Thead>
          <Tbody>
            {loading ? (
              <tr><Td colSpan={5}><div className="py-8 text-center text-gray-400">กำลังโหลด...</div></Td></tr>
            ) : roles.map((r) => (
              <tr key={r.id} className="hover:bg-gray-50">
                <Td className="font-mono text-sm font-medium">{r.code}</Td>
                <Td>
                  <div className="font-medium text-gray-900">{r.name_th}</div>
                  <div className="text-xs text-gray-400">{r.name_en}</div>
                </Td>
                <Td className="text-center">
                  <Badge variant="blue">{r.permission_count}</Badge>
                </Td>
                <Td className="text-center">
                  <Badge variant="gray">{r.user_count}</Badge>
                </Td>
                <Td className="text-right space-x-3">
                  {r.is_system ? (
                    <Badge variant="green">System</Badge>
                  ) : (
                    <>
                      <Link href={`/app/admin/roles/${r.id}`} className="text-sm text-blue-600 hover:underline">แก้ไข</Link>
                      <button onClick={() => handleDelete(r.id)} className="text-sm text-red-600 hover:underline">ลบ</button>
                    </>
                  )}
                </Td>
              </tr>
            ))}
          </Tbody>
        </Table>
      </div>
    </div>
  );
}

'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button, Table, Thead, Tbody, Th, Td, Badge, Modal, ModalHeader, ModalBody, ModalFooter, Input } from '@/components/ui';
import { get, post, patch } from '@/lib/api-client';
import type { Department, User } from '@/types';

export default function HrDepartmentsPage() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [editDept, setEditDept] = useState<Department | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ code: '', name_th: '', name_en: '', parent_id: '', manager_id: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [depts, allUsers] = await Promise.all([
        get<Department[]>('/api/hr/departments'),
        get<{ employees: User[] }>('/api/hr/employees?limit=100'), // Quick hack to get some users
      ]);
      setDepartments(depts);
      setUsers(allUsers.employees);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  function openCreate() {
    setForm({ code: '', name_th: '', name_en: '', parent_id: '', manager_id: '' });
    setError('');
    setShowCreate(true);
  }

  function openEdit(d: Department) {
    setForm({ 
      code: d.code, 
      name_th: d.name_th, 
      name_en: d.name_en, 
      parent_id: d.parent_id ?? '', 
      manager_id: d.manager_id ?? '' 
    });
    setError('');
    setEditDept(d);
  }

  function setF(key: string, val: string) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  async function handleSave() {
    setError('');
    setSaving(true);
    try {
      const payload = {
        code: form.code,
        name_th: form.name_th,
        name_en: form.name_en,
        parent_id: form.parent_id || null,
        manager_id: form.manager_id || null,
      };
      if (editDept) {
        await patch(`/api/hr/departments/${editDept.id}`, payload);
        setEditDept(null);
      } else {
        await post('/api/hr/departments', payload);
        setShowCreate(false);
      }
      fetchData();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'เกิดข้อผิดพลาด');
    } finally {
      setSaving(false);
    }
  }

  const isOpen = showCreate || !!editDept;
  const isEdit = !!editDept;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">แผนก / Departments</h1>
          <p className="text-sm text-stone-500">{departments.length} แผนก</p>
        </div>
        <Button onClick={openCreate} className="w-full sm:w-auto">+ เพิ่มแผนก</Button>
      </div>

      <div className="rounded-xl bg-white shadow-sm border border-stone-100 overflow-hidden">
        <Table>
          <Thead>
            <tr>
              <Th>รหัส</Th>
              <Th>ชื่อแผนก (TH)</Th>
              <Th className="hidden md:table-cell">Name (EN)</Th>
              <Th className="hidden md:table-cell">หัวหน้าแผนก</Th>
              <Th>สถานะ</Th>
              <Th></Th>
            </tr>
          </Thead>
          <Tbody>
            {loading ? (
              <tr><Td colSpan={6}><div className="py-12 text-center text-stone-400">กำลังโหลด...</div></Td></tr>
            ) : departments.length === 0 ? (
              <tr><Td colSpan={6}><div className="py-12 text-center text-stone-400">ไม่พบข้อมูล</div></Td></tr>
            ) : (
              departments.map((d) => (
                <tr key={d.id} className="hover:bg-stone-50 transition-colors">
                  <Td className="font-mono font-medium text-sm text-stone-600">{d.code}</Td>
                  <Td className="text-sm font-medium text-stone-900">{d.name_th}</Td>
                  <Td className="text-sm text-stone-500 hidden md:table-cell">{d.name_en}</Td>
                  <Td className="text-sm text-stone-600 hidden md:table-cell">{d.manager_name_th || d.manager_name_en || '—'}</Td>
                  <Td>
                    <Badge variant={d.is_active ? 'green' : 'gray'}>
                      {d.is_active ? 'ใช้งาน' : 'ปิด'}
                    </Badge>
                  </Td>
                  <Td className="text-right">
                    <button className="text-sm text-stone-400 hover:text-stone-950 transition-colors" onClick={() => openEdit(d)}>แก้ไข</button>
                  </Td>
                </tr>
              ))
            )}
          </Tbody>
        </Table>
      </div>

      {isOpen && (
        <Modal open onClose={() => { setShowCreate(false); setEditDept(null); }}>
          <ModalHeader>{isEdit ? 'แก้ไขแผนก' : 'เพิ่มแผนกใหม่'}</ModalHeader>
          <ModalBody>
            <div className="space-y-4 py-2">
              <Input label="รหัสแผนก *" value={form.code} onChange={(e) => setF('code', e.target.value)} disabled={isEdit} />
              <div className="grid grid-cols-2 gap-4">
                <Input label="ชื่อแผนก (TH) *" value={form.name_th} onChange={(e) => setF('name_th', e.target.value)} />
                <Input label="Department Name (EN) *" value={form.name_en} onChange={(e) => setF('name_en', e.target.value)} />
              </div>
              
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-stone-700">หัวหน้าแผนก</label>
                <select 
                  className="h-9 px-3 rounded-md border border-stone-200 bg-white text-sm outline-none focus:ring-2 focus:ring-stone-950/10 transition-all"
                  value={form.manager_id} 
                  onChange={(e) => setF('manager_id', e.target.value)}
                >
                  <option value="">เลือกพนักงาน</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.name_en} ({u.name_th})</option>)}
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-stone-700">แผนกแม่ (ถ้ามี)</label>
                <select 
                  className="h-9 px-3 rounded-md border border-stone-200 bg-white text-sm outline-none focus:ring-2 focus:ring-stone-950/10 transition-all"
                  value={form.parent_id} 
                  onChange={(e) => setF('parent_id', e.target.value)}
                >
                  <option value="">ไม่มี</option>
                  {departments.filter(d => d.id !== editDept?.id).map(d => <option key={d.id} value={d.id}>{d.name_th}</option>)}
                </select>
              </div>

              {error && <p className="text-sm text-red-600 bg-red-50 p-2 rounded border border-red-100">{error}</p>}
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" onClick={() => { setShowCreate(false); setEditDept(null); }}>ยกเลิก</Button>
            <Button onClick={handleSave} loading={saving}>{isEdit ? 'บันทึก' : 'สร้างแผนก'}</Button>
          </ModalFooter>
        </Modal>
      )}
    </div>
  );
}

'use client';

import { useState } from 'react';
import { Modal, ModalHeader, ModalBody, ModalFooter, Button, Input, Select } from '@/components/ui';
import { post, patch } from '@/lib/api-client';
import type { User } from '@/types';

interface Props {
  user: User | null;
  onClose: () => void;
  onSaved: () => void;
}

export default function UserFormModal({ user, onClose, onSaved }: Props) {
  const isEdit = !!user;
  const [form, setForm] = useState({
    email: user?.email ?? '',
    name_th: user?.name_th ?? '',
    name_en: user?.name_en ?? '',
    role: user?.role ?? 'staff',
    password: '',
    is_active: user?.is_active ?? true,
    employee_id: user?.employee_id ?? '',
    position: user?.position ?? '',
    department: user?.department ?? '',
    phone: user?.phone ?? '',
    hired_date: user?.hired_date ? new Date(user.hired_date).toISOString().slice(0, 10) : '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function set(key: string, val: string | boolean) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  async function handleSave() {
    setError('');
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        name_th: form.name_th,
        name_en: form.name_en,
        role: form.role,
        is_active: form.is_active,
        employee_id: form.employee_id || null,
        position: form.position || null,
        department: form.department || null,
        phone: form.phone || null,
        hired_date: form.hired_date || null,
      };

      if (isEdit) {
        await patch(`/api/admin/users/${user.id}`, payload);
      } else {
        if (!form.password) { setError('กรุณาระบุรหัสผ่าน'); setSaving(false); return; }
        await post('/api/admin/users', { ...payload, email: form.email, password: form.password });
      }
      onSaved();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'เกิดข้อผิดพลาด');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={onClose} size="lg">
      <ModalHeader>{isEdit ? 'แก้ไขผู้ใช้' : 'เพิ่มผู้ใช้ใหม่'}</ModalHeader>
      <ModalBody>
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="อีเมล / Email *" type="email" value={form.email} onChange={(e) => set('email', e.target.value)} disabled={isEdit} />
            <Select
              label="บทบาทพื้นฐาน / Base Role *"
              value={form.role}
              onChange={(e) => set('role', e.target.value)}
              options={[
                { value: 'admin', label: 'ผู้ดูแลระบบ / Admin' },
                { value: 'manager', label: 'ผู้จัดการ / Manager' },
                { value: 'staff', label: 'พนักงาน / Staff' },
              ]}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="ชื่อภาษาไทย" value={form.name_th} onChange={(e) => set('name_th', e.target.value)} />
            <Input label="Name (English) *" value={form.name_en} onChange={(e) => set('name_en', e.target.value)} />
          </div>

          {!isEdit && (
            <Input label="รหัสผ่าน / Password *" type="password" value={form.password} onChange={(e) => set('password', e.target.value)} helperText="อย่างน้อย 8 ตัวอักษร" />
          )}

          <div className="border-t pt-4">
            <h3 className="text-xs font-bold text-gray-600 uppercase mb-4 tracking-widest">ข้อมูลพนักงาน / Employee Info</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input label="รหัสพนักงาน / Employee ID" value={form.employee_id} onChange={(e) => set('employee_id', e.target.value)} placeholder="เช่น EMP001" />
              <Input label="ตำแหน่ง / Position" value={form.position} onChange={(e) => set('position', e.target.value)} />
              <Input label="แผนก / Department" value={form.department} onChange={(e) => set('department', e.target.value)} />
              <Input label="เบอร์โทรศัพท์ / Phone" value={form.phone} onChange={(e) => set('phone', e.target.value)} />
              <Input label="วันที่เริ่มงาน / Hired Date" type="date" value={form.hired_date} onChange={(e) => set('hired_date', e.target.value)} />
            </div>
          </div>

          {isEdit && (
            <label className="flex items-center gap-2 text-sm pt-2">
              <input type="checkbox" className="rounded" checked={form.is_active} onChange={(e) => set('is_active', e.target.checked)} />
              บัญชีเปิดใช้งาน / Active Account
            </label>
          )}

          {error && <p className="text-sm text-red-600 font-medium">{error}</p>}
        </div>
      </ModalBody>
      <ModalFooter>
        <Button variant="ghost" onClick={onClose}>ยกเลิก</Button>
        <Button onClick={handleSave} loading={saving}>{isEdit ? 'บันทึก' : 'สร้างบัญชี'}</Button>
      </ModalFooter>
    </Modal>
  );
}

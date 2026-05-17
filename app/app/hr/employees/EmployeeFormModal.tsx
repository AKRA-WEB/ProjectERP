'use client';

import { useState, useEffect } from 'react';
import { Modal, ModalHeader, ModalBody, ModalFooter, Button, Input, Select } from '@/components/ui';
import { get, post } from '@/lib/api-client';
import type { Department, Position, SalaryGrade, EmploymentType } from '@/types';

interface Props {
  onClose: () => void;
  onSaved: () => void;
}

export default function EmployeeFormModal({ onClose, onSaved }: Props) {
  const [form, setForm] = useState({
    email: '',
    password: '',
    name_th: '',
    name_en: '',
    role: 'staff' as const,
    employee_id: '',
    department_id: '',
    position_id: '',
    salary_grade_id: '',
    base_salary: 0,
    employment_type: 'full_time' as const,
    employee_status: 'active' as const,
    hired_date: new Date().toISOString().slice(0, 10),
    phone: '',
  });

  const [departments, setDepartments] = useState<Department[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [salaryGrades, setSalaryGrades] = useState<SalaryGrade[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      get<Department[]>('/api/hr/departments'),
      get<Position[]>('/api/hr/positions'),
      get<SalaryGrade[]>('/api/hr/salary-grades'),
    ]).then(([depts, pos, grades]) => {
      setDepartments(depts);
      setPositions(pos);
      setSalaryGrades(grades);
    });
  }, []);

  function set(key: string, val: string | number) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  async function handleSave() {
    if (!form.email || !form.password || !form.name_th || !form.name_en) {
      setError('กรุณากรอกข้อมูลที่จำเป็น (*)');
      return;
    }
    setError('');
    setSaving(true);
    try {
      await post('/api/hr/employees', {
        ...form,
        department_id: form.department_id || null,
        position_id: form.position_id || null,
        salary_grade_id: form.salary_grade_id || null,
        base_salary: Number(form.base_salary) || null,
      });
      onSaved();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'เกิดข้อผิดพลาด');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={onClose} size="xl">
      <ModalHeader>เพิ่มพนักงานใหม่</ModalHeader>
      <ModalBody>
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="อีเมล / Email *" type="email" value={form.email} onChange={(e) => set('email', e.target.value)} />
            <Input label="รหัสผ่าน / Password *" type="password" value={form.password} onChange={(e) => set('password', e.target.value)} helperText="อย่างน้อย 8 ตัวอักษร" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="ชื่อภาษาไทย *" value={form.name_th} onChange={(e) => set('name_th', e.target.value)} />
            <Input label="Name (English) *" value={form.name_en} onChange={(e) => set('name_en', e.target.value)} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Input label="รหัสพนักงาน" value={form.employee_id} onChange={(e) => set('employee_id', e.target.value)} placeholder="เช่น EMP001" />
            <Select
              label="บทบาทพื้นฐาน *"
              value={form.role}
              onChange={(e) => set('role', e.target.value)}
              options={[
                { value: 'admin', label: 'ผู้ดูแลระบบ' },
                { value: 'manager', label: 'ผู้จัดการ' },
                { value: 'staff', label: 'พนักงาน' },
              ]}
            />
            <Input label="เบอร์โทรศัพท์" value={form.phone} onChange={(e) => set('phone', e.target.value)} />
          </div>

          <div className="border-t pt-4">
            <h3 className="text-xs font-bold text-gray-400 uppercase mb-4 tracking-widest">ข้อมูลการจ้างงาน / Employment</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Select
                label="แผนก"
                value={form.department_id}
                onChange={(e) => set('department_id', e.target.value)}
                options={departments.map(d => ({ value: d.id, label: d.name_th }))}
                placeholder="เลือกแผนก"
              />
              <Select
                label="ตำแหน่ง"
                value={form.position_id}
                onChange={(e) => set('position_id', e.target.value)}
                options={positions.filter(p => !form.department_id || p.department_id === form.department_id).map(p => ({ value: p.id, label: p.name_th }))}
                placeholder="เลือกตำแหน่ง"
              />
              <Select
                label="ระดับเงินเดือน"
                value={form.salary_grade_id}
                onChange={(e) => set('salary_grade_id', e.target.value)}
                options={salaryGrades.map(sg => ({ value: sg.id, label: sg.name_th }))}
                placeholder="เลือกระดับ"
              />
              <Input label="เงินเดือนพื้นฐาน" type="number" value={form.base_salary} onChange={(e) => set('base_salary', parseFloat(e.target.value) || 0)} />
              <Select
                label="ประเภทการจ้าง"
                value={form.employment_type}
                onChange={(e) => set('employment_type', e.target.value as EmploymentType)}
                options={[
                  { value: 'full_time', label: 'ประจำ (Full-time)' },
                  { value: 'part_time', label: 'พาร์ทไทม์ (Part-time)' },
                  { value: 'contract', label: 'สัญญาจ้าง (Contract)' },
                ]}
              />
              <Input label="วันที่เริ่มงาน" type="date" value={form.hired_date} onChange={(e) => set('hired_date', e.target.value)} />
            </div>
          </div>

          {error && <p className="text-sm text-red-600 font-medium">{error}</p>}
        </div>
      </ModalBody>
      <ModalFooter>
        <Button variant="ghost" onClick={onClose}>ยกเลิก</Button>
        <Button onClick={handleSave} loading={saving}>เพิ่มพนักงาน</Button>
      </ModalFooter>
    </Modal>
  );
}

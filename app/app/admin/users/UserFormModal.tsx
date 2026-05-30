'use client';

import { useState, useEffect } from 'react';
import { Modal, ModalHeader, ModalBody, ModalFooter, Button, Input, Select } from '@/components/ui';
import { post, patch, get } from '@/lib/api-client';
import { useLanguage, localeName, useT } from '@/lib/i18n';
import type { User, BusinessUnit } from '@/types';

interface Props {
  user: User | null;
  onClose: () => void;
  onSaved: () => void;
}

export default function UserFormModal({ user, onClose, onSaved }: Props) {
  const isEdit = !!user;
  const { lang } = useLanguage();
  const t = useT();
  const [businessUnits, setBusinessUnits] = useState<BusinessUnit[]>([]);

  useEffect(() => {
    get<BusinessUnit[]>('/api/admin/business-units')
      .then(setBusinessUnits)
      .catch(console.error);
  }, []);

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
    business_unit_id: user?.business_unit_id ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [newPin, setNewPin] = useState('');
  const [savingPin, setSavingPin] = useState(false);
  const [pinMessage, setPinMessage] = useState('');

  function set(key: string, val: string | boolean) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  async function handleSavePin() {
    if (!user) return;
    setPinMessage('');
    setError('');
    setSavingPin(true);
    try {
      await patch(`/api/admin/users/${user.id}/override-pin`, { pin: newPin });
      setPinMessage(t('users.form.pin_updated'));
      setNewPin('');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t('users.form.error_update_pin'));
    } finally {
      setSavingPin(false);
    }
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
        business_unit_id: form.business_unit_id || null,
      };

      if (isEdit) {
        await patch(`/api/admin/users/${user.id}`, payload);
      } else {
        if (!form.password) { setError(t('users.form.password_required')); setSaving(false); return; }
        await post('/api/admin/users', { ...payload, email: form.email, password: form.password });
      }
      onSaved();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t('users.form.error_generic'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={onClose} size="lg">
      <ModalHeader>{isEdit ? t('users.form.edit_title') : t('users.form.create_title')}</ModalHeader>
      <ModalBody>
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label={`${t('label.email')} *`} type="email" value={form.email} onChange={(e) => set('email', e.target.value)} disabled={isEdit} />
            <Select
              label={`${t('label.role')} *`}
              value={form.role}
              onChange={(e) => set('role', e.target.value)}
              options={[
                { value: 'admin', label: `${t('users.filter.admin')} (Admin)` },
                { value: 'manager', label: `${t('users.filter.manager')} (Manager)` },
                { value: 'staff', label: `${t('users.filter.staff')} (Staff)` },
                { value: 'auditor', label: `${t('users.filter.auditor')} (Auditor)` },
              ]}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label={`${t('label.name')} (TH)`} value={form.name_th} onChange={(e) => set('name_th', e.target.value)} />
            <Input label="Name (English) *" value={form.name_en} onChange={(e) => set('name_en', e.target.value)} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              label={t('label.department')}
              value={form.business_unit_id}
              onChange={(e) => set('business_unit_id', e.target.value)}
              options={[
                { value: '', label: lang === 'en' ? 'All BUs (Cross-BU)' : t('users.label_bu_all') },
                ...businessUnits.map((bu) => ({
                  value: bu.id,
                  label: `${bu.code} — ${localeName(bu.name_th, bu.name_en, lang)}`
                })),
              ]}
            />
          </div>

          {!isEdit && (
            <Input label={`${t('label.phone')} / Password *`} type="password" value={form.password} onChange={(e) => set('password', e.target.value)} helperText="At least 8 characters" />
          )}

          <div className="border-t pt-4">
            <h3 className="text-xs font-bold text-gray-600 uppercase mb-4 tracking-widest">{t('users.form.edit_title')} Info</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input label={`${t('label.employee')} ID`} value={form.employee_id} onChange={(e) => set('employee_id', e.target.value)} placeholder="e.g. EMP001" />
              <Input label={t('label.position')} value={form.position} onChange={(e) => set('position', e.target.value)} />
              <Input label={t('label.department')} value={form.department} onChange={(e) => set('department', e.target.value)} />
              <Input label={t('label.phone')} value={form.phone} onChange={(e) => set('phone', e.target.value)} />
              <Input label="Hired Date" type="date" value={form.hired_date} onChange={(e) => set('hired_date', e.target.value)} />
            </div>
          </div>

          {isEdit && (form.role === 'manager' || form.role === 'admin') && (
            <div className="border-t pt-4">
              <h3 className="text-xs font-bold text-gray-600 uppercase mb-4 tracking-widest">
                Supervisor Override PIN
              </h3>
              <div className="flex items-end gap-3">
                <div className="flex-1">
                  <Input
                    label="New PIN (4-6 digits)"
                    placeholder={user?.override_pin_hash ? t('users.label_pin_has') : t('users.label_pin_none')}
                    type="password"
                    maxLength={6}
                    pattern="[0-9]*"
                    inputMode="numeric"
                    value={newPin}
                    onChange={(e) => setNewPin(e.target.value.replace(/[^0-9]/g, ''))}
                    helperText="Enter 4-6 digits for authorization role"
                  />
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleSavePin}
                  loading={savingPin}
                  disabled={!newPin || newPin.length < 4}
                >
                  Update PIN
                </Button>
              </div>
              {pinMessage && <p className="mt-2 text-sm text-green-600 font-medium">{pinMessage}</p>}
            </div>
          )}

          {isEdit && (
            <label className="flex items-center gap-2 text-sm pt-2">
              <input type="checkbox" className="rounded" checked={form.is_active} onChange={(e) => set('is_active', e.target.checked)} />
              {t('users.label_active')} / Active Account
            </label>
          )}

          {error && <p className="text-sm text-red-600 font-medium">{error}</p>}
        </div>
      </ModalBody>
      <ModalFooter>
        <Button variant="ghost" onClick={onClose}>{t('action.cancel')}</Button>
        <Button onClick={handleSave} loading={saving}>{isEdit ? t('users.form.save_btn') : t('users.form.create_btn')}</Button>
      </ModalFooter>
    </Modal>
  );
}

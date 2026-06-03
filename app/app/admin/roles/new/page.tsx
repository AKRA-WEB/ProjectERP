'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Input } from '@/components/ui';
import { get, post } from '@/lib/api-client';
import type { Permission } from '@/types';
import { useT } from '@/lib/i18n';

export default function NewRolePage() {
  const router = useRouter();
  const t = useT();
  const [catalog, setCatalog] = useState<Record<string, Permission[]>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    code: '',
    name_th: '',
    name_en: '',
    description: '',
  });
  const [selectedPerms, setSelectedPerms] = useState<string[]>([]);

  useEffect(() => {
    get<Record<string, Permission[]>>('/api/admin/permissions')
      .then(setCatalog)
      .finally(() => setLoading(false));
  }, []);

  function togglePerm(id: string) {
    setSelectedPerms((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  }

  async function handleSubmit() {
    if (!formData.code || !formData.name_th || !formData.name_en || selectedPerms.length === 0) {
      setError(t('roles.new.validation_error'));
      return;
    }
    setError('');
    setSaving(true);
    try {
      await post('/api/admin/roles', { ...formData, permission_ids: selectedPerms });
      router.push('/app/admin/roles');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t('roles.new.error_generic'));
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="py-16 text-center text-gray-600">{t('msg.loading_data')}</div>;

  const moduleLabels: Record<string, string> = {
    inbound_order: t('roles.module.inbound_order'),
    purchase_request: t('roles.module.purchase_request'),
    purchase_order: t('roles.module.purchase_order'),
    grn: t('roles.module.grn'),
    rma: t('roles.module.rma'),
    claim: t('roles.module.claim'),
    transfer: t('roles.module.transfer'),
    cycle_count: t('roles.module.cycle_count'),
    inventory: t('roles.module.inventory'),
    admin: t('roles.module.admin'),
  };

  return (
    <div className="max-w-4xl">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-gray-900">{t('roles.new.title')}</h1>
        <button className="text-sm text-gray-500 hover:underline" onClick={() => router.back()}>← {t('roles.new.back')}</button>
      </div>

      <div className="rounded-xl bg-white shadow-sm border border-gray-100 p-6 space-y-8">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Input label={`${t('label.code')} *`} placeholder="e.g. warehouse_admin" value={formData.code} onChange={(e) => setFormData({ ...formData, code: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') })} />
          <Input label={`${t('label.name')} (TH) *`} value={formData.name_th} onChange={(e) => setFormData({ ...formData, name_th: e.target.value })} />
          <Input label={`${t('label.name')} (EN) *`} value={formData.name_en} onChange={(e) => setFormData({ ...formData, name_en: e.target.value })} />
        </div>
        <Input label={t('label.description')} value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} />

        <div>
          <h2 className="text-sm font-semibold text-gray-900 mb-4 border-b pb-2 uppercase tracking-wider">{t('roles.new.permissions_section')}</h2>
          <div className="space-y-8">
            {Object.entries(catalog).map(([module, perms]) => (
              <div key={module}>
                <h3 className="text-xs font-bold text-gray-600 uppercase mb-3 bg-gray-50 px-2 py-1 inline-block rounded">{moduleLabels[module] ?? module.replace(/_/g, ' ')}</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {perms.map((p) => (
                    <label key={p.id} className="flex items-start gap-3 p-3 rounded-lg border border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors">
                      <input type="checkbox" className="mt-1 rounded" checked={selectedPerms.includes(p.id)} onChange={() => togglePerm(p.id)} />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900">{p.name_th}</p>
                        <p className="text-xs text-gray-600 truncate">{p.id}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex justify-end pt-6 border-t">
          <Button onClick={handleSubmit} loading={saving}>{t('roles.new.save_btn')}</Button>
        </div>
      </div>
    </div>
  );
}

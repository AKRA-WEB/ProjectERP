'use client';

import { useState, useEffect } from 'react';
import { get, patch } from '@/lib/api-client';
import { Button, Input } from '@/components/ui';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Settings, Save, AlertCircle } from 'lucide-react';
import { useT } from '@/lib/i18n';

const CARD = 'bg-white border border-stone-200 rounded-xl p-6 shadow-sm';

export default function RepackSettingsPage() {
  const t = useT();
  const [threshold, setThreshold] = useState<number>(5);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchSettings();
  }, []);

  async function fetchSettings() {
    try {
      const res = await get<{ threshold_pct: number }>('/api/settings/repack-loss-threshold');
      setThreshold(Number(res.threshold_pct));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    setError('');
    try {
      await patch('/api/settings/repack-loss-threshold', { threshold_pct: threshold });
      alert(t('repack.save_success'));
    } catch (err: unknown) {
      setError((err as Error).message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="flex justify-center py-24"><LoadingSpinner /></div>;

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold flex items-center gap-2">
        <Settings className="w-6 h-6 text-stone-600" /> {t('repack.page.title')}
      </h1>

      <div className={CARD}>
        <div className="space-y-6">
          <div>
            <h2 className="text-lg font-bold text-stone-900 mb-1">{t('repack.threshold.title')}</h2>
            <p className="text-sm text-stone-500 mb-4">{t('repack.threshold.desc')}</p>

            <div className="flex items-center gap-4 max-w-xs">
              <Input
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={threshold}
                onChange={(e) => setThreshold(Number(e.target.value))}
                className="text-right font-mono text-lg"
              />
              <span className="text-lg font-bold text-stone-400">%</span>
            </div>
          </div>

          {error && (
            <div className="p-4 bg-red-50 text-red-700 rounded-lg flex items-center gap-2 text-sm">
              <AlertCircle className="w-4 h-4" /> {error}
            </div>
          )}

          <div className="pt-6 border-t border-stone-100">
            <Button className="bg-stone-900 text-white px-8" onClick={handleSave} loading={saving}>
              <Save className="w-4 h-4 mr-2" /> {t('repack.btn_save')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

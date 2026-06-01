'use client';

/* eslint-disable local-rules/no-hardcoded-thai */
import { useState, useEffect, startTransition } from 'react';
import { get, post } from '@/lib/api-client';
import { formatCurrency, formatDatetime } from '@/lib/format';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { StatusBadge } from '@/components/ui/StatusBadge';
import Link from 'next/link';
import type { PosSession, Warehouse, PosShift } from '@/types';
import { useRouter } from 'next/navigation';
import { DirectionalTransition } from '@/components/ui/directional-transition';
import { addTransitionType } from '@/lib/react-vts';
import { useT, useLanguage, localeName } from '@/lib/i18n';

const CARD = 'bg-white border border-stone-200 rounded-[10px] shadow-sm overflow-hidden';

export default function PosHomePage() {
  const [sessions, setSessions] = useState<PosSession[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [shifts, setShifts] = useState<PosShift[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();
  const t = useT();
  const { lang } = useLanguage();

  // Form state
  const [warehouseId, setWarehouseId] = useState('');
  const [openingFloat, setOpeningFloat] = useState('0');
  const [shiftId, setShiftId] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    try {
      const [sessionsRes, warehousesRes, shiftsRes] = await Promise.all([
        get<{ data: PosSession[] }>('/api/pos/sessions?status=open'),
        get<Warehouse[]>('/api/admin/warehouses'),
        get<PosShift[]>('/api/pos/shifts'),
      ]);
      setSessions(sessionsRes.data);
      setWarehouses(warehousesRes.filter(w => w.is_active));
      setShifts(shiftsRes);
      if (warehousesRes.length > 0) setWarehouseId(warehousesRes[0].id);
    } catch (error) {
      console.error('Failed to fetch POS data:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleOpenSession(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await post<PosSession>('/api/pos/sessions', {
        warehouse_id: warehouseId,
        opening_float: parseFloat(openingFloat),
        shift_id: shiftId || undefined,
        notes: notes || undefined,
      });
      startTransition(() => {
        addTransitionType('nav-forward');
        router.push(`/app/pos/session/${res.id}`);
      });
    } catch (error) {
      alert(error instanceof Error ? error.message : t('error.server'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <DirectionalTransition>
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-stone-900">{t('page.pos_terminal')}</h1>
            <p className="text-stone-500 text-sm">จัดการรอบการขายและเปิดเครื่องบันทึกเงินสด</p>
          </div>
          <div className="flex gap-2">
            <Link href="/app/pos/sessions" transitionTypes={['nav-forward']}>
              <Button variant="outline">{t('page.sessions')}</Button>
            </Link>
            <Button onClick={() => setIsModalOpen(true)}>{t('action.create')} {t('page.sessions')}</Button>
          </div>
        </div>

        <div className="grid gap-4">
          <h2 className="text-sm font-medium text-stone-500 uppercase tracking-wider">{t('status.open')}</h2>
          
          {loading ? (
            <div className="flex justify-center py-12">
              <LoadingSpinner />
            </div>
          ) : sessions.length === 0 ? (
            <div className={`${CARD} p-12 text-center`}>
              <div className="text-4xl mb-3">🏪</div>
              <p className="text-stone-500">{t('label.no_data')}</p>
              <Button 
                variant="outline" 
                className="mt-4"
                onClick={() => setIsModalOpen(true)}
              >
                {t('action.create')}
              </Button>
            </div>
          ) : (
            <div className="grid gap-4">
              {sessions.map((s) => (
                <Link key={s.id} href={`/app/pos/session/${s.id}`} transitionTypes={['nav-forward']}>
                  <div className={`${CARD} p-5 hover:border-emerald-500 transition-colors cursor-pointer group`}>
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-stone-900">{s.session_number}</span>
                          <StatusBadge status="open" />
                        </div>
                        <p className="text-sm text-stone-600">
                          {t('label.warehouse')}: <span className="font-medium text-stone-900">{localeName(s.warehouse_name_th, s.warehouse_name_en, lang)}</span>
                          {s.shift_name_th && <span className="ml-2 text-emerald-600">| {t('page.shifts')}: <span className="font-bold">{localeName(s.shift_name_th, s.shift_name_en, lang)}</span></span>}
                        </p>
                        <p className="text-xs text-stone-400">
                          {t('status.open')}: {formatDatetime(s.opened_at, lang)} โดย {s.opened_by_name}
                        </p>
                      </div>
                      <div className="text-right space-y-2">
                        <div className="text-xs text-stone-400 uppercase font-medium">{t('label.total')}</div>
                        <div className="text-xl font-bold text-emerald-600">{formatCurrency(s.total_sales ?? 0, lang)}</div>
                        <div className="text-xs text-stone-400">{s.transaction_count ?? 0} {t('label.qty')}</div>
                      </div>
                    </div>
                    <div className="mt-4 pt-4 border-t border-stone-100 flex justify-end">
                      <span className="text-sm font-medium text-emerald-600 group-hover:translate-x-1 transition-transform inline-flex items-center gap-1">
                        {t('action.view')} →
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        <Modal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title={t('action.create')}
        >
          <form onSubmit={handleOpenSession} className="space-y-4 pt-2">
            <Select
              label={t('label.warehouse')}
              value={warehouseId}
              onChange={(e) => setWarehouseId(e.target.value)}
              required
            >
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.code} — {localeName(w.name_th, w.name_en, lang)}
                </option>
              ))}
            </Select>

            <Select
              label={t('page.shifts')}
              value={shiftId}
              onChange={(e) => setShiftId(e.target.value)}
            >
              <option value="">-- {t('label.all')} --</option>
              {shifts.map((s) => (
                <option key={s.id} value={s.id}>
                  {localeName(s.name_th, s.name_en, lang)} ({s.start_time} - {s.end_time})
                </option>
              ))}
            </Select>

            <Input
              label={t('label.amount')}
              type="number"
              value={openingFloat}
              onChange={(e) => setOpeningFloat(e.target.value)}
              min="0"
              step="0.01"
              required
            />

            <Input
              label={t('label.note')}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="..."
            />

            <div className="flex justify-end gap-2 pt-4">
              <button 
                type="button" 
                onClick={() => setIsModalOpen(false)}
                disabled={submitting}
                className="h-9 px-4 rounded-md border border-stone-200 bg-white text-sm font-medium hover:bg-stone-50 disabled:opacity-50"
              >
                {t('action.cancel')}
              </button>
              <Button type="submit" loading={submitting}>
                {t('action.confirm')}
              </Button>
            </div>
          </form>
        </Modal>
      </div>
    </DirectionalTransition>
  );
}

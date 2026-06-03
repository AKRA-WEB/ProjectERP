'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  RefreshCw,
  ArrowLeft,
  Calendar,
  Search,
  Clock,
  Database,
  CheckCircle,
  AlertTriangle
} from 'lucide-react';
import { get, post } from '@/lib/api-client';
import { formatDatetime } from '@/lib/format';
import { useToast } from '@/components/ui/Toast';
import { DirectionalTransition } from '@/components/ui/directional-transition';
import {
  Badge,
  StatusBadge,
  Table,
  Thead,
  Tbody,
  Th,
  LoadingSpinner,
  Card,
  CardHeader,
  CardBody,
  KpiCard,
  KpiGrid
} from '@/components/ui';
import { useT } from '@/lib/i18n';

interface SyncRun {
  id: string;
  started_at: string;
  completed_at: string | null;
  status: 'running' | 'completed' | 'failed';
  total_count: number;
  created_count: number;
  updated_count: number;
  disabled_count: number;
  orphan_count: number;
  error_message: string | null;
}

interface UserMapping {
  id: string;
  local_user_id: string | null;
  hrzoft_employee_id: string;
  last_synced_at: string;
  status: 'active' | 'disabled' | 'orphan';
  conflict_notes: string | null;
  email: string | null;
  name_th: string | null;
  name_en: string | null;
  position: string | null;
  department: string | null;
  local_active: boolean | null;
}

export default function HrzoftIntegrationPage() {
  const toast = useToast();
  const t = useT();
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [lastRun, setLastRun] = useState<SyncRun | null>(null);
  const [mappings, setMappings] = useState<UserMapping[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await get<{ lastRun: SyncRun | null; mappings: UserMapping[] }>(
        '/api/admin/hrzoft/last-run'
      );
      setLastRun(res.lastRun);
      setMappings(res.mappings || []);
    } catch (err: unknown) {
      console.error('Failed to load Hrzoft sync data:', err);
      const errMsg = err instanceof Error ? err.message : t('hrzoft.load_error');
      toast('error', errMsg);
    } finally {
      setLoading(false);
    }
  }, [toast, t]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSyncNow = async () => {
    try {
      setSyncing(true);
      toast('info', t('hrzoft.sync_start'));

      const res = await post<{ result: SyncRun }>('/api/admin/hrzoft/sync', {});

      toast('success', `${t('hrzoft.sync_success')} ${res.result.total_count} ${t('hrzoft.sync_success_total')} (${t('hrzoft.sync_success_created')} ${res.result.created_count}, ${t('hrzoft.sync_success_updated')} ${res.result.updated_count}, ${t('hrzoft.sync_success_disabled')} ${res.result.disabled_count})`);

      await loadData();
    } catch (err: unknown) {
      console.error('Manual sync failed:', err);
      const errMsg = err instanceof Error ? err.message : t('hrzoft.sync_error');
      toast('error', errMsg);
    } finally {
      setSyncing(false);
    }
  };

  const filteredMappings = mappings.filter(m => {
    const matchesSearch =
      (m.name_th && m.name_th.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (m.name_en && m.name_en.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (m.email && m.email.toLowerCase().includes(searchQuery.toLowerCase())) ||
      m.hrzoft_employee_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (m.position && m.position.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (m.department && m.department.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesStatus = statusFilter === 'all' || m.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <DirectionalTransition>
      <div className="max-w-[1200px] mx-auto min-h-[calc(100vh-140px)] font-sans px-4 py-8">

        {/* Style tokens for micro-interactions and arun aesthetic */}
        <style dangerouslySetInnerHTML={{ __html: `
          .glow-btn:hover {
            box-shadow: 0 0 12px rgba(122,90,126,0.3);
          }
          .custom-table tr {
            transition: background-color 0.15s ease;
          }
          .custom-table tr:hover {
            background-color: #fafaf9;
          }
        ` }} />

        {/* Breadcrumb Navigation */}
        <div className="mb-6">
          <Link
            href="/app/admin"
            className="inline-flex items-center gap-2 text-sm text-[#7a5a7e] hover:text-[#5e4361] font-medium transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>{t('hrzoft.back_to_admin')}</span>
          </Link>
        </div>

        {/* Page Header */}
        <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between border-b border-[#e4e0d6] pb-6 gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-[#7a5a7e] font-semibold mb-1">
              <span>INTEGRATIONS SYSTEM</span>
              <span className="w-1.5 h-1.5 rounded-full bg-[#7a5a7e]/40" />
              <span>{t('hrzoft.breadcrumb')}</span>
            </div>
            <h1 className="font-display text-[28px] font-semibold tracking-tight text-[#1c1917] m-0">
              {t('hrzoft.page.title')}
            </h1>
            <p className="text-sm text-stone-500 mt-1.5 max-w-[700px]">
              {t('hrzoft.page.description')}
            </p>
          </div>

          <button
            onClick={handleSyncNow}
            disabled={syncing || loading}
            className={`glow-btn px-5 py-2.5 bg-[#7a5a7e] hover:bg-[#5e4361] disabled:bg-stone-300 text-white rounded-md text-sm font-semibold flex items-center justify-center gap-2.5 transition-all cursor-pointer ${
              syncing ? 'animate-pulse' : ''
            }`}
          >
            <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
            <span>{syncing ? t('hrzoft.btn.syncing') : t('hrzoft.btn.sync_now')}</span>
          </button>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <LoadingSpinner className="w-10 h-10 text-[#7a5a7e]" />
            <div className="text-sm text-stone-500 font-medium">{t('hrzoft.loading')}</div>
          </div>
        ) : (
          <div className="space-y-8">

            {/* KPI Cards Grid */}
            <KpiGrid>
              <KpiCard
                label={t('hrzoft.kpi.total')}
                value={lastRun ? lastRun.total_count : 0}
                subValue={t('hrzoft.kpi.total_sub')}
              />
              <KpiCard
                label={t('hrzoft.kpi.created')}
                value={lastRun ? lastRun.created_count : 0}
                subValue={t('hrzoft.kpi.created_sub')}
              />
              <KpiCard
                label={t('hrzoft.kpi.updated')}
                value={lastRun ? lastRun.updated_count : 0}
                subValue={t('hrzoft.kpi.updated_sub')}
              />
              <KpiCard
                label={t('hrzoft.kpi.disabled')}
                value={lastRun ? lastRun.disabled_count : 0}
                subValue={t('hrzoft.kpi.disabled_sub')}
              />
              <KpiCard
                label={t('hrzoft.kpi.orphans')}
                value={lastRun ? lastRun.orphan_count : 0}
                subValue={t('hrzoft.kpi.orphans_sub')}
              />
            </KpiGrid>

            {/* Last Execution Run Status Card */}
            <Card>
              <CardHeader className="bg-stone-50/50 border-b border-[#e4e0d6] px-6 py-4 flex flex-row items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-[#7a5a7e]" />
                  <h3 className="text-base font-semibold text-stone-800 m-0">
                    {t('hrzoft.last_run.title')}
                  </h3>
                </div>
                {lastRun ? (
                  <Badge
                    variant={
                      lastRun.status === 'completed' ? 'ok' :
                      lastRun.status === 'failed' ? 'danger' : 'warn'
                    }
                  >
                    {lastRun.status === 'completed' ? t('hrzoft.status.completed') :
                     lastRun.status === 'failed' ? t('hrzoft.status.failed') : t('hrzoft.status.running')}
                  </Badge>
                ) : (
                  <Badge variant="muted">{t('hrzoft.status.idle')}</Badge>
                )}
              </CardHeader>
              <CardBody className="p-6">
                {lastRun ? (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
                    <div className="space-y-1.5">
                      <div className="text-stone-400 text-xs font-semibold uppercase tracking-wider">{t('hrzoft.last_run.started_at')}</div>
                      <div className="text-stone-700 font-medium flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-stone-400" />
                        {formatDatetime(lastRun.started_at, 'th')}
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <div className="text-stone-400 text-xs font-semibold uppercase tracking-wider">{t('hrzoft.last_run.finished_at')}</div>
                      <div className="text-stone-700 font-medium flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-stone-400" />
                        {lastRun.completed_at ? formatDatetime(lastRun.completed_at, 'th') : '—'}
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <div className="text-stone-400 text-xs font-semibold uppercase tracking-wider">{t('hrzoft.last_run.api_target')}</div>
                      <div className="text-stone-700 font-medium font-mono flex items-center gap-2 text-xs truncate max-w-[300px]">
                        <Database className="w-4 h-4 text-stone-400" />
                        {process.env.NEXT_PUBLIC_HRZOFT_URL || 'Hrzoft External API Gateway (Simulation fallback active)'}
                      </div>
                    </div>

                    {lastRun.error_message && (
                      <div className="col-span-1 md:col-span-3 mt-2 bg-red-50 border border-red-200 rounded p-4 text-red-700 flex gap-2">
                        <AlertTriangle className="w-5 h-5 shrink-0" />
                        <div>
                          <span className="font-semibold block mb-0.5">{t('hrzoft.last_run.error_label')}</span>
                          <span className="font-mono text-xs break-all">{lastRun.error_message}</span>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-6 text-stone-400 text-sm">
                    {t('hrzoft.last_run.no_history')}
                  </div>
                )}
              </CardBody>
            </Card>

            {/* Conflict & Details Table section */}
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-lg font-semibold text-stone-800 m-0">
                    {t('hrzoft.mappings.title')}
                  </h3>
                  <p className="text-xs text-stone-500 mt-0.5">
                    {t('hrzoft.mappings.description')}
                  </p>
                </div>

                {/* Filter and search */}
                <div className="flex flex-col sm:flex-row gap-2.5">
                  <div className="relative min-w-[200px]">
                    <Search className="absolute left-3 top-2.5 w-4 h-4 text-stone-400" />
                    <input
                      type="text"
                      placeholder={t('hrzoft.search_placeholder')}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 border border-stone-300 rounded-md text-xs text-stone-700 focus:outline-none focus:border-[#7a5a7e] transition-colors bg-white"
                    />
                  </div>

                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="px-3 py-2 border border-stone-300 rounded-md text-xs text-stone-700 focus:outline-none focus:border-[#7a5a7e] transition-colors bg-white cursor-pointer"
                  >
                    <option value="all">{t('hrzoft.filter.all')}</option>
                    <option value="active">{t('hrzoft.filter.active')}</option>
                    <option value="disabled">{t('hrzoft.filter.disabled')}</option>
                    <option value="orphan">{t('hrzoft.filter.orphan')}</option>
                  </select>
                </div>
              </div>

              {/* Data Table */}
              <div className="border border-[#e4e0d6] rounded-lg overflow-hidden bg-white shadow-sm">
                <Table className="custom-table w-full">
                  <Thead>
                    <tr>
                      <Th className="py-3 px-4 text-left text-xs font-semibold text-stone-600 uppercase tracking-wider w-[120px]">
                        {t('hrzoft.th.emp_id')}
                      </Th>
                      <Th className="py-3 px-4 text-left text-xs font-semibold text-stone-600 uppercase tracking-wider">
                        {t('hrzoft.th.employee')}
                      </Th>
                      <Th className="py-3 px-4 text-left text-xs font-semibold text-stone-600 uppercase tracking-wider hidden md:table-cell">
                        {t('hrzoft.th.dept_position')}
                      </Th>
                      <Th className="py-3 px-4 text-left text-xs font-semibold text-stone-600 uppercase tracking-wider w-[140px]">
                        {t('hrzoft.th.sync_status')}
                      </Th>
                      <Th className="py-3 px-4 text-left text-xs font-semibold text-stone-600 uppercase tracking-wider">
                        {t('hrzoft.th.notes')}
                      </Th>
                    </tr>
                  </Thead>
                  <Tbody>
                    {filteredMappings.length > 0 ? (
                      filteredMappings.map((mapping) => (
                        <tr key={mapping.id} className="border-b border-stone-100 last:border-0">
                          <td className="py-3.5 px-4 font-mono text-xs font-semibold text-[#7a5a7e]">
                            {mapping.hrzoft_employee_id}
                          </td>
                          <td className="py-3.5 px-4">
                            <div>
                              <span className="font-medium text-stone-800 text-sm block">
                                {mapping.name_th || mapping.name_en || t('hrzoft.no_name')}
                              </span>
                              <span className="text-xs text-stone-400 block font-mono mt-0.5">
                                {mapping.email || '—'}
                              </span>
                            </div>
                          </td>
                          <td className="py-3.5 px-4 hidden md:table-cell">
                            <div>
                              <span className="text-xs text-stone-600 font-medium block">
                                {mapping.department || '—'}
                              </span>
                              <span className="text-[11px] text-stone-400 block mt-0.5">
                                {mapping.position || '—'}
                              </span>
                            </div>
                          </td>
                          <td className="py-3.5 px-4">
                            <StatusBadge
                              status={
                                mapping.status === 'active' ? 'active' :
                                mapping.status === 'disabled' ? 'inactive' : 'rejected'
                              }
                              labelOverride={
                                mapping.status === 'active' ? 'Active' :
                                mapping.status === 'disabled' ? 'Disabled' : t('hrzoft.orphan_label')
                              }
                            />
                          </td>
                          <td className="py-3.5 px-4 text-xs">
                            {mapping.status === 'orphan' ? (
                              <div className="text-amber-600 flex items-center gap-1.5 font-medium bg-amber-50 rounded px-2.5 py-1 w-fit border border-amber-200">
                                <AlertTriangle className="w-3.5 h-3.5" />
                                <span>{t('hrzoft.orphan_note')}</span>
                              </div>
                            ) : mapping.conflict_notes ? (
                              <div className="text-purple-600 flex items-center gap-1.5 font-medium bg-purple-50 rounded px-2.5 py-1 w-fit border border-purple-200">
                                <AlertTriangle className="w-3.5 h-3.5 animate-pulse" />
                                <span>{mapping.conflict_notes}</span>
                              </div>
                            ) : (
                              <span className="text-stone-400">{t('hrzoft.sync_ok')}</span>
                            )}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="text-center py-10 text-stone-400 text-sm">
                          {searchQuery || statusFilter !== 'all'
                            ? t('hrzoft.no_results')
                            : t('hrzoft.no_mappings')}
                        </td>
                      </tr>
                    )}
                  </Tbody>
                </Table>
              </div>
            </div>

          </div>
        )}

      </div>
    </DirectionalTransition>
  );
}

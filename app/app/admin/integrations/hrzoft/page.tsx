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
      const errMsg = err instanceof Error ? err.message : 'ไม่สามารถโหลดข้อมูลการซิงค์พนักงานได้';
      toast('error', errMsg);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSyncNow = async () => {
    try {
      setSyncing(true);
      toast('info', 'กำลังดึงข้อมูลพนักงานจาก Hrzoft กรุณารอสักครู่...');

      const res = await post<{ result: SyncRun }>('/api/admin/hrzoft/sync', {});
      
      toast('success', `สำเร็จ! ซิงค์ทั้งหมด ${res.result.total_count} รายการ (สร้าง ${res.result.created_count}, อัปเดต ${res.result.updated_count}, ปิดใช้งาน ${res.result.disabled_count})`);
      
      await loadData();
    } catch (err: unknown) {
      console.error('Manual sync failed:', err);
      const errMsg = err instanceof Error ? err.message : 'เกิดข้อผิดพลาดระหว่างกระบวนการซิงค์ข้อมูล';
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
            <span>กลับหน้าหลักผู้ดูแลระบบ / Admin Panel</span>
          </Link>
        </div>

        {/* Page Header */}
        <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between border-b border-[#e4e0d6] pb-6 gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-[#7a5a7e] font-semibold mb-1">
              <span>INTEGRATIONS SYSTEM</span>
              <span className="w-1.5 h-1.5 rounded-full bg-[#7a5a7e]/40" />
              <span>การเชื่อมต่อระบบภายนอก</span>
            </div>
            <h1 className="font-display text-[28px] font-semibold tracking-tight text-[#1c1917] m-0">
              เชื่อมโยงข้อมูลพนักงาน Hrzoft
            </h1>
            <p className="text-sm text-stone-500 mt-1.5 max-w-[700px]">
              ระบบเชื่อมข้อมูลบัญชีพนักงานจาก Hrzoft เป็นหลักคืนทุกคืนโดยอัตโนมัติ โดยระบบ ERP จะควบคุมสิทธิ์การใช้งาน (Role) และหน่วยธุรกิจ (BU)
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
            <span>{syncing ? 'กำลังซิงค์ข้อมูล...' : 'ซิงค์ข้อมูลตอนนี้ / Sync Now'}</span>
          </button>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <LoadingSpinner className="w-10 h-10 text-[#7a5a7e]" />
            <div className="text-sm text-stone-500 font-medium">กำลังโหลดข้อมูลระบบซิงค์...</div>
          </div>
        ) : (
          <div className="space-y-8">
            
            {/* KPI Cards Grid */}
            <KpiGrid>
              <KpiCard
                label="พนักงานทั้งหมด / Total"
                value={lastRun ? lastRun.total_count : 0}
                subValue="จำนวนพนักงานที่ดึงมาล่าสุด"
              />
              <KpiCard
                label="สร้างบัญชีใหม่ / Created"
                value={lastRun ? lastRun.created_count : 0}
                subValue="สร้างบัญชีผู้ใช้ใหม่ใน ERP"
              />
              <KpiCard
                label="อัปเดตข้อมูล / Updated"
                value={lastRun ? lastRun.updated_count : 0}
                subValue="ข้อมูลโปรไฟล์ที่ได้รับการอัปเดต"
              />
              <KpiCard
                label="ปิดการใช้งาน / Disabled"
                value={lastRun ? lastRun.disabled_count : 0}
                subValue="พนักงานที่ลาออกหรือระงับงาน"
              />
              <KpiCard
                label="พนักงานตกค้าง / Orphans"
                value={lastRun ? lastRun.orphan_count : 0}
                subValue="พบในระบบ ERP แต่ไม่พบใน Hrzoft"
              />
            </KpiGrid>

            {/* Last Execution Run Status Card */}
            <Card>
              <CardHeader className="bg-stone-50/50 border-b border-[#e4e0d6] px-6 py-4 flex flex-row items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-[#7a5a7e]" />
                  <h3 className="text-base font-semibold text-stone-800 m-0">
                    สถานะการทำงานรอบล่าสุด / Last Job Execution Status
                  </h3>
                </div>
                {lastRun ? (
                  <Badge 
                    variant={
                      lastRun.status === 'completed' ? 'ok' : 
                      lastRun.status === 'failed' ? 'danger' : 'warn'
                    }
                  >
                    {lastRun.status === 'completed' ? 'สำเร็จ / Completed' : 
                     lastRun.status === 'failed' ? 'ผิดพลาด / Failed' : 'กำลังรัน / Running'}
                  </Badge>
                ) : (
                  <Badge variant="muted">ยังไม่เคยดำเนินการ / Idle</Badge>
                )}
              </CardHeader>
              <CardBody className="p-6">
                {lastRun ? (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
                    <div className="space-y-1.5">
                      <div className="text-stone-400 text-xs font-semibold uppercase tracking-wider">เวลาเริ่มดำเนินการ / Started At</div>
                      <div className="text-stone-700 font-medium flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-stone-400" />
                        {formatDatetime(lastRun.started_at, 'th')}
                      </div>
                    </div>
                    
                    <div className="space-y-1.5">
                      <div className="text-stone-400 text-xs font-semibold uppercase tracking-wider">เวลาสิ้นสุดการทำงาน / Finished At</div>
                      <div className="text-stone-700 font-medium flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-stone-400" />
                        {lastRun.completed_at ? formatDatetime(lastRun.completed_at, 'th') : '—'}
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <div className="text-stone-400 text-xs font-semibold uppercase tracking-wider">แหล่งข้อมูล API / API Target</div>
                      <div className="text-stone-700 font-medium font-mono flex items-center gap-2 text-xs truncate max-w-[300px]">
                        <Database className="w-4 h-4 text-stone-400" />
                        {process.env.NEXT_PUBLIC_HRZOFT_URL || 'Hrzoft External API Gateway (Simulation fallback active)'}
                      </div>
                    </div>

                    {lastRun.error_message && (
                      <div className="col-span-1 md:col-span-3 mt-2 bg-red-50 border border-red-200 rounded p-4 text-red-700 flex gap-2">
                        <AlertTriangle className="w-5 h-5 shrink-0" />
                        <div>
                          <span className="font-semibold block mb-0.5">เกิดข้อผิดพลาดของระบบ:</span>
                          <span className="font-mono text-xs break-all">{lastRun.error_message}</span>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-6 text-stone-400 text-sm">
                    ไม่มีประวัติการรัน หรือเซิร์ฟเวอร์ยังไม่ได้เชื่อมต่อเป็นครั้งแรก กดปุ่ม &quot;ซิงค์ข้อมูลตอนนี้&quot; เพื่อเปิดการทำงานรอบแรก
                  </div>
                )}
              </CardBody>
            </Card>

            {/* Conflict & Details Table section */}
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-lg font-semibold text-stone-800 m-0">
                    รายการเชื่อมต่อข้อมูลพนักงาน / Employee Mappings
                  </h3>
                  <p className="text-xs text-stone-500 mt-0.5">
                    ตรวจสอบความถูกต้อง ค้นหา และระบุข้อมูลพนักงานที่มีความขัดแย้งของอีเมลหรือรายการค้างในระบบ
                  </p>
                </div>

                {/* Filter and search */}
                <div className="flex flex-col sm:flex-row gap-2.5">
                  <div className="relative min-w-[200px]">
                    <Search className="absolute left-3 top-2.5 w-4 h-4 text-stone-400" />
                    <input
                      type="text"
                      placeholder="ค้นหาชื่อ, รหัส, แผนก..."
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
                    <option value="all">แสดงสถานะทั้งหมด</option>
                    <option value="active">Active (เชื่อมต่อปกติ)</option>
                    <option value="disabled">Disabled (ปิดสิทธิ์ผู้ใช้)</option>
                    <option value="orphan">Orphan (ตกค้างใน ERP)</option>
                  </select>
                </div>
              </div>

              {/* Data Table */}
              <div className="border border-[#e4e0d6] rounded-lg overflow-hidden bg-white shadow-sm">
                <Table className="custom-table w-full">
                  <Thead>
                    <tr>
                      <Th className="py-3 px-4 text-left text-xs font-semibold text-stone-600 uppercase tracking-wider w-[120px]">
                        รหัสพนักงาน
                      </Th>
                      <Th className="py-3 px-4 text-left text-xs font-semibold text-stone-600 uppercase tracking-wider">
                        พนักงาน (ERP User)
                      </Th>
                      <Th className="py-3 px-4 text-left text-xs font-semibold text-stone-600 uppercase tracking-wider hidden md:table-cell">
                        แผนก / ตำแหน่ง
                      </Th>
                      <Th className="py-3 px-4 text-left text-xs font-semibold text-stone-600 uppercase tracking-wider w-[140px]">
                        สถานะเชื่อมต่อ
                      </Th>
                      <Th className="py-3 px-4 text-left text-xs font-semibold text-stone-600 uppercase tracking-wider">
                        หมายเหตุ / ข้อมูลขัดแย้ง
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
                                {mapping.name_th || mapping.name_en || 'ไม่มีข้อมูลชื่อพนักงาน'}
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
                                mapping.status === 'disabled' ? 'Disabled' : 'Orphan (ตกค้าง)'
                              }
                            />
                          </td>
                          <td className="py-3.5 px-4 text-xs">
                            {mapping.status === 'orphan' ? (
                              <div className="text-amber-600 flex items-center gap-1.5 font-medium bg-amber-50 rounded px-2.5 py-1 w-fit border border-amber-200">
                                <AlertTriangle className="w-3.5 h-3.5" />
                                <span>ไม่พบใน Hrzoft (คงค่าไว้เพื่อตรวจสอบสิทธิ์)</span>
                              </div>
                            ) : mapping.conflict_notes ? (
                              <div className="text-purple-600 flex items-center gap-1.5 font-medium bg-purple-50 rounded px-2.5 py-1 w-fit border border-purple-200">
                                <AlertTriangle className="w-3.5 h-3.5 animate-pulse" />
                                <span>{mapping.conflict_notes}</span>
                              </div>
                            ) : (
                              <span className="text-stone-400">ซิงค์สำเร็จปกติ</span>
                            )}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="text-center py-10 text-stone-400 text-sm">
                          {searchQuery || statusFilter !== 'all' 
                            ? 'ไม่พบข้อมูลที่สอดคล้องกับตัวกรองค้นหา' 
                            : 'ไม่มีรายชื่อที่ทำแผนที่ข้อมูลการเชื่อมโยง'}
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

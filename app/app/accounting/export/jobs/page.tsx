'use client';

import { useState, useEffect, useCallback } from 'react';
import { get } from '@/lib/api-client';
import { formatDate } from '@/lib/format';
import Link from 'next/link';

interface ExportJob {
  id: string;
  format: 'express' | 'flowaccount' | 'peak';
  range_from: string;
  range_to: string;
  requested_by: string;
  requested_at: string;
  completed_at: string | null;
  status: 'pending' | 'completed' | 'failed';
  output_meta: {
    record_count?: number;
    filename?: string;
    size_bytes?: number;
    error_message?: string;
  } | null;
  requester_name: string;
}

interface JobsResponse {
  jobs: ExportJob[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

const CARD = 'bg-white border border-stone-200 rounded-[12px] shadow-sm overflow-hidden';

export default function AccountingExportJobsPage() {
  const [data, setData] = useState<JobsResponse | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const fetchJobs = useCallback(async (pageNum = 1) => {
    setLoading(true);
    try {
      const res = await get<JobsResponse>(`/api/accounting/export/jobs?page=${pageNum}&limit=20`);
      setData(res);
      setPage(res.page);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchJobs(1);
  }, [fetchJobs]);

  const getFormatBadge = (fmt: string) => {
    const cls =
      fmt === 'express'
        ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
        : fmt === 'flowaccount'
        ? 'bg-blue-50 border-blue-200 text-blue-800'
        : 'bg-indigo-50 border-indigo-200 text-indigo-800';
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded-[5px] text-[10.5px] font-semibold border uppercase tracking-wider ${cls}`}>
        {fmt}
      </span>
    );
  };

  const getStatusBadge = (st: string) => {
    const cls =
      st === 'completed'
        ? 'bg-emerald-100/50 border-emerald-300 text-emerald-800'
        : st === 'failed'
        ? 'bg-red-50 border-red-200 text-red-800'
        : 'bg-amber-50 border-amber-200 text-amber-800';
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${cls}`}>
        {st === 'completed' ? 'Success' : st === 'failed' ? 'Failed' : 'Pending'}
      </span>
    );
  };

  const formatBytes = (bytes?: number) => {
    if (!bytes) return '—';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  };

  return (
    <div className="max-w-[1200px] mx-auto pb-12 space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-stone-200 pb-5">
        <div>
          <span className="text-xs font-semibold text-emerald-600 uppercase tracking-widest">Audit Trails</span>
          <h1 className="text-2xl font-bold text-stone-900 mt-1">ประวัติการส่งออกข้อมูลบัญชี / Export Logs</h1>
          <p className="text-stone-500 text-sm mt-0.5">
            บันทึกการส่งออกไฟล์ข้อมูลแยกประเภทบัญชีทั่วไปเพื่อใช้ในการสอบทานความปลอดภัยและการตรวจสอบระบบ (Audit logs)
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/app/accounting/export"
            className="h-8 px-4 rounded-lg text-xs font-semibold text-stone-600 bg-stone-50 border border-stone-200 hover:bg-stone-100 flex items-center gap-1.5 shadow-[0_1px_0_rgba(15,23,42,.03)]"
          >
            📥 ส่งออกข้อมูล / New Export
          </Link>
          <Link
            href="/app/dashboard"
            className="h-8 px-3 rounded-lg text-xs font-semibold text-stone-600 bg-white border border-stone-200 hover:bg-stone-50 flex items-center gap-1 shadow-[0_1px_0_rgba(15,23,42,.03)]"
          >
            ← กลับแดชบอร์ด
          </Link>
        </div>
      </div>

      {/* History table */}
      <div className={CARD}>
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-stone-200 text-stone-600 bg-stone-50/70 font-semibold">
              <th className="py-3 px-5">หมายเลขงาน / Job ID</th>
              <th className="py-3 px-5">วันเวลาที่ขอ / Requested At</th>
              <th className="py-3 px-5">ระบบบัญชี / Software</th>
              <th className="py-3 px-5">ช่วงข้อมูล / Date Range</th>
              <th className="py-3 px-5">ผู้ดึงข้อมูล / Requested By</th>
              <th className="py-3 px-5">สถานะ / Status</th>
              <th className="py-3 px-5">รายละเอียด / Metadata</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="py-12 text-center text-stone-400 italic">กำลังโหลดประวัติการส่งออก...</td></tr>
            ) : !data?.jobs?.length ? (
              <tr><td colSpan={7} className="py-12 text-center text-stone-400 italic">ไม่พบประวัติการส่งออกในระบบ</td></tr>
            ) : (
              data.jobs.map((job) => (
                <tr key={job.id} className="border-b border-stone-100 hover:bg-stone-50/30 transition-colors">
                  <td className="py-3.5 px-5 font-mono font-semibold text-stone-900" title={job.id}>
                    {job.id.substring(0, 8)}...
                  </td>
                  <td className="py-3.5 px-5 text-stone-500 font-mono">
                    {new Date(job.requested_at).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' })}
                  </td>
                  <td className="py-3.5 px-5">{getFormatBadge(job.format)}</td>
                  <td className="py-3.5 px-5 font-mono text-stone-600">
                    {formatDate(job.range_from)} ถึง {formatDate(job.range_to)}
                  </td>
                  <td className="py-3.5 px-5 font-medium text-stone-850">
                    {job.requester_name}
                  </td>
                  <td className="py-3.5 px-5">{getStatusBadge(job.status)}</td>
                  <td className="py-3.5 px-5 text-stone-500 max-w-[250px] truncate" title={job.output_meta?.filename || job.output_meta?.error_message || ''}>
                    {job.status === 'completed' && job.output_meta ? (
                      <div className="flex flex-col gap-0.5">
                        <span className="font-medium text-stone-800 text-[11px] truncate">
                          📁 {job.output_meta.filename}
                        </span>
                        <span className="text-[10px] text-stone-400">
                          {job.output_meta.record_count?.toLocaleString('th-TH')} แถว · {formatBytes(job.output_meta.size_bytes)}
                        </span>
                      </div>
                    ) : job.status === 'failed' && job.output_meta?.error_message ? (
                      <span className="text-red-500 font-medium">⚠️ {job.output_meta.error_message}</span>
                    ) : (
                      '—'
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Pagination */}
        {data && data.total_pages > 1 && (
          <div className="px-5 py-4 border-t border-stone-100 flex items-center justify-between text-xs text-stone-500 bg-stone-50/20">
            <span>หน้า {page} จาก {data.total_pages}</span>
            <div className="flex gap-1.5">
              <button
                onClick={() => fetchJobs(page - 1)}
                disabled={page === 1}
                className="h-8 px-3 rounded-lg border border-stone-200 bg-white hover:bg-stone-50 disabled:opacity-40 disabled:pointer-events-none"
              >
                ← ก่อนหน้า
              </button>
              <button
                onClick={() => fetchJobs(page + 1)}
                disabled={page === data.total_pages}
                className="h-8 px-3 rounded-lg border border-stone-200 bg-white hover:bg-stone-50 disabled:opacity-40 disabled:pointer-events-none"
              >
                ถัดไป →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

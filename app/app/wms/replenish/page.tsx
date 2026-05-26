'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { get, post, patch } from '@/lib/api-client';
import { formatCurrency } from '@/lib/format';
import { formatDate } from '@/lib/utils';
import { 
  ArrowLeftRight, AlertTriangle, CheckCircle2, XCircle, Clock, 
  Play, Search, Edit2, Check, X, RefreshCw, BarChart3, Package
} from 'lucide-react';
import { Button, StatusBadge, Pagination } from '@/components/ui';

interface Suggestion {
  id: string;
  product_id: string;
  suggested_qty: string | number;
  source_wh: string;
  target_wh: string;
  source_bu: string;
  target_bu: string;
  created_at: string;
  approved_at: string | null;
  approved_by: string | null;
  transfer_id: string | null;
  je_id: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'executed';
  sku: string;
  product_name_th: string;
  product_name_en: string;
  moving_avg_cost: string | number;
  w1_reorder_point: string | number;
  w1_reorder_qty: string | number;
  uom_code: string;
  source_wh_code: string;
  source_wh_name_th: string;
  source_wh_name_en: string;
  target_wh_code: string;
  target_wh_name_th: string;
  target_wh_name_en: string;
  approved_by_name_th: string | null;
  approved_by_name_en: string | null;
  source_qty_available: string | number;
  target_qty_available: string | number;
}

const STAT_CARD = 'bg-white border border-stone-200 rounded-[12px] p-5 shadow-[0_1px_3px_rgba(15,23,42,0.03)] relative overflow-hidden flex items-center justify-between';

export default function ReplenishDashboardPage() {
  const { data: session } = useSession();
  const role = (session?.user as { role?: string } | undefined)?.role;

  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Filtering & Pagination
  const [statusFilter, setStatusFilter] = useState<string>('pending');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const PAGE_SIZE = 15;

  // Sync / Admin Trigger State
  const [runningJob, setRunningJob] = useState(false);
  const [jobSuccessMessage, setJobSuccessMessage] = useState('');

  // Editing Suggestion Quantity State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editQty, setEditQty] = useState<string>('');

  // Approval Modal State
  const [approvingSuggestion, setApprovingSuggestion] = useState<Suggestion | null>(null);
  const [approveQty, setApproveQty] = useState<string>('');
  const [processingApproval, setProcessingApproval] = useState(false);

  // Load Suggestions
  const loadSuggestions = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const url = `/api/replenish/suggestions?page=${page}&pageSize=${PAGE_SIZE}${
        statusFilter && statusFilter !== 'all' ? `&status=${statusFilter}` : ''
      }`;
      const res = await get<{ data: Suggestion[]; total: number }>(url);
      setSuggestions(res.data);
      setTotal(res.total);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'ไม่สามารถดึงข้อมูลรายการได้ / Failed to load suggestions');
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter]);

  useEffect(() => {
    loadSuggestions();
  }, [loadSuggestions]);

  // Run Nightly Job Synchronously (Admins only)
  const handleRunJob = async () => {
    setRunningJob(true);
    setError('');
    setJobSuccessMessage('');
    try {
      const res = await post<{ message: string; createdCount: number }>('/api/admin/replenish/run-now', {});
      setJobSuccessMessage(`ระบบดำเนินการสำเร็จ! สร้างรายการสั่งเติมใหม่ ${res.createdCount} รายการ / Job completed! Created ${res.createdCount} new suggestions.`);
      setPage(1);
      loadSuggestions();
      setTimeout(() => setJobSuccessMessage(''), 5000);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'การรันงานระบบล้มเหลว / Job run failed');
    } finally {
      setRunningJob(false);
    }
  };

  // Reject Suggestion
  const handleReject = async (id: string) => {
    if (!confirm('คุณต้องการปฏิเสธรายการแนะนำการเติมนี้ใช่หรือไม่? (รายการนี้จะไม่ได้รับการแนะนำอีกเป็นเวลา 7 วัน)\n\nAre you sure you want to reject this suggestion? (It will not be suggested again for 7 days)')) {
      return;
    }
    try {
      await patch(`/api/replenish/suggestions/${id}`, { action: 'reject' });
      loadSuggestions();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'การปฏิเสธรายการล้มเหลว / Rejection failed');
    }
  };

  // Inline Edit Quantity
  const startEdit = (s: Suggestion) => {
    setEditingId(s.id);
    setEditQty(s.suggested_qty.toString());
  };

  const handleSaveEdit = async (id: string) => {
    const qty = parseFloat(editQty);
    if (isNaN(qty) || qty <= 0) {
      alert('กรุณากรอกจำนวนที่ถูกต้องมากกว่า 0 / Please enter a valid quantity greater than 0');
      return;
    }
    try {
      await patch(`/api/replenish/suggestions/${id}`, { action: 'edit', suggested_qty: qty });
      setEditingId(null);
      loadSuggestions();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'การแก้ไขจำนวนล้มเหลว / Edit failed');
    }
  };

  // Approval Modal Actions
  const openApprovalModal = (s: Suggestion) => {
    setApprovingSuggestion(s);
    setApproveQty(s.suggested_qty.toString());
  };

  const closeApprovalModal = () => {
    setApprovingSuggestion(null);
    setApproveQty('');
    setProcessingApproval(false);
  };

  const handleApproveConfirm = async () => {
    if (!approvingSuggestion) return;
    const qty = parseFloat(approveQty);
    if (isNaN(qty) || qty <= 0) {
      alert('กรุณากรอกจำนวนที่ถูกต้องมากกว่า 0 / Please enter a valid quantity greater than 0');
      return;
    }

    setProcessingApproval(true);
    try {
      const res = await patch<{ status: string; transfer_number: string; je_posted: boolean }>(
        `/api/replenish/suggestions/${approvingSuggestion.id}`, 
        { action: 'approve', suggested_qty: qty }
      );
      
      let msg = `อนุมัติสำเร็จ! สร้างเอกสารโอนย้าย ${res.transfer_number} เรียบร้อยแล้ว`;
      if (res.je_posted) {
        msg += '\nและได้บันทึกบัญชีเจ้าหนี้/ลูกหนี้ระหว่างบริษัทเรียบร้อยเเล้ว / Inter-company JEs posted.';
      } else {
        msg += '\n(ข้ามการบันทึกบัญชีเนื่องจากไม่มีราคาทุนเฉลี่ย / Accounting skipped due to 0 MAC)';
      }
      
      alert(msg);
      closeApprovalModal();
      loadSuggestions();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'การอนุมัติรายการสั่งเติมล้มเหลว / Approval failed');
    } finally {
      setProcessingApproval(false);
    }
  };

  // Client Side Search Filter
  const filteredSuggestions = suggestions.filter(s => {
    const term = searchQuery.toLowerCase();
    return s.sku.toLowerCase().includes(term) ||
      s.product_name_th.toLowerCase().includes(term) ||
      (s.product_name_en && s.product_name_en.toLowerCase().includes(term));
  });

  // Role Protection
  const isAuthorized = ['admin', 'manager'].includes(role ?? '');

  if (!isAuthorized && role) {
    return (
      <div className="max-w-md mx-auto my-16 bg-white border border-stone-200 rounded-[12px] p-8 text-center space-y-4 shadow-sm">
        <div className="text-4xl text-red-500">🚫</div>
        <h1 className="text-xl font-bold text-stone-900">ไม่มีสิทธิ์การเข้าถึง / Access Denied</h1>
        <p className="text-stone-500 text-sm">
          เฉพาะผู้จัดการคลังสินค้า (Manager) หรือผู้ดูแลระบบ (Admin) เท่านั้นที่สามารถตรวจสอบและอนุมัติการสั่งเติมสินค้าอัตโนมัติได้
        </p>
        <Link href="/app/dashboard" className="inline-flex h-9 px-4 rounded-lg bg-stone-900 text-white text-xs font-semibold items-center justify-center hover:bg-stone-850">
          กลับหน้าหลัก
        </Link>
      </div>
    );
  }

  // Calculate quick facts (approx stats for current view/filters)
  const totalPendingVal = suggestions
    .filter(s => s.status === 'pending')
    .reduce((sum, s) => sum + (Number(s.suggested_qty) * Number(s.moving_avg_cost || 0)), 0);

  return (
    <div className="max-w-[1400px] mx-auto pb-12 space-y-8 animate-fade-in px-4">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-stone-200 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-emerald-600 uppercase tracking-widest bg-emerald-50 px-2.5 py-0.5 rounded-full">V2.1 Orion</span>
            <span className="text-xs font-semibold text-stone-500 bg-stone-100 px-2 py-0.5 rounded-full">W2 ➔ W1 Replenish</span>
          </div>
          <h1 className="text-2xl font-bold text-stone-950 mt-1.5 flex items-center gap-2">
            การเติมสินค้าหน้าร้านอัตโนมัติ
            <span className="text-[15px] font-normal text-stone-400">/ Auto-Replenishment Queue</span>
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <Button
            onClick={loadSuggestions}
            variant="outline"
            className="flex items-center gap-1.5 h-9 rounded-[8px] text-[13px]"
            disabled={loading}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            รีเฟรชข้อมูล
          </Button>

          {role === 'admin' && (
            <Button
              onClick={handleRunJob}
              className="flex items-center gap-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white hover:from-emerald-700 hover:to-teal-700 h-9 rounded-[8px] text-[13px] border-0 shadow-md font-semibold"
              disabled={runningJob}
            >
              {runningJob ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  กำลังประมวลผล...
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-current" />
                  รันงานเติมสินค้า / Run Job Now
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Success/Error Alerts */}
      {jobSuccessMessage && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl p-4 text-[13.5px] flex items-start gap-2.5 shadow-sm">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
          <div>{jobSuccessMessage}</div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 rounded-xl p-4 text-[13.5px] flex items-start gap-2.5 shadow-sm">
          <XCircle className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />
          <div>{error}</div>
        </div>
      )}

      {/* Quick Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className={STAT_CARD}>
          <div>
            <p className="text-[12.5px] font-medium text-stone-500 uppercase tracking-wider">รายการรอดำเนินการ / Suggestions Queue</p>
            <h3 className="text-3xl font-bold text-stone-900 mt-1.5 font-mono">{suggestions.filter(s => s.status === 'pending').length} รายการ</h3>
            <p className="text-[11.5px] text-stone-400 mt-1">รอนุมัติจัดเตรียมสินค้า W2 ➔ W1</p>
          </div>
          <div className="bg-emerald-50 text-emerald-600 p-3 rounded-full">
            <Clock className="w-6 h-6" />
          </div>
        </div>

        <div className={STAT_CARD}>
          <div>
            <p className="text-[12.5px] font-medium text-stone-500 uppercase tracking-wider">มูลค่าสินค้าสั่งสั่งเติม / Est. Transfer Value</p>
            <h3 className="text-3xl font-bold text-stone-900 mt-1.5 font-mono">{formatCurrency(totalPendingVal, 'th')}</h3>
            <p className="text-[11.5px] text-stone-400 mt-1">คำนวณจากราคาทุนเฉลี่ย (MAC)</p>
          </div>
          <div className="bg-emerald-50 text-emerald-600 p-3 rounded-full">
            <BarChart3 className="w-6 h-6" />
          </div>
        </div>

        <div className={STAT_CARD}>
          <div>
            <p className="text-[12.5px] font-medium text-stone-500 uppercase tracking-wider">บัญชีเคลียร์ข้อมูล / intercompany clearing</p>
            <div className="flex flex-col gap-0.5 mt-1.5">
              <span className="text-[12px] font-mono font-medium text-stone-700 bg-stone-50 px-2 py-0.5 rounded border border-stone-200 inline-block w-fit">1190-TRD (Receivable)</span>
              <span className="text-[12px] font-mono font-medium text-stone-700 bg-stone-50 px-2 py-0.5 rounded border border-stone-200 inline-block w-fit">2190-AKRA (Payable)</span>
            </div>
            <p className="text-[11.5px] text-stone-400 mt-1">พร้อมบันทึกบัญชีอัตโนมัติ</p>
          </div>
          <div className="bg-emerald-50 text-emerald-600 p-3 rounded-full">
            <ArrowLeftRight className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="bg-white border border-stone-200 rounded-[12px] shadow-sm overflow-hidden">
        {/* Controls Bar */}
        <div className="p-5 border-b border-stone-200 bg-stone-50/50 flex flex-col sm:flex-row items-center justify-between gap-4">
          {/* Status Tabs */}
          <div className="flex gap-1.5 bg-stone-200/60 p-0.5 rounded-lg shrink-0 w-full sm:w-auto">
            {['pending', 'approved', 'rejected', 'all'].map(status => (
              <button
                key={status}
                onClick={() => { setStatusFilter(status); setPage(1); }}
                className={`flex-1 sm:flex-none px-3.5 py-1.5 text-[12.5px] font-medium rounded-md transition-all ${
                  statusFilter === status 
                    ? 'bg-white text-stone-900 shadow-sm border border-stone-200' 
                    : 'text-stone-600 hover:text-stone-900 hover:bg-white/40'
                }`}
              >
                {status === 'pending' && 'รอดำเนินการ / Pending'}
                {status === 'approved' && 'อนุมัติแล้ว / Approved'}
                {status === 'rejected' && 'ปฏิเสธแล้ว / Rejected'}
                {status === 'all' && 'ทั้งหมด / All'}
              </button>
            ))}
          </div>

          {/* Search Box */}
          <div className="relative w-full sm:max-w-xs">
            <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="ค้นหา SKU หรือชื่อสินค้า..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full h-9 pl-9 pr-4 rounded-[8px] border border-stone-200 text-[13px] placeholder:text-stone-400 focus:outline-none focus:border-emerald-600"
            />
          </div>
        </div>

        {/* Suggestion List Table */}
        <div className="overflow-x-auto">
          {loading ? (
            <div className="py-20 text-center space-y-3">
              <RefreshCw className="w-8 h-8 text-emerald-600 animate-spin mx-auto" />
              <p className="text-stone-500 text-[13px]">กำลังดึงข้อมูลรายการ... / Loading suggestion queue...</p>
            </div>
          ) : filteredSuggestions.length === 0 ? (
            <div className="py-20 text-center space-y-3">
              <Package className="w-12 h-12 text-stone-300 mx-auto" />
              <p className="text-stone-500 text-[14px] font-medium">ไม่พบรายการสินค้าสั่งเติม / No suggestions found</p>
              <p className="text-stone-400 text-xs">สต็อกหน้าร้าน W1 ของสินค้าทุกตัวยังคงสูงกว่าระดับสั่งเติม</p>
            </div>
          ) : (
            <table className="w-full text-left text-[13.5px] border-collapse">
              <thead>
                <tr className="bg-stone-50 text-[12px] font-bold text-stone-500 uppercase tracking-wider border-b border-stone-200">
                  <th className="px-5 py-3.5">ข้อมูลสินค้า / Product info</th>
                  <th className="px-5 py-3.5 text-center">ระดับสต็อกหน้าร้าน W1</th>
                  <th className="px-5 py-3.5 text-right">จำนวนสั่งเติม</th>
                  <th className="px-5 py-3.5 text-right">มูลค่า (Est. Value)</th>
                  <th className="px-5 py-3.5 text-center">คลังจ่าย W2 Stock</th>
                  <th className="px-5 py-3.5 text-center">สถานะ / Status</th>
                  <th className="px-5 py-3.5 text-right pr-6">จัดการ / Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-150">
                {filteredSuggestions.map(s => {
                  const macVal = Number(s.moving_avg_cost || 0);
                  const qty = Number(editingId === s.id ? editQty : s.suggested_qty);
                  const value = qty * macVal;
                  
                  const isLow = Number(s.target_qty_available || 0) <= Number(s.w1_reorder_point || 0);
                  
                  return (
                    <tr key={s.id} className="hover:bg-stone-50/50 transition-colors">
                      {/* Product Info */}
                      <td className="px-5 py-4">
                        <div className="flex flex-col">
                          <span className="font-mono font-bold text-stone-900">{s.sku}</span>
                          <span className="text-[13px] text-stone-600 mt-0.5 line-clamp-1">{s.product_name_th}</span>
                          <span className="text-[11.5px] text-stone-400 font-mono mt-0.5 line-clamp-1">{s.product_name_en || '—'}</span>
                        </div>
                      </td>

                      {/* W1 Stock & Point */}
                      <td className="px-5 py-4 text-center">
                        <div className="inline-flex flex-col items-center">
                          <span className={`font-mono font-bold px-2 py-0.5 rounded ${
                            isLow ? 'text-red-700 bg-red-50 border border-red-150' : 'text-stone-700 bg-stone-100'
                          }`}>
                            {Number(s.target_qty_available)} {s.uom_code}
                          </span>
                          <span className="text-[11px] text-stone-400 mt-1">
                            (สั่งเติมที่ ≤ {s.w1_reorder_point})
                          </span>
                        </div>
                      </td>

                      {/* Suggested Qty */}
                      <td className="px-5 py-4 text-right">
                        {editingId === s.id ? (
                          <div className="flex items-center justify-end gap-1.5">
                            <input
                              type="number"
                              value={editQty}
                              onChange={e => setEditQty(e.target.value)}
                              className="w-16 h-8 text-right px-1.5 border border-stone-300 rounded focus:outline-none focus:border-emerald-600"
                            />
                            <button onClick={() => handleSaveEdit(s.id)} className="p-1 text-emerald-600 bg-emerald-50 rounded hover:bg-emerald-100">
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => setEditingId(null)} className="p-1 text-red-600 bg-red-50 rounded hover:bg-red-100">
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-end gap-1 group">
                            <span className="font-mono font-bold text-stone-900">{s.suggested_qty} {s.uom_code}</span>
                            {s.status === 'pending' && (
                              <button onClick={() => startEdit(s)} className="opacity-0 group-hover:opacity-100 p-0.5 text-stone-400 hover:text-stone-600 transition-opacity">
                                <Edit2 className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Est value */}
                      <td className="px-5 py-4 text-right">
                        <div className="flex flex-col items-end">
                          <span className="font-mono font-semibold text-stone-800">
                            {formatCurrency(value, 'th')}
                          </span>
                          {macVal > 0 ? (
                            <span className="text-[11px] text-stone-400 mt-0.5">
                              (MAC: {formatCurrency(macVal, 'th')})
                            </span>
                          ) : (
                            <span className="text-[10px] text-amber-600 bg-amber-50 px-1 py-0.5 rounded mt-0.5">
                              ไม่มีทุน (ข้ามบันทึกบัญชี)
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Source WH stock */}
                      <td className="px-5 py-4 text-center">
                        <div className="inline-flex flex-col items-center">
                          <span className="font-mono text-stone-700 bg-stone-100 px-2 py-0.5 rounded">
                            {s.source_qty_available} {s.uom_code}
                          </span>
                          <span className="text-[11px] text-stone-400 mt-1">
                            {s.source_wh_code} (Wholesale)
                          </span>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-5 py-4 text-center">
                        <div className="flex justify-center">
                          {s.status === 'pending' && <StatusBadge status="pending" />}
                          {s.status === 'approved' && <StatusBadge status="approved" labelOverride="อนุมัติจัดส่งแล้ว" />}
                          {s.status === 'rejected' && <StatusBadge status="rejected" labelOverride="ปฏิเสธการเติม" />}
                          {s.status === 'executed' && <StatusBadge status="completed" labelOverride="โอนย้ายสำเร็จ" />}
                        </div>
                        {s.status === 'approved' && s.approved_by_name_th && (
                          <span className="text-[10px] text-stone-400 block mt-1">
                            โดย {s.approved_by_name_th}เมื่อ {formatDate(s.approved_at || '')}
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-4 text-right pr-6">
                        {s.status === 'pending' ? (
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleReject(s.id)}
                              className="h-8 px-2.5 rounded-[6px] text-[12.5px] font-medium border border-red-200 text-red-700 bg-white hover:bg-red-50 transition-colors flex items-center gap-1"
                              title="ปฏิเสธข้อแนะนำนี้ / Reject suggestion"
                            >
                              <XCircle className="w-3.5 h-3.5" />
                              ปฏิเสธ
                            </button>

                            <button
                              onClick={() => openApprovalModal(s)}
                              className="h-8 px-3 rounded-[6px] text-[12.5px] font-semibold bg-emerald-600 text-white hover:bg-emerald-700 transition-colors flex items-center gap-1 shadow-sm"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              อนุมัติเติม
                            </button>
                          </div>
                        ) : (
                          <div className="text-[12px] text-stone-400 italic">
                            {s.status === 'approved' && (
                              <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded font-mono">
                                TRF Created
                              </span>
                            )}
                            {s.status === 'rejected' && 'Cooldown (7d)'}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {total > PAGE_SIZE && (
          <div className="p-5 border-t border-stone-200 flex items-center justify-between">
            <span className="text-xs text-stone-500">แสดงผล {filteredSuggestions.length} จากทั้งหมด {total} รายการ</span>
            <Pagination
              currentPage={page}
              totalPages={Math.ceil(total / PAGE_SIZE)}
              onPageChange={setPage}
            />
          </div>
        )}
      </div>

      {/* Approval Details Modal */}
      {approvingSuggestion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white border border-stone-200 w-full max-w-lg rounded-2xl shadow-xl overflow-hidden flex flex-col transform transition-all scale-100">
            <div className="px-6 py-4 border-b border-stone-150 flex items-center justify-between bg-stone-50">
              <h2 className="text-lg font-bold text-stone-900 flex items-center gap-2">
                <ArrowLeftRight className="w-5 h-5 text-emerald-600" />
                อนุมัติการสั่งเติมสินค้าหน้าร้าน (Inter-BU)
              </h2>
              <button onClick={closeApprovalModal} className="p-1 rounded-lg text-stone-400 hover:text-stone-600 hover:bg-stone-100 transition-all">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 flex-1 overflow-y-auto">
              <div className="bg-emerald-50/50 border border-emerald-100 rounded-xl p-4 flex flex-col gap-1.5">
                <span className="text-xs text-emerald-700 font-semibold tracking-wider uppercase">ข้อมูลธุรกรรมสั่งเติมสินค้า</span>
                <span className="text-[16px] font-bold text-stone-900 font-mono">{approvingSuggestion.sku}</span>
                <span className="text-[14px] text-stone-700 font-medium">{approvingSuggestion.product_name_th}</span>
                <span className="text-[12.5px] text-stone-400 font-mono">{approvingSuggestion.product_name_en || '—'}</span>
              </div>

              {/* Stats Summary Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-stone-50 rounded-xl p-3 border border-stone-150">
                  <span className="text-[11.5px] text-stone-500 font-medium uppercase tracking-wider block">สต็อกจ่าย W2 (AKRA)</span>
                  <span className="text-lg font-bold font-mono text-stone-900 mt-1 block">
                    {approvingSuggestion.source_qty_available} {approvingSuggestion.uom_code}
                  </span>
                </div>
                <div className="bg-stone-50 rounded-xl p-3 border border-stone-150">
                  <span className="text-[11.5px] text-stone-500 font-medium uppercase tracking-wider block">สต็อกหน้าร้าน W1 (TRD)</span>
                  <span className="text-lg font-bold font-mono text-red-600 mt-1 block">
                    {approvingSuggestion.target_qty_available} {approvingSuggestion.uom_code}
                  </span>
                </div>
              </div>

              {/* Editable Approval Qty */}
              <div className="space-y-1.5">
                <label className="text-[13px] font-semibold text-stone-700">จำนวนอนุมัติโอนย้าย / Approved Qty *</label>
                <div className="flex items-center gap-2.5">
                  <input
                    type="number"
                    value={approveQty}
                    onChange={e => setApproveQty(e.target.value)}
                    className="flex-1 h-10 px-3.5 border border-stone-300 rounded-xl focus:outline-none focus:border-emerald-600 font-mono font-bold text-stone-900"
                    placeholder="ป้อนจำนวนเติมสินค้า..."
                  />
                  <span className="font-semibold text-stone-500 bg-stone-100 px-3 py-2 rounded-xl text-sm border border-stone-200">
                    {approvingSuggestion.uom_code}
                  </span>
                </div>
                <span className="text-[11.5px] text-stone-400">ค่าเริ่มต้นระบบอิงจาก reorder qty ของสินค้า</span>
              </div>

              {/* Financial value impact */}
              <div className="border-t border-stone-200 pt-4 flex flex-col gap-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-stone-500">ราคาทุนเฉลี่ยปัจจุบัน / MAC</span>
                  <span className="font-mono font-semibold text-stone-800">
                    {formatCurrency(Number(approvingSuggestion.moving_avg_cost), 'th')}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[14.5px] border-b pb-2">
                  <span className="text-stone-800 font-semibold">มูลค่าธุรกรรมประเมิน / Total Value</span>
                  <span className="font-mono font-bold text-emerald-700 text-[16px]">
                    {formatCurrency(parseFloat(approveQty || '0') * Number(approvingSuggestion.moving_avg_cost || 0), 'th')}
                  </span>
                </div>

                <div className="bg-amber-50 border border-amber-200 text-amber-800 text-[12.5px] rounded-xl p-3.5 space-y-1.5 shadow-sm">
                  <div className="flex items-center gap-1.5 font-bold">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>การบันทึกบัญชีธุรกรรมข้ามหน่วยงาน (Inter-company JE)</span>
                  </div>
                  {Number(approvingSuggestion.moving_avg_cost) > 0 ? (
                    <p className="text-[11.5px] leading-relaxed text-amber-700">
                      เมื่ออนุมัติ ระบบจะลงบัญชีคู่ค้าอัตโนมัติ โดยลดบัญชีสินค้า W2 (AKRA) และ เพิ่มบัญชีสินค้า W1 (TRD) ผ่านบัญชีลูกหนี้/เจ้าหนี้ระหว่างบริษัท (1190-TRD / 2190-AKRA)
                    </p>
                  ) : (
                    <p className="text-[11.5px] leading-relaxed text-red-700 font-medium">
                      ⚠️ สินค้ายังไม่มีราคาทุนเฉลี่ย (MAC = 0) ระบบจะข้ามการลงบัญชีสมุดบันทึกรายการรายวัน แต่จะยังสร้างเอกสารโอนย้ายเพื่อย้ายสินค้าตามปกติ
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="px-6 py-4.5 border-t border-stone-150 bg-stone-50 flex items-center justify-end gap-3 shrink-0">
              <button
                onClick={closeApprovalModal}
                className="h-10 px-4 rounded-xl text-[13px] font-medium text-stone-700 bg-white border border-stone-200 hover:bg-stone-100 transition-colors"
                disabled={processingApproval}
              >
                ยกเลิก
              </button>
              <button
                onClick={handleApproveConfirm}
                className="h-10 px-5 rounded-xl text-[13px] font-semibold bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5 transition-colors shadow-sm disabled:opacity-50"
                disabled={processingApproval}
              >
                {processingApproval ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    กำลังอนุมัติโอนย้าย...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    ยืนยันอนุมัติและลงบัญชี
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { get, post } from '@/lib/api-client';
import { formatCurrency } from '@/lib/format';
import { 
  BarChart3, RefreshCw, AlertTriangle,
  Search, ShieldAlert, BadgeInfo, Activity
} from 'lucide-react';
import { Button, Table, Thead, Tbody, Th, Td, Badge, PageLoader, Card, CardHeader } from '@/components/ui';

interface Candidate {
  product_id: string;
  sku: string;
  name_th: string;
  name_en: string;
  qty_on_hand: string | number;
  qty_sold_30d: string | number;
  qty_sold_365d: string | number;
  revenue_30d: string | number;
  gross_margin_30d: string | number;
  gross_margin_pct: string | number;
  sell_through_30d: string | number;
  days_on_hand: string | number;
  velocity_bucket: 'FAST' | 'MEDIUM' | 'SLOW' | 'STAGNANT';
  score: string | number;
  reasons: string[];
}

interface PerformanceSku {
  product_id: string;
  sku: string;
  name_th: string;
  name_en: string;
  qty_on_hand: string | number;
  qty_sold_30d: string | number;
  qty_sold_365d: string | number;
  revenue_30d: string | number;
  cogs_30d: string | number;
  gross_margin_30d: string | number;
  gross_margin_pct: string | number;
  sell_through_30d: string | number;
  days_on_hand: string | number;
  velocity_bucket: 'FAST' | 'MEDIUM' | 'SLOW' | 'STAGNANT';
  moving_avg_cost: string | number;
  last_updated: string;
}

export default function SkuCutAnalyticsPage() {

  const [activeTab, setActiveTab] = useState<'candidates' | 'performance'>('candidates');
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [performance, setPerformance] = useState<PerformanceSku[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  // Search and Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [bucketFilter, setBucketFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPerformance, setTotalPerformance] = useState(0);
  const LIMIT = 25;

  const loadCandidates = useCallback(async () => {
    try {
      const url = `/api/analytics/sku-cut-candidates${searchQuery ? `?search=${encodeURIComponent(searchQuery)}` : ''}`;
      const data = await get<Candidate[]>(url);
      setCandidates(data);
    } catch (e: unknown) {
      console.error(e);
      setError('ไม่สามารถดึงข้อมูลรายการแนะนำการตัดได้ / Failed to load candidates');
    }
  }, [searchQuery]);

  const loadPerformance = useCallback(async () => {
    try {
      const offset = (page - 1) * LIMIT;
      const url = `/api/analytics/sku-performance?limit=${LIMIT}&offset=${offset}${
        searchQuery ? `&search=${encodeURIComponent(searchQuery)}` : ''
      }${bucketFilter ? `&bucket=${bucketFilter}` : ''}`;
      
      const res = await get<{ rows: PerformanceSku[]; total: number }>(url);
      setPerformance(res.rows);
      setTotalPerformance(res.total);
    } catch (e: unknown) {
      console.error(e);
      setError('ไม่สามารถดึงข้อมูลภาพรวมประสิทธิภาพได้ / Failed to load SKU performance');
    }
  }, [page, searchQuery, bucketFilter]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    if (activeTab === 'candidates') {
      await loadCandidates();
    } else {
      await loadPerformance();
    }
    setLoading(false);
  }, [activeTab, loadCandidates, loadPerformance]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRefresh = async () => {
    setRefreshing(true);
    setError('');
    try {
      await post('/api/analytics/sku-performance/refresh', {});
      await loadData();
    } catch (e: unknown) {
      console.error(e);
      setError('การรีเฟรชข้อมูลล้มเหลว / Refresh failed');
    } finally {
      setRefreshing(false);
    }
  };

  const getReasonLabel = (code: string) => {
    switch (code) {
      case 'LOW_SELL_THROUGH':
        return { label: 'อัตราขายออกต่ำ / Low Sell-Through', color: 'bg-rose-50 border-rose-200 text-rose-700' };
      case 'STAGNANT_STOCK':
        return { label: 'ไม่มีการเคลื่อนไหว / Stagnant Stock', color: 'bg-amber-50 border-amber-200 text-amber-700' };
      case 'WEAK_MARGIN':
        return { label: 'กำไรขั้นต้นต่ำ / Weak Margin', color: 'bg-orange-50 border-orange-200 text-orange-700' };
      case 'HIGH_DAYS_ON_HAND':
        return { label: 'สต็อกค้างนานเกินไป / High Days-on-Hand', color: 'bg-amber-100 border-amber-300 text-amber-800' };
      default:
        return { label: code, color: 'bg-stone-50 border-stone-200 text-stone-700' };
    }
  };

  const getScoreColor = (score: number) => {
    if (score < 25) return 'text-rose-600 bg-rose-50 border-rose-200';
    if (score < 50) return 'text-orange-600 bg-orange-50 border-orange-200';
    if (score < 75) return 'text-amber-600 bg-amber-50 border-amber-200';
    return 'text-emerald-600 bg-emerald-50 border-emerald-200';
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-stone-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-stone-900 flex items-center gap-2.5">
            <BarChart3 className="w-7 h-7 text-emerald-600" />
            วิเคราะห์การตัด SKU และคาดการณ์ความต้องการ / AI SKU-Cut & Forecast
          </h1>
          <p className="text-[14px] text-stone-500 mt-1.5">
            ระบบจัดหาข้อเสนอแนะในการตัดลดสินค้า (SKU) ที่ขายช้า ทำกำไรน้อย หรือค้างสต็อกนาน ด้วยสถิติ AI 12 เดือนย้อนหลัง
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button 
            onClick={handleRefresh} 
            disabled={refreshing || loading}
            variant="outline"
            className="flex items-center gap-2 rounded-lg border-stone-300 hover:bg-stone-50 h-[38px] px-3.5"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'กำลังคำนวณข้อมูล... / Refreshing...' : 'ประมวลผลสต็อก / Refresh Snapshot'}
          </Button>
        </div>
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 rounded-lg p-4 text-[14.5px] text-rose-700 flex items-start gap-2.5">
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
          <div>{error}</div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-stone-200 gap-6">
        <button
          onClick={() => { setActiveTab('candidates'); setPage(1); }}
          className={`pb-3 text-[15px] font-semibold transition-all relative ${
            activeTab === 'candidates' 
              ? 'text-emerald-700 border-b-2 border-emerald-600' 
              : 'text-stone-500 hover:text-stone-800'
          }`}
        >
          รายการแนะนำลด SKU / SKU Cut Candidates ({candidates.length})
        </button>
        <button
          onClick={() => { setActiveTab('performance'); setPage(1); }}
          className={`pb-3 text-[15px] font-semibold transition-all relative ${
            activeTab === 'performance' 
              ? 'text-emerald-700 border-b-2 border-emerald-600' 
              : 'text-stone-500 hover:text-stone-800'
          }`}
        >
          สถิติประสิทธิภาพทุก SKU / All SKU Performance
        </button>
      </div>

      {/* Search and filter toolbar */}
      <div className="bg-stone-50 border border-stone-200 rounded-xl p-4 flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-2.5 w-4.5 h-4.5 text-stone-400" />
          <input
            type="text"
            placeholder="ค้นหา SKU หรือชื่อสินค้า... / Search SKU or product..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 pr-4 py-2 border border-stone-300 rounded-lg text-[13.5px] w-full focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
          />
        </div>

        {activeTab === 'performance' && (
          <div className="flex gap-2 w-full md:w-auto shrink-0 justify-end">
            <select
              value={bucketFilter}
              onChange={(e) => { setBucketFilter(e.target.value); setPage(1); }}
              className="border border-stone-300 rounded-lg px-3 py-2 text-[13.5px] bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 min-w-[150px]"
            >
              <option value="">ความเร็วสินค้า (ทั้งหมด) / All Speeds</option>
              <option value="FAST">FAST (ขายดี &gt;= 100)</option>
              <option value="MEDIUM">MEDIUM (ปานกลาง &gt;= 10)</option>
              <option value="SLOW">SLOW (ขายช้า &gt; 0)</option>
              <option value="STAGNANT">STAGNANT (ค้างสต็อก 0)</option>
            </select>
          </div>
        )}
      </div>

      {/* Table Section */}
      {loading ? (
        <PageLoader />
      ) : activeTab === 'candidates' ? (
        <Card className="border-stone-200 rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.02)] overflow-hidden">
          <CardHeader className="bg-stone-50/50 border-b border-stone-200 p-4">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-rose-500" />
              <h2 className="font-semibold text-stone-800 text-[15.5px]">
                กลุ่ม SKU ที่แนะนำให้พิจารณาตัดออกจากระบบ (Bottom Decile Candidate SKUs)
              </h2>
            </div>
          </CardHeader>
          <div className="overflow-x-auto">
            <Table>
              <Thead>
                <tr>
                  <Th className="text-[13px] font-semibold text-stone-700 bg-stone-50/40">SKU</Th>
                  <Th className="text-[13px] font-semibold text-stone-700 bg-stone-50/40">ชื่อสินค้า / Product Description</Th>
                  <Th className="text-[13px] font-semibold text-stone-700 bg-stone-50/40 text-right">สต็อกหน้าร้าน / Stock</Th>
                  <Th className="text-[13px] font-semibold text-stone-700 bg-stone-50/40 text-right">ยอดขาย (30 วัน)</Th>
                  <Th className="text-[13px] font-semibold text-stone-700 bg-stone-50/40 text-right">มาร์จิ้น % / Margin %</Th>
                  <Th className="text-[13px] font-semibold text-stone-700 bg-stone-50/40 text-right">อัตราขายออก %</Th>
                  <Th className="text-[13px] font-semibold text-stone-700 bg-stone-50/40 text-center">ความช้า / Velocity</Th>
                  <Th className="text-[13px] font-semibold text-stone-700 bg-stone-50/40 text-center">คะแนนดี / Score</Th>
                  <Th className="text-[13px] font-semibold text-stone-700 bg-stone-50/40">เหตุผลแนะนำให้ตัด / Reasons</Th>
                  <Th className="text-[13px] font-semibold text-stone-700 bg-stone-50/40 text-center">การวิเคราะห์ / Forecast</Th>
                </tr>
              </Thead>
              <Tbody>
                {candidates.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="p-8 text-center text-stone-400 text-[13.5px]">
                      ไม่มีข้อมูลรายการแนะนำการตัด / No SKU cut candidates found.
                    </td>
                  </tr>
                ) : (
                  candidates.map((c) => (
                    <tr key={c.product_id} className="hover:bg-stone-50/65 transition-colors group">
                      <Td className="font-semibold text-stone-800 text-[13.5px] whitespace-nowrap">
                        {c.sku}
                      </Td>
                      <Td className="max-w-[280px]">
                        <div className="text-[13.5px] font-medium text-stone-800 line-clamp-1">{c.name_th}</div>
                        <div className="text-[11.5px] text-stone-400 line-clamp-1 mt-0.5">{c.name_en}</div>
                      </Td>
                      <Td className="text-right text-[13px] tabular-nums font-medium text-stone-700">
                        {Number(c.qty_on_hand).toLocaleString(undefined, { minimumFractionDigits: 1 })}
                      </Td>
                      <Td className="text-right text-[13px] tabular-nums font-semibold text-stone-900">
                        {Number(c.qty_sold_30d).toLocaleString()}
                      </Td>
                      <Td className={`text-right text-[13px] tabular-nums font-semibold ${Number(c.gross_margin_pct) < 15 ? 'text-rose-600' : 'text-stone-700'}`}>
                        {Number(c.gross_margin_pct).toFixed(1)}%
                      </Td>
                      <Td className="text-right text-[13px] tabular-nums font-medium text-stone-700">
                        {Number(c.sell_through_30d).toFixed(1)}%
                      </Td>
                      <Td className="text-center">
                        <Badge className={
                          c.velocity_bucket === 'FAST' ? 'bg-emerald-100 text-emerald-800' :
                          c.velocity_bucket === 'MEDIUM' ? 'bg-blue-100 text-blue-800' :
                          c.velocity_bucket === 'SLOW' ? 'bg-amber-100 text-amber-800' :
                          'bg-stone-200 text-stone-700 border-stone-300'
                        }>
                          {c.velocity_bucket}
                        </Badge>
                      </Td>
                      <Td className="text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[12px] font-bold border ${getScoreColor(Number(c.score))}`}>
                          {Number(c.score).toFixed(0)}
                        </span>
                      </Td>
                      <Td>
                        <div className="flex flex-wrap gap-1">
                          {c.reasons.map((r, idx) => {
                            const details = getReasonLabel(r);
                            return (
                              <span key={idx} className={`px-2 py-0.5 border rounded-md text-[11px] font-medium leading-none ${details.color}`}>
                                {details.label}
                              </span>
                            );
                          })}
                        </div>
                      </Td>
                      <Td className="text-center">
                        <Link 
                          href={`/app/analytics/forecast/${c.product_id}`}
                          className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 rounded-md text-[12px] font-semibold transition-all group-hover:scale-102"
                        >
                          <Activity className="w-3.5 h-3.5" />
                          คาดการณ์ความต้องการ / Forecast
                        </Link>
                      </Td>
                    </tr>
                  ))
                )}
              </Tbody>
            </Table>
          </div>
        </Card>
      ) : (
        <Card className="border-stone-200 rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.02)] overflow-hidden">
          <CardHeader className="bg-stone-50/50 border-b border-stone-200 p-4">
            <div className="flex items-center gap-2">
              <BadgeInfo className="w-5 h-5 text-emerald-600" />
              <h2 className="font-semibold text-stone-800 text-[15.5px]">
                ตารางสรุปข้อมูลประสิทธิภาพของสินค้าทุกรายการ (Complete SKU Performance Snapshot)
              </h2>
            </div>
          </CardHeader>
          <div className="overflow-x-auto">
            <Table>
              <Thead>
                <tr>
                  <Th className="text-[13px] font-semibold text-stone-700 bg-stone-50/40">SKU</Th>
                  <Th className="text-[13px] font-semibold text-stone-700 bg-stone-50/40">ชื่อสินค้า / Product Description</Th>
                  <Th className="text-[13px] font-semibold text-stone-700 bg-stone-50/40 text-right">สินค้าคงเหลือ / On Hand</Th>
                  <Th className="text-[13px] font-semibold text-stone-700 bg-stone-50/40 text-right">ยอดขาย (30 วัน)</Th>
                  <Th className="text-[13px] font-semibold text-stone-700 bg-stone-50/40 text-right">ยอดขาย (365 วัน)</Th>
                  <Th className="text-[13px] font-semibold text-stone-700 bg-stone-50/40 text-right">รายได้ (30 วัน)</Th>
                  <Th className="text-[13px] font-semibold text-stone-700 bg-stone-50/40 text-right">ต้นทุน (MAC)</Th>
                  <Th className="text-[13px] font-semibold text-stone-700 bg-stone-50/40 text-right">กำไร % / Margin %</Th>
                  <Th className="text-[13px] font-semibold text-stone-700 bg-stone-50/40 text-right">ขายออก %</Th>
                  <Th className="text-[13px] font-semibold text-stone-700 bg-stone-50/40 text-right">ระยะขายหมด (วัน)</Th>
                  <Th className="text-[13px] font-semibold text-stone-700 bg-stone-50/40 text-center">ความเร็ว / Velocity</Th>
                  <Th className="text-[13px] font-semibold text-stone-700 bg-stone-50/40 text-center">ดูคาดการณ์ / Forecast</Th>
                </tr>
              </Thead>
              <Tbody>
                {performance.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="p-8 text-center text-stone-400 text-[13.5px]">
                      ไม่มีข้อมูล SKU / No SKU data found.
                    </td>
                  </tr>
                ) : (
                  performance.map((p) => (
                    <tr key={p.product_id} className="hover:bg-stone-50/65 transition-colors group">
                      <Td className="font-semibold text-stone-800 text-[13.5px] whitespace-nowrap">{p.sku}</Td>
                      <Td className="max-w-[220px]">
                        <div className="text-[13.5px] font-medium text-stone-800 line-clamp-1">{p.name_th}</div>
                        <div className="text-[11.5px] text-stone-400 line-clamp-1 mt-0.5">{p.name_en}</div>
                      </Td>
                      <Td className="text-right text-[13px] tabular-nums font-medium text-stone-700">
                        {Number(p.qty_on_hand).toLocaleString(undefined, { minimumFractionDigits: 1 })}
                      </Td>
                      <Td className="text-right text-[13px] tabular-nums font-semibold text-stone-900">
                        {Number(p.qty_sold_30d).toLocaleString()}
                      </Td>
                      <Td className="text-right text-[13px] tabular-nums font-medium text-stone-500">
                        {Number(p.qty_sold_365d).toLocaleString()}
                      </Td>
                      <Td className="text-right text-[13px] tabular-nums font-semibold text-emerald-700">
                        {formatCurrency(Number(p.revenue_30d))}
                      </Td>
                      <Td className="text-right text-[13px] tabular-nums text-stone-500">
                        {formatCurrency(Number(p.moving_avg_cost))}
                      </Td>
                      <Td className={`text-right text-[13px] tabular-nums font-semibold ${Number(p.gross_margin_pct) < 15 ? 'text-rose-600' : 'text-stone-700'}`}>
                        {Number(p.gross_margin_pct).toFixed(1)}%
                      </Td>
                      <Td className="text-right text-[13px] tabular-nums font-medium text-stone-700">
                        {Number(p.sell_through_30d).toFixed(1)}%
                      </Td>
                      <Td className="text-right text-[13px] tabular-nums font-medium text-stone-700">
                        {Number(p.days_on_hand) >= 999 ? '∞' : `${Number(p.days_on_hand).toFixed(0)} วัน`}
                      </Td>
                      <Td className="text-center">
                        <Badge className={
                          p.velocity_bucket === 'FAST' ? 'bg-emerald-100 text-emerald-800' :
                          p.velocity_bucket === 'MEDIUM' ? 'bg-blue-100 text-blue-800' :
                          p.velocity_bucket === 'SLOW' ? 'bg-amber-100 text-amber-800' :
                          'bg-stone-200 text-stone-700 border-stone-300'
                        }>
                          {p.velocity_bucket}
                        </Badge>
                      </Td>
                      <Td className="text-center">
                        <Link 
                          href={`/app/analytics/forecast/${p.product_id}`}
                          className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 rounded-md text-[12px] font-semibold transition-all group-hover:scale-102"
                        >
                          <Activity className="w-3.5 h-3.5" />
                          ดูคาดการณ์
                        </Link>
                      </Td>
                    </tr>
                  ))
                )}
              </Tbody>
            </Table>
          </div>

          {/* Simple pagination */}
          {totalPerformance > LIMIT && (
            <div className="bg-stone-50 border-t border-stone-200 p-4 flex justify-between items-center text-[13.5px]">
              <span className="text-stone-500">
                แสดง {Math.min(totalPerformance, (page - 1) * LIMIT + 1)} - {Math.min(totalPerformance, page * LIMIT)} จากทั้งหมด {totalPerformance} รายการ
              </span>
              <div className="flex gap-2">
                <Button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  variant="outline"
                  className="px-3 rounded-lg border-stone-300"
                >
                  ย้อนกลับ / Prev
                </Button>
                <Button
                  onClick={() => setPage(p => p + 1)}
                  disabled={page * LIMIT >= totalPerformance}
                  variant="outline"
                  className="px-3 rounded-lg border-stone-300"
                >
                  ถัดไป / Next
                </Button>
              </div>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

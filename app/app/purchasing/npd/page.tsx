'use client';

/* eslint-disable local-rules/no-hardcoded-thai */
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { get, patch } from '@/lib/api-client';
import { formatDate } from '@/lib/utils';
import { 
  Sparkles, CheckCircle2, XCircle,
  Search, AlertTriangle, Calendar, Info, Activity, GraduationCap, RefreshCw
} from 'lucide-react';
import { Button, Table, Thead, Tbody, Th, Td, Badge, PageLoader, Card, CardHeader, CardBody, Input } from '@/components/ui';

interface NpdTrial {
  id: string;
  product_id: string;
  start_date: string;
  end_date: string;
  status: 'active' | 'graduated' | 'cut' | 'extended';
  decision_at: string | null;
  decision_by: string | null;
  decision_notes: string | null;
  sku: string;
  name_th: string;
  name_en: string;
  is_npd_trial: boolean;
  score: string | number;
  qty_sold_30d: string | number;
  sell_through_30d: string | number;
  gross_margin_pct: string | number;
  qty_on_hand?: string | number;
  suggested_decision?: 'graduate' | 'cut';
}

export default function NpdTrialDashboardPage() {
  const [activeTab, setActiveTab] = useState<'pending' | 'active' | 'history'>('pending');
  const [trials, setTrials] = useState<NpdTrial[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Search
  const [searchQuery, setSearchQuery] = useState('');

  // Decisions Modal State
  const [decisionTrial, setDecisionTrial] = useState<NpdTrial | null>(null);
  const [decisionNotes, setDecisionNotes] = useState('');
  const [extendDate, setExtendDate] = useState('');
  const [processing, setProcessing] = useState(false);

  const loadTrials = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      let endpoint = '';
      if (activeTab === 'pending') {
        endpoint = `/api/analytics/npd-trials/decisions-pending${searchQuery ? `?search=${encodeURIComponent(searchQuery)}` : ''}`;
      } else {
        endpoint = `/api/analytics/npd-trials?status=${activeTab}${searchQuery ? `&search=${encodeURIComponent(searchQuery)}` : ''}`;
      }
      const data = await get<NpdTrial[]>(endpoint);
      setTrials(data);
    } catch (e: unknown) {
      console.error(e);
      setError('ไม่สามารถดึงข้อมูลรายการ NPD Trial ได้ / Failed to load NPD trials');
    } finally {
      setLoading(false);
    }
  }, [activeTab, searchQuery]);

  useEffect(() => {
    loadTrials();
  }, [loadTrials]);

  const handleDecision = async (action: 'graduate' | 'cut' | 'extend') => {
    if (!decisionTrial) return;
    setProcessing(true);
    setError('');
    setSuccessMsg('');
    try {
      const payload: { action: string; notes: string; end_date?: string } = { action, notes: decisionNotes };
      if (action === 'extend') {
        if (!extendDate) {
          setError('กรุณาระบุวันที่ต้องการต่ออายุ / Please select an extension date');
          setProcessing(false);
          return;
        }
        payload.end_date = extendDate;
      }

      await patch(`/api/products/${decisionTrial.product_id}/npd-trial`, payload);
      setSuccessMsg(`บันทึกการตัดสินใจเรียบร้อยแล้ว / Action completed: ${action}`);
      setDecisionTrial(null);
      setDecisionNotes('');
      setExtendDate('');
      await loadTrials();
    } catch (e: unknown) {
      console.error(e);
      const err = e as { message?: string };
      setError(err.message ?? 'เกิดข้อผิดพลาดในการประมวลผล / Decision execution failed');
    } finally {
      setProcessing(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score < 25) return 'text-rose-600 bg-rose-50 border-rose-200';
    if (score < 40) return 'text-orange-600 bg-orange-50 border-orange-200';
    if (score < 60) return 'text-amber-600 bg-amber-50 border-amber-200';
    return 'text-emerald-600 bg-emerald-50 border-emerald-200';
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-stone-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-stone-900 flex items-center gap-2.5">
            <Sparkles className="w-7 h-7 text-emerald-600" />
            วิเคราะห์การติดตามผลิตภัณฑ์ใหม่ (NPD Trial SKUs Tracking)
          </h1>
          <p className="text-[14px] text-stone-500 mt-1.5">
            ติดตามประเมินผลสินค้าที่เพิ่งนำเข้าทดลองตลาด (NPD) เพื่อแนะนำการนำเข้าระบบถาวร (Graduate) หรือยกเลิกและโอนเข้าคลังลดราคา (Cut to V-CLR)
          </p>
        </div>
      </div>

      {successMsg && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 text-[14.5px] text-emerald-700 flex items-start gap-2.5">
          <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
          <div>{successMsg}</div>
        </div>
      )}

      {error && (
        <div className="bg-rose-50 border border-rose-200 rounded-lg p-4 text-[14.5px] text-rose-700 flex items-start gap-2.5">
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
          <div>{error}</div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-stone-200 gap-6">
        <button
          onClick={() => { setActiveTab('pending'); setTrials([]); }}
          className={`pb-3 text-[15px] font-semibold transition-all relative ${
            activeTab === 'pending' 
              ? 'text-emerald-700 border-b-2 border-emerald-600' 
              : 'text-stone-500 hover:text-stone-800'
          }`}
        >
          รอพิจารณาตัดสินใจ / Pending Decisions
        </button>
        <button
          onClick={() => { setActiveTab('active'); setTrials([]); }}
          className={`pb-3 text-[15px] font-semibold transition-all relative ${
            activeTab === 'active' 
              ? 'text-emerald-700 border-b-2 border-emerald-600' 
              : 'text-stone-500 hover:text-stone-800'
          }`}
        >
          สินค้าทดลองตลาดที่กำลังรัน / Active Trials
        </button>
        <button
          onClick={() => { setActiveTab('history'); setTrials([]); }}
          className={`pb-3 text-[15px] font-semibold transition-all relative ${
            activeTab === 'history' 
              ? 'text-emerald-700 border-b-2 border-emerald-600' 
              : 'text-stone-500 hover:text-stone-800'
          }`}
        >
          ประวัติการทดลอง (จบแล้ว) / Completed Trials
        </button>
      </div>

      {/* Search and toolbar */}
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
        <Button 
          onClick={loadTrials} 
          variant="outline" 
          className="border-stone-300 rounded-lg shrink-0"
        >
          <RefreshCw className="w-4 h-4 mr-1.5" /> รีเฟรช / Refresh
        </Button>
      </div>

      {/* Decisions dialog overlay */}
      {decisionTrial && (
        <div className="fixed inset-0 z-50 bg-black/45 flex items-center justify-center p-4">
          <div className="bg-white border border-stone-200 rounded-xl max-w-lg w-full p-6 shadow-xl space-y-4">
            <div className="flex justify-between items-start border-b border-stone-100 pb-3">
              <div>
                <h3 className="text-lg font-bold text-stone-900">ตัดสินใจดำเนินการสินค้า NPD</h3>
                <p className="text-[12.5px] text-stone-500 mt-0.5">SKU: {decisionTrial.sku} — {decisionTrial.name_th}</p>
              </div>
              <button 
                onClick={() => { setDecisionTrial(null); setDecisionNotes(''); setExtendDate(''); }}
                className="text-stone-400 hover:text-stone-600 text-lg"
              >
                ✕
              </button>
            </div>

            <div className="p-4 bg-stone-50 rounded-lg border space-y-2.5 text-[13.5px]">
              <div className="flex justify-between">
                <span className="text-stone-500">คะแนนประสิทธิภาพของสินค้า / Score:</span>
                <span className={`px-2 py-0.5 rounded-md font-bold text-[12px] border ${getScoreColor(Number(decisionTrial.score))}`}>
                  {Number(decisionTrial.score).toFixed(0)} / 100
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-500">อัตราการขายออก / Sell-Through:</span>
                <span className="font-semibold text-stone-800">{Number(decisionTrial.sell_through_30d).toFixed(1)}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-500">ยอดขาย 30 วัน / 30d Qty Sold:</span>
                <span className="font-semibold text-stone-800">{Number(decisionTrial.qty_sold_30d).toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-500">สินค้าคลังคงเหลือ / On Hand Stock:</span>
                <span className="font-semibold text-stone-800">{Number(decisionTrial.qty_on_hand ?? 0).toLocaleString()}</span>
              </div>
              <div className="border-t border-stone-200 pt-2.5 flex justify-between items-center">
                <span className="text-stone-600 font-medium">คำแนะนำเชิงวิเคราะห์ / Suggestion:</span>
                {Number(decisionTrial.score) >= 40.0 ? (
                  <span className="inline-flex items-center gap-1 text-emerald-700 font-bold bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full text-[12.5px]">
                    <GraduationCap className="w-3.5 h-3.5" /> Graduate
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-rose-700 font-bold bg-rose-50 border border-rose-200 px-2.5 py-0.5 rounded-full text-[12.5px]">
                    <XCircle className="w-3.5 h-3.5" /> Cut to clearance
                  </span>
                )}
              </div>
            </div>

            <div className="space-y-3.5">
              <div className="flex flex-col gap-1">
                <label className="text-[13px] font-bold text-stone-700">หมายเหตุ / Notes</label>
                <textarea
                  rows={3}
                  value={decisionNotes}
                  onChange={(e) => setDecisionNotes(e.target.value)}
                  placeholder="ระบุความเห็นทางธุรกิจหรือเหตุผลสนับสนุนการตัดสินใจ..."
                  className="p-3 border rounded-lg text-[13.5px] focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div className="flex flex-col gap-1.5 p-3.5 bg-amber-50/50 border border-amber-200 rounded-lg">
                <label className="text-[13px] font-bold text-amber-800 flex items-center gap-1.5">
                  <Calendar className="w-4 h-4" /> หากต้องการต่อเวลาทดลอง (Extend Trial)
                </label>
                <Input 
                  type="date"
                  value={extendDate}
                  onChange={(e) => setExtendDate(e.target.value)}
                  className="bg-white border-stone-300"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2.5 border-t border-stone-100 pt-4">
              <Button
                variant="outline"
                onClick={() => { setDecisionTrial(null); setDecisionNotes(''); setExtendDate(''); }}
                disabled={processing}
                className="border-stone-300 rounded-lg text-[13px] h-[36px]"
              >
                ยกเลิก / Cancel
              </Button>
              <Button
                onClick={() => handleDecision('extend')}
                disabled={processing || !extendDate}
                className="bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-[13px] h-[36px]"
              >
                ต่อเวลา / Extend
              </Button>
              <Button
                onClick={() => handleDecision('cut')}
                disabled={processing}
                className="bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-[13px] h-[36px]"
              >
                ตัดออก / Cut (Clearance)
              </Button>
              <Button
                onClick={() => handleDecision('graduate')}
                disabled={processing}
                className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[13px] h-[36px]"
              >
                Graduate permanent SKU
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Main Table section */}
      {loading ? (
        <PageLoader />
      ) : (
        <Card className="border-stone-200 rounded-xl shadow-sm overflow-hidden bg-white">
          <CardHeader className="bg-stone-50/50 border-b border-stone-200 p-4">
            <div className="flex items-center gap-2">
              <Info className="w-5 h-5 text-emerald-600" />
              <h2 className="font-semibold text-stone-800 text-[15px]">
                {activeTab === 'pending' ? 'รายการสินค้า NPD ที่สิ้นสุดระยะทดลองแล้ว และรอการประเมินเพื่อดำเนินการต่อ' :
                 activeTab === 'active' ? 'รายการสินค้า NPD ที่อยู่ระหว่างดำเนินการทดลองวางจำหน่ายในตลาด' :
                 'ประวัติและผลลัพธ์ของสินค้า NPD ที่เสร็จสิ้นกระบวนการทดลองตลาดแล้ว'}
              </h2>
            </div>
          </CardHeader>
          <div className="overflow-x-auto">
            <Table>
              <Thead>
                <tr>
                  <Th className="text-[13px] font-semibold text-stone-700 bg-stone-50/40">SKU</Th>
                  <Th className="text-[13px] font-semibold text-stone-700 bg-stone-50/40">ชื่อสินค้า / Description</Th>
                  <Th className="text-[13px] font-semibold text-stone-700 bg-stone-50/40 text-center">เริ่มทดลอง</Th>
                  <Th className="text-[13px] font-semibold text-stone-700 bg-stone-50/40 text-center">สิ้นสุดการทดลอง</Th>
                  <Th className="text-[13px] font-semibold text-stone-700 bg-stone-50/40 text-right">สต็อกหน้าร้าน</Th>
                  <Th className="text-[13px] font-semibold text-stone-700 bg-stone-50/40 text-right">ยอดขาย (30 วัน)</Th>
                  <Th className="text-[13px] font-semibold text-stone-700 bg-stone-50/40 text-right">อัตราขายออก</Th>
                  <Th className="text-[13px] font-semibold text-stone-700 bg-stone-50/40 text-center">คะแนน SKU</Th>
                  {activeTab === 'pending' ? (
                    <>
                      <Th className="text-[13px] font-semibold text-stone-700 bg-stone-50/40 text-center">คำแนะนำ</Th>
                      <Th className="text-[13px] font-semibold text-stone-700 bg-stone-50/40 text-center">การตัดสินใจ</Th>
                    </>
                  ) : activeTab === 'active' ? (
                    <Th className="text-[13px] font-semibold text-stone-700 bg-stone-50/40 text-center">ความต้องการ</Th>
                  ) : (
                    <>
                      <Th className="text-[13px] font-semibold text-stone-700 bg-stone-50/40 text-center">ผลลัพธ์ / Status</Th>
                      <Th className="text-[13px] font-semibold text-stone-700 bg-stone-50/40">บันทึกประกอบ</Th>
                    </>
                  )}
                </tr>
              </Thead>
              <Tbody>
                {trials.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="p-8 text-center text-stone-400 text-[13.5px]">
                      ไม่มีข้อมูลในแท็บนี้ / No NPD trials found in this section.
                    </td>
                  </tr>
                ) : (
                  trials.map((t) => (
                    <tr key={t.id} className="hover:bg-stone-50/65 transition-colors group">
                      <Td className="font-semibold text-stone-800 text-[13.5px] whitespace-nowrap">{t.sku}</Td>
                      <Td className="max-w-[200px]">
                        <div className="text-[13.5px] font-medium text-stone-800 line-clamp-1">{t.name_th}</div>
                        <div className="text-[11.5px] text-stone-400 line-clamp-1 mt-0.5">{t.name_en}</div>
                      </Td>
                      <Td className="text-center text-[13px] whitespace-nowrap text-stone-600">{formatDate(t.start_date)}</Td>
                      <Td className={`text-center text-[13px] whitespace-nowrap font-medium ${activeTab === 'pending' ? 'text-rose-600' : 'text-stone-600'}`}>
                        {formatDate(t.end_date)}
                      </Td>
                      <Td className="text-right text-[13px] tabular-nums font-medium text-stone-700">
                        {Number(t.qty_on_hand ?? 0).toLocaleString(undefined, { minimumFractionDigits: 1 })}
                      </Td>
                      <Td className="text-right text-[13px] tabular-nums font-semibold text-stone-900">
                        {Number(t.qty_sold_30d).toLocaleString()}
                      </Td>
                      <Td className="text-right text-[13px] tabular-nums text-stone-700">
                        {Number(t.sell_through_30d).toFixed(1)}%
                      </Td>
                      <Td className="text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[12px] font-bold border ${getScoreColor(Number(t.score))}`}>
                          {Number(t.score).toFixed(0)}
                        </span>
                      </Td>

                      {activeTab === 'pending' ? (
                        <>
                          <Td className="text-center">
                            {t.suggested_decision === 'graduate' ? (
                              <span className="inline-flex items-center gap-0.5 text-emerald-700 font-bold bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md text-[11.5px]">
                                <GraduationCap className="w-3 h-3" /> Graduate
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-0.5 text-rose-700 font-bold bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-md text-[11.5px]">
                                <XCircle className="w-3 h-3" /> Cut
                              </span>
                            )}
                          </Td>
                          <Td className="text-center">
                            <Button
                              size="sm"
                              onClick={() => setDecisionTrial(t)}
                              className="bg-stone-900 hover:bg-stone-800 text-white rounded-md text-[12px] font-semibold h-[30px]"
                            >
                              ประเมินผล / Decide
                            </Button>
                          </Td>
                        </>
                      ) : activeTab === 'active' ? (
                        <Td className="text-center">
                          <Link 
                            href={`/app/analytics/forecast/${t.product_id}`}
                            className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 rounded-md text-[12px] font-semibold transition-all group-hover:scale-102"
                          >
                            <Activity className="w-3.5 h-3.5" />
                            พยากรณ์ดีมานด์
                          </Link>
                        </Td>
                      ) : (
                        <>
                          <Td className="text-center">
                            <Badge className={
                              t.status === 'graduated' ? 'bg-emerald-100 text-emerald-800 border-emerald-200' :
                              t.status === 'cut' ? 'bg-rose-100 text-rose-800 border-rose-200' :
                              t.status === 'extended' ? 'bg-amber-100 text-amber-800 border-amber-200' :
                              'bg-stone-100 text-stone-800'
                            }>
                              {t.status === 'graduated' ? 'Graduate (อนุมัติ)' :
                               t.status === 'cut' ? 'Cut (ถอดสินค้า)' : 'Extended (ขยายเวลา)'}
                            </Badge>
                          </Td>
                          <Td className="text-[12.5px] text-stone-500 max-w-[200px] truncate" title={t.decision_notes ?? ''}>
                            {t.decision_notes || '-'}
                          </Td>
                        </>
                      )}
                    </tr>
                  ))
                )}
              </Tbody>
            </Table>
          </div>
        </Card>
      )}

      {/* Strategy and Risk documentation */}
      <Card className="border-stone-200 bg-stone-50 rounded-xl overflow-hidden">
        <CardBody className="p-5 flex gap-3.5 items-start">
          <Info className="w-6 h-6 text-emerald-600 shrink-0 mt-0.5" />
          <div className="space-y-1.5">
            <h4 className="text-[14px] font-bold text-stone-800">คำชี้แจงการจัดการสินค้าค้างสต็อกจากการถอดออก (Stock Clearance Safeguards)</h4>
            <p className="text-[13px] text-stone-600 leading-relaxed">
              * เมื่อฝ่ายจัดซื้อเลือกการตัดสินใจ <strong>&quot;ตัดออก / Cut (Clearance)&quot;</strong> ผลิตภัณฑ์ดังกล่าวจะถูกเปลี่ยนสถานะเป็น Inactive (is_active = FALSE)<br />
              * ระบบจะทำการสแกนหา **ยอดสต็อกคงเหลือ (qty_on_hand)** ในทุกคลังจัดเก็บกายภาพทันที และทำการบันทึกตัดสต็อกออกพร้อมโอนย้ายไปยังคลังจำหน่ายสินค้าล้างสต็อกส่วนกลาง <strong>Virtual Warehouse &quot;V-CLR&quot; (Clearance)</strong> โดยอัตโนมัติผ่าน stock_ledger เพื่อใช้สำหรับจัดกิจกรรมล้างสต็อกในลำดับถัดไป ป้องกันการลบข้อมูลสต็อกจริงโดยพลการ
            </p>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

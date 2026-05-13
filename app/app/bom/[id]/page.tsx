'use client';

import { useState, useEffect, use, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button, StatusBadge, Modal, ModalHeader, ModalBody, ModalFooter, Input, SearchInput, Select } from '@/components/ui';
import { get, patch, del } from '@/lib/api-client';
import { formatDate } from '@/lib/format';
import type { BomHeader, Product, PaginatedResponse, UnitOfMeasure } from '@/types';
import { useSession } from 'next-auth/react';

const CARD = 'bg-white border border-stone-200 rounded-[10px] shadow-sm overflow-hidden';

export default function BomDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { data: session } = useSession();
  
  const [bom, setBom] = useState<BomHeader | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [error, setError] = useState('');
  
  const [showAddLine, setShowAddLine] = useState(false);
  const [compSearch, setCompSearch] = useState('');
  const [compResults, setCompResults] = useState<Product[]>([]);
  const [selectedComp, setSelectedComp] = useState<Product | null>(null);
  const [newLine, setNewLine] = useState({
    uom_id: '',
    qty_required: 1,
    scrap_pct: 0,
    notes: '',
    uoms: [] as UnitOfMeasure[]
  });

  const user = session?.user as { role: string } | undefined;
  const canEdit = user && ['admin', 'manager'].includes(user.role);

  const fetchBom = useCallback(async () => {
    setLoading(true);
    try {
      const res = await get<BomHeader>(`/api/bom/${id}`);
      setBom(res);
    } catch {
      setError('ไม่พบข้อมูลสูตรการผลิต');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchBom();
  }, [fetchBom]);

  async function handleAction(action: string, body: object = {}) {
    setActing(true);
    setError('');
    try {
      await patch(`/api/bom/${id}`, { action, ...body });
      await fetchBom();
      setShowAddLine(false);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'เกิดข้อผิดพลาด');
    } finally {
      setActing(false);
    }
  }

  async function handleDelete() {
    if (!confirm('คุณต้องการลบสูตรการผลิตนี้ใช่หรือไม่?')) return;
    setActing(true);
    try {
      await del(`/api/bom/${id}`);
      router.push('/app/bom');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'ไม่สามารถลบได้');
      setActing(false);
    }
  }

  async function handleCompSearch(q: string) {
    setCompSearch(q);
    if (!q) { setCompResults([]); return; }
    const res = await get<PaginatedResponse<Product>>(`/api/products?search=${encodeURIComponent(q)}&limit=10`);
    setCompResults(res.data ?? []);
  }

  async function selectComp(p: Product) {
    if (bom && p.id === bom.product_id) {
      alert('ไม่สามารถนำสินค้าผลผลิตมาเป็นส่วนประกอบได้');
      return;
    }
    const uoms = await get<UnitOfMeasure[]>(`/api/products/${p.id}/uom`);
    const baseUom = { id: p.uom_id, code: p.uom_code } as UnitOfMeasure;
    setSelectedComp(p);
    setNewLine({
      uom_id: p.uom_id as string,
      qty_required: 1,
      scrap_pct: 0,
      notes: '',
      uoms: [baseUom, ...uoms]
    });
    setCompSearch('');
    setCompResults([]);
  }

  if (loading) return <div className="py-16 text-center text-stone-400 italic">กำลังโหลด...</div>;
  if (!bom) return <div className="py-16 text-center text-stone-400 italic">ไม่พบข้อมูล</div>;

  return (
    <div className="max-w-6xl mx-auto pb-12 space-y-6">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <button className="text-sm text-stone-500 hover:underline flex items-center gap-1" onClick={() => router.push('/app/bom')}>
            ← ย้อนกลับ
          </button>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-stone-950 font-mono uppercase">{bom.bom_number}</h1>
            <StatusBadge status={bom.is_active ? 'active' : 'inactive'} />
            <span className="bg-stone-100 text-stone-600 px-2 py-0.5 rounded text-xs font-bold uppercase">v{bom.version}</span>
          </div>
        </div>
        <div className="flex gap-2">
          {canEdit && (
            <>
              {bom.is_active ? (
                <Button variant="secondary" onClick={() => handleAction('deactivate')} loading={acting}>ยกเลิกใช้งาน</Button>
              ) : (
                <Button onClick={() => handleAction('activate')} loading={acting}>ตั้งเป็นสูตรใช้งาน (Active)</Button>
              )}
              <Button variant="danger" onClick={handleDelete} loading={acting}>ลบสูตร</Button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {[
          { label: 'สินค้าผลผลิต', value: bom.product_name_th, sub: bom.product_sku },
          { label: 'จำนวนผลผลิต', value: `${Number(bom.output_qty).toLocaleString()} ${bom.uom_code}` },
          { label: 'ประเภทสูตร', value: bom.bom_type === 'manufacturing' ? 'การผลิต' : 'ชุดสินค้า' },
          { label: 'ผู้สร้าง', value: bom.created_by_name || '—', sub: formatDate(bom.created_at) },
        ].map((f, i) => (
          <div key={i} className="bg-white border border-stone-200 p-4 rounded-xl shadow-sm">
            <p className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider mb-1">{f.label}</p>
            <p className="text-[15px] font-bold text-stone-950 truncate">{f.value}</p>
            {f.sub && <p className="text-[11px] text-stone-500 font-mono mt-0.5">{f.sub}</p>}
          </div>
        ))}
      </div>

      {bom.notes && (
        <div className="bg-stone-50 border border-stone-100 p-4 rounded-xl text-stone-600 text-[13px]">
          <span className="font-semibold text-stone-900 block mb-1 uppercase text-[10px] tracking-widest">หมายเหตุ:</span>
          {bom.notes}
        </div>
      )}

      <div className={CARD}>
        <div className="p-4 border-b border-stone-200 bg-stone-50 flex items-center justify-between">
          <h3 className="text-[14px] font-semibold text-stone-950 uppercase tracking-wider">ส่วนประกอบ (Components)</h3>
          <div className="flex items-center gap-3">
            <span className="text-[12px] text-stone-500">{bom.lines?.length || 0} รายการ</span>
            {canEdit && (
              <button
                onClick={() => setShowAddLine(true)}
                className="text-xs font-bold text-emerald-600 hover:text-emerald-700 uppercase"
              >
                + เพิ่มรายการ
              </button>
            )}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr className="bg-stone-50/50 border-b border-stone-100 text-stone-400 font-semibold uppercase tracking-wider text-[10px]">
                <th className="text-left py-2.5 px-4 w-12">#</th>
                <th className="text-left py-2.5 px-4">ส่วนประกอบ</th>
                <th className="text-right py-2.5 px-4 w-28">จำนวน</th>
                <th className="text-left py-2.5 px-4 w-20">หน่วย</th>
                <th className="text-right py-2.5 px-4 w-24">Scrap %</th>
                <th className="text-right py-2.5 px-4 w-28">ใช้จริง</th>
                {canEdit && <th className="px-4 w-10"></th>}
              </tr>
            </thead>
            <tbody>
              {bom.lines?.map((l) => (
                <tr key={l.id} className="border-b border-stone-50 last:border-0 hover:bg-stone-50/30">
                  <td className="py-3 px-4 text-stone-400 font-mono">{l.line_number}</td>
                  <td className="py-3 px-4">
                    <div className="font-medium text-stone-900">{l.component_name_th}</div>
                    <div className="text-[10px] text-stone-400 font-mono">{l.component_sku}</div>
                    {l.notes && <div className="text-[11px] text-stone-400 mt-1 italic">{l.notes}</div>}
                  </td>
                  <td className="py-3 px-4 text-right font-mono">{Number(l.qty_required).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                  <td className="py-3 px-4 text-stone-500 font-medium">{l.uom_code}</td>
                  <td className="py-3 px-4 text-right text-stone-500">{Number(l.scrap_pct) > 0 ? `${l.scrap_pct}%` : '—'}</td>
                  <td className="py-3 px-4 text-right font-bold text-stone-950 font-mono">{Number(l.qty_effective).toLocaleString(undefined, { minimumFractionDigits: 4 })}</td>
                  {canEdit && (
                    <td className="py-3 px-4 text-right">
                      <button onClick={() => handleAction('remove_line', { line_id: l.id })} className="text-stone-300 hover:text-red-600 transition-colors">
                        ✕
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showAddLine && (
        <Modal open onClose={() => setShowAddLine(false)}>
          <ModalHeader>เพิ่มส่วนประกอบ</ModalHeader>
          <ModalBody className="space-y-4">
            <div className="relative">
              <label className="text-xs font-semibold text-stone-500 uppercase block mb-1">ค้นหาสินค้า</label>
              {selectedComp ? (
                <div className="flex items-center justify-between p-3 border rounded-lg bg-stone-50">
                  <div>
                    <div className="font-mono text-[10px] text-stone-500 uppercase tracking-wider">{selectedComp.sku}</div>
                    <div className="text-sm font-bold text-stone-900">{selectedComp.name_th}</div>
                  </div>
                  <button onClick={() => setSelectedComp(null)} className="text-stone-400 hover:text-red-600 font-bold px-2">✕</button>
                </div>
              ) : (
                <>
                  <SearchInput
                    placeholder="พิมพ์ SKU หรือชื่อสินค้า..."
                    value={compSearch}
                    onChange={(e) => handleCompSearch(e.target.value)}
                  />
                  {compResults.length > 0 && (
                    <div className="absolute z-50 mt-1 w-full rounded-lg border bg-white shadow-xl overflow-hidden max-h-60 overflow-y-auto">
                      {compResults.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          className="w-full text-left px-4 py-3 hover:bg-stone-50 text-sm border-b last:border-0 transition-colors"
                          onClick={() => selectComp(p)}
                        >
                          <div className="font-mono font-bold text-stone-950 uppercase">{p.sku}</div>
                          <div className="text-stone-500 text-xs mt-0.5">{p.name_th}</div>
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>

            {selectedComp && (
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="จำนวนที่ต้องใช้ *"
                  type="number"
                  min="0.000001"
                  step="any"
                  value={newLine.qty_required}
                  onChange={(e) => setNewLine({ ...newLine, qty_required: parseFloat(e.target.value) || 0 })}
                />
                <Select
                  label="หน่วย *"
                  value={newLine.uom_id}
                  onChange={(e) => setNewLine({ ...newLine, uom_id: e.target.value })}
                  options={newLine.uoms.map(u => ({ value: u.id, label: u.code }))}
                />
                <Input
                  label="Scrap % (เผื่อเสีย)"
                  type="number"
                  min="0"
                  max="99"
                  step="0.1"
                  value={newLine.scrap_pct}
                  onChange={(e) => setNewLine({ ...newLine, scrap_pct: parseFloat(e.target.value) || 0 })}
                />
                <Input
                  label="หมายเหตุ"
                  value={newLine.notes}
                  onChange={(e) => setNewLine({ ...newLine, notes: e.target.value })}
                />
              </div>
            )}
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" onClick={() => setShowAddLine(false)}>ยกเลิก</Button>
            <Button onClick={() => handleAction('add_line', { line: {
              component_id: selectedComp?.id,
              uom_id: newLine.uom_id,
              qty_required: newLine.qty_required,
              scrap_pct: newLine.scrap_pct,
              notes: newLine.notes || undefined
            }})} loading={acting} disabled={!selectedComp}>เพิ่มรายการ</Button>
          </ModalFooter>
        </Modal>
      )}

      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-100 text-red-700 text-sm flex items-center gap-3">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M8 1a7 7 0 100 14A7 7 0 008 1zm0 11a1 1 0 110-2 1 1 0 010 2zm1-3H7V4h2v5z"/></svg>
          {error}
        </div>
      )}
    </div>
  );
}

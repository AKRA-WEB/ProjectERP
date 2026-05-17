'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button, Input, Select, Table, Thead, Tbody, Th, Td, Badge, Modal } from '@/components/ui';
import { get, post, del } from '@/lib/api-client';
import type { UnitOfMeasure, UomConversion } from '@/types';

export default function AdminUomPage() {
  const [uoms, setUoms] = useState<UnitOfMeasure[]>([]);
  const [conversions, setConversions] = useState<UomConversion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Create UoM form state
  const [showCreateUom, setShowCreateUom] = useState(false);
  const [newUom, setNewUom] = useState({ code: '', name_th: '', name_en: '', is_base_unit: false, is_integer_unit: false, barcode_label: '', sort_order: 0 });
  const [creating, setCreating] = useState(false);

  // Create conversion form state
  const [showCreateConv, setShowCreateConv] = useState(false);
  const [newConv, setNewConv] = useState({ uom_id: '', base_uom_id: '', factor: '', notes: '' });
  const [creatingConv, setCreatingConv] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [u, c] = await Promise.all([
        get<UnitOfMeasure[]>('/api/admin/uom'),
        get<UomConversion[]>('/api/admin/uom/conversions'),
      ]);
      setUoms(u);
      setConversions(c);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'โหลดข้อมูลไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  async function handleCreateUom() {
    setCreating(true);
    setError('');
    try {
      await post('/api/admin/uom', {
        ...newUom,
        barcode_label: newUom.barcode_label || null,
      });
      setShowCreateUom(false);
      setNewUom({ code: '', name_th: '', name_en: '', is_base_unit: false, is_integer_unit: false, barcode_label: '', sort_order: 0 });
      await fetchAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'สร้างไม่สำเร็จ');
    } finally {
      setCreating(false);
    }
  }

  async function handleDeleteUom(id: string, code: string) {
    if (!confirm(`ลบหน่วย "${code}"?`)) return;
    setError('');
    try {
      await del(`/api/admin/uom/${id}`);
      await fetchAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ลบไม่สำเร็จ');
    }
  }

  async function handleCreateConversion() {
    setCreatingConv(true);
    setError('');
    try {
      await post('/api/admin/uom/conversions', {
        uom_id: newConv.uom_id,
        base_uom_id: newConv.base_uom_id,
        factor: parseFloat(newConv.factor),
        notes: newConv.notes || null,
      });
      setShowCreateConv(false);
      setNewConv({ uom_id: '', base_uom_id: '', factor: '', notes: '' });
      await fetchAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'สร้างไม่สำเร็จ');
    } finally {
      setCreatingConv(false);
    }
  }

  async function handleDeleteConversion(id: string) {
    if (!confirm('ลบ conversion นี้?')) return;
    setError('');
    try {
      await del(`/api/admin/uom/conversions/${id}`);
      await fetchAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ลบไม่สำเร็จ');
    }
  }

  const baseUoms = uoms.filter(u => u.is_base_unit);
  const nonBaseUoms = uoms.filter(u => !u.is_base_unit);

  if (loading) return <div className="py-16 text-center text-gray-600">กำลังโหลด...</div>;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">หน่วยนับ / Units of Measure</h1>
        <p className="text-sm text-gray-500">จัดการหน่วยนับและอัตราการแปลงหน่วย</p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {/* ── UoM Master ── */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-800">หน่วยทั้งหมด</h2>
          <Button onClick={() => setShowCreateUom(true)}>+ เพิ่มหน่วย</Button>
        </div>
        <div className="overflow-hidden rounded-lg border border-gray-200">
          <Table>
            <Thead>
              <tr>
                <Th>Code</Th>
                <Th>ชื่อ TH</Th>
                <Th>Name EN</Th>
                <Th>ประเภท</Th>
                <Th>Integer?</Th>
                <Th>Conversion</Th>
                <Th>Barcode Label</Th>
                <Th></Th>
              </tr>
            </Thead>
            <Tbody>
              {uoms.map(u => (
                <tr key={u.id}>
                  <Td><code className="font-mono text-sm font-semibold">{u.code}</code></Td>
                  <Td>{u.name_th}</Td>
                  <Td>{u.name_en}</Td>
                  <Td>
                    {u.is_base_unit
                      ? <Badge variant="green">Base</Badge>
                      : <Badge variant="gray">Non-base</Badge>}
                  </Td>
                  <Td>{u.is_integer_unit ? '✓' : '—'}</Td>
                  <Td>
                    {u.factor
                      ? <span className="text-sm">1 {u.code} = <strong>{u.factor}</strong> {u.base_uom_code}</span>
                      : <span className="text-gray-600 text-sm">—</span>}
                  </Td>
                  <Td><span className="text-sm text-gray-500">{u.barcode_label ?? '—'}</span></Td>
                  <Td>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteUom(u.id, u.code)}
                      className="text-red-600 hover:text-red-700"
                    >
                      ลบ
                    </Button>
                  </Td>
                </tr>
              ))}
            </Tbody>
          </Table>
        </div>
      </section>

      {/* ── Conversions ── */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-800">อัตราการแปลงหน่วย / Conversion Rules</h2>
          <Button onClick={() => setShowCreateConv(true)} disabled={nonBaseUoms.length === 0 || baseUoms.length === 0}>
            + เพิ่ม Conversion
          </Button>
        </div>
        <div className="overflow-hidden rounded-lg border border-gray-200">
          <Table>
            <Thead>
              <tr>
                <Th>สูตร / Rule</Th>
                <Th>Factor</Th>
                <Th>Notes</Th>
                <Th></Th>
              </tr>
            </Thead>
            <Tbody>
              {conversions.length === 0 ? (
                <tr><Td colSpan={4} className="text-center text-gray-600 py-8">ยังไม่มี conversion rules</Td></tr>
              ) : conversions.map(c => (
                <tr key={c.id}>
                  <Td>
                    <span className="font-mono text-sm">
                      1 <strong>{c.uom_code}</strong> = {c.factor} {c.base_uom_code}
                    </span>
                  </Td>
                  <Td><strong>{c.factor}</strong></Td>
                  <Td className="text-sm text-gray-500">{c.notes ?? '—'}</Td>
                  <Td>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteConversion(c.id)}
                      className="text-red-600 hover:text-red-700"
                    >
                      ลบ
                    </Button>
                  </Td>
                </tr>
              ))}
            </Tbody>
          </Table>
        </div>
      </section>

      {/* ── Create UoM Modal ── */}
      {showCreateUom && (
        <Modal title="เพิ่มหน่วยนับ" onClose={() => setShowCreateUom(false)}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Code <span className="text-gray-600">(A-Z0-9 หรือภาษาไทย)</span></label>
              <Input
                value={newUom.code}
                onChange={e => setNewUom(p => ({ ...p, code: e.target.value.toUpperCase() }))}
                placeholder="PCS, BOX, CTN..."
                maxLength={10}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ชื่อ (TH)</label>
                <Input value={newUom.name_th} onChange={e => setNewUom(p => ({ ...p, name_th: e.target.value }))} placeholder="ชิ้น" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name (EN)</label>
                <Input value={newUom.name_en} onChange={e => setNewUom(p => ({ ...p, name_en: e.target.value }))} placeholder="Piece" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Barcode Label</label>
              <Input value={newUom.barcode_label} onChange={e => setNewUom(p => ({ ...p, barcode_label: e.target.value }))} placeholder="optional" />
            </div>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={newUom.is_base_unit} onChange={e => setNewUom(p => ({ ...p, is_base_unit: e.target.checked }))} />
                Base Unit
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={newUom.is_integer_unit} onChange={e => setNewUom(p => ({ ...p, is_integer_unit: e.target.checked }))} />
                Integer Only (round down)
              </label>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Sort Order</label>
              <Input type="number" value={newUom.sort_order} onChange={e => setNewUom(p => ({ ...p, sort_order: parseInt(e.target.value) || 0 }))} />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={() => setShowCreateUom(false)}>ยกเลิก</Button>
              <Button onClick={handleCreateUom} disabled={creating || !newUom.code || !newUom.name_th || !newUom.name_en}>
                {creating ? 'กำลังบันทึก...' : 'บันทึก'}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── Create Conversion Modal ── */}
      {showCreateConv && (
        <Modal title="เพิ่ม Conversion Rule" onClose={() => setShowCreateConv(false)}>
          <div className="space-y-4">
            <p className="text-sm text-gray-600">กำหนดว่า 1 หน่วย = กี่หน่วยฐาน (เช่น 1 CTN = 48 PCS)</p>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">หน่วยที่ต้องการแปลง</label>
              <Select value={newConv.uom_id} onChange={e => setNewConv(p => ({ ...p, uom_id: e.target.value }))}>
                <option value="">-- เลือกหน่วย --</option>
                {nonBaseUoms.filter(u => !conversions.find(c => c.uom_id === u.id)).map(u => (
                  <option key={u.id} value={u.id}>{u.code} — {u.name_th}</option>
                ))}
              </Select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">หน่วยฐาน (Base Unit)</label>
              <Select value={newConv.base_uom_id} onChange={e => setNewConv(p => ({ ...p, base_uom_id: e.target.value }))}>
                <option value="">-- เลือกหน่วยฐาน --</option>
                {baseUoms.map(u => (
                  <option key={u.id} value={u.id}>{u.code} — {u.name_th}</option>
                ))}
              </Select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Factor (1 หน่วย = ? หน่วยฐาน)</label>
              <Input
                type="number"
                step="0.000001"
                min="0.000001"
                value={newConv.factor}
                onChange={e => setNewConv(p => ({ ...p, factor: e.target.value }))}
                placeholder="48"
              />
              {newConv.uom_id && newConv.base_uom_id && newConv.factor && (
                <p className="mt-1 text-sm text-blue-600">
                  1 {uoms.find(u => u.id === newConv.uom_id)?.code} = {newConv.factor} {uoms.find(u => u.id === newConv.base_uom_id)?.code}
                </p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
              <Input value={newConv.notes} onChange={e => setNewConv(p => ({ ...p, notes: e.target.value }))} placeholder="หมายเหตุ" />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={() => setShowCreateConv(false)}>ยกเลิก</Button>
              <Button
                onClick={handleCreateConversion}
                disabled={creatingConv || !newConv.uom_id || !newConv.base_uom_id || !newConv.factor || parseFloat(newConv.factor) <= 0}
              >
                {creatingConv ? 'กำลังบันทึก...' : 'บันทึก'}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

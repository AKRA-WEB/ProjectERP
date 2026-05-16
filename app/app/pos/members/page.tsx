'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { get, post, patch } from '@/lib/api-client';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { useSession } from 'next-auth/react';
import type { PosMember, SessionUser } from '@/types';

const CARD = 'bg-white border border-stone-200 rounded-[10px] shadow-sm overflow-hidden';

export default function MembersPage() {
  const { data: authSession } = useSession();
  const currentUser = authSession?.user as unknown as SessionUser;

  const [members, setMembers] = useState<PosMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  
  // Registration modal
  const [isRegModalOpen, setIsRegModalOpen] = useState(false);
  const [regData, setRegData] = useState({ name_th: '', phone: '', email: '' });
  const [registering, setRegistering] = useState(false);

  // Edit states
  const [editingId, setEditingId] = useState<string | null>(null);

  const fetchMembers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await get<PosMember[]>(`/api/pos/members?q=${encodeURIComponent(searchQuery)}&page=${page}`);
      setMembers(res);
    } catch (error) {
      console.error('Failed to fetch members:', error);
    } finally {
      setLoading(false);
    }
  }, [searchQuery, page]);

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      fetchMembers();
    }, 300);
    return () => clearTimeout(delayDebounceFn);
  }, [fetchMembers]);

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setRegistering(true);
    try {
      await post('/api/pos/members', regData);
      setIsRegModalOpen(false);
      setRegData({ name_th: '', phone: '', email: '' });
      fetchMembers();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Registration failed');
    } finally {
      setRegistering(false);
    }
  }

  async function updateMember(id: string, updates: Partial<PosMember>) {
    try {
      await patch(`/api/pos/members/${id}`, updates);
      fetchMembers();
    } catch {
      alert('Update failed');
    }
  }

  if (!currentUser?.permissions.includes('pos:members') && currentUser?.role !== 'admin') {
    return <div className="text-center py-24 text-stone-400">ไม่มีสิทธิ์ / Forbidden</div>;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-stone-900 tracking-tight">จัดการสมาชิก / Members</h1>
          <p className="text-sm text-stone-500 mt-1">จัดการข้อมูลสมาชิกและสิทธิพิเศษ</p>
        </div>
        <Button onClick={() => setIsRegModalOpen(true)}>
          + สมัครสมาชิก / Register
        </Button>
      </div>

      <div className={`${CARD} p-4 flex flex-col md:flex-row gap-4 items-center`}>
        <div className="relative flex-1 w-full">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400">🔍</span>
          <Input
            placeholder="ค้นหาด้วยชื่อ หรือ เบอร์โทรศัพท์..."
            className="pl-10"
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
          />
        </div>
      </div>

      <div className={`${CARD}`}>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-stone-50 border-b border-stone-200 text-[11px] font-bold text-stone-400 uppercase tracking-wider">
              <tr>
                <th className="px-6 py-4">เลขสมาชิก / No.</th>
                <th className="px-6 py-4">ชื่อ-นามสกุล / Name</th>
                <th className="px-6 py-4">เบอร์โทร / Phone</th>
                <th className="px-6 py-4">ระดับ / Tier</th>
                <th className="px-6 py-4 text-center">ส่วนลด % / Discount</th>
                <th className="px-6 py-4 text-right">คะแนน / Points</th>
                <th className="px-6 py-4 text-center">สถานะ / Status</th>
                <th className="px-6 py-4 text-right">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {loading && members.length === 0 ? (
                <tr><td colSpan={8} className="px-6 py-12 text-center"><LoadingSpinner /></td></tr>
              ) : members.length === 0 ? (
                <tr><td colSpan={8} className="px-6 py-12 text-center text-stone-400">ไม่พบข้อมูลสมาชิก</td></tr>
              ) : (
                members.map((m) => (
                  <tr key={m.id} className="hover:bg-stone-50/50 transition-colors group text-sm">
                    <td className="px-6 py-4 font-mono font-bold text-stone-600">{m.member_number}</td>
                    <td className="px-6 py-4 font-medium text-stone-900">{m.name_th}</td>
                    <td className="px-6 py-4 text-stone-600">{m.phone}</td>
                    <td className="px-6 py-4">
                      {editingId === m.id ? (
                        <select 
                          className="bg-white border border-stone-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                          value={m.tier}
                          onChange={(e) => updateMember(m.id, { tier: e.target.value })}
                          onBlur={() => setEditingId(null)}
                          autoFocus
                        >
                          <option value="standard">Standard</option>
                          <option value="silver">Silver</option>
                          <option value="gold">Gold</option>
                          <option value="platinum">Platinum</option>
                        </select>
                      ) : (
                        <span 
                          onClick={() => setEditingId(m.id)}
                          className="cursor-pointer hover:underline uppercase font-bold text-stone-500 bg-stone-100 px-2 py-0.5 rounded text-[10px]"
                        >
                          {m.tier}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center">
                      {editingId === m.id ? (
                        <div className="flex items-center justify-center gap-1">
                          <input
                            type="number"
                            step="0.01"
                            className="w-16 bg-white border border-stone-200 rounded px-2 py-1 text-xs text-center focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                            defaultValue={m.discount_rate}
                            onBlur={(e) => {
                              updateMember(m.id, { discount_rate: parseFloat(e.target.value) });
                              setEditingId(null);
                            }}
                          />
                        </div>
                      ) : (
                        <span onClick={() => setEditingId(m.id)} className="cursor-pointer hover:underline font-mono text-emerald-600 font-bold">
                          {(m.discount_rate * 100).toFixed(0)}%
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right font-bold text-stone-700 font-mono">{m.point_balance.toLocaleString()}</td>
                    <td className="px-6 py-4 text-center">
                      <button onClick={() => updateMember(m.id, { is_active: !m.is_active })}>
                        <StatusBadge status={m.is_active ? 'active' : 'inactive'} />
                      </button>
                    </td>
                    <td className="px-6 py-4 text-right">
                       <Button variant="outline" size="sm" onClick={() => setEditingId(m.id)}>แก้ไข</Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        <div className="px-6 py-4 bg-stone-50/50 border-t border-stone-200 flex justify-between items-center text-xs text-stone-400">
           <span>หน้า {page}</span>
           <div className="flex gap-2">
             <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>ก่อนหน้า</Button>
             <Button variant="outline" size="sm" disabled={members.length < 20} onClick={() => setPage(p => p + 1)}>ถัดไป</Button>
           </div>
        </div>
      </div>

      {/* Registration Modal */}
      <Modal isOpen={isRegModalOpen} onClose={() => setIsRegModalOpen(false)} title="สมัครสมาชิกใหม่ / Register Member">
        <form onSubmit={handleRegister} className="space-y-4 pt-2">
          <Input
            label="ชื่อ-นามสกุล (ไทย) / Name TH"
            placeholder="เช่น สมชาย ใจดี"
            required
            value={regData.name_th}
            onChange={(e) => setRegData({ ...regData, name_th: e.target.value })}
          />
          <Input
            label="เบอร์โทรศัพท์ / Phone"
            placeholder="0812345678"
            required
            value={regData.phone}
            onChange={(e) => setRegData({ ...regData, phone: e.target.value })}
          />
          <Input
            label="อีเมล / Email (Optional)"
            placeholder="somchai@example.com"
            type="email"
            value={regData.email}
            onChange={(e) => setRegData({ ...regData, email: e.target.value })}
          />
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" type="button" onClick={() => setIsRegModalOpen(false)}>ยกเลิก</Button>
            <Button type="submit" loading={registering}>ลงทะเบียน</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

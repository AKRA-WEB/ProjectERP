'use client';

import { useState, useEffect } from 'react';
import { get, patch } from '@/lib/api-client';
import type { Account } from '@/types';
import { Button } from '@/components/ui';
import { useRouter } from 'next/navigation';

const CARD = 'bg-white border border-stone-200 rounded-[10px] shadow-sm overflow-hidden';

export default function PayrollSettingsPage() {
  const router = useRouter();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    salary_expense_account_id: '',
    sso_expense_account_id: '',
    salary_payable_account_id: '',
    sso_payable_account_id: '',
    tax_payable_account_id: '',
  });

  useEffect(() => {
    async function init() {
      setLoading(true);
      try {
        const [accs, settings] = await Promise.all([
          get<Account[]>('/api/accounting/accounts'),
          get<{ salary_expense_account_id?: string; sso_expense_account_id?: string; salary_payable_account_id?: string; sso_payable_account_id?: string; tax_payable_account_id?: string }>('/api/hr/payroll-accounts'),
        ]);
        setAccounts(accs);
        if (settings.salary_expense_account_id) {
          setForm({
            salary_expense_account_id: settings.salary_expense_account_id || '',
            sso_expense_account_id: settings.sso_expense_account_id || '',
            salary_payable_account_id: settings.salary_payable_account_id || '',
            sso_payable_account_id: settings.sso_payable_account_id || '',
            tax_payable_account_id: settings.tax_payable_account_id || '',
          });
        }
      } finally { setLoading(false); }
    }
    init();
  }, []);

  async function handleSave() {
    setSaving(true);
    try {
      await patch('/api/hr/payroll-accounts', form);
      router.push('/app/hr/payroll');
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'เกิดข้อผิดพลาด');
    } finally { setSaving(false); }
  }

  if (loading) return <div className="py-12 text-center text-stone-400">กำลังโหลด...</div>;

  const AccountSelect = ({ label, value, onChange }: { label: string, value: string, onChange: (v: string) => void }) => (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-stone-700">{label}</label>
      <select
        className="h-9 px-3 rounded-md border border-stone-200 bg-white text-sm outline-none focus:ring-2 focus:ring-stone-950/10 transition-all"
        value={value}
        onChange={e => onChange(e.target.value)}
      >
        <option value="">เลือกผังบัญชี</option>
        {accounts.map(a => <option key={a.id} value={a.id}>{a.account_code} - {a.name_th}</option>)}
      </select>
    </div>
  );

  return (
    <div className="max-w-[600px] mx-auto pb-12 space-y-6">
      <div>
        <h1 className="text-[24px] font-semibold tracking-tight text-stone-950">ตั้งค่าผังบัญชี Payroll</h1>
        <p className="text-[14px] text-stone-500">กำหนดคู่บัญชีสำหรับการบันทึกรายการเงินเดือนอัตโนมัติ</p>
      </div>

      <div className={CARD}>
        <div className="p-6 space-y-6">
          <div className="space-y-4">
            <h3 className="text-[14px] font-semibold text-stone-950 border-b border-stone-100 pb-2">ฝั่งค่าใช้จ่าย (Expenses)</h3>
            <AccountSelect 
              label="บัญชีเงินเดือนและค่าแรง (Salary Expense)" 
              value={form.salary_expense_account_id} 
              onChange={v => setForm({...form, salary_expense_account_id: v})} 
            />
            <AccountSelect 
              label="บัญชีเงินสมทบประกันสังคม (SSO Expense)" 
              value={form.sso_expense_account_id} 
              onChange={v => setForm({...form, sso_expense_account_id: v})} 
            />
          </div>

          <div className="space-y-4 pt-4">
            <h3 className="text-[14px] font-semibold text-stone-950 border-b border-stone-100 pb-2">ฝั่งหนี้สิน (Payables)</h3>
            <AccountSelect 
              label="บัญชีเงินเดือนค้างจ่าย (Salary Payable)" 
              value={form.salary_payable_account_id} 
              onChange={v => setForm({...form, salary_payable_account_id: v})} 
            />
            <AccountSelect 
              label="บัญชีเงินสมทบประกันสังคมค้างจ่าย (SSO Payable)" 
              value={form.sso_payable_account_id} 
              onChange={v => setForm({...form, sso_payable_account_id: v})} 
            />
            <AccountSelect 
              label="บัญชีภาษีเงินได้ค้างจ่าย (Tax Payable)" 
              value={form.tax_payable_account_id} 
              onChange={v => setForm({...form, tax_payable_account_id: v})} 
            />
          </div>
        </div>

        <div className="px-6 py-4 border-t border-stone-100 bg-stone-50/50 flex items-center justify-end gap-3">
          <Button variant="ghost" onClick={() => router.back()}>ยกเลิก</Button>
          <Button onClick={handleSave} loading={saving}>บันทึกการตั้งค่า</Button>
        </div>
      </div>
    </div>
  );
}

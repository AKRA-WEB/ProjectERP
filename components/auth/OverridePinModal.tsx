'use client';

import { useEffect, useState } from 'react';
import { Modal, ModalHeader, ModalBody, ModalFooter, Button, Input, Select } from '@/components/ui';
import { get, post, ApiError } from '@/lib/api-client';
import { useLanguage } from '@/lib/i18n';

interface Authorizer {
  id: string;
  name_th: string;
  name_en: string;
  email: string;
  role: string;
}

interface OverridePinModalProps {
  isOpen: boolean;
  action: string;
  onSuccess: (token: string, reasonCode: string) => void;
  onClose: () => void;
}

const REASON_CODES = [
  { value: 'PRICE_MATCH', label_th: 'ปรับราคาตามคู่แข่ง (Price Match)', label_en: 'Price Match' },
  { value: 'PROMOTION', label_th: 'โปรโมชันพิเศษ (Special Promotion)', label_en: 'Special Promotion' },
  { value: 'CUSTOMER_SATISFACTION', label_th: 'เพื่อความพึงพอใจลูกค้า (Customer Satisfaction)', label_en: 'Customer Satisfaction' },
  { value: 'FEFO_VIOLATION', label_th: 'ลำดับสินค้าต่างจาก FEFO (FEFO Violation)', label_en: 'FEFO Violation' },
  { value: 'EXCESS_CREDIT', label_th: 'อนุมัติวงเงินเครดิตเกินกำหนด (Excess Credit)', label_en: 'Excess Credit' },
  { value: 'REPACK_LOSS', label_th: 'การสูญเสียจากการบรรจุใหม่ (Repack Yield Loss)', label_en: 'Repack Yield Loss' },
  { value: 'OTHER', label_th: 'เหตุผลอื่นๆ (Other)', label_en: 'Other Reason' },
];

export function OverridePinModal({ isOpen, action, onSuccess, onClose }: OverridePinModalProps) {
  const { lang } = useLanguage();
  const [authorizers, setAuthorizers] = useState<Authorizer[]>([]);
  const [selectedAuthorizerId, setSelectedAuthorizerId] = useState('');
  const [pin, setPin] = useState('');
  const [reasonCode, setReasonCode] = useState('OTHER');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // 1. Fetch active managers and admins on open
  useEffect(() => {
    if (!isOpen) return;

    // Reset fields on modal open
    setPin('');
    setErrorMsg('');
    setIsLoading(false);

    // Dynamic default reason code based on action
    if (action.includes('price') || action.includes('min_price')) {
      setReasonCode('PRICE_MATCH');
    } else if (action.includes('fefo')) {
      setReasonCode('FEFO_VIOLATION');
    } else if (action.includes('credit')) {
      setReasonCode('EXCESS_CREDIT');
    } else if (action.includes('repack') || action.includes('loss')) {
      setReasonCode('REPACK_LOSS');
    } else {
      setReasonCode('OTHER');
    }

    const loadAuthorizers = async () => {
      try {
        const data = await get<Authorizer[]>('/api/auth/active-authorizers');
        setAuthorizers(data);
        if (data.length > 0) {
          setSelectedAuthorizerId(data[0].id);
        }
      } catch (err) {
        console.error('Failed to load active authorizers', err);
        setErrorMsg(
          lang === 'th'
            ? 'โหลดรายชื่อผู้มีอำนาจอนุมัติไม่สำเร็จ'
            : 'Failed to load active authorizers'
        );
      }
    };

    loadAuthorizers();
  }, [isOpen, action, lang]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAuthorizerId) {
      setErrorMsg(lang === 'th' ? 'กรุณาเลือกผู้อนุมัติ' : 'Please select an authorizer');
      return;
    }
    if (!pin || pin.length < 4 || pin.length > 6) {
      setErrorMsg(lang === 'th' ? 'กรุณากรอกรหัส PIN 4-6 หลัก' : 'Please enter a 4-6 digit PIN');
      return;
    }

    setIsLoading(true);
    setErrorMsg('');

    try {
      // 2. Submit PIN to verification route
      const res = await post<{ token: string }>('/api/auth/verify-override-pin', {
        userId: selectedAuthorizerId,
        pin,
        action,
      });

      // 3. Resolve on success
      onSuccess(res.token, reasonCode);
    } catch (err: unknown) {
      console.error(err);
      if (err instanceof ApiError) {
        if (err.status === 429) {
          setErrorMsg(
            lang === 'th'
              ? 'ป้อนรหัสผิดเกินกำหนด บัญชีผู้อนุมัติถูกล็อกชั่วคราว 10 นาที'
              : 'Too many wrong attempts. Locked out for 10 minutes.'
          );
        } else if (err.status === 401) {
          setErrorMsg(lang === 'th' ? 'รหัส PIN ไม่ถูกต้อง' : 'Wrong PIN');
        } else {
          setErrorMsg(err.message);
        }
      } else {
        setErrorMsg(lang === 'th' ? 'เกิดข้อผิดพลาดในการตรวจสอบสิทธิ์' : 'Authorization verification failed');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    if (isLoading) return;
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} size="sm">
      <ModalHeader onClose={handleClose}>
        {lang === 'th' ? 'การอนุมัติสิทธิ์โดยผู้ดูแล' : 'Supervisor Override Authorization'}
      </ModalHeader>
      <form onSubmit={handleSubmit}>
        <ModalBody className="space-y-4">
          <div className="text-[13px] text-ink-3">
            {lang === 'th'
              ? 'การดำเนินการนี้จำเป็นต้องได้รับอนุมัติจากผู้จัดการหรือแอดมิน กรุณาเชิญผู้มีอำนาจมาลงชื่ออนุมัติ'
              : 'This action requires supervisor authorization. Please ask a manager or admin to enter their PIN.'}
          </div>

          {/* Authorizer Select */}
          <Select
            label={lang === 'th' ? 'ผู้มีอำนาจอนุมัติ (Supervisor)' : 'Authorizing Supervisor'}
            value={selectedAuthorizerId}
            onChange={(e) => setSelectedAuthorizerId(e.target.value)}
            disabled={isLoading || authorizers.length === 0}
            options={authorizers.map((a) => ({
              value: a.id,
              label: `${a.name_en} (${a.role.toUpperCase()})` + (a.name_th ? ` - ${a.name_th}` : ''),
            }))}
            placeholder={authorizers.length === 0 ? (lang === 'th' ? 'ไม่มีผู้อนุมัติว่างอยู่' : 'No authorizers available') : undefined}
          />

          {/* Reason Code Select */}
          <Select
            label={lang === 'th' ? 'เหตุผลในการอนุมัติ (Reason)' : 'Reason for Override'}
            value={reasonCode}
            onChange={(e) => setReasonCode(e.target.value)}
            disabled={isLoading}
            options={REASON_CODES.map((r) => ({
              value: r.value,
              label: lang === 'th' ? r.label_th : r.label_en,
            }))}
          />

          {/* PIN Input */}
          <Input
            label={lang === 'th' ? 'รหัส PIN ผู้อนุมัติ (4-6 หลัก)' : 'Supervisor PIN (4-6 digits)'}
            type="password"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            value={pin}
            onChange={(e) => {
              const val = e.target.value.replace(/[^0-9]/g, '');
              setPin(val);
            }}
            disabled={isLoading}
            className="text-center text-lg tracking-[0.5em] font-mono h-11"
            placeholder="••••••"
            required
            autoComplete="off"
          />

          {errorMsg && (
            <div className="p-3 text-[13px] text-danger bg-danger-light rounded-[8px] font-sans border border-danger-line leading-relaxed">
              {errorMsg}
            </div>
          )}
        </ModalBody>
        <ModalFooter>
          <Button
            type="button"
            variant="secondary"
            onClick={handleClose}
            disabled={isLoading}
          >
            {lang === 'th' ? 'ยกเลิก' : 'Cancel'}
          </Button>
          <Button
            type="submit"
            variant="primary"
            loading={isLoading}
            disabled={isLoading || authorizers.length === 0}
          >
            {lang === 'th' ? 'อนุมัติรายการ' : 'Authorize Override'}
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  );
}

import { Badge } from './Badge';

// Old → New: gray→muted, blue→info, green→ok, yellow→warn, red→danger, orange→warn, purple→purple
type BadgeVariant = 'ok' | 'warn' | 'danger' | 'info' | 'muted' | 'purple';

const STATUS_CONFIG: Record<string, { variant: BadgeVariant }> = {
  draft:               { variant: 'muted' },
  submitted:           { variant: 'info' },
  manager_approved:    { variant: 'purple' },
  admin_approved:      { variant: 'ok' },
  rejected:            { variant: 'danger' },
  converted_to_po:     { variant: 'warn' },
  sent:                { variant: 'info' },
  partially_received:  { variant: 'warn' },
  fully_received:      { variant: 'ok' },
  invoiced:            { variant: 'purple' },
  paid:                { variant: 'ok' },
  closed:              { variant: 'muted' },
  cancelled:           { variant: 'danger' },
  received:            { variant: 'info' },
  verified:            { variant: 'ok' },
  receiving:           { variant: 'warn' },
  pending_verification:{ variant: 'warn' },
  qc_pending:          { variant: 'warn' },
  qc_passed:           { variant: 'ok' },
  qc_failed:           { variant: 'danger' },
  stocked:             { variant: 'ok' },
  pending:             { variant: 'warn' },
  completed:           { variant: 'ok' },
  open:                { variant: 'info' },
  in_review:           { variant: 'warn' },
  resolved:            { variant: 'ok' },
  approved:            { variant: 'ok' },
  counting:            { variant: 'info' },
  pending_approval:    { variant: 'warn' },
  // HR statuses
  active:              { variant: 'ok' },
  inactive:            { variant: 'muted' },
  resigned:            { variant: 'muted' },
  processing:          { variant: 'info' },
  void:                { variant: 'danger' },
};

const LABEL_TH: Record<string, string> = {
  draft: 'ร่าง',
  submitted: 'ส่งแล้ว',
  manager_approved: 'ผู้จัดการอนุมัติ',
  admin_approved: 'แอดมินอนุมัติ',
  rejected: 'ถูกปฏิเสธ',
  converted_to_po: 'แปลงเป็น PO',
  sent: 'ส่งแล้ว',
  partially_received: 'รับบางส่วน',
  fully_received: 'รับครบ',
  invoiced: 'ออกใบแจ้งหนี้',
  paid: 'ชำระแล้ว',
  closed: 'ปิดแล้ว',
  cancelled: 'ยกเลิก',
  received: 'รับแล้ว',
  verified: 'ตรวจสอบแล้ว',
  receiving: 'กำลังรับ',
  pending_verification: 'รอตรวจสอบ',
  qc_pending: 'รอ QC',
  qc_passed: 'ผ่าน QC',
  qc_failed: 'ไม่ผ่าน QC',
  stocked: 'เข้าสต็อกแล้ว',
  pending: 'รอดำเนินการ',
  completed: 'เสร็จสิ้น',
  open: 'เปิด',
  in_review: 'กำลังพิจารณา',
  resolved: 'แก้ไขแล้ว',
  approved: 'อนุมัติแล้ว',
  counting: 'กำลังนับ',
  pending_approval: 'รออนุมัติ',
  active: 'ปกติ (Active)',
  inactive: 'ระงับ (Inactive)',
  resigned: 'ลาออก (Resigned)',
  processing: 'กำลังดำเนินการ',
  void: 'ยกเลิก (Void)',
};

interface StatusBadgeProps {
  status: string;
  labelOverride?: string;
}

export function StatusBadge({ status, labelOverride }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status] ?? { variant: 'muted' as BadgeVariant };
  return (
    <Badge variant={config.variant}>
      {labelOverride ?? LABEL_TH[status] ?? status.replace(/_/g, ' ')}
    </Badge>
  );
}


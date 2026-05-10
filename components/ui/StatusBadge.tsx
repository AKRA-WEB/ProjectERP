import { Badge } from './Badge';

type BadgeVariant = 'gray' | 'blue' | 'green' | 'yellow' | 'red' | 'purple' | 'orange';

const STATUS_CONFIG: Record<string, { variant: BadgeVariant }> = {
  draft: { variant: 'gray' },
  submitted: { variant: 'blue' },
  manager_approved: { variant: 'purple' },
  admin_approved: { variant: 'green' },
  rejected: { variant: 'red' },
  converted_to_po: { variant: 'orange' },
  sent: { variant: 'blue' },
  partially_received: { variant: 'yellow' },
  fully_received: { variant: 'green' },
  invoiced: { variant: 'purple' },
  paid: { variant: 'green' },
  closed: { variant: 'gray' },
  cancelled: { variant: 'red' },
  received: { variant: 'blue' },
  verified: { variant: 'green' },
  receiving: { variant: 'yellow' },
  pending_verification: { variant: 'orange' },
  qc_pending: { variant: 'yellow' },
  qc_passed: { variant: 'green' },
  qc_failed: { variant: 'red' },
  stocked: { variant: 'green' },
  pending: { variant: 'yellow' },
  completed: { variant: 'green' },
  open: { variant: 'blue' },
  in_review: { variant: 'yellow' },
  resolved: { variant: 'green' },
  approved: { variant: 'green' },
  counting: { variant: 'blue' },
  pending_approval: { variant: 'yellow' },
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
};

interface StatusBadgeProps {
  status: string;
  labelOverride?: string;
}

export function StatusBadge({ status, labelOverride }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status] ?? { variant: 'gray' as BadgeVariant };
  return (
    <Badge variant={config.variant}>
      {labelOverride ?? LABEL_TH[status] ?? status.replace(/_/g, ' ')}
    </Badge>
  );
}

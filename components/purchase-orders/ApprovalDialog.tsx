import { Modal, ModalHeader, ModalBody, ModalFooter, Button } from '@/components/ui';
import { formatCurrency } from '@/lib/format';

interface LineItem {
  product_id: string;
  sku: string;
  name_th: string;
  qty_ordered: number;
  unit_price: number;
  line_discount: number;
}

interface ApprovalDialogProps {
  open: boolean;
  onClose: () => void;
  vendorName: string;
  lines: LineItem[];
  summary: {
    subtotal: number;
    totalLineDiscount: number;
    afterLineDiscount: number;
    billDiscount: number;
    nonVatAmount: number;
    preVat: number;
    vat: number;
    netTotal: number;
  };
  onConfirm: () => Promise<void>;
  loading?: boolean;
}

export function ApprovalDialog({
  open,
  onClose,
  vendorName,
  lines,
  summary,
  onConfirm,
  loading = false,
}: ApprovalDialogProps) {
  return (
    <Modal open={open} onClose={onClose}>
      <ModalHeader onClose={onClose}>ยืนยันการอนุมัติและรับเข้าคลังทันที</ModalHeader>
      <ModalBody>
        <div className="space-y-6">
          <div>
            <p className="text-sm text-gray-500 mb-1">ผู้จำหน่าย</p>
            <p className="font-semibold text-gray-900">{vendorName}</p>
          </div>

          <div className="border rounded-lg overflow-hidden max-h-60 overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="text-left p-2 font-medium text-gray-600">สินค้า</th>
                  <th className="text-right p-2 font-medium text-gray-600">จำนวน</th>
                  <th className="text-right p-2 font-medium text-gray-600">ราคา/หน่วย</th>
                  <th className="text-right p-2 font-medium text-gray-600">ส่วนลด</th>
                  <th className="text-right p-2 font-medium text-gray-600">รวม</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l, i) => (
                  <tr key={i} className="border-t">
                    <td className="p-2">
                      <div className="font-mono font-medium">{l.sku}</div>
                      <div className="text-gray-500 truncate max-w-[150px]">{l.name_th}</div>
                    </td>
                    <td className="p-2 text-right font-mono">{l.qty_ordered}</td>
                    <td className="p-2 text-right">{formatCurrency(l.unit_price)}</td>
                    <td className="p-2 text-right text-red-600">-{formatCurrency(l.line_discount)}</td>
                    <td className="p-2 text-right font-medium">
                      {formatCurrency(l.qty_ordered * l.unit_price - l.line_discount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">ยอดรวมสินค้า (ก่อนหัก):</span>
              <span className="font-mono">{formatCurrency(summary.subtotal)}</span>
            </div>
            {summary.totalLineDiscount > 0 && (
              <div className="flex justify-between text-red-600">
                <span>ส่วนลดรวมรายการ:</span>
                <span className="font-mono">-{formatCurrency(summary.totalLineDiscount)}</span>
              </div>
            )}
            {summary.billDiscount > 0 && (
              <div className="flex justify-between text-red-600">
                <span>ส่วนลดท้ายบิล:</span>
                <span className="font-mono">-{formatCurrency(summary.billDiscount)}</span>
              </div>
            )}
            {summary.nonVatAmount > 0 && (
              <div className="flex justify-between">
                <span className="text-gray-500">ยอดไม่เสียภาษี:</span>
                <span className="font-mono">{formatCurrency(summary.nonVatAmount)}</span>
              </div>
            )}
            <div className="flex justify-between font-medium pt-2 border-t">
              <span>ยอดก่อนภาษี:</span>
              <span className="font-mono">{formatCurrency(summary.preVat)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">ภาษีมูลค่าเพิ่ม (7%):</span>
              <span className="font-mono">{formatCurrency(summary.vat)}</span>
            </div>
            <div className="flex justify-between text-lg font-bold text-blue-700 pt-1">
              <span>ยอดสุทธิ:</span>
              <span className="font-mono">{formatCurrency(summary.netTotal)}</span>
            </div>
          </div>

          <p className="text-xs text-amber-600 bg-amber-50 p-3 rounded border border-amber-100">
            * การอนุมัตินี้จะสร้างใบรับสินค้า (GRN) และเพิ่มสต็อกเข้าคลังทันที ไม่สามารถแก้ไขย้อนหลังได้
          </p>
        </div>
      </ModalBody>
      <ModalFooter>
        <div className="flex gap-3 justify-end">
          <Button variant="secondary" onClick={onClose} disabled={loading}>ยกเลิก</Button>
          <Button onClick={onConfirm} loading={loading}>ยืนยันการอนุมัติ</Button>
        </div>
      </ModalFooter>
    </Modal>
  );
}

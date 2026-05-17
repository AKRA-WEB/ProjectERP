'use client';

import { useState, useRef } from 'react';
import { Modal, ModalBody, ModalFooter } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { importProducts, type ImportResult } from '@/lib/api-client';
import { 
  FileSpreadsheet, 
  Upload, 
  CheckCircle2, 
  AlertCircle, 
  XCircle,
  FileX
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ProductImportModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

type Status = 'idle' | 'uploading' | 'result' | 'error';

export default function ProductImportModal({ open, onClose, onSuccess }: ProductImportModalProps) {
  const [status, setStatus] = useState<Status>('idle');
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setStatus('idle');
    setFile(null);
    setResult(null);
    setError(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.name.endsWith('.xlsx')) {
        setFile(selectedFile);
        setError(null);
      } else {
        setError('กรุณาเลือกไฟล์ .xlsx เท่านั้น');
        setFile(null);
      }
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setStatus('uploading');
    try {
      const data = await importProducts(file);
      setResult(data);
      setStatus('result');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการนำเข้าข้อมูล';
      setError(message);
      setStatus('error');
    }
  };

  const handleClose = () => {
    if (status === 'uploading') return;
    if (status === 'result' && result && (result.inserted > 0 || result.updated > 0)) {
      onSuccess();
    } else {
      onClose();
    }
    reset();
  };

  return (
    <Modal open={open} onClose={handleClose} title="นำเข้าสินค้าจาก Excel" size={status === 'result' && (result?.errors?.length ?? 0) > 0 ? 'lg' : 'md'}>
      <ModalBody>
        {status === 'idle' && (
          <div className="flex flex-col items-center justify-center py-8 gap-4">
            <div 
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                "w-full h-40 border-2 border-dashed rounded-xl flex flex-col items-center justify-center cursor-pointer transition-colors",
                file ? "border-primary bg-primary/5" : "border-line-soft hover:border-primary hover:bg-surface-soft"
              )}
            >
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileChange} 
                accept=".xlsx" 
                className="hidden" 
              />
              {file ? (
                <>
                  <FileSpreadsheet className="w-12 h-12 text-primary mb-2" />
                  <p className="text-ink font-medium">{file.name}</p>
                  <p className="text-ink-3 text-sm">{(file.size / 1024).toFixed(1)} KB</p>
                </>
              ) : (
                <>
                  <Upload className="w-12 h-12 text-ink-3 mb-2" />
                  <p className="text-ink-2">คลิกเพื่อเลือกไฟล์ .xlsx</p>
                  <p className="text-ink-3 text-sm">ตัวอย่าง: export_product_all.xlsx</p>
                </>
              )}
            </div>
            {error && (
              <div className="flex items-center gap-2 text-red-600 text-sm">
                <AlertCircle className="w-4 h-4" />
                <span>{error}</span>
              </div>
            )}
            <div className="w-full bg-surface-sunken p-4 rounded-lg text-sm text-ink-2">
              <p className="font-semibold mb-2">คำแนะนำ:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>ใช้ไฟล์ที่ส่งออกจากระบบ POS โดยตรง</li>
                <li>ระบบจะอัปเดตข้อมูลหากพบรหัสสินค้า (Product code) เดิม</li>
                <li>สินค้าใหม่ที่มีจำนวนสต็อกจะถูกนำเข้าคลังสินค้าหลักอัตโนมัติ</li>
              </ul>
            </div>
          </div>
        )}

        {status === 'uploading' && (
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <LoadingSpinner size="lg" />
            <p className="text-ink font-medium animate-pulse">กำลังนำเข้าข้อมูล...</p>
            <p className="text-ink-3 text-sm">กรุณาอย่าปิดหน้าต่างนี้จนกว่าจะเสร็จสิ้น</p>
          </div>
        )}

        {status === 'result' && result && (
          <div className="space-y-6">
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-green-50 border border-green-100 p-4 rounded-xl flex flex-col items-center">
                <CheckCircle2 className="w-8 h-8 text-green-600 mb-2" />
                <span className="text-2xl font-bold text-green-700">{result.inserted}</span>
                <span className="text-sm text-green-600 font-medium">เพิ่มใหม่</span>
              </div>
              <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl flex flex-col items-center">
                <Upload className="w-8 h-8 text-blue-600 mb-2" />
                <span className="text-2xl font-bold text-blue-700">{result.updated}</span>
                <span className="text-sm text-blue-600 font-medium">อัปเดต</span>
              </div>
              <div className="bg-red-50 border border-red-100 p-4 rounded-xl flex flex-col items-center">
                <XCircle className="w-8 h-8 text-red-600 mb-2" />
                <span className="text-2xl font-bold text-red-700">{result.failed}</span>
                <span className="text-sm text-red-600 font-medium">ล้มเหลว</span>
              </div>
            </div>

            {result.errors.length > 0 && (
              <div className="border rounded-xl overflow-hidden">
                <div className="bg-surface-soft px-4 py-2 border-b">
                  <span className="text-sm font-semibold text-ink">รายการที่ผิดพลาด ({result.errors.length})</span>
                </div>
                <div className="max-h-[300px] overflow-y-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-surface-sunken sticky top-0">
                      <tr>
                        <th className="px-4 py-2 font-medium text-ink-3">แถว</th>
                        <th className="px-4 py-2 font-medium text-ink-3">SKU</th>
                        <th className="px-4 py-2 font-medium text-ink-3">สาเหตุ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {result.errors.map((err, idx) => (
                        <tr key={idx} className="hover:bg-surface-soft">
                          <td className="px-4 py-2 text-ink-2">{err.row}</td>
                          <td className="px-4 py-2 font-mono text-ink-2">{err.sku}</td>
                          <td className="px-4 py-2 text-red-600">{err.reason}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {status === 'error' && (
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <FileX className="w-16 h-16 text-red-500 mb-2" />
            <h3 className="text-lg font-bold text-ink">การนำเข้าล้มเหลว</h3>
            <p className="text-red-600 text-center px-8">{error}</p>
          </div>
        )}
      </ModalBody>

      <ModalFooter>
        {status === 'idle' && (
          <>
            <Button variant="ghost" onClick={handleClose}>ยกเลิก</Button>
            <Button 
              disabled={!file} 
              onClick={handleUpload}
            >
              เริ่มนำเข้าข้อมูล
            </Button>
          </>
        )}
        {status === 'result' && (
          <Button onClick={handleClose}>
            {result && (result.inserted > 0 || result.updated > 0) ? 'เสร็จสิ้น' : 'ปิด'}
          </Button>
        )}
        {status === 'error' && (
          <Button onClick={reset}>ลองใหม่อีกครั้ง</Button>
        )}
      </ModalFooter>
    </Modal>
  );
}

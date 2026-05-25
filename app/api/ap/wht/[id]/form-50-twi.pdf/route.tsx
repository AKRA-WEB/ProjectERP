import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { queryOne } from '@/lib/db/client';
import { apiError } from '@/lib/api-response';
import { renderToBuffer, Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer';
import React from 'react';

// Register Thai Sarabun font from Google Fonts CDN
Font.register({
  family: 'Sarabun',
  fonts: [
    { src: 'https://fonts.gstatic.com/s/sarabun/v12/8Uz0WVy6eP2z759WEY32-w.ttf', fontWeight: 'normal' },
    { src: 'https://fonts.gstatic.com/s/sarabun/v12/8Uz1WVy6eP2z759WEC4S-6pq.ttf', fontWeight: 'bold' }
  ]
});

const styles = StyleSheet.create({
  page: {
    padding: 30,
    fontFamily: 'Sarabun',
    fontSize: 9,
    color: '#1c1917',
    backgroundColor: '#ffffff',
  },
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  headerLeft: {
    flexDirection: 'column',
  },
  mainTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  subTitle: {
    fontSize: 9,
    color: '#475569',
    marginTop: 2,
  },
  docNoBox: {
    border: '1px solid #cbd5e1',
    borderRadius: 4,
    padding: 6,
    minWidth: 140,
    alignItems: 'center',
    justifyContent: 'center',
  },
  docNoLabel: {
    fontSize: 8,
    color: '#64748b',
    textTransform: 'uppercase',
  },
  docNoValue: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#0f172a',
    marginTop: 2,
    fontFamily: 'Helvetica',
  },
  sectionBox: {
    border: '1px solid #cbd5e1',
    borderRadius: 6,
    padding: 10,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#0f172a',
    borderBottom: '1px solid #e2e8f0',
    paddingBottom: 4,
    marginBottom: 6,
  },
  gridRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  gridColLabel: {
    width: 120,
    color: '#64748b',
  },
  gridColVal: {
    flex: 1,
    fontWeight: 'bold',
    color: '#334155',
  },
  table: {
    marginTop: 10,
    border: '1px solid #cbd5e1',
    borderRadius: 6,
    overflow: 'hidden',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f8fafc',
    borderBottom: '1px solid #cbd5e1',
    paddingVertical: 6,
    fontWeight: 'bold',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottom: '1px solid #e2e8f0',
    paddingVertical: 8,
    alignItems: 'center',
  },
  colDesc: { flex: 2, paddingLeft: 8 },
  colDate: { width: 90, textAlign: 'center' },
  colRate: { width: 60, textAlign: 'center' },
  colAmount: { width: 100, textAlign: 'right', paddingRight: 8 },
  colTax: { width: 100, textAlign: 'right', paddingRight: 8 },
  summaryRow: {
    flexDirection: 'row',
    paddingVertical: 8,
    backgroundColor: '#f8fafc',
    fontWeight: 'bold',
  },
  colSummaryLabel: {
    flex: 2,
    textAlign: 'right',
    paddingRight: 12,
  },
  footerContainer: {
    flexDirection: 'row',
    marginTop: 20,
    justifyContent: 'space-between',
  },
  footerLeft: {
    width: '55%',
  },
  footerRight: {
    width: '40%',
    border: '1px solid #cbd5e1',
    borderRadius: 6,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
  },
  signLine: {
    width: 140,
    borderBottom: '1px dashed #94a3b8',
    marginTop: 25,
    marginBottom: 4,
  },
});

export async function GET(
  _: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);

  const { id } = await params;

  // Retrieve WHT Certificate and linked Details
  const certificate = await queryOne<{
    id: string;
    doc_no: string;
    wht_rate: string;
    wht_amount: string;
    issued_at: string;
    vendor_name_th: string;
    vendor_name_en: string;
    vendor_tax_id: string | null;
    vendor_address_th: string | null;
    payment_number: string;
    payment_total_amount: string;
    payment_date: string;
    issued_by_name: string | null;
  }>(
    `SELECT wc.*, 
            v.name_th AS vendor_name_th, 
            v.name_en AS vendor_name_en, 
            v.tax_id AS vendor_tax_id,
            v.address_th AS vendor_address_th,
            p.payment_number,
            p.total_amount AS payment_total_amount,
            p.payment_date,
            u.name_en AS issued_by_name
     FROM wht_certificates wc
     JOIN vendors v ON v.id = wc.vendor_id
     JOIN ap_payments p ON p.id = wc.payment_id
     LEFT JOIN users u ON u.id = wc.issued_by
     WHERE wc.id = $1`,
    [id]
  );

  if (!certificate) return apiError('Withholding tax certificate not found', 404);

  // Helper to format date into Thai Buddhist Era (e.g. 25 พ.ค. 2569 or 25/05/2569)
  const formatThaiDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear() + 543; // convert to BE
    return `${day}/${month}/${year}`;
  };

  const WhtDoc = () => (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header Section */}
        <View style={styles.headerContainer}>
          <View style={styles.headerLeft}>
            <Text style={styles.mainTitle}>หนังสือรับรองการหักภาษี ณ ที่จ่าย (Form 50 Twi)</Text>
            <Text style={styles.subTitle}>ตามมาตรา 50 ทวิ แห่งประมวลรัษฎากร / Under Section 50 Twi of Revenue Code</Text>
          </View>
          <View style={styles.docNoBox}>
            <Text style={styles.docNoLabel}>เลขที่เอกสาร / Doc No.</Text>
            <Text style={styles.docNoValue}>{certificate.doc_no}</Text>
          </View>
        </View>

        {/* Section 1: Payer Details */}
        <View style={styles.sectionBox}>
          <Text style={styles.sectionTitle}>1. ผู้มีหน้าที่หักภาษี ณ ที่จ่าย (Payer of Income)</Text>
          <View style={styles.gridRow}>
            <Text style={styles.gridColLabel}>เลขประจำตัวผู้เสียภาษี:</Text>
            <Text style={styles.gridColVal}>0105562000123</Text>
          </View>
          <View style={styles.gridRow}>
            <Text style={styles.gridColLabel}>ชื่อบริษัท:</Text>
            <Text style={styles.gridColVal}>บริษัท อัครพาณิชย์ จำกัด (AKRA Panich Co., Ltd.)</Text>
          </View>
          <View style={styles.gridRow}>
            <Text style={styles.gridColLabel}>ที่ตั้ง:</Text>
            <Text style={styles.gridColVal}>123 ถนนสุขุมวิท แขวงคลองเตย เขตคลองเตย กรุงเทพมหานคร 10110</Text>
          </View>
        </View>

        {/* Section 2: Payee Details */}
        <View style={styles.sectionBox}>
          <Text style={styles.sectionTitle}>2. ผู้ถูกหักภาษี ณ ที่จ่าย (Payee / Vendor)</Text>
          <View style={styles.gridRow}>
            <Text style={styles.gridColLabel}>เลขประจำตัวผู้เสียภาษี:</Text>
            <Text style={[styles.gridColVal, { fontFamily: 'Helvetica' }]}>{certificate.vendor_tax_id || '—'}</Text>
          </View>
          <View style={styles.gridRow}>
            <Text style={styles.gridColLabel}>ชื่อผู้รับเงิน / บริษัท:</Text>
            <Text style={styles.gridColVal}>{certificate.vendor_name_th} {certificate.vendor_name_en ? `(${certificate.vendor_name_en})` : ''}</Text>
          </View>
          <View style={styles.gridRow}>
            <Text style={styles.gridColLabel}>ที่อยู่:</Text>
            <Text style={styles.gridColVal}>{certificate.vendor_address_th || '—'}</Text>
          </View>
        </View>

        {/* Section 3: Income Table */}
        <View style={styles.table}>
          {/* Header */}
          <View style={styles.tableHeader}>
            <Text style={styles.colDesc}>ประเภทเงินได้พึงประเมิน / Type of Income</Text>
            <Text style={styles.colDate}>วันจ่าย / Date</Text>
            <Text style={styles.colRate}>อัตรา / Rate</Text>
            <Text style={styles.colAmount}>จำนวนเงินที่จ่าย / Gross</Text>
            <Text style={styles.colTax}>ภาษีที่หักไว้ / Tax Withheld</Text>
          </View>

          {/* Row */}
          <View style={styles.tableRow}>
            <Text style={styles.colDesc}>ค่าบริการ / Services (Section 40(8))</Text>
            <Text style={[styles.colDate, { fontFamily: 'Helvetica' }]}>{formatThaiDate(certificate.payment_date)}</Text>
            <Text style={[styles.colRate, { fontFamily: 'Helvetica' }]}>{Number(certificate.wht_rate).toFixed(2)}%</Text>
            <Text style={[styles.colAmount, { fontFamily: 'Helvetica' }]}>{Number(certificate.payment_total_amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
            <Text style={[styles.colTax, { fontFamily: 'Helvetica' }]}>{Number(certificate.wht_amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
          </View>

          {/* Summary Row */}
          <View style={styles.summaryRow}>
            <Text style={styles.colSummaryLabel}>รวมทั้งสิ้น / Total</Text>
            <Text style={styles.colRate}></Text>
            <Text style={[styles.colAmount, { fontFamily: 'Helvetica' }]}>{Number(certificate.payment_total_amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
            <Text style={[styles.colTax, { fontFamily: 'Helvetica' }]}>{Number(certificate.wht_amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
          </View>
        </View>

        {/* Section 4: Bottom Notes & Signatures */}
        <View style={styles.footerContainer}>
          <View style={styles.footerLeft}>
            <Text style={{ fontWeight: 'bold', marginBottom: 4 }}>คำเตือน / Warning:</Text>
            <Text style={{ color: '#64748b', fontSize: 8, lineHeight: 1.3 }}>
              ผู้มีหน้าที่ออกหนังสือรับรองการหักภาษี ณ ที่จ่าย หากฝ่าฝืนไม่จัดทำหรือไม่มอบหนังสือรับรองการหักภาษี ณ ที่จ่าย ให้แก่ผู้ถูกหักภาษี ณ ที่จ่าย ตามเวลาที่กฎหมายกำหนด ต้องระวางโทษปรับไม่เกิน 2,000 บาท
            </Text>
            <Text style={{ color: '#475569', fontSize: 8.5, marginTop: 10 }}>
              • อ้างอิงจากเลขที่ใบสำคัญชำระเงิน (AP Payment No): {certificate.payment_number}
            </Text>
            <Text style={{ color: '#475569', fontSize: 8.5, marginTop: 2 }}>
              • วันที่ออกหนังสือรับรอง: {formatThaiDate(certificate.issued_at)}
            </Text>
          </View>
          <View style={styles.footerRight}>
            <Text style={{ fontSize: 8.5, color: '#475569' }}>ลงชื่อผู้มีหน้าที่หักภาษี ณ ที่จ่าย</Text>
            <View style={styles.signLine} />
            <Text style={{ fontWeight: 'bold', fontSize: 9 }}>({certificate.issued_by_name || 'ผู้รับมอบอำนาจ'})</Text>
            <Text style={{ fontSize: 7.5, color: '#64748b', marginTop: 4 }}>ตำแหน่ง: ผู้มีอำนาจลงนาม / Authorized Signatory</Text>
          </View>
        </View>
      </Page>
    </Document>
  );

  const buffer = await renderToBuffer(<WhtDoc />);
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="WHT-Form50-${certificate.doc_no}.pdf"`,
    },
  });
}

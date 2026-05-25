import { auth } from '@/auth';
import { apiSuccess, apiError } from '@/lib/api-response';
import { queryOne } from '@/lib/db/client';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);

  const { id } = await params;
  const certificate = await queryOne(
    `SELECT wc.*, 
            v.name_th AS vendor_name_th, 
            v.name_en AS vendor_name_en, 
            v.code AS vendor_code,
            v.tax_id AS vendor_tax_id,
            v.address_th AS vendor_address_th,
            p.payment_number,
            p.total_amount AS payment_total_amount,
            u.name_en AS issued_by_name
     FROM wht_certificates wc
     JOIN vendors v ON v.id = wc.vendor_id
     JOIN ap_payments p ON p.id = wc.payment_id
     LEFT JOIN users u ON u.id = wc.issued_by
     WHERE wc.id = $1`,
    [id]
  );
  
  if (!certificate) return apiError('Withholding tax certificate not found', 404);

  return apiSuccess(certificate);
}

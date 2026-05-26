import { NextRequest } from 'next/server';
import { auth } from '@/auth';
import { SessionUser } from '@/types';
import { apiSuccess, apiError } from '@/lib/api-response';
import { query } from '@/lib/db/client';
import { runRebateAccrualJob } from '@/lib/jobs/rebate-accruals';

interface JoinedAccrual {
  id: string;
  vendor_id: string;
  vendor_code: string;
  vendor_name_th: string;
  vendor_name_en: string;
  contract_id: string;
  period_label: string;
  eligible_purchases: number | string;
  accrued_rebate: number | string;
  status: 'pending' | 'accrued' | 'realised' | 'expired';
  posted_je_id: string | null;
  threshold_amount: number | string;
  rebate_rate: number | string;
  period: 'monthly' | 'quarterly' | 'annual';
  created_at: string;
  total_count?: string;
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return apiError('Unauthorized', 401);

  const { searchParams } = new URL(req.url);
  const vendorId = searchParams.get('vendor_id') || null;
  const status = searchParams.get('status') || null;
  const page = parseInt(searchParams.get('page') ?? '1');
  const pageSize = parseInt(searchParams.get('pageSize') ?? '20');
  const offset = (page - 1) * pageSize;

  try {
    const conditions: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (vendorId) {
      conditions.push(`a.vendor_id = $${idx}`);
      params.push(vendorId);
      idx++;
    }

    if (status) {
      conditions.push(`a.status = $${idx}`);
      params.push(status);
      idx++;
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const rows = await query<JoinedAccrual>(
      `SELECT a.*, 
              v.code AS vendor_code, 
              v.name_th AS vendor_name_th, 
              v.name_en AS vendor_name_en,
              c.threshold_amount,
              c.rebate_rate,
              c.period,
              COUNT(*) OVER() as total_count
       FROM vendor_rebate_accruals a
       LEFT JOIN vendors v ON a.vendor_id = v.id
       LEFT JOIN vendor_rebate_contracts c ON a.contract_id = c.id
       ${where}
       ORDER BY a.period_label DESC, v.code ASC
       LIMIT $${idx} OFFSET $${idx + 1}`,
      [...params, pageSize, offset]
    );

    const total = rows[0] ? parseInt(rows[0].total_count as string) : 0;
    return apiSuccess({ data: rows, total });
  } catch (err) {
    console.error('Failed to fetch rebate accruals:', err);
    return apiError('Failed to fetch rebate accruals', 500);
  }
}

// POST: Run recalculation sweep on-demand
export async function POST() {
  const session = await auth();
  if (!session) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;

  // Assert admin or manager role
  if (u.role !== 'admin' && u.role !== 'manager') {
    return apiError('Forbidden', 403);
  }

  try {
    const result = await runRebateAccrualJob();
    return apiSuccess({
      message: 'Rebate accrual recalculation job completed successfully',
      processedCount: result.processedCount
    });
  } catch (err) {
    console.error('Rebate accrual calculation job failed:', err);
    return apiError('Rebate accrual calculation job failed', 500);
  }
}

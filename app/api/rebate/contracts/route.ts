import { NextRequest } from 'next/server';
import { auth } from '@/auth';
import { SessionUser, VendorRebateContract } from '@/types';
import { apiSuccess, apiError, apiValidationError } from '@/lib/api-response';
import { query, queryOne } from '@/lib/db/client';
import { z } from 'zod';

const CreateContractSchema = z.object({
  vendor_id: z.string().uuid(),
  threshold_amount: z.number().positive(),
  rebate_rate: z.number().positive().max(100),
  period: z.enum(['monthly', 'quarterly', 'annual']),
  valid_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  valid_to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
}).refine(data => new Date(data.valid_to) >= new Date(data.valid_from), {
  message: 'valid_to must be equal or after valid_from',
  path: ['valid_to']
});

interface JoinedContract {
  id: string;
  vendor_id: string;
  vendor_code: string;
  vendor_name_th: string;
  vendor_name_en: string;
  threshold_amount: number | string;
  rebate_rate: number | string;
  period: 'monthly' | 'quarterly' | 'annual';
  valid_from: string;
  valid_to: string;
  created_at: string;
  total_count?: string;
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return apiError('Unauthorized', 401);

  const { searchParams } = new URL(req.url);
  const vendorId = searchParams.get('vendor_id') || null;
  const page = parseInt(searchParams.get('page') ?? '1');
  const pageSize = parseInt(searchParams.get('pageSize') ?? '20');
  const offset = (page - 1) * pageSize;

  try {
    const conditions: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (vendorId) {
      conditions.push(`c.vendor_id = $${idx}`);
      params.push(vendorId);
      idx++;
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const rows = await query<JoinedContract>(
      `SELECT c.*, v.code AS vendor_code, v.name_th AS vendor_name_th, v.name_en AS vendor_name_en, COUNT(*) OVER() as total_count
       FROM vendor_rebate_contracts c
       LEFT JOIN vendors v ON c.vendor_id = v.id
       ${where}
       ORDER BY c.created_at DESC
       LIMIT $${idx} OFFSET $${idx + 1}`,
      [...params, pageSize, offset]
    );

    const total = rows[0] ? parseInt(rows[0].total_count as string) : 0;
    return apiSuccess({ data: rows, total });
  } catch (err) {
    console.error('Failed to fetch rebate contracts:', err);
    return apiError('Failed to fetch rebate contracts', 500);
  }
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;

  // Assert admin or manager role
  if (u.role !== 'admin' && u.role !== 'manager') {
    return apiError('Forbidden', 403);
  }

  try {
    const body = await req.json();
    const parsed = CreateContractSchema.safeParse(body);
    if (!parsed.success) {
      return apiValidationError(parsed.error);
    }

    const { vendor_id, threshold_amount, rebate_rate, period, valid_from, valid_to } = parsed.data;

    // Verify vendor exists
    const vendorExists = await queryOne(
      `SELECT id FROM vendors WHERE id = $1`,
      [vendor_id]
    );
    if (!vendorExists) {
      return apiError('Vendor not found', 404);
    }

    const contract = await queryOne<VendorRebateContract>(
      `INSERT INTO vendor_rebate_contracts (vendor_id, threshold_amount, rebate_rate, period, valid_from, valid_to)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [vendor_id, threshold_amount, rebate_rate, period, valid_from, valid_to]
    );

    return apiSuccess(contract, 201);
  } catch (err) {
    console.error('Failed to create rebate contract:', err);
    return apiError('Failed to create rebate contract', 500);
  }
}

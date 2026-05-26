import { NextRequest } from 'next/server';
import { auth } from '@/auth';
import { SessionUser, VendorRebateContract } from '@/types';
import { apiSuccess, apiError, apiValidationError } from '@/lib/api-response';
import { queryOne } from '@/lib/db/client';
import { z } from 'zod';

const UpdateContractSchema = z.object({
  threshold_amount: z.number().positive().optional(),
  rebate_rate: z.number().positive().max(100).optional(),
  valid_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  valid_to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()
}).refine(data => {
  if (data.valid_from && data.valid_to) {
    return new Date(data.valid_to) >= new Date(data.valid_from);
  }
  return true;
}, {
  message: 'valid_to must be equal or after valid_from',
  path: ['valid_to']
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;

  // Assert admin or manager role
  if (u.role !== 'admin' && u.role !== 'manager') {
    return apiError('Forbidden', 403);
  }

  const { id } = await params;

  try {
    const body = await req.json();
    const parsed = UpdateContractSchema.safeParse(body);
    if (!parsed.success) {
      return apiValidationError(parsed.error);
    }

    // Verify contract exists
    const contract = await queryOne<VendorRebateContract>(
      `SELECT * FROM vendor_rebate_contracts WHERE id = $1`,
      [id]
    );
    if (!contract) {
      return apiError('Rebate contract not found', 404);
    }

    // Prepare fields to update
    const threshold_amount = parsed.data.threshold_amount ?? contract.threshold_amount;
    const rebate_rate = parsed.data.rebate_rate ?? contract.rebate_rate;
    const valid_from = parsed.data.valid_from ?? contract.valid_from;
    const valid_to = parsed.data.valid_to ?? contract.valid_to;

    // Validate dates consistency
    if (new Date(valid_to) < new Date(valid_from)) {
      return apiError('valid_to must be equal or after valid_from', 400);
    }

    const updated = await queryOne<VendorRebateContract>(
      `UPDATE vendor_rebate_contracts
       SET threshold_amount = $1, rebate_rate = $2, valid_from = $3, valid_to = $4
       WHERE id = $5
       RETURNING *`,
      [threshold_amount, rebate_rate, valid_from, valid_to, id]
    );

    return apiSuccess(updated);
  } catch (err) {
    console.error('Failed to update rebate contract:', err);
    return apiError('Failed to update rebate contract', 500);
  }
}

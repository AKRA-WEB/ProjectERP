import { NextRequest } from 'next/server';
import { auth } from '@/auth';
import { apiSuccess, apiError, apiValidationError } from '@/lib/api-response';
import { resolvePrice } from '@/lib/pricing/resolve';
import { z } from 'zod';

const resolveQuerySchema = z.object({
  channel: z.enum(['TRD', 'AKRA']),
  customer_id: z.string().uuid().nullable().optional().or(z.literal('')).transform(val => val || null),
  product_id: z.string().uuid(),
  qty: z.preprocess((val) => Number(val), z.number().positive()),
  at_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal('')).transform(val => val || undefined),
});

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  
  const { searchParams } = new URL(req.url);
  const rawParams = {
    channel: searchParams.get('channel'),
    customer_id: searchParams.get('customer_id'),
    product_id: searchParams.get('product_id'),
    qty: searchParams.get('qty'),
    at_date: searchParams.get('at_date'),
  };

  const parsed = resolveQuerySchema.safeParse(rawParams);
  if (!parsed.success) {
    return apiValidationError(parsed.error);
  }

  const { channel, customer_id, product_id, qty, at_date } = parsed.data;

  const resolution = await resolvePrice({
    channel,
    customer_id,
    product_id,
    qty,
    at_date,
  });

  if (!resolution) {
    return apiError('Price not configured for this product/channel', 404);
  }

  return apiSuccess({ resolution });
}

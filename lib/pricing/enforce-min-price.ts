import pool from '@/lib/db/client';
import { consumeOverrideToken } from '@/lib/auth/override-pin';

export type MinPriceContext = {
  product_id: string;
  unit_price: number;
  is_clearance: boolean;
  override_token?: string;
  user_id: string;
  target_table: 'sales_orders' | 'sales_invoices' | 'pos_transactions' | 'sales_quotations';
  target_id: string;
  reason_code?: string;
};

export class MinPriceViolationError extends Error {
  status: number;
  details: {
    code: string;
    min_price: number;
    reason_codes: string[];
  };

  constructor(message: string, min_price: number) {
    super(message);
    this.name = 'MinPriceViolationError';
    this.status = 409;
    this.details = {
      code: 'MIN_PRICE_VIOLATION',
      min_price,
      reason_codes: ['bulk-deal', 'damaged-discount', 'customer-retention', 'promo-mismatch', 'other'],
    };
  }
}

export async function enforceMinPrice(ctx: MinPriceContext): Promise<void> {
  const {
    product_id,
    unit_price,
    is_clearance,
    override_token,
    user_id,
    target_table,
    target_id,
    reason_code,
  } = ctx;

  // 1. Fetch product min prices from database
  const res = await pool.query<{ min_price: string | null; clr_min_price: string | null }>(
    'SELECT min_price, clr_min_price FROM products WHERE id = $1',
    [product_id]
  );
  
  if (res.rowCount === 0) {
    throw Object.assign(new Error('Product not found'), { status: 404 });
  }

  const row = res.rows[0];
  const minPrice = row.min_price ? Number(row.min_price) : 0;
  const clrMinPrice = row.clr_min_price ? Number(row.clr_min_price) : 0;

  // 2. Determine threshold
  const threshold = is_clearance ? clrMinPrice : minPrice;

  // 3. If unit_price >= threshold, all good
  if (unit_price >= threshold) {
    return;
  }

  // 4. If no override token, block
  if (!override_token) {
    throw new MinPriceViolationError('Min price violation', threshold);
  }

  // 5. If override token is present, attempt to consume it
  // Expected action matches our contract: 'min_price_override'
  await consumeOverrideToken(override_token, 'min_price_override', {
    target_table,
    target_id,
    reason_code,
    original_value: { unit_price: threshold },
    override_value: { unit_price },
    user_id,
  });
}

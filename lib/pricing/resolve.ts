import pool from '@/lib/db/client';

export interface PriceResolution {
  price: number;
  source: 'contract' | 'tier' | 'fallback';
  applied_contract_id?: string;
  tier?: 'T0' | 'T1' | 'T2' | 'T3';
}

export async function resolvePrice(args: {
  channel: 'TRD' | 'AKRA';
  customer_id: string | null;
  product_id: string;
  qty: number;
  at_date?: string; // ISO date format (YYYY-MM-DD), default is today
}): Promise<PriceResolution | null> {
  const { channel, customer_id, product_id, at_date } = args;
  const targetDate = at_date || new Date().toISOString().split('T')[0];

  try {
    let contractDiscountPct: number | null = null;
    let appliedContractId: string | undefined = undefined;

    // 1. Contract Lookup (only if customer_id is provided)
    if (customer_id) {
      const contractResult = await pool.query<{
        id: string;
        locked_price: string | null;
        discount_pct: string | null;
      }>(
        `SELECT id, locked_price, discount_pct 
         FROM customer_price_contracts 
         WHERE customer_id = $1 
           AND (product_id = $2 OR product_id IS NULL) 
           AND valid_from <= $3 
           AND (valid_to IS NULL OR valid_to >= $3) 
         ORDER BY product_id NULLS LAST 
         LIMIT 1`,
        [customer_id, product_id, targetDate]
      );

      const contract = contractResult.rows[0];
      if (contract) {
        if (contract.locked_price !== null) {
          return {
            price: Number(contract.locked_price),
            source: 'contract',
            applied_contract_id: contract.id,
          };
        }
        if (contract.discount_pct !== null) {
          contractDiscountPct = Number(contract.discount_pct);
          appliedContractId = contract.id;
        }
      }
    }

    // 2. Tier Lookup
    let tier: 'T0' | 'T1' | 'T2' | 'T3' = 'T0';

    if (customer_id) {
      const memberResult = await pool.query<{ price_tier: 'T0' | 'T1' | 'T2' | 'T3' }>(
        'SELECT price_tier FROM pos_members WHERE id = $1',
        [customer_id]
      );
      if (memberResult.rows[0]) {
        tier = memberResult.rows[0].price_tier;
      }
    }

    const priceResult = await pool.query<{ price: string }>(
      `SELECT price 
       FROM product_prices 
       WHERE product_id = $1 
         AND channel = $2 
         AND tier = $3 
         AND valid_from <= $4 
         AND (valid_to IS NULL OR valid_to >= $4) 
       ORDER BY valid_from DESC 
       LIMIT 1`,
      [product_id, channel, tier, targetDate]
    );

    const tierPriceRow = priceResult.rows[0];
    if (tierPriceRow) {
      const basePrice = Number(tierPriceRow.price);
      if (contractDiscountPct !== null) {
        const discountedPrice = basePrice * (1 - contractDiscountPct / 100);
        return {
          price: discountedPrice,
          source: 'contract',
          applied_contract_id: appliedContractId,
        };
      }
      return {
        price: basePrice,
        source: 'tier',
        tier,
      };
    }

    // 3. Fallback to product unit_cost
    const productResult = await pool.query<{ unit_cost: string }>(
      'SELECT unit_cost FROM products WHERE id = $1',
      [product_id]
    );

    const product = productResult.rows[0];
    if (product) {
      const fallbackPrice = Number(product.unit_cost);
      if (contractDiscountPct !== null) {
        const discountedPrice = fallbackPrice * (1 - contractDiscountPct / 100);
        return {
          price: discountedPrice,
          source: 'contract',
          applied_contract_id: appliedContractId,
        };
      }
      return {
        price: fallbackPrice,
        source: 'fallback',
      };
    }

    return null;
  } catch (error) {
    console.error('Error in resolvePrice:', error);
    return null;
  }
}

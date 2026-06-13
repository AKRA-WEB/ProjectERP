import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resolvePrice } from './resolve';

const db = vi.hoisted(() => ({
  query: vi.fn(),
}));

vi.mock('@/lib/db/client', () => ({
  default: db,
}));

describe('resolvePrice', () => {
  beforeEach(() => {
    db.query.mockReset();
  });

  it('returns a locked customer contract price before checking tier prices', async () => {
    db.query.mockResolvedValueOnce({
      rows: [{ id: 'contract-1', locked_price: '88.50', discount_pct: null }],
    });

    await expect(
      resolvePrice({
        channel: 'TRD',
        customer_id: 'customer-1',
        product_id: 'product-1',
        qty: 1,
        at_date: '2026-06-13',
      })
    ).resolves.toEqual({
      price: 88.5,
      source: 'contract',
      applied_contract_id: 'contract-1',
    });
    expect(db.query).toHaveBeenCalledTimes(1);
  });

  it('applies a contract percentage discount to the customer tier price', async () => {
    db.query
      .mockResolvedValueOnce({
        rows: [{ id: 'contract-2', locked_price: null, discount_pct: '10' }],
      })
      .mockResolvedValueOnce({ rows: [{ price_tier: 'T2' }] })
      .mockResolvedValueOnce({ rows: [{ price: '120.00' }] });

    await expect(
      resolvePrice({
        channel: 'AKRA',
        customer_id: 'customer-2',
        product_id: 'product-2',
        qty: 3,
        at_date: '2026-06-13',
      })
    ).resolves.toEqual({
      price: 108,
      source: 'contract',
      applied_contract_id: 'contract-2',
    });
    expect(db.query).toHaveBeenNthCalledWith(
      3,
      expect.stringContaining('FROM product_prices'),
      ['product-2', 'AKRA', 'T2', '2026-06-13']
    );
  });

  it('uses T0 tier pricing when no customer is provided', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ price: '45.25' }] });

    await expect(
      resolvePrice({
        channel: 'TRD',
        customer_id: null,
        product_id: 'product-3',
        qty: 1,
        at_date: '2026-06-13',
      })
    ).resolves.toEqual({
      price: 45.25,
      source: 'tier',
      tier: 'T0',
    });
    expect(db.query).toHaveBeenCalledWith(expect.stringContaining('FROM product_prices'), [
      'product-3',
      'TRD',
      'T0',
      '2026-06-13',
    ]);
  });

  it('falls back to product unit cost when no active tier price exists', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ unit_cost: '31.75' }] });

    await expect(
      resolvePrice({
        channel: 'TRD',
        customer_id: null,
        product_id: 'product-4',
        qty: 1,
        at_date: '2026-06-13',
      })
    ).resolves.toEqual({
      price: 31.75,
      source: 'fallback',
    });
  });

  it('returns null when contract, tier price, and fallback product lookups miss', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    await expect(
      resolvePrice({
        channel: 'AKRA',
        customer_id: null,
        product_id: 'missing-product',
        qty: 1,
        at_date: '2026-06-13',
      })
    ).resolves.toBeNull();
  });
});

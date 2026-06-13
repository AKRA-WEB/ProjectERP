import { beforeEach, describe, expect, it, vi } from 'vitest';
import { enforceMinPrice, MinPriceViolationError, type MinPriceContext } from './enforce-min-price';

const db = vi.hoisted(() => ({
  query: vi.fn(),
}));

const override = vi.hoisted(() => ({
  consumeOverrideToken: vi.fn(),
}));

vi.mock('@/lib/db/client', () => ({
  default: db,
}));

vi.mock('@/lib/auth/override-pin', () => ({
  consumeOverrideToken: override.consumeOverrideToken,
}));

function ctx(overrides: Partial<MinPriceContext> = {}): MinPriceContext {
  return {
    product_id: 'product-1',
    unit_price: 100,
    is_clearance: false,
    user_id: 'user-1',
    target_table: 'sales_orders',
    target_id: 'target-1',
    ...overrides,
  };
}

describe('enforceMinPrice', () => {
  beforeEach(() => {
    db.query.mockReset();
    override.consumeOverrideToken.mockReset();
  });

  it('throws 404 when the product does not exist', async () => {
    db.query.mockResolvedValueOnce({ rowCount: 0, rows: [] });

    await expect(enforceMinPrice(ctx())).rejects.toMatchObject({ status: 404 });
  });

  it('allows a normal sale exactly at the minimum price boundary', async () => {
    db.query.mockResolvedValueOnce({
      rowCount: 1,
      rows: [{ min_price: '100.00', clr_min_price: '40.00' }],
    });

    await expect(enforceMinPrice(ctx({ unit_price: 100 }))).resolves.toBeUndefined();
    expect(override.consumeOverrideToken).not.toHaveBeenCalled();
  });

  it('blocks a normal sale below minimum price without an override token', async () => {
    db.query.mockResolvedValueOnce({
      rowCount: 1,
      rows: [{ min_price: '100.00', clr_min_price: '40.00' }],
    });

    await expect(enforceMinPrice(ctx({ unit_price: 99.99 }))).rejects.toMatchObject({
      name: 'MinPriceViolationError',
      status: 409,
      details: { code: 'MIN_PRICE_VIOLATION', min_price: 100 },
    });
  });

  it('uses clearance minimum price when the sale is marked clearance', async () => {
    db.query.mockResolvedValueOnce({
      rowCount: 1,
      rows: [{ min_price: '100.00', clr_min_price: '40.00' }],
    });

    await expect(
      enforceMinPrice(ctx({ is_clearance: true, unit_price: 39.99 }))
    ).rejects.toBeInstanceOf(MinPriceViolationError);
  });

  it('consumes an override token for a below-minimum sale instead of throwing', async () => {
    db.query.mockResolvedValueOnce({
      rowCount: 1,
      rows: [{ min_price: '100.00', clr_min_price: '40.00' }],
    });
    override.consumeOverrideToken.mockResolvedValueOnce(undefined);

    await expect(
      enforceMinPrice(
        ctx({
          unit_price: 75,
          override_token: 'override-token',
          reason_code: 'customer-retention',
        })
      )
    ).resolves.toBeUndefined();
    expect(override.consumeOverrideToken).toHaveBeenCalledWith('override-token', 'min_price_override', {
      target_table: 'sales_orders',
      target_id: 'target-1',
      reason_code: 'customer-retention',
      original_value: { unit_price: 100 },
      override_value: { unit_price: 75 },
      user_id: 'user-1',
    });
  });
});

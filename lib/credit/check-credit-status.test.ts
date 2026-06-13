import { beforeEach, describe, expect, it, vi } from 'vitest';
import { checkCreditStatus } from './check-credit-status';

const db = vi.hoisted(() => ({
  query: vi.fn(),
}));

vi.mock('@/lib/db/client', () => ({
  default: db,
}));

describe('checkCreditStatus', () => {
  beforeEach(() => {
    db.query.mockReset();
  });

  it('returns an overrideable default status when the customer is missing', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });

    await expect(checkCreditStatus('missing-customer')).resolves.toEqual({
      on_hold: false,
      outstanding: 0,
      credit_limit: 0,
      max_aging_days: 0,
      can_override: true,
    });
  });

  it('does not hold a customer under the credit limit with no aging', async () => {
    db.query.mockResolvedValueOnce({
      rows: [{ credit_limit: '1000.00', on_hold: true, outstanding: '999.99', max_aging_days: '0' }],
    });

    await expect(checkCreditStatus('customer-1')).resolves.toMatchObject({
      on_hold: false,
      outstanding: 999.99,
      credit_limit: 1000,
      max_aging_days: 0,
      reason: undefined,
    });
  });

  it('allows the exact credit-limit boundary', async () => {
    db.query.mockResolvedValueOnce({
      rows: [{ credit_limit: '1000.00', on_hold: false, outstanding: '1000.00', max_aging_days: '0' }],
    });

    await expect(checkCreditStatus('customer-2')).resolves.toMatchObject({
      on_hold: false,
      outstanding: 1000,
      credit_limit: 1000,
    });
  });

  it('holds a customer when outstanding balance exceeds the credit limit', async () => {
    db.query.mockResolvedValueOnce({
      rows: [{ credit_limit: '1000.00', on_hold: false, outstanding: '1000.01', max_aging_days: '0' }],
    });

    await expect(checkCreditStatus('customer-3')).resolves.toMatchObject({
      on_hold: true,
      reason: 'over_limit_or_aging',
      can_override: true,
    });
  });

  it('holds a customer when any issued unpaid invoice is at least one day overdue', async () => {
    db.query.mockResolvedValueOnce({
      rows: [{ credit_limit: '1000.00', on_hold: false, outstanding: '10.00', max_aging_days: '1' }],
    });

    await expect(checkCreditStatus('customer-4')).resolves.toMatchObject({
      on_hold: true,
      max_aging_days: 1,
      reason: 'over_limit_or_aging',
    });
  });
});

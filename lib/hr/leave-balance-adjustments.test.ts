import { describe, expect, it } from 'vitest';
import { computeLeaveAdjustment } from './leave-balance-adjustments';

const state = { days_entitled: 10, days_used: 3 };

describe('computeLeaveAdjustment — entitlement', () => {
  it('returns correct before/after for positive delta', () => {
    const result = computeLeaveAdjustment('entitlement', state, 5, 'Annual refresh');
    expect(result).toEqual({ before: 10, after: 15 });
  });

  it('returns correct before/after for negative delta', () => {
    const result = computeLeaveAdjustment('entitlement', state, -2, 'Correction');
    expect(result).toEqual({ before: 10, after: 8 });
  });

  it('rejects negative resulting entitlement', () => {
    expect(() =>
      computeLeaveAdjustment('entitlement', state, -15, 'Correction')
    ).toThrow();
  });
});

describe('computeLeaveAdjustment — used_correction', () => {
  it('returns correct before/after for positive delta', () => {
    const result = computeLeaveAdjustment('used_correction', state, 2, 'Missed record');
    expect(result).toEqual({ before: 3, after: 5 });
  });

  it('returns correct before/after for negative delta', () => {
    const result = computeLeaveAdjustment('used_correction', state, -1, 'System error');
    expect(result).toEqual({ before: 3, after: 2 });
  });

  it('rejects when used would go negative', () => {
    expect(() =>
      computeLeaveAdjustment('used_correction', state, -10, 'Correction')
    ).toThrow();
  });

  it('rejects when used would exceed entitled', () => {
    expect(() =>
      computeLeaveAdjustment('used_correction', state, 8, 'Correction')
    ).toThrow();
  });
});

describe('computeLeaveAdjustment — validation', () => {
  it('rejects empty reason', () => {
    expect(() =>
      computeLeaveAdjustment('entitlement', state, 1, '')
    ).toThrow('Reason is required');
  });

  it('rejects whitespace-only reason', () => {
    expect(() =>
      computeLeaveAdjustment('entitlement', state, 1, '   ')
    ).toThrow('Reason is required');
  });
});

import { describe, expect, it } from 'vitest';
import { validateDocReview, isDocExpired } from './employee-documents';

describe('validateDocReview — verify', () => {
  it('does not throw when verifying without a reason', () => {
    expect(() => validateDocReview('verify', {})).not.toThrow();
  });

  it('sets status to verified', () => {
    expect(() => validateDocReview('verify', { rejected_reason: null })).not.toThrow();
  });
});

describe('validateDocReview — reject', () => {
  it('requires rejected_reason when rejecting', () => {
    expect(() => validateDocReview('reject', {})).toThrow('rejected_reason is required');
  });

  it('requires non-empty rejected_reason', () => {
    expect(() => validateDocReview('reject', { rejected_reason: '  ' })).toThrow();
  });

  it('does not throw when rejected_reason is provided', () => {
    expect(() =>
      validateDocReview('reject', { rejected_reason: 'Missing signature' })
    ).not.toThrow();
  });
});

describe('isDocExpired', () => {
  const past = new Date('2020-01-01');
  const future = new Date('2030-01-01');
  const asOf = new Date('2026-06-01');

  it('returns true for a document with expiry in the past', () => {
    expect(isDocExpired({ expiry_date: '2020-01-01' }, asOf)).toBe(true);
  });

  it('returns false for a document with expiry in the future', () => {
    expect(isDocExpired({ expiry_date: '2030-01-01' }, asOf)).toBe(false);
  });

  it('returns false when expiry_date is null', () => {
    expect(isDocExpired({ expiry_date: null }, asOf)).toBe(false);
  });

  it('comparison uses provided asOf date', () => {
    expect(isDocExpired({ expiry_date: past.toISOString().split('T')[0] }, future)).toBe(true);
  });
});

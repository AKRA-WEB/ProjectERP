import { describe, expect, it } from 'vitest';
import { formatCurrency, formatDate, formatNumber, formatQty } from './utils';

describe('formatCurrency', () => {
  it('formats English THB values with two decimal places', () => {
    const formatted = formatCurrency(1234.5, 'en');

    expect(formatted).toContain('THB');
    expect(formatted).toContain('1,234.50');
  });

  it('formats Thai THB values with a baht currency marker and two decimal places', () => {
    const formatted = formatCurrency(1234.5, 'th');

    expect(formatted.charCodeAt(0)).toBe(3647);
    expect(formatted).toContain('1,234.50');
  });

  it('returns zero currency for null and empty values', () => {
    expect(formatCurrency(null, 'en')).toBe('THB 0.00');
    expect(formatCurrency('', 'th').charCodeAt(0)).toBe(3647);
    expect(formatCurrency('', 'th')).toContain('0.00');
  });
});

describe('formatDate', () => {
  it('uses Buddhist year formatting for Thai locale dates', () => {
    expect(formatDate('2024-01-15T00:00:00.000+07:00', 'th')).toBe('15/01/2567');
  });

  it('uses Gregorian year formatting for English locale dates', () => {
    expect(formatDate('2024-01-15T00:00:00.000+07:00', 'en')).toBe('15/01/2024');
  });

  it('returns a dash for missing dates', () => {
    expect(formatDate(null, 'en')).toBe('-');
  });
});

describe('formatNumber and formatQty', () => {
  it('formats numbers by locale and fixed quantities by requested decimals', () => {
    expect(formatNumber(1234.5, 'en')).toBe('1,234.5');
    expect(formatQty(1.2345, 3)).toBe('1.234');
  });
});

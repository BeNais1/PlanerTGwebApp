import { describe, expect, it } from 'vitest';
import { convertCurrency } from '../src/domain/currency';

const rates = { EUR: 1, USD: 1.12, UAH: 49.5 };

describe('currency conversion', () => {
  it('converts through the common EUR base', () => {
    expect(convertCurrency(100, 'USD', 'UAH', rates)).toBeCloseTo(4_419.642857, 5);
    expect(convertCurrency(4_950, 'UAH', 'EUR', rates)).toBeCloseTo(100, 8);
  });

  it('keeps the amount unchanged for the same currency', () => {
    expect(convertCurrency(123.45, 'EUR', 'EUR', rates)).toBe(123.45);
  });

  it('rejects missing or invalid rates', () => {
    expect(() => convertCurrency(100, 'EUR', 'USD', { EUR: 1, USD: 0 })).toThrow();
  });
});

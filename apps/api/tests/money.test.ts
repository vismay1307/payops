import { describe, expect, it } from 'vitest';
import { formatMoney, parseMoney } from '../src/utils/money.js';

describe('parseMoney', () => {
  it.each([
    ['0.10', 'USD', 10],
    ['1240.00', 'USD', 124000],
    ['1', 'USD', 100],
    ['100', 'JPY', 100],
    ['12.34', 'EUR', 1234],
  ])('converts %s %s into minor units', (amount, currency, expected) => {
    expect(parseMoney(amount, currency)).toBe(expected);
  });

  it.each(['1,000.5', '-10.00', '1.234', 'abc', '', '1.00 USD'])(
    'rejects invalid amount %s',
    (amount) => {
      expect(() => parseMoney(amount, 'USD')).toThrow();
    },
  );

  it('rejects decimal fractions for JPY', () => {
    expect(() => parseMoney('10.50', 'JPY')).toThrow();
  });

  it('rejects invalid currency codes', () => {
    expect(() => parseMoney('10.00', 'US')).toThrow();
  });
});

describe('formatMoney', () => {
  it.each([
    [10, 'USD', '0.10'],
    [124000, 'USD', '1240.00'],
    [100, 'JPY', '100'],
    [0, 'EUR', '0.00'],
  ])('formats %i minor units as %s money', (amount, currency, expected) => {
    expect(formatMoney(amount, currency)).toBe(expected);
  });

  it('rejects negative values', () => {
    expect(() => formatMoney(-100, 'USD')).toThrow();
  });

  it('rejects unsafe integers', () => {
    expect(() => formatMoney(Number.MAX_SAFE_INTEGER + 1, 'USD')).toThrow();
  });
});

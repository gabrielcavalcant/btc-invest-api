import { describe, expect, it } from 'vitest';
import {
  estimateBtcForPurchase,
  estimateBtcForSale,
  formatBrl,
  formatBtc,
  formatPercent,
  isGreater,
  normalizeAmount,
  percentChange,
  toScaled,
} from './money';

describe('money', () => {
  it('formats API decimal strings in Brazilian notation', () => {
    expect(formatBrl('10000.00')).toBe('R$ 10.000,00');
    expect(formatBrl('1234567.8')).toBe('R$ 1.234.567,80');
    expect(formatBrl('0.05')).toBe('R$ 0,05');
    expect(formatBrl('-3.5')).toBe('-R$ 3,50');
    expect(formatBtc('0.00697534')).toBe('0,00697534 BTC');
  });

  it('parses decimals without floating point and rejects garbage', () => {
    expect(toScaled('0.1', 2) + toScaled('0.2', 2)).toBe(30n); // 0.1 + 0.2 === 0.3, exactly
    expect(() => toScaled('abc', 2)).toThrow();
  });

  it('accepts comma or dot as the decimal separator', () => {
    expect(normalizeAmount('1500,50')).toBe('1500.50');
    expect(isGreater('1500,51', '1500.50')).toBe(true);
    expect(isGreater('1500,50', '1500.50')).toBe(false);
  });

  it('estimates BTC with the same rounding as the API', () => {
    // purchase rounds down: never promises more BTC than delivered
    expect(estimateBtcForPurchase('3000', '432314.00')).toBe('0.00693940');
    // sale rounds up: enough satoshis to reach the amount
    expect(estimateBtcForSale('1000', '300000.00')).toBe('0.00333334');
  });

  it('computes the variation rounding half away from zero', () => {
    expect(percentChange('1500.07', '1500.17')).toBe(0.01);
    expect(percentChange('3000.00', '2999.82')).toBe(-0.01);
    expect(percentChange('100.00', '110.00')).toBe(10);
    expect(percentChange('0.00', '10.00')).toBe(0);
    expect(formatPercent(10)).toBe('+10,00%');
    expect(formatPercent(-0.5)).toBe('-0,50%');
  });
});

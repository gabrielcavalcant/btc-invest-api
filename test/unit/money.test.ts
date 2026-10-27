import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  centsToSats,
  formatBrl,
  formatBtc,
  parseDecimal,
  parseUserAmountToCents,
  percentVariation,
  satsNeededFor,
  satsToCents,
} from '../../src/domain/money';
import { ValidationError } from '../../src/domain/errors';

describe('money', () => {
  it('parses user amounts in BRL to cents', () => {
    assert.equal(parseUserAmountToCents(100), 10_000n);
    assert.equal(parseUserAmountToCents('100.5'), 10_050n);
    assert.equal(parseUserAmountToCents(0.1), 10n);
    assert.equal(parseUserAmountToCents('1234.56'), 123_456n);
  });

  it('rejects invalid user amounts', () => {
    for (const bad of [0, -1, '1.234', 'abc', '', null, undefined, '1e3', 1e21, '0.00']) {
      assert.throws(
        () => parseUserAmountToCents(bad),
        ValidationError,
        `should reject ${String(bad)}`,
      );
    }
  });

  it('parses third-party decimals rounding half up', () => {
    assert.equal(parseDecimal('345678.12', 2), 34_567_812n);
    assert.equal(parseDecimal('345678.125', 2), 34_567_813n);
    assert.equal(parseDecimal('345678.12499999', 2), 34_567_812n);
    assert.equal(parseDecimal('345678', 2), 34_567_800n);
  });

  it('formats cents and satoshis', () => {
    assert.equal(formatBrl(123_456n), '1234.56');
    assert.equal(formatBrl(5n), '0.05');
    assert.equal(formatBrl(-150n), '-1.50');
    assert.equal(formatBtc(12_345n), '0.00012345');
    assert.equal(formatBtc(150_000_000n), '1.50000000');
  });

  it('converts between BRL and BTC without losing precision', () => {
    const price = 30_000_000n; // R$ 300.000,00 / BTC
    assert.equal(centsToSats(30_000n, price), 100_000n); // R$ 300 -> 0.001 BTC
    assert.equal(satsToCents(100_000n, price), 30_000n);
    assert.equal(centsToSats(1n, price), 3n); // R$ 0,01 -> 3.33 sats, floored
    assert.equal(satsNeededFor(1n, price), 4n); // need 4 sats to get at least 1 cent
  });

  it('computes the percentage variation with 2 decimals', () => {
    assert.equal(percentVariation(30_000_000n, 33_000_000n), 10);
    assert.equal(percentVariation(30_000_000n, 27_000_000n), -10);
    assert.equal(percentVariation(30_000_000n, 30_001_000n), 0.0); // 0.0033% -> 0.00
    assert.equal(percentVariation(30_000_000n, 30_100_000n), 0.33);
    assert.equal(percentVariation(30_000_000n, 29_900_000n), -0.33);
  });
});

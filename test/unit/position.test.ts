import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { Investment } from '../../src/domain/entities';
import { computePosition } from '../../src/domain/services/position';

describe('computePosition', () => {
  it('shows each investment with variation and current gross value at the bid', () => {
    const investments: Investment[] = [
      {
        id: 'b',
        accountId: 'acc',
        btcSats: 200_000n,
        investedCents: 60_000n,
        priceCents: 30_000_000n,
        purchasedAt: new Date('2026-10-02T10:00:00Z'),
        liquidatedAt: null,
        originInvestmentId: null,
      },
      {
        id: 'a',
        accountId: 'acc',
        btcSats: 100_000n,
        investedCents: 25_000n,
        priceCents: 25_000_000n,
        purchasedAt: new Date('2026-10-01T10:00:00Z'),
        liquidatedAt: null,
        originInvestmentId: null,
      },
    ];

    const position = computePosition(investments, 33_000_000n);

    assert.deepEqual(
      position.investments.map((i) => i.id),
      ['a', 'b'],
    );
    const [a, b] = position.investments;
    assert.equal(a?.priceVariationPercent, 32);
    assert.equal(a?.currentGrossCents, 33_000n);
    assert.equal(b?.priceVariationPercent, 10);
    assert.equal(b?.currentGrossCents, 66_000n);
    assert.deepEqual(position.totals, {
      investedCents: 85_000n,
      btcSats: 300_000n,
      currentGrossCents: 99_000n,
    });
  });
});

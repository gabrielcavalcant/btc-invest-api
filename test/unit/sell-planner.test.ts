import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { Investment } from '../../src/domain/entities';
import { InsufficientFundsError } from '../../src/domain/errors';
import { satsToCents } from '../../src/domain/money';
import { planSell } from '../../src/domain/services/sell-planner';

const BTC = 100_000_000n;

function investment(id: string, day: number, btcSats: bigint, priceCents: bigint): Investment {
  return {
    id,
    accountId: 'acc',
    btcSats,
    priceCents,
    investedCents: satsToCents(btcSats, priceCents),
    purchasedAt: new Date(Date.UTC(2026, 9, day)),
    liquidatedAt: null,
    originInvestmentId: null,
  };
}

describe('planSell', () => {
  // Two investments of 0.01 BTC: bought at R$ 200k and R$ 250k. Bid is now R$ 300k.
  const first = investment('a', 1, BTC / 100n, 20_000_000n); // worth R$ 3.000,00 now
  const second = investment('b', 2, BTC / 100n, 25_000_000n); // worth R$ 3.000,00 now
  const bid = 30_000_000n;

  it('liquidates investments FIFO, oldest first, regardless of input order', () => {
    const plan = planSell([second, first], 600_000n, bid);
    assert.deepEqual(
      plan.liquidations.map((l) => l.investment.id),
      ['a', 'b'],
    );
    assert.equal(plan.reinvestment, null);
    assert.equal(plan.creditedCents, 600_000n);
    assert.equal(plan.soldSats, BTC / 50n);
  });

  it('liquidates fully and reinvests the residual on a partial sale', () => {
    // Wants R$ 1.000,00: investment "a" (R$ 3.000,00) is liquidated and R$ 2.000,00 reinvested.
    const plan = planSell([first, second], 100_000n, bid);

    assert.equal(plan.liquidations.length, 1);
    assert.equal(plan.liquidations[0]?.cents, 300_000n);
    assert.equal(plan.liquidations[0]?.sats, BTC / 100n);

    const r = plan.reinvestment;
    assert.ok(r);
    assert.equal(r.origin.id, 'a');
    assert.equal(r.cents, 200_000n); // residual value reinvested
    assert.equal(r.priceCents, 20_000_000n); // original quote
    assert.equal(r.purchasedAt.getTime(), first.purchasedAt.getTime());
    // 1/3 of the satoshis were needed (rounded up), the rest stays invested
    assert.equal(r.sats, BTC / 100n - 333_334n);
    assert.equal(r.investedCents, satsToCents(r.sats, 20_000_000n));

    // Balance receives exactly what was asked: liquidation - reinvestment
    assert.equal(plan.creditedCents, 100_000n);
    assert.equal((plan.liquidations[0]?.cents ?? 0n) - r.cents, plan.creditedCents);
    assert.equal(plan.soldSats, 333_334n);
  });

  it('crosses investments when the first one is not enough', () => {
    const plan = planSell([first, second], 450_000n, bid); // R$ 4.500,00
    assert.deepEqual(
      plan.liquidations.map((l) => l.investment.id),
      ['a', 'b'],
    );
    assert.equal(plan.reinvestment?.origin.id, 'b');
    assert.equal(plan.reinvestment?.cents, 150_000n);
    assert.equal(plan.reinvestment?.priceCents, 25_000_000n);
    assert.equal(plan.creditedCents, 450_000n);
  });

  it('never creates BTC: liquidated sats = sold sats + reinvested sats', () => {
    for (const target of [1n, 99n, 123_457n, 299_999n, 300_000n, 512_345n, 600_000n]) {
      const plan = planSell([first, second], target, bid);
      const liquidated = plan.liquidations.reduce((s, l) => s + l.sats, 0n);
      assert.equal(liquidated, plan.soldSats + (plan.reinvestment?.sats ?? 0n));
      assert.ok(plan.soldSats >= 0n);
      assert.ok(plan.creditedCents >= target && plan.creditedCents <= target + 1n);
    }
  });

  it('rejects withdrawals above the current value of the investments', () => {
    assert.throws(() => planSell([first, second], 600_001n, bid), InsufficientFundsError);
    assert.throws(() => planSell([], 1n, bid), InsufficientFundsError);
  });
});

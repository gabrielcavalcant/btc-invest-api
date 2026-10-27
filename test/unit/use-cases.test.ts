import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { Authenticate } from '../../src/application/use-cases/authenticate';
import { Deposit } from '../../src/application/use-cases/deposit';
import { GetBalance } from '../../src/application/use-cases/get-balance';
import { GetDailyVolume, startOfDayInZone } from '../../src/application/use-cases/get-daily-volume';
import { GetPosition } from '../../src/application/use-cases/get-position';
import { GetStatement } from '../../src/application/use-cases/get-statement';
import {
  CapturePriceSnapshot,
  floorToSlot,
  GetPriceHistory,
  PurgeOldPriceHistory,
} from '../../src/application/use-cases/price-history';
import { PurchaseBtc } from '../../src/application/use-cases/purchase-btc';
import { RegisterAccount } from '../../src/application/use-cases/register-account';
import { SellBtc } from '../../src/application/use-cases/sell-btc';
import {
  ConflictError,
  InsufficientFundsError,
  UnauthorizedError,
  ValidationError,
} from '../../src/domain/errors';
import { buildTestContext } from '../support/in-memory';

const DAY = 24 * 60 * 60 * 1000;

describe('use cases', () => {
  let ctx: ReturnType<typeof buildTestContext>;
  let accountId: string;

  const deposit = (amountCents: bigint) => new Deposit(ctx).execute({ accountId, amountCents });
  const purchase = (amountCents: bigint) =>
    new PurchaseBtc(ctx).execute({ accountId, amountCents });
  const sell = (amountCents: bigint) => new SellBtc(ctx).execute({ accountId, amountCents });
  const balance = async () => (await new GetBalance(ctx).execute(accountId)).balanceCents;

  beforeEach(async () => {
    // bid (buy) R$ 300.000,00 / ask (sell) R$ 301.000,00
    ctx = buildTestContext({ buyCents: 30_000_000n, sellCents: 30_100_000n });
    const created = await new RegisterAccount({ ...ctx, accounts: ctx.accounts }).execute({
      name: 'Maria Silva',
      email: ' Maria@Example.com ',
      password: 'super-secret',
    });
    accountId = created.id;
  });

  describe('accounts', () => {
    it('registers normalizing the e-mail and rejects duplicates', async () => {
      const account = await ctx.accounts.findById(accountId);
      assert.equal(account?.email, 'maria@example.com');
      assert.equal(account?.balanceCents, 0n);
      await assert.rejects(
        new RegisterAccount(ctx).execute({
          name: 'X',
          email: 'MARIA@example.com',
          password: '12345678',
        }),
        ConflictError,
      );
    });

    it('authenticates with valid credentials only', async () => {
      const auth = new Authenticate(ctx);
      assert.deepEqual(
        await auth.execute({ email: 'maria@example.com', password: 'super-secret' }),
        {
          token: `token-for-${accountId}`,
        },
      );
      await assert.rejects(
        auth.execute({ email: 'maria@example.com', password: 'wrong' }),
        UnauthorizedError,
      );
      await assert.rejects(
        auth.execute({ email: 'nobody@example.com', password: 'x' }),
        UnauthorizedError,
      );
    });
  });

  describe('deposit and balance', () => {
    it('credits the balance, records the statement and sends an e-mail', async () => {
      await deposit(100_000n);
      const result = await deposit(50_050n);
      assert.equal(result.balanceCents, 150_050n);
      assert.equal(await balance(), 150_050n);
      assert.equal(ctx.db.transactions.filter((t) => t.type === 'DEPOSIT').length, 2);
      assert.deepEqual(ctx.notifier.sent.at(-1), {
        kind: 'deposit',
        payload: { to: 'maria@example.com', name: 'Maria Silva', amountCents: 50_050n },
      });
    });
  });

  describe('purchase', () => {
    it('converts BRL to BTC by the SELL price and debits the balance', async () => {
      await deposit(1_000_000n); // R$ 10.000,00
      const result = await purchase(301_000n); // R$ 3.010,00 at R$ 301k -> 0.01 BTC
      assert.equal(result.btcSats, 1_000_000n);
      assert.equal(result.priceCents, 30_100_000n);
      assert.equal(result.balanceCents, 699_000n);
      assert.equal(await balance(), 699_000n);

      const [inv] = await ctx.investments.findOpenByAccount(accountId);
      assert.equal(inv?.investedCents, 301_000n);
      assert.equal(ctx.notifier.sent.at(-1)?.kind, 'purchase');
    });

    it('rejects purchases above the balance without changing anything', async () => {
      await deposit(10_000n);
      await assert.rejects(purchase(10_001n), InsufficientFundsError);
      assert.equal(await balance(), 10_000n);
      assert.equal((await ctx.investments.findOpenByAccount(accountId)).length, 0);
    });

    it('rejects amounts too small to buy one satoshi', async () => {
      ctx.quotes.quote = { buyCents: 10_000_000_000_000n, sellCents: 10_000_000_000_000n };
      await deposit(100n);
      await assert.rejects(purchase(1n), ValidationError);
    });
  });

  describe('position', () => {
    it('shows the investments valued at the current bid', async () => {
      await deposit(1_000_000n);
      await purchase(301_000n); // 0.01 BTC at R$ 301k
      ctx.quotes.quote = { buyCents: 33_110_000n, sellCents: 33_200_000n };

      const position = await new GetPosition(ctx).execute(accountId);
      const [item] = position.investments;
      assert.equal(item?.priceAtPurchaseCents, 30_100_000n);
      assert.equal(item?.priceVariationPercent, 10);
      assert.equal(item?.currentGrossCents, 331_100n);
      assert.equal(position.totals.currentGrossCents, 331_100n);
    });
  });

  describe('sell', () => {
    beforeEach(async () => {
      ctx.quotes.quote = { buyCents: 20_000_000n, sellCents: 20_000_000n };
      await deposit(1_000_000n);
      await purchase(200_000n); // 0.01 BTC at R$ 200k (oldest)
      ctx.clock.advance(DAY);
      ctx.quotes.quote = { buyCents: 25_000_000n, sellCents: 25_000_000n };
      await purchase(250_000n); // 0.01 BTC at R$ 250k
      ctx.clock.advance(DAY);
      ctx.quotes.quote = { buyCents: 30_000_000n, sellCents: 30_100_000n };
    });

    it('sells FIFO, credits exactly the amount and records sale + reinvestment', async () => {
      const before = await balance(); // R$ 5.500,00
      const result = await sell(100_000n); // R$ 1.000,00

      assert.equal(result.amountCents, 100_000n);
      assert.equal(await balance(), before + 100_000n);
      assert.equal(result.btcSats, 333_334n);
      assert.equal(result.priceCents, 30_000_000n);

      const statement = ctx.db.transactions.filter(
        (t) => t.type === 'SELL' || t.type === 'REINVESTMENT',
      );
      assert.deepEqual(
        statement.map((t) => [t.type, t.amountCents]),
        [
          ['SELL', 300_000n],
          ['REINVESTMENT', 200_000n],
        ],
      );
      const reinvestmentTx = statement[1];
      assert.equal(reinvestmentTx?.btcPriceCents, 20_000_000n); // original quote

      const open = await ctx.investments.findOpenByAccount(accountId);
      assert.equal(open.length, 2);
      const residual = open.find((i) => i.originInvestmentId !== null);
      assert.ok(residual);
      assert.equal(residual.priceCents, 20_000_000n);
      assert.equal(residual.btcSats, 666_666n);
      // the residual stays first in the FIFO queue (keeps the original purchase date)
      assert.equal(open[0]?.id, residual.id);

      assert.deepEqual(ctx.notifier.sent.at(-1), {
        kind: 'sell',
        payload: {
          to: 'maria@example.com',
          name: 'Maria Silva',
          btcSats: 333_334n,
          amountCents: 100_000n,
          priceCents: 30_000_000n,
        },
      });
    });

    it('sells everything when the amount equals the whole position', async () => {
      await sell(600_000n);
      assert.equal((await ctx.investments.findOpenByAccount(accountId)).length, 0);
    });

    it('rejects selling more than the position is worth, keeping the state intact', async () => {
      const before = await balance();
      await assert.rejects(sell(600_001n), InsufficientFundsError);
      assert.equal(await balance(), before);
      assert.equal((await ctx.investments.findOpenByAccount(accountId)).length, 2);
    });

    it('reports the daily volume discounting reinvestments', async () => {
      await sell(100_000n);
      const volume = await new GetDailyVolume({ ...ctx, timeZone: 'America/Sao_Paulo' }).execute();
      // only today's operations: the purchases were 1 and 2 days ago
      assert.equal(volume.boughtSats, 0n);
      assert.equal(volume.soldSats, 333_334n);

      await purchase(30_100n); // 0.001 BTC
      const after = await new GetDailyVolume({ ...ctx, timeZone: 'America/Sao_Paulo' }).execute();
      assert.equal(after.boughtSats, 100_000n);
    });
  });

  describe('statement', () => {
    it('defaults to the last 90 days and accepts a custom interval', async () => {
      await deposit(10_000n);
      ctx.clock.advance(91 * DAY);
      await deposit(20_000n);

      const last90 = await new GetStatement(ctx).execute({ accountId });
      assert.deepEqual(
        last90.items.map((t) => t.amountCents),
        [20_000n],
      );

      const custom = await new GetStatement(ctx).execute({
        accountId,
        from: new Date(ctx.clock.now().getTime() - 100 * DAY),
        to: ctx.clock.now(),
      });
      assert.equal(custom.items.length, 2);

      await assert.rejects(
        new GetStatement(ctx).execute({ accountId, from: ctx.clock.now(), to: new Date(0) }),
        ValidationError,
      );
    });
  });

  describe('price history', () => {
    it('stores snapshots in 10-minute slots and returns the last 24h', async () => {
      ctx.clock.current = new Date('2026-10-26T08:07:31Z');
      const snap = await new CapturePriceSnapshot(ctx).execute();
      assert.equal(snap.capturedAt.toISOString(), '2026-10-26T08:00:00.000Z');

      ctx.clock.advance(10 * 60 * 1000); // 08:17:31 -> slot 08:10
      await new CapturePriceSnapshot(ctx).execute();
      ctx.clock.advance(10 * 60 * 1000); // 08:27:31 -> slot 08:20
      await new CapturePriceSnapshot(ctx).execute();
      ctx.clock.current = new Date('2026-10-27T08:17:31Z');
      await new CapturePriceSnapshot(ctx).execute(); // slot 08:10 of the next day
      assert.equal(ctx.db.history.size, 4);

      const history = await new GetPriceHistory(ctx).execute();
      assert.deepEqual(
        history.map((h) => h.capturedAt.toISOString()),
        ['2026-10-26T08:20:00.000Z', '2026-10-27T08:10:00.000Z'],
      );
    });

    it('purges data older than 90 days', async () => {
      await new CapturePriceSnapshot(ctx).execute();
      ctx.clock.advance(91 * DAY);
      await new CapturePriceSnapshot(ctx).execute();
      assert.equal(await new PurgeOldPriceHistory(ctx).execute(), 1);
      assert.equal(ctx.db.history.size, 1);
    });

    it('floors dates to the slot', () => {
      assert.equal(
        floorToSlot(new Date('2026-10-26T08:19:59.999Z')).toISOString(),
        '2026-10-26T08:10:00.000Z',
      );
    });
  });

  describe('startOfDayInZone', () => {
    it('returns midnight of the local day as an instant', () => {
      // 02:00 UTC on the 27th is still the 26th in São Paulo (UTC-3)
      assert.equal(
        startOfDayInZone(new Date('2026-10-27T02:00:00Z'), 'America/Sao_Paulo').toISOString(),
        '2026-10-26T03:00:00.000Z',
      );
      assert.equal(
        startOfDayInZone(new Date('2026-10-27T02:00:00Z'), 'UTC').toISOString(),
        '2026-10-27T00:00:00.000Z',
      );
    });
  });
});

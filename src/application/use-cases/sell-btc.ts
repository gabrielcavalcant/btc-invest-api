import { TransactionType } from '../../domain/entities';
import { NotFoundError } from '../../domain/errors';
import { planSell } from '../../domain/services/sell-planner';
import type { Clock, IdGenerator, Notifier, QuoteProvider, UnitOfWork } from '../ports';

export interface SellBtcOutput {
  amountCents: bigint;
  btcSats: bigint;
  priceCents: bigint;
  balanceCents: bigint;
  liquidatedInvestments: string[];
  reinvestment: {
    investmentId: string;
    amountCents: bigint;
    btcSats: bigint;
    priceCents: bigint;
  } | null;
  soldAt: Date;
}

/**
 * Sells BTC until the requested BRL amount is reached, FIFO, at the BUY (bid) price.
 * The money goes back to the account balance.
 */
export class SellBtc {
  constructor(
    private readonly deps: {
      uow: UnitOfWork;
      quotes: QuoteProvider;
      notifier: Notifier;
      ids: IdGenerator;
      clock: Clock;
    },
  ) {}

  async execute(input: { accountId: string; amountCents: bigint }): Promise<SellBtcOutput> {
    const quote = await this.deps.quotes.getQuote();
    const bidCents = quote.buyCents;
    const now = this.deps.clock.now();

    const result = await this.deps.uow.run(async ({ accounts, investments, transactions }) => {
      // Locking the account row serializes concurrent sells/purchases of the same customer.
      const account = await accounts.findByIdForUpdate(input.accountId);
      if (!account) throw new NotFoundError('Account not found');

      const open = await investments.findOpenByAccount(account.id);
      const plan = planSell(open, input.amountCents, bidCents);

      await investments.markLiquidated(
        plan.liquidations.map((l) => l.investment.id),
        now,
      );
      for (const liquidation of plan.liquidations) {
        await transactions.create({
          id: this.deps.ids.next(),
          accountId: account.id,
          type: TransactionType.SELL,
          amountCents: liquidation.cents,
          btcSats: liquidation.sats,
          btcPriceCents: bidCents,
          investmentId: liquidation.investment.id,
          createdAt: now,
        });
      }

      let reinvestment: SellBtcOutput['reinvestment'] = null;
      if (plan.reinvestment) {
        const r = plan.reinvestment;
        const investmentId = this.deps.ids.next();
        await investments.create({
          id: investmentId,
          accountId: account.id,
          btcSats: r.sats,
          investedCents: r.investedCents,
          priceCents: r.priceCents,
          purchasedAt: r.purchasedAt,
          liquidatedAt: null,
          originInvestmentId: r.origin.id,
        });
        await transactions.create({
          id: this.deps.ids.next(),
          accountId: account.id,
          type: TransactionType.REINVESTMENT,
          amountCents: r.cents,
          btcSats: r.sats,
          btcPriceCents: r.priceCents,
          investmentId,
          createdAt: now,
        });
        reinvestment = {
          investmentId,
          amountCents: r.cents,
          btcSats: r.sats,
          priceCents: r.priceCents,
        };
      }

      const balanceCents = account.balanceCents + plan.creditedCents;
      await accounts.updateBalance(account.id, balanceCents);

      return { account, plan, balanceCents, reinvestment };
    });

    await this.deps.notifier.btcSold({
      to: result.account.email,
      name: result.account.name,
      btcSats: result.plan.soldSats,
      amountCents: result.plan.creditedCents,
      priceCents: bidCents,
    });

    return {
      amountCents: result.plan.creditedCents,
      btcSats: result.plan.soldSats,
      priceCents: bidCents,
      balanceCents: result.balanceCents,
      liquidatedInvestments: result.plan.liquidations.map((l) => l.investment.id),
      reinvestment: result.reinvestment,
      soldAt: now,
    };
  }
}

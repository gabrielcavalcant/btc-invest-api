import { TransactionType } from '../../domain/entities';
import { InsufficientFundsError, NotFoundError, ValidationError } from '../../domain/errors';
import { centsToSats } from '../../domain/money';
import type { Clock, IdGenerator, Notifier, QuoteProvider, UnitOfWork } from '../ports';

export interface PurchaseBtcOutput {
  investmentId: string;
  amountCents: bigint;
  btcSats: bigint;
  priceCents: bigint;
  balanceCents: bigint;
  purchasedAt: Date;
}

/** Buys BTC with the available balance, converting BRL by the SELL (ask) price. */
export class PurchaseBtc {
  constructor(
    private readonly deps: {
      uow: UnitOfWork;
      quotes: QuoteProvider;
      notifier: Notifier;
      ids: IdGenerator;
      clock: Clock;
    },
  ) {}

  async execute(input: { accountId: string; amountCents: bigint }): Promise<PurchaseBtcOutput> {
    const quote = await this.deps.quotes.getQuote();
    const priceCents = quote.sellCents;
    const btcSats = centsToSats(input.amountCents, priceCents);
    if (btcSats <= 0n) throw new ValidationError('Amount is too small to buy any satoshi');

    const now = this.deps.clock.now();

    const result = await this.deps.uow.run(async ({ accounts, investments, transactions }) => {
      const account = await accounts.findByIdForUpdate(input.accountId);
      if (!account) throw new NotFoundError('Account not found');
      if (account.balanceCents < input.amountCents) {
        throw new InsufficientFundsError('Insufficient balance');
      }

      const balanceCents = account.balanceCents - input.amountCents;
      await accounts.updateBalance(account.id, balanceCents);

      const investmentId = this.deps.ids.next();
      await investments.create({
        id: investmentId,
        accountId: account.id,
        btcSats,
        investedCents: input.amountCents,
        priceCents,
        purchasedAt: now,
        liquidatedAt: null,
        originInvestmentId: null,
      });

      await transactions.create({
        id: this.deps.ids.next(),
        accountId: account.id,
        type: TransactionType.PURCHASE,
        amountCents: input.amountCents,
        btcSats,
        btcPriceCents: priceCents,
        investmentId,
        createdAt: now,
      });

      return { account, balanceCents, investmentId };
    });

    await this.deps.notifier.btcPurchased({
      to: result.account.email,
      name: result.account.name,
      amountCents: input.amountCents,
      btcSats,
      priceCents,
    });

    return {
      investmentId: result.investmentId,
      amountCents: input.amountCents,
      btcSats,
      priceCents,
      balanceCents: result.balanceCents,
      purchasedAt: now,
    };
  }
}

import { TransactionType } from '../../domain/entities';
import { NotFoundError } from '../../domain/errors';
import type { Clock, IdGenerator, Notifier, UnitOfWork } from '../ports';

export interface DepositOutput {
  transactionId: string;
  amountCents: bigint;
  balanceCents: bigint;
  createdAt: Date;
}

export class Deposit {
  constructor(
    private readonly deps: {
      uow: UnitOfWork;
      notifier: Notifier;
      ids: IdGenerator;
      clock: Clock;
    },
  ) {}

  async execute(input: { accountId: string; amountCents: bigint }): Promise<DepositOutput> {
    const now = this.deps.clock.now();

    const result = await this.deps.uow.run(async ({ accounts, transactions }) => {
      const account = await accounts.findByIdForUpdate(input.accountId);
      if (!account) throw new NotFoundError('Account not found');

      const balanceCents = account.balanceCents + input.amountCents;
      await accounts.updateBalance(account.id, balanceCents);

      const transactionId = this.deps.ids.next();
      await transactions.create({
        id: transactionId,
        accountId: account.id,
        type: TransactionType.DEPOSIT,
        amountCents: input.amountCents,
        btcSats: null,
        btcPriceCents: null,
        investmentId: null,
        createdAt: now,
      });

      return { account, balanceCents, transactionId };
    });

    await this.deps.notifier.depositMade({
      to: result.account.email,
      name: result.account.name,
      amountCents: input.amountCents,
    });

    return {
      transactionId: result.transactionId,
      amountCents: input.amountCents,
      balanceCents: result.balanceCents,
      createdAt: now,
    };
  }
}

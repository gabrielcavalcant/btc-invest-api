import type { Transaction } from '../../domain/entities';
import { ValidationError } from '../../domain/errors';
import type { Clock, TransactionRepository } from '../ports';

export const DEFAULT_STATEMENT_DAYS = 90;
const DAY_MS = 24 * 60 * 60 * 1000;

export class GetStatement {
  constructor(private readonly deps: { transactions: TransactionRepository; clock: Clock }) {}

  /** Defaults to the last 90 days when no interval is informed. */
  async execute(input: {
    accountId: string;
    from?: Date;
    to?: Date;
  }): Promise<{ from: Date; to: Date; items: Transaction[] }> {
    const to = input.to ?? this.deps.clock.now();
    const from = input.from ?? new Date(to.getTime() - DEFAULT_STATEMENT_DAYS * DAY_MS);
    if (from > to) throw new ValidationError('"from" must be before "to"');

    const items = await this.deps.transactions.findByAccountInRange(input.accountId, from, to);
    return { from, to, items: [...items].sort(chronological) };
  }
}

// Movements of the same operation share the timestamp: a sale shows before its reinvestment.
const TYPE_ORDER: Record<Transaction['type'], number> = {
  DEPOSIT: 0,
  PURCHASE: 1,
  SELL: 2,
  REINVESTMENT: 3,
};

function chronological(a: Transaction, b: Transaction): number {
  return a.createdAt.getTime() - b.createdAt.getTime() || TYPE_ORDER[a.type] - TYPE_ORDER[b.type];
}

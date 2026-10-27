import { NotFoundError } from '../../domain/errors';
import type { AccountRepository } from '../ports';

export class GetBalance {
  constructor(private readonly deps: { accounts: AccountRepository }) {}

  async execute(accountId: string): Promise<{ balanceCents: bigint }> {
    const account = await this.deps.accounts.findById(accountId);
    if (!account) throw new NotFoundError('Account not found');
    return { balanceCents: account.balanceCents };
  }
}

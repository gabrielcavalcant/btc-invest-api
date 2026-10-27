import type { Account } from '../../domain/entities';
import { ConflictError } from '../../domain/errors';
import type { AccountRepository, Clock, IdGenerator, PasswordHasher } from '../ports';

export interface RegisterAccountInput {
  name: string;
  email: string;
  password: string;
}

export interface RegisterAccountOutput {
  id: string;
  name: string;
  email: string;
  createdAt: Date;
}

export class RegisterAccount {
  constructor(
    private readonly deps: {
      accounts: AccountRepository;
      hasher: PasswordHasher;
      ids: IdGenerator;
      clock: Clock;
    },
  ) {}

  async execute(input: RegisterAccountInput): Promise<RegisterAccountOutput> {
    const email = input.email.trim().toLowerCase();
    if (await this.deps.accounts.findByEmail(email)) {
      throw new ConflictError('E-mail already registered');
    }

    const account: Account = {
      id: this.deps.ids.next(),
      name: input.name.trim(),
      email,
      passwordHash: await this.deps.hasher.hash(input.password),
      balanceCents: 0n,
      createdAt: this.deps.clock.now(),
    };
    await this.deps.accounts.create(account);

    return {
      id: account.id,
      name: account.name,
      email: account.email,
      createdAt: account.createdAt,
    };
  }
}

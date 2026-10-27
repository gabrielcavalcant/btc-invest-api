import { randomUUID } from 'node:crypto';
import { UnauthorizedError } from '../../domain/errors';
import type { AccountRepository, PasswordHasher, TokenIssuer } from '../ports';

export class Authenticate {
  /**
   * Hash compared when the e-mail does not exist, so the response time does not
   * reveal which e-mails are registered (user enumeration).
   */
  private dummyHash: Promise<string> | null = null;

  constructor(
    private readonly deps: {
      accounts: AccountRepository;
      hasher: PasswordHasher;
      tokens: TokenIssuer;
    },
  ) {}

  async execute(input: { email: string; password: string }): Promise<{ token: string }> {
    const account = await this.deps.accounts.findByEmail(input.email.trim().toLowerCase());
    this.dummyHash ??= this.deps.hasher.hash(randomUUID());
    const valid = await this.deps.hasher.compare(
      input.password,
      account?.passwordHash ?? (await this.dummyHash),
    );
    if (!account || !valid) throw new UnauthorizedError('Invalid e-mail or password');

    return { token: await this.deps.tokens.issue(account.id) };
  }
}

import type {
  AccountRepository,
  Clock,
  IdGenerator,
  InvestmentRepository,
  Notifier,
  PasswordHasher,
  PriceHistoryRepository,
  QuoteProvider,
  TokenIssuer,
  TransactionalRepositories,
  TransactionRepository,
  UnitOfWork,
} from '../../src/application/ports';
import type {
  Account,
  Investment,
  PriceSnapshot,
  Quote,
  Transaction,
  TransactionType,
} from '../../src/domain/entities';

/** In-memory adapters: let us test every use case without database, Redis or network. */

export class InMemoryDb {
  accounts = new Map<string, Account>();
  investments = new Map<string, Investment>();
  transactions: Transaction[] = [];
  history = new Map<number, PriceSnapshot>();

  snapshot() {
    return {
      accounts: new Map([...this.accounts].map(([k, v]) => [k, { ...v }])),
      investments: new Map([...this.investments].map(([k, v]) => [k, { ...v }])),
      transactions: this.transactions.map((t) => ({ ...t })),
    };
  }

  restore(s: ReturnType<InMemoryDb['snapshot']>) {
    this.accounts = s.accounts;
    this.investments = s.investments;
    this.transactions = s.transactions;
  }
}

export class InMemoryAccounts implements AccountRepository {
  constructor(private readonly db: InMemoryDb) {}
  async create(account: Account) {
    this.db.accounts.set(account.id, { ...account });
  }
  async findById(id: string) {
    const a = this.db.accounts.get(id);
    return a ? { ...a } : null;
  }
  async findByEmail(email: string) {
    const a = [...this.db.accounts.values()].find((x) => x.email === email);
    return a ? { ...a } : null;
  }
  findByIdForUpdate(id: string) {
    return this.findById(id);
  }
  async updateBalance(id: string, balanceCents: bigint) {
    const a = this.db.accounts.get(id);
    if (a) a.balanceCents = balanceCents;
  }
}

export class InMemoryInvestments implements InvestmentRepository {
  constructor(private readonly db: InMemoryDb) {}
  async create(investment: Investment) {
    this.db.investments.set(investment.id, { ...investment });
  }
  async findOpenByAccount(accountId: string) {
    return [...this.db.investments.values()]
      .filter((i) => i.accountId === accountId && !i.liquidatedAt)
      .sort((a, b) => a.purchasedAt.getTime() - b.purchasedAt.getTime())
      .map((i) => ({ ...i }));
  }
  async markLiquidated(ids: string[], at: Date) {
    for (const id of ids) {
      const i = this.db.investments.get(id);
      if (i) i.liquidatedAt = at;
    }
  }
}

export class InMemoryTransactions implements TransactionRepository {
  constructor(private readonly db: InMemoryDb) {}
  async create(transaction: Transaction) {
    this.db.transactions.push({ ...transaction });
  }
  async findByAccountInRange(accountId: string, from: Date, to: Date) {
    return this.db.transactions.filter(
      (t) => t.accountId === accountId && t.createdAt >= from && t.createdAt <= to,
    );
  }
  async sumBtcByTypeInRange(from: Date, to: Date) {
    const sums: Partial<Record<TransactionType, bigint>> = {};
    for (const t of this.db.transactions) {
      if (t.createdAt >= from && t.createdAt < to && t.btcSats !== null) {
        sums[t.type] = (sums[t.type] ?? 0n) + t.btcSats;
      }
    }
    return sums;
  }
}

export class InMemoryPriceHistory implements PriceHistoryRepository {
  constructor(private readonly db: InMemoryDb) {}
  async save(s: PriceSnapshot) {
    this.db.history.set(s.capturedAt.getTime(), { ...s });
  }
  async findInRange(from: Date, to: Date) {
    return [...this.db.history.values()]
      .filter((s) => s.capturedAt >= from && s.capturedAt <= to)
      .sort((a, b) => a.capturedAt.getTime() - b.capturedAt.getTime());
  }
  async deleteOlderThan(date: Date) {
    let removed = 0;
    for (const [k, s] of this.db.history) {
      if (s.capturedAt < date) {
        this.db.history.delete(k);
        removed++;
      }
    }
    return removed;
  }
}

/** Rolls back the in-memory state if the work throws, like a real transaction. */
export class InMemoryUnitOfWork implements UnitOfWork {
  constructor(
    private readonly db: InMemoryDb,
    private readonly repos: TransactionalRepositories,
  ) {}
  async run<T>(work: (repos: TransactionalRepositories) => Promise<T>): Promise<T> {
    const backup = this.db.snapshot();
    try {
      return await work(this.repos);
    } catch (error) {
      this.db.restore(backup);
      throw error;
    }
  }
}

export class FixedQuote implements QuoteProvider {
  constructor(public quote: Omit<Quote, 'fetchedAt'>) {}
  async getQuote(): Promise<Quote> {
    return { ...this.quote, fetchedAt: new Date() };
  }
}

export class FakeClock implements Clock {
  constructor(public current = new Date('2026-10-26T12:00:00Z')) {}
  now() {
    return new Date(this.current);
  }
  advance(ms: number) {
    this.current = new Date(this.current.getTime() + ms);
  }
}

export class SequentialIds implements IdGenerator {
  private n = 0;
  next() {
    this.n += 1;
    return `00000000-0000-4000-8000-${String(this.n).padStart(12, '0')}`;
  }
}

export class PlainHasher implements PasswordHasher {
  async hash(plain: string) {
    return `hashed:${plain}`;
  }
  async compare(plain: string, hash: string) {
    return hash === `hashed:${plain}`;
  }
}

export class FakeTokens implements TokenIssuer {
  async issue(accountId: string) {
    return `token-for-${accountId}`;
  }
}

export class RecordingNotifier implements Notifier {
  sent: { kind: string; payload: unknown }[] = [];
  async depositMade(payload: Parameters<Notifier['depositMade']>[0]) {
    this.sent.push({ kind: 'deposit', payload });
  }
  async btcPurchased(payload: Parameters<Notifier['btcPurchased']>[0]) {
    this.sent.push({ kind: 'purchase', payload });
  }
  async btcSold(payload: Parameters<Notifier['btcSold']>[0]) {
    this.sent.push({ kind: 'sell', payload });
  }
}

/** Builds the whole application wired with in-memory adapters. */
export function buildTestContext(quote = { buyCents: 30_000_000n, sellCents: 30_100_000n }) {
  const db = new InMemoryDb();
  const accounts = new InMemoryAccounts(db);
  const investments = new InMemoryInvestments(db);
  const transactions = new InMemoryTransactions(db);
  const history = new InMemoryPriceHistory(db);
  const uow = new InMemoryUnitOfWork(db, { accounts, investments, transactions });
  return {
    db,
    accounts,
    investments,
    transactions,
    history,
    uow,
    quotes: new FixedQuote(quote),
    clock: new FakeClock(),
    ids: new SequentialIds(),
    hasher: new PlainHasher(),
    tokens: new FakeTokens(),
    notifier: new RecordingNotifier(),
  };
}

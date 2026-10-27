import type {
  Account,
  Investment,
  PriceSnapshot,
  Quote,
  Transaction,
  TransactionType,
} from '../domain/entities';

/**
 * Ports (hexagonal architecture): the application layer depends only on these
 * interfaces. Infra provides the adapters (TypeORM, Redis, BullMQ, SendGrid...).
 */

export interface AccountRepository {
  create(account: Account): Promise<void>;
  findById(id: string): Promise<Account | null>;
  findByEmail(email: string): Promise<Account | null>;
  /** Loads the account locking its row until the current unit of work ends. */
  findByIdForUpdate(id: string): Promise<Account | null>;
  updateBalance(id: string, balanceCents: bigint): Promise<void>;
}

export interface InvestmentRepository {
  create(investment: Investment): Promise<void>;
  /** Open (not liquidated) investments, oldest first. */
  findOpenByAccount(accountId: string): Promise<Investment[]>;
  markLiquidated(ids: string[], at: Date): Promise<void>;
}

export interface TransactionRepository {
  create(transaction: Transaction): Promise<void>;
  findByAccountInRange(accountId: string, from: Date, to: Date): Promise<Transaction[]>;
  /** Sum of `btcSats` grouped by type for every account in [from, to). */
  sumBtcByTypeInRange(from: Date, to: Date): Promise<Partial<Record<TransactionType, bigint>>>;
}

export interface PriceHistoryRepository {
  /** Inserts or replaces the snapshot of that exact slot. */
  save(snapshot: PriceSnapshot): Promise<void>;
  findInRange(from: Date, to: Date): Promise<PriceSnapshot[]>;
  /** Returns how many rows were removed. */
  deleteOlderThan(date: Date): Promise<number>;
}

export interface TransactionalRepositories {
  accounts: AccountRepository;
  investments: InvestmentRepository;
  transactions: TransactionRepository;
}

/** Runs the work inside a single database transaction (all or nothing). */
export interface UnitOfWork {
  run<T>(work: (repos: TransactionalRepositories) => Promise<T>): Promise<T>;
}

export interface QuoteProvider {
  getQuote(): Promise<Quote>;
}

export interface PasswordHasher {
  hash(plain: string): Promise<string>;
  compare(plain: string, hash: string): Promise<boolean>;
}

export interface TokenIssuer {
  issue(accountId: string): Promise<string>;
}

export interface Clock {
  now(): Date;
}

export interface IdGenerator {
  next(): string;
}

/** Notifications are async (queued) and must never break the business operation. */
export interface Notifier {
  depositMade(input: { to: string; name: string; amountCents: bigint }): Promise<void>;
  btcPurchased(input: {
    to: string;
    name: string;
    amountCents: bigint;
    btcSats: bigint;
    priceCents: bigint;
  }): Promise<void>;
  btcSold(input: {
    to: string;
    name: string;
    btcSats: bigint;
    amountCents: bigint;
    priceCents: bigint;
  }): Promise<void>;
}

import { In, IsNull, type DataSource, type EntityManager } from 'typeorm';
import type {
  AccountRepository,
  InvestmentRepository,
  PriceHistoryRepository,
  TransactionalRepositories,
  TransactionRepository,
  UnitOfWork,
} from '../../application/ports';
import type {
  Account,
  Investment,
  PriceSnapshot,
  Transaction,
  TransactionType,
} from '../../domain/entities';
import { AccountSchema, InvestmentSchema, PriceSnapshotSchema, TransactionSchema } from './schemas';

/**
 * Repositories receive an EntityManager: the same class works inside or outside a
 * database transaction (see TypeOrmUnitOfWork).
 */

export class TypeOrmAccountRepository implements AccountRepository {
  constructor(private readonly manager: EntityManager) {}

  private get repo() {
    return this.manager.getRepository(AccountSchema);
  }

  async create(account: Account): Promise<void> {
    await this.repo.insert(account);
  }

  findById(id: string): Promise<Account | null> {
    return this.repo.findOneBy({ id });
  }

  findByEmail(email: string): Promise<Account | null> {
    return this.repo.findOneBy({ email });
  }

  findByIdForUpdate(id: string): Promise<Account | null> {
    // SELECT ... FOR UPDATE: concurrent operations on the same account wait in line,
    // so two requests can never spend the same balance twice.
    return this.repo.findOne({ where: { id }, lock: { mode: 'pessimistic_write' } });
  }

  async updateBalance(id: string, balanceCents: bigint): Promise<void> {
    await this.repo.update({ id }, { balanceCents });
  }
}

export class TypeOrmInvestmentRepository implements InvestmentRepository {
  constructor(private readonly manager: EntityManager) {}

  private get repo() {
    return this.manager.getRepository(InvestmentSchema);
  }

  async create(investment: Investment): Promise<void> {
    await this.repo.insert(investment);
  }

  findOpenByAccount(accountId: string): Promise<Investment[]> {
    return this.repo.find({
      where: { accountId, liquidatedAt: IsNull() },
      order: { purchasedAt: 'ASC', id: 'ASC' },
    });
  }

  async markLiquidated(ids: string[], at: Date): Promise<void> {
    if (ids.length === 0) return;
    await this.repo.update({ id: In(ids) }, { liquidatedAt: at });
  }
}

export class TypeOrmTransactionRepository implements TransactionRepository {
  constructor(private readonly manager: EntityManager) {}

  private get repo() {
    return this.manager.getRepository(TransactionSchema);
  }

  async create(transaction: Transaction): Promise<void> {
    await this.repo.insert(transaction);
  }

  findByAccountInRange(accountId: string, from: Date, to: Date): Promise<Transaction[]> {
    return this.repo
      .createQueryBuilder('t')
      .where('t.accountId = :accountId', { accountId })
      .andWhere('t.createdAt BETWEEN :from AND :to', { from, to })
      .orderBy('t.createdAt', 'ASC')
      .getMany();
  }

  async sumBtcByTypeInRange(
    from: Date,
    to: Date,
  ): Promise<Partial<Record<TransactionType, bigint>>> {
    const rows = await this.repo
      .createQueryBuilder('t')
      .select('t.type', 'type')
      .addSelect('COALESCE(SUM(t.btc_sats), 0)::text', 'total')
      .where('t.createdAt >= :from AND t.createdAt < :to', { from, to })
      .groupBy('t.type')
      .getRawMany<{ type: TransactionType; total: string }>();

    return Object.fromEntries(rows.map((r) => [r.type, BigInt(r.total)]));
  }
}

export class TypeOrmPriceHistoryRepository implements PriceHistoryRepository {
  constructor(private readonly manager: EntityManager) {}

  private get repo() {
    return this.manager.getRepository(PriceSnapshotSchema);
  }

  async save(snapshot: PriceSnapshot): Promise<void> {
    await this.repo.upsert(snapshot, ['capturedAt']);
  }

  findInRange(from: Date, to: Date): Promise<PriceSnapshot[]> {
    return this.repo
      .createQueryBuilder('p')
      .where('p.capturedAt BETWEEN :from AND :to', { from, to })
      .orderBy('p.capturedAt', 'ASC')
      .getMany();
  }

  async deleteOlderThan(date: Date): Promise<number> {
    const result = await this.repo
      .createQueryBuilder()
      .delete()
      .where('captured_at < :date', { date })
      .execute();
    return result.affected ?? 0;
  }
}

export function createRepositories(manager: EntityManager): TransactionalRepositories {
  return {
    accounts: new TypeOrmAccountRepository(manager),
    investments: new TypeOrmInvestmentRepository(manager),
    transactions: new TypeOrmTransactionRepository(manager),
  };
}

export class TypeOrmUnitOfWork implements UnitOfWork {
  constructor(private readonly dataSource: DataSource) {}

  run<T>(work: (repos: TransactionalRepositories) => Promise<T>): Promise<T> {
    return this.dataSource.transaction((manager) => work(createRepositories(manager)));
  }
}

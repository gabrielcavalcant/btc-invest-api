import { randomUUID } from 'node:crypto';
import type { Clock, IdGenerator, PasswordHasher, QuoteProvider } from '../application/ports';
import { Deposit } from '../application/use-cases/deposit';
import { GetBalance } from '../application/use-cases/get-balance';
import { GetDailyVolume } from '../application/use-cases/get-daily-volume';
import { GetPosition } from '../application/use-cases/get-position';
import { GetQuote } from '../application/use-cases/get-quote';
import { GetStatement } from '../application/use-cases/get-statement';
import {
  CapturePriceSnapshot,
  GetPriceHistory,
  PurgeOldPriceHistory,
} from '../application/use-cases/price-history';
import { PurchaseBtc } from '../application/use-cases/purchase-btc';
import { RegisterAccount } from '../application/use-cases/register-account';
import { SellBtc } from '../application/use-cases/sell-btc';
import type { Env } from '../config/env';
import { createRedis, redisOptionsFromUrl } from '../infra/cache/redis';
import { createDataSource } from '../infra/database/data-source';
import {
  createRepositories,
  TypeOrmPriceHistoryRepository,
  TypeOrmUnitOfWork,
} from '../infra/database/repositories';
import type { Logger } from '../infra/logger';
import { QueueNotifier } from '../infra/queue/queue.notifier';
import { createEmailQueue } from '../infra/queue/queues';
import { CachedQuoteProvider } from '../infra/quotes/cached.quote-provider';
import { FakeQuoteProvider } from '../infra/quotes/fake.quote-provider';
import { MercadoBitcoinQuoteProvider } from '../infra/quotes/mercado-bitcoin.quote-provider';
import { BcryptPasswordHasher } from '../infra/security/bcrypt.hasher';

export const systemClock: Clock = { now: () => new Date() };
export const uuidGenerator: IdGenerator = { next: () => randomUUID() };

export function createQuoteProvider(env: Env): QuoteProvider {
  return env.QUOTE_PROVIDER === 'fake'
    ? new FakeQuoteProvider()
    : new MercadoBitcoinQuoteProvider({ url: env.QUOTE_URL, timeoutMs: env.QUOTE_TIMEOUT_MS });
}

/**
 * Composition root: the only place that knows the concrete adapters.
 * Creates the infrastructure and injects it into the use cases.
 */
export async function createContainer(env: Env, logger: Logger) {
  const dataSource = await createDataSource({
    url: env.DATABASE_URL,
    logging: env.DATABASE_LOGGING,
  }).initialize();
  const redis = createRedis(env.REDIS_URL);
  // enableOfflineQueue=false: if Redis is down, enqueueing fails fast instead of hanging.
  const emailQueue = createEmailQueue({
    ...redisOptionsFromUrl(env.REDIS_URL),
    enableOfflineQueue: false,
  });

  const repos = createRepositories(dataSource.manager);
  const history = new TypeOrmPriceHistoryRepository(dataSource.manager);
  const uow = new TypeOrmUnitOfWork(dataSource);
  const quotes = new CachedQuoteProvider(createQuoteProvider(env), redis, logger, {
    ttlSeconds: env.QUOTE_CACHE_TTL_SECONDS,
  });
  const notifier = new QueueNotifier(emailQueue, logger);
  const hasher: PasswordHasher = new BcryptPasswordHasher(env.BCRYPT_ROUNDS);
  const clock = systemClock;
  const ids = uuidGenerator;

  const useCases = {
    registerAccount: new RegisterAccount({ accounts: repos.accounts, hasher, ids, clock }),
    deposit: new Deposit({ uow, notifier, ids, clock }),
    getBalance: new GetBalance({ accounts: repos.accounts }),
    getQuote: new GetQuote({ quotes }),
    purchaseBtc: new PurchaseBtc({ uow, quotes, notifier, ids, clock }),
    getPosition: new GetPosition({ investments: repos.investments, quotes }),
    sellBtc: new SellBtc({ uow, quotes, notifier, ids, clock }),
    getStatement: new GetStatement({ transactions: repos.transactions, clock }),
    getDailyVolume: new GetDailyVolume({
      transactions: repos.transactions,
      clock,
      timeZone: env.APP_TIMEZONE,
    }),
    getPriceHistory: new GetPriceHistory({ history, clock }),
    capturePriceSnapshot: new CapturePriceSnapshot({ quotes, history, clock }),
    purgeOldPriceHistory: new PurgeOldPriceHistory({ history, clock }),
  };

  return {
    env,
    useCases,
    accounts: repos.accounts,
    hasher,
    redis,
    dataSource,
    async healthCheck() {
      await dataSource.query('SELECT 1');
      await redis.ping();
    },
    async close() {
      await emailQueue.close();
      redis.disconnect();
      await dataSource.destroy();
    },
  };
}

export type Container = Awaited<ReturnType<typeof createContainer>>;

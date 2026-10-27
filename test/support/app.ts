import { Deposit } from '../../src/application/use-cases/deposit';
import { GetBalance } from '../../src/application/use-cases/get-balance';
import { GetDailyVolume } from '../../src/application/use-cases/get-daily-volume';
import { GetPosition } from '../../src/application/use-cases/get-position';
import { GetQuote } from '../../src/application/use-cases/get-quote';
import { GetStatement } from '../../src/application/use-cases/get-statement';
import {
  CapturePriceSnapshot,
  GetPriceHistory,
  PurgeOldPriceHistory,
} from '../../src/application/use-cases/price-history';
import { PurchaseBtc } from '../../src/application/use-cases/purchase-btc';
import { RegisterAccount } from '../../src/application/use-cases/register-account';
import { SellBtc } from '../../src/application/use-cases/sell-btc';
import { loadEnv } from '../../src/config/env';
import { buildApp } from '../../src/http/app';
import { buildTestContext } from './in-memory';

export const testEnv = loadEnv({
  NODE_ENV: 'test',
  DATABASE_URL: 'postgres://unused:unused@localhost:5432/unused',
  REDIS_URL: 'redis://localhost:6379',
  JWT_SECRET: 'test-secret-with-at-least-32-characters!!',
  RATE_LIMIT_MAX: '1000',
  APP_TIMEZONE: 'America/Sao_Paulo',
});

/** Fastify app wired with in-memory adapters: exercises the real HTTP layer without infra. */
export async function buildInMemoryApp() {
  const ctx = buildTestContext();
  const useCases = {
    registerAccount: new RegisterAccount(ctx),
    deposit: new Deposit(ctx),
    getBalance: new GetBalance(ctx),
    getQuote: new GetQuote(ctx),
    purchaseBtc: new PurchaseBtc(ctx),
    getPosition: new GetPosition(ctx),
    sellBtc: new SellBtc(ctx),
    getStatement: new GetStatement(ctx),
    getDailyVolume: new GetDailyVolume({ ...ctx, timeZone: testEnv.APP_TIMEZONE }),
    getPriceHistory: new GetPriceHistory(ctx),
    capturePriceSnapshot: new CapturePriceSnapshot(ctx),
    purgeOldPriceHistory: new PurgeOldPriceHistory(ctx),
  };
  const app = await buildApp({
    env: testEnv,
    useCases,
    accounts: ctx.accounts,
    hasher: ctx.hasher,
    healthCheck: async () => undefined,
  });
  return { app, ctx };
}

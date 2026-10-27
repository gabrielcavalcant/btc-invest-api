import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { loadEnv } from '../../src/config/env';
import { buildApp } from '../../src/http/app';
import { createLogger } from '../../src/infra/logger';
import { createContainer, type Container } from '../../src/main/container';

/**
 * End-to-end against real PostgreSQL + Redis (docker compose up -d postgres redis).
 * Uses the offline quote (QUOTE_PROVIDER=fake) so it does not depend on the internet.
 * Point DATABASE_URL to a test database: the tables are truncated!
 * Redis uses TEST_REDIS_URL (default: logical db 1) because it is flushed too.
 */
describe('API e2e (PostgreSQL + Redis)', () => {
  const env = loadEnv({
    ...process.env,
    NODE_ENV: 'test',
    QUOTE_PROVIDER: 'fake',
    LOG_LEVEL: 'silent',
    RATE_LIMIT_MAX: '10000',
    DATABASE_URL: process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL,
    REDIS_URL: process.env.TEST_REDIS_URL ?? 'redis://localhost:6379/1',
  });
  let container: Container;
  let app: Awaited<ReturnType<typeof buildApp>>;
  let token: string;
  const auth = () => ({ authorization: `Bearer ${token}` });

  before(async () => {
    container = await createContainer(env, createLogger(env));
    await container.dataSource.runMigrations();
    await container.dataSource.query(
      'TRUNCATE transactions, investments, accounts, price_history CASCADE',
    );
    await container.redis.flushdb();
    app = await buildApp({ ...container });

    await app.inject({
      method: 'POST',
      url: '/account',
      payload: { name: 'E2E User', email: 'e2e@example.com', password: 'e2e-password' },
    });
    const login = await app.inject({
      method: 'POST',
      url: '/login',
      payload: { email: 'e2e@example.com', password: 'e2e-password' },
    });
    token = login.json().token;
  });

  after(async () => {
    await app?.close();
    await container?.close();
  });

  it('runs the whole flow persisting in the database', async () => {
    const deposit = await app.inject({
      method: 'POST',
      url: '/account/deposit',
      headers: auth(),
      payload: { amount: 5000 },
    });
    assert.equal(deposit.statusCode, 201);

    const purchase = await app.inject({
      method: 'POST',
      url: '/btc/purchase',
      headers: auth(),
      payload: { amount: 2000 },
    });
    assert.equal(purchase.statusCode, 201);

    const position = await app.inject({ method: 'GET', url: '/btc', headers: auth() });
    assert.equal(position.json().investments.length, 1);

    const sell = await app.inject({
      method: 'POST',
      url: '/btc/sell',
      headers: auth(),
      payload: { amount: 500 },
    });
    assert.equal(sell.statusCode, 201);
    assert.equal(sell.json().amount, '500.00');

    const balance = await app.inject({ method: 'GET', url: '/account/balance', headers: auth() });
    assert.equal(balance.json().balance, '3500.00');

    const extract = await app.inject({ method: 'GET', url: '/extract', headers: auth() });
    assert.deepEqual(
      extract.json().items.map((t: { type: string }) => t.type),
      ['DEPOSIT', 'PURCHASE', 'SELL', 'REINVESTMENT'],
    );

    const volume = await app.inject({ method: 'GET', url: '/volume', headers: auth() });
    assert.equal(volume.statusCode, 200);
    assert.ok(Number(volume.json().buy) > 0);

    await container.useCases.capturePriceSnapshot.execute();
    const history = await app.inject({ method: 'GET', url: '/history', headers: auth() });
    assert.equal(history.json().length, 1);
  });

  it('never spends the same balance twice under concurrent purchases', async () => {
    const balance = await app.inject({ method: 'GET', url: '/account/balance', headers: auth() });
    const available = Number(balance.json().balance); // 3500.00
    const each = available / 2;

    const results = await Promise.all(
      Array.from({ length: 6 }, () =>
        app.inject({
          method: 'POST',
          url: '/btc/purchase',
          headers: auth(),
          payload: { amount: each },
        }),
      ),
    );
    const codes = results.map((r) => r.statusCode).sort();
    assert.deepEqual(codes, [201, 201, 422, 422, 422, 422]);

    const after = await app.inject({ method: 'GET', url: '/account/balance', headers: auth() });
    assert.equal(after.json().balance, '0.00');
  });
});

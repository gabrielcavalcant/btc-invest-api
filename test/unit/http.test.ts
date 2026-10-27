import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { buildInMemoryApp } from '../support/app';

describe('HTTP API (in-memory adapters)', () => {
  let app: Awaited<ReturnType<typeof buildInMemoryApp>>['app'];
  let ctx: Awaited<ReturnType<typeof buildInMemoryApp>>['ctx'];
  let token: string;

  const auth = () => ({ authorization: `Bearer ${token}` });

  before(async () => {
    ({ app, ctx } = await buildInMemoryApp());
  });

  after(async () => {
    await app.close();
  });

  it('POST /account creates an account (201) and rejects duplicates (409)', async () => {
    const body = { name: 'Maria Silva', email: 'maria@example.com', password: 'super-secret' };
    const created = await app.inject({ method: 'POST', url: '/account', payload: body });
    assert.equal(created.statusCode, 201);
    assert.equal(created.json().email, 'maria@example.com');
    assert.equal(created.json().password, undefined);

    const duplicated = await app.inject({ method: 'POST', url: '/account', payload: body });
    assert.equal(duplicated.statusCode, 409);
  });

  it('POST /account validates the payload (400)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/account',
      payload: { name: 'M', email: 'not-an-email', password: '123' },
    });
    assert.equal(res.statusCode, 400);
    assert.equal(res.json().error.code, 'VALIDATION_ERROR');
    assert.deepEqual(
      res
        .json()
        .error.details.map((d: { field: string }) => d.field)
        .sort(),
      ['email', 'name', 'password'],
    );
  });

  it('POST /login returns a JWT (200) or 401', async () => {
    const wrong = await app.inject({
      method: 'POST',
      url: '/login',
      payload: { email: 'maria@example.com', password: 'wrong-password' },
    });
    assert.equal(wrong.statusCode, 401);

    const res = await app.inject({
      method: 'POST',
      url: '/login',
      payload: { email: 'MARIA@example.com', password: 'super-secret' },
    });
    assert.equal(res.statusCode, 200);
    token = res.json().token;
    assert.match(token, /^[\w-]+\.[\w-]+\.[\w-]+$/);
  });

  it('every other endpoint requires authentication (401)', async () => {
    for (const [method, url] of [
      ['GET', '/account/balance'],
      ['POST', '/account/deposit'],
      ['GET', '/btc/price'],
      ['POST', '/btc/purchase'],
      ['POST', '/btc/sell'],
      ['GET', '/btc'],
      ['GET', '/extract'],
      ['GET', '/volume'],
      ['GET', '/history'],
    ] as const) {
      const res = await app.inject({ method, url });
      assert.equal(res.statusCode, 401, `${method} ${url}`);
    }
    const invalid = await app.inject({
      method: 'GET',
      url: '/account/balance',
      headers: { authorization: 'Bearer invalid.token.here' },
    });
    assert.equal(invalid.statusCode, 401);
  });

  it('deposit -> balance', async () => {
    const bad = await app.inject({
      method: 'POST',
      url: '/account/deposit',
      headers: auth(),
      payload: { amount: -10 },
    });
    assert.equal(bad.statusCode, 400);

    const dep = await app.inject({
      method: 'POST',
      url: '/account/deposit',
      headers: auth(),
      payload: { amount: 10000 },
    });
    assert.equal(dep.statusCode, 201);
    assert.equal(dep.json().balance, '10000.00');

    const balance = await app.inject({ method: 'GET', url: '/account/balance', headers: auth() });
    assert.deepEqual(balance.json(), { balance: '10000.00' });
    assert.equal(ctx.notifier.sent.at(-1)?.kind, 'deposit');
  });

  it('price -> purchase -> position -> sell -> extract -> volume', async () => {
    const price = await app.inject({ method: 'GET', url: '/btc/price', headers: auth() });
    assert.equal(price.statusCode, 200);
    assert.equal(price.json().buy, '300000.00');
    assert.equal(price.json().sell, '301000.00');

    const tooMuch = await app.inject({
      method: 'POST',
      url: '/btc/purchase',
      headers: auth(),
      payload: { amount: 10000.01 },
    });
    assert.equal(tooMuch.statusCode, 422);

    const purchase = await app.inject({
      method: 'POST',
      url: '/btc/purchase',
      headers: auth(),
      payload: { amount: '3010.00' },
    });
    assert.equal(purchase.statusCode, 201);
    assert.equal(purchase.json().btcAmount, '0.01000000');
    assert.equal(purchase.json().balance, '6990.00');

    const position = await app.inject({ method: 'GET', url: '/btc', headers: auth() });
    assert.equal(position.statusCode, 200);
    const [inv] = position.json().investments;
    assert.equal(inv.investedAmount, '3010.00');
    assert.equal(inv.btcPriceAtPurchase, '301000.00');
    assert.equal(inv.currentGrossAmount, '3000.00');
    assert.equal(inv.priceVariationPercent, -0.33);

    const sell = await app.inject({
      method: 'POST',
      url: '/btc/sell',
      headers: auth(),
      payload: { amount: 1000 },
    });
    assert.equal(sell.statusCode, 201);
    assert.equal(sell.json().amount, '1000.00');
    assert.equal(sell.json().balance, '7990.00');
    assert.equal(sell.json().reinvestment.amount, '2000.00');
    assert.equal(sell.json().reinvestment.btcPrice, '301000.00');

    const extract = await app.inject({ method: 'GET', url: '/extract', headers: auth() });
    assert.equal(extract.statusCode, 200);
    assert.deepEqual(
      extract
        .json()
        .items.map((t: { type: string }) => t.type)
        .sort(),
      ['DEPOSIT', 'PURCHASE', 'REINVESTMENT', 'SELL'],
    );

    const badRange = await app.inject({
      method: 'GET',
      url: '/extract?from=2026-10-30&to=2026-10-01',
      headers: auth(),
    });
    assert.equal(badRange.statusCode, 400);

    const volume = await app.inject({ method: 'GET', url: '/volume', headers: auth() });
    assert.equal(volume.json().buy, '0.01000000');
    assert.equal(volume.json().sell, '0.00333334');
  });

  it('GET /history lists the 10-minute snapshots', async () => {
    await ctx.history.save({
      capturedAt: new Date(ctx.clock.now().getTime() - 10 * 60 * 1000),
      buyCents: 30_000_000n,
      sellCents: 30_100_000n,
    });
    const res = await app.inject({ method: 'GET', url: '/history', headers: auth() });
    assert.equal(res.statusCode, 200);
    assert.equal(res.json().length, 1);
    assert.deepEqual(Object.keys(res.json()[0]), ['date', 'buy', 'sell']);
  });

  it('accepts HTML form bodies (x-www-form-urlencoded) with the same validation', async () => {
    const form = { ...auth(), 'content-type': 'application/x-www-form-urlencoded' };
    const before = await app.inject({ method: 'GET', url: '/account/balance', headers: auth() });

    const res = await app.inject({
      method: 'POST',
      url: '/account/deposit',
      headers: form,
      payload: 'amount=10.50',
    });
    assert.equal(res.statusCode, 201);
    assert.equal(res.json().amount, '10.50');
    assert.equal(Number(res.json().balance) - Number(before.json().balance), 10.5);

    const invalid = await app.inject({
      method: 'POST',
      url: '/account/deposit',
      headers: form,
      payload: 'amount=abc',
    });
    assert.equal(invalid.statusCode, 400);
    assert.equal(invalid.json().error.code, 'VALIDATION_ERROR');
  });

  it('GET /docs/json documents every endpoint, with the zod input schemas', async () => {
    const res = await app.inject({ method: 'GET', url: '/docs/json' });
    assert.equal(res.statusCode, 200);
    const spec = res.json();
    assert.deepEqual(Object.keys(spec.paths).sort(), [
      '/account',
      '/account/balance',
      '/account/deposit',
      '/btc',
      '/btc/price',
      '/btc/purchase',
      '/btc/sell',
      '/extract',
      '/health',
      '/history',
      '/login',
      '/volume',
    ]);
    const registerBody = spec.paths['/account'].post.requestBody.content;
    // form first: the Swagger UI renders one input per field
    assert.deepEqual(Object.keys(registerBody), [
      'application/x-www-form-urlencoded',
      'application/json',
    ]);
    assert.deepEqual(registerBody['application/json'].schema.required, [
      'name',
      'email',
      'password',
    ]);
    assert.deepEqual(spec.paths['/btc/sell'].post.security, [{ bearerAuth: [] }]);

    const ui = await app.inject({ method: 'GET', url: '/docs' });
    assert.ok([200, 302].includes(ui.statusCode));
  });

  it('unknown routes return 404 in the standard error format', async () => {
    const res = await app.inject({ method: 'GET', url: '/nope' });
    assert.equal(res.statusCode, 404);
    assert.equal(res.json().error.code, 'NOT_FOUND');
  });
});

import assert from 'node:assert/strict';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { after, before, describe, it } from 'node:test';
import type { Redis } from 'ioredis';
import type { QuoteProvider } from '../../src/application/ports';
import { QuoteUnavailableError } from '../../src/domain/errors';
import type { Logger } from '../../src/infra/logger';
import { CachedQuoteProvider } from '../../src/infra/quotes/cached.quote-provider';
import { brl, emailTemplates } from '../../src/infra/mail/templates';
import { MercadoBitcoinQuoteProvider } from '../../src/infra/quotes/mercado-bitcoin.quote-provider';

describe('MercadoBitcoinQuoteProvider', () => {
  let server: Server;
  let baseUrl: string;
  let nextResponse: { status: number; body: string } = { status: 200, body: '{}' };
  /** Served first, one per request, before falling back to `nextResponse` */
  let queued: { status: number; body: string }[] = [];
  let hits = 0;

  before(async () => {
    server = createServer((_req, res) => {
      hits++;
      const response = queued.shift() ?? nextResponse;
      res.writeHead(response.status, { 'content-type': 'application/json' });
      res.end(response.body);
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  after(() => new Promise<void>((resolve) => server.close(() => resolve())));

  // Generous timeout: the first fetch of the process can be slow on a busy CI machine
  const provider = () => new MercadoBitcoinQuoteProvider({ url: baseUrl, timeoutMs: 5000 });

  it('parses the ticker payload into cents', async () => {
    nextResponse = {
      status: 200,
      body: JSON.stringify({
        ticker: {
          high: '352000.00000000',
          low: '340000.00000000',
          vol: '12.5',
          last: '350100.12345',
          buy: '350000.12345678',
          sell: '350500.99999',
          open: '345000',
          date: 1761490000,
        },
      }),
    };
    const quote = await provider().getQuote();
    assert.equal(quote.buyCents, 35_000_012n);
    assert.equal(quote.sellCents, 35_050_100n);
    assert.equal(quote.fetchedAt.toISOString(), new Date(1761490000 * 1000).toISOString());
  });

  it('retries once on transient failures (5xx), but not on client errors (4xx)', async () => {
    const ticker = JSON.stringify({ ticker: { buy: '350000', sell: '350500' } });
    const retrying = () =>
      new MercadoBitcoinQuoteProvider({ url: baseUrl, timeoutMs: 5000, retryDelayMs: 1 });

    queued = [{ status: 503, body: '{}' }];
    nextResponse = { status: 200, body: ticker };
    hits = 0;
    assert.equal((await retrying().getQuote()).buyCents, 35_000_000n);
    assert.equal(hits, 2);

    nextResponse = { status: 400, body: '{}' };
    hits = 0;
    await assert.rejects(retrying().getQuote(), QuoteUnavailableError);
    assert.equal(hits, 1);
  });

  it('fails with QuoteUnavailableError on HTTP errors or unexpected payloads', async () => {
    nextResponse = { status: 500, body: '{"error":"boom"}' };
    await assert.rejects(provider().getQuote(), QuoteUnavailableError);

    nextResponse = { status: 200, body: '{"unexpected":true}' };
    await assert.rejects(provider().getQuote(), QuoteUnavailableError);

    await assert.rejects(
      new MercadoBitcoinQuoteProvider({ url: 'http://127.0.0.1:1', timeoutMs: 500 }).getQuote(),
      QuoteUnavailableError,
    );
  });
});

describe('CachedQuoteProvider', () => {
  /** Minimal Redis: empty cache that accepts writes */
  const emptyRedis = () => {
    const pipeline = { set: () => pipeline, exec: async () => [] };
    return { get: async () => null, multi: () => pipeline } as unknown as Redis;
  };
  const silentLogger = { warn: () => {} } as unknown as Logger;

  it('shares one external call among concurrent cache misses', async () => {
    let calls = 0;
    const slowProvider: QuoteProvider = {
      getQuote: async () => {
        calls++;
        await new Promise((resolve) => setTimeout(resolve, 20));
        return { buyCents: 1n, sellCents: 2n, fetchedAt: new Date() };
      },
    };
    const cached = new CachedQuoteProvider(slowProvider, emptyRedis(), silentLogger, {
      ttlSeconds: 10,
    });

    const quotes = await Promise.all(Array.from({ length: 5 }, () => cached.getQuote()));
    assert.equal(calls, 1);
    assert.ok(quotes.every((q) => q.sellCents === 2n));

    // once settled, the next miss calls the API again
    await cached.getQuote();
    assert.equal(calls, 2);
  });
});

describe('e-mail templates', () => {
  it('formats BRL in Brazilian notation without floating point', () => {
    assert.equal(brl(123_456_789n), 'R$ 1.234.567,89');
    assert.equal(brl(5n), 'R$ 0,05');
  });

  it('renders the sale e-mail with BTC sold and BRL redeemed, escaping HTML', () => {
    const mail = emailTemplates.sell({
      to: 'a@b.com',
      name: '<Maria>',
      btcSats: 333_334n,
      amountCents: 100_000n,
      priceCents: 30_000_000n,
    });
    assert.equal(mail.subject, 'Venda de Bitcoin realizada');
    assert.match(mail.text, /vendeu 0\.00333334 BTC e resgatou R\$ 1\.000,00/);
    assert.ok(mail.html.includes('&lt;Maria&gt;'));
  });
});

import type { Redis } from 'ioredis';
import type { QuoteProvider } from '../../application/ports';
import type { Quote } from '../../domain/entities';
import type { Logger } from '../logger';

const FRESH_KEY = 'quote:btc:fresh';
const LAST_KEY = 'quote:btc:last';

interface CachedQuote {
  buy: string;
  sell: string;
  fetchedAt: string;
}

const serialize = (q: Quote): string =>
  JSON.stringify({
    buy: q.buyCents.toString(),
    sell: q.sellCents.toString(),
    fetchedAt: q.fetchedAt.toISOString(),
  });

const deserialize = (raw: string): Quote => {
  const c = JSON.parse(raw) as CachedQuote;
  return { buyCents: BigInt(c.buy), sellCents: BigInt(c.sell), fetchedAt: new Date(c.fetchedAt) };
};

/**
 * Redis cache in front of the quote API (shared by every API instance):
 *  - a fresh quote is reused for `ttlSeconds`, protecting the external API from bursts;
 *  - if the API fails, the last known quote (up to `staleMaxSeconds`) is used;
 *  - concurrent cache misses share a single external call (no thundering herd).
 */
export class CachedQuoteProvider implements QuoteProvider {
  private inFlight: Promise<Quote> | null = null;

  constructor(
    private readonly inner: QuoteProvider,
    private readonly redis: Redis,
    private readonly logger: Logger,
    private readonly options: { ttlSeconds: number; staleMaxSeconds?: number },
  ) {}

  async getQuote(): Promise<Quote> {
    const cached = await this.safeGet(FRESH_KEY);
    if (cached) return deserialize(cached);

    this.inFlight ??= this.fetchAndCache().finally(() => {
      this.inFlight = null;
    });
    return this.inFlight;
  }

  private async fetchAndCache(): Promise<Quote> {
    try {
      const quote = await this.inner.getQuote();
      const value = serialize(quote);
      await this.redis
        .multi()
        .set(FRESH_KEY, value, 'EX', this.options.ttlSeconds)
        .set(LAST_KEY, value, 'EX', this.options.staleMaxSeconds ?? 300)
        .exec()
        .catch((error: unknown) => this.logger.warn({ err: error }, 'Could not cache quote'));
      return quote;
    } catch (error) {
      const last = await this.safeGet(LAST_KEY);
      if (last) {
        this.logger.warn({ err: error }, 'Quote API failed, using last known quote');
        return deserialize(last);
      }
      throw error;
    }
  }

  private async safeGet(key: string): Promise<string | null> {
    try {
      return await this.redis.get(key);
    } catch (error) {
      this.logger.warn({ err: error }, 'Redis unavailable, skipping quote cache');
      return null;
    }
  }
}

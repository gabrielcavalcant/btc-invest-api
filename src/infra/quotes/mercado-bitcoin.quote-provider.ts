import { z } from 'zod';
import type { QuoteProvider } from '../../application/ports';
import type { Quote } from '../../domain/entities';
import { QuoteUnavailableError } from '../../domain/errors';
import { parseDecimal } from '../../domain/money';

// Response of https://www.mercadobitcoin.net/api/BTC/ticker/
const tickerSchema = z.object({
  ticker: z.object({
    buy: z.union([z.string(), z.number()]),
    sell: z.union([z.string(), z.number()]),
    date: z.number().optional(),
  }),
});

const toCents = (value: string | number) =>
  parseDecimal(typeof value === 'number' ? value.toFixed(8) : value, 2);

export class MercadoBitcoinQuoteProvider implements QuoteProvider {
  constructor(
    private readonly options: {
      url: string;
      timeoutMs: number;
      /** Extra attempts on network errors or 5xx (transient failures). */
      retries?: number;
      retryDelayMs?: number;
    },
  ) {}

  async getQuote(): Promise<Quote> {
    const retries = this.options.retries ?? 1;
    let body: unknown;
    for (let attempt = 0; ; attempt++) {
      try {
        body = await this.fetchTicker();
        break;
      } catch (error) {
        if (attempt >= retries || !isTransient(error)) {
          throw Object.assign(new QuoteUnavailableError(), { cause: error });
        }
        await new Promise((resolve) => setTimeout(resolve, this.options.retryDelayMs ?? 300));
      }
    }

    const parsed = tickerSchema.safeParse(body);
    if (!parsed.success) {
      throw Object.assign(new QuoteUnavailableError(), { cause: parsed.error });
    }
    const { buy, sell, date } = parsed.data.ticker;
    return {
      buyCents: toCents(buy),
      sellCents: toCents(sell),
      fetchedAt: date ? new Date(date * 1000) : new Date(),
    };
  }

  private async fetchTicker(): Promise<unknown> {
    const response = await fetch(this.options.url, {
      signal: AbortSignal.timeout(this.options.timeoutMs),
      headers: { accept: 'application/json' },
    });
    if (!response.ok) throw new HttpStatusError(response.status);
    return response.json();
  }
}

class HttpStatusError extends Error {
  constructor(readonly status: number) {
    super(`Mercado Bitcoin responded ${status}`);
  }
}

/** Network errors, timeouts and 5xx may work on a second try; 4xx and bad payloads will not. */
function isTransient(error: unknown): boolean {
  return error instanceof HttpStatusError ? error.status >= 500 : !(error instanceof SyntaxError);
}

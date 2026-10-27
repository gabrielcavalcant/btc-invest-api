import type { QuoteProvider } from '../../application/ports';
import type { Quote } from '../../domain/entities';

/**
 * Offline quote for local development and tests (QUOTE_PROVIDER=fake).
 * Oscillates smoothly around R$ 350.000,00 with a 0.5% spread.
 */
export class FakeQuoteProvider implements QuoteProvider {
  constructor(private readonly basePriceCents = 35_000_000n) {}

  async getQuote(): Promise<Quote> {
    const now = new Date();
    const wave = Math.sin(now.getTime() / (1000 * 60 * 30)); // ~3h period
    const buyCents = this.basePriceCents + BigInt(Math.round(wave * 500_000)); // ± R$ 5.000
    const sellCents = (buyCents * 1005n) / 1000n;
    return { buyCents, sellCents, fetchedAt: now };
  }
}

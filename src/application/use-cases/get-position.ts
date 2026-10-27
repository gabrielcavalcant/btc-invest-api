import type { Quote } from '../../domain/entities';
import { computePosition, type Position } from '../../domain/services/position';
import type { InvestmentRepository, QuoteProvider } from '../ports';

export class GetPosition {
  constructor(
    private readonly deps: { investments: InvestmentRepository; quotes: QuoteProvider },
  ) {}

  async execute(accountId: string): Promise<Position & { quote: Quote }> {
    const [quote, investments] = await Promise.all([
      this.deps.quotes.getQuote(),
      this.deps.investments.findOpenByAccount(accountId),
    ]);
    return { ...computePosition(investments, quote.buyCents), quote };
  }
}

import type { Quote } from '../../domain/entities';
import type { QuoteProvider } from '../ports';

export class GetQuote {
  constructor(private readonly deps: { quotes: QuoteProvider }) {}

  execute(): Promise<Quote> {
    return this.deps.quotes.getQuote();
  }
}

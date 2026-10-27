import type { PriceSnapshot } from '../../domain/entities';
import type { Clock, PriceHistoryRepository, QuoteProvider } from '../ports';

export const SNAPSHOT_INTERVAL_MINUTES = 10;
export const HISTORY_RETENTION_DAYS = 90;
const MINUTE_MS = 60 * 1000;
const DAY_MS = 24 * 60 * MINUTE_MS;

/** Floors a date to its 10-minute slot (08:07:31 -> 08:00:00, 08:13:00 -> 08:10:00). */
export function floorToSlot(date: Date, minutes = SNAPSHOT_INTERVAL_MINUTES): Date {
  const slot = minutes * MINUTE_MS;
  return new Date(Math.floor(date.getTime() / slot) * slot);
}

/** Runs every 10 minutes (job): stores the current quote in its slot. */
export class CapturePriceSnapshot {
  constructor(
    private readonly deps: { quotes: QuoteProvider; history: PriceHistoryRepository; clock: Clock },
  ) {}

  async execute(): Promise<PriceSnapshot> {
    const quote = await this.deps.quotes.getQuote();
    const snapshot: PriceSnapshot = {
      capturedAt: floorToSlot(this.deps.clock.now()),
      buyCents: quote.buyCents,
      sellCents: quote.sellCents,
    };
    await this.deps.history.save(snapshot);
    return snapshot;
  }
}

/** Buy/sell history of the last 24 hours, one point every 10 minutes. */
export class GetPriceHistory {
  constructor(private readonly deps: { history: PriceHistoryRepository; clock: Clock }) {}

  execute(): Promise<PriceSnapshot[]> {
    const to = this.deps.clock.now();
    return this.deps.history.findInRange(new Date(to.getTime() - DAY_MS), to);
  }
}

/** Runs daily (job): removes data older than 90 days. */
export class PurgeOldPriceHistory {
  constructor(private readonly deps: { history: PriceHistoryRepository; clock: Clock }) {}

  execute(): Promise<number> {
    const limit = new Date(this.deps.clock.now().getTime() - HISTORY_RETENTION_DAYS * DAY_MS);
    return this.deps.history.deleteOlderThan(limit);
  }
}

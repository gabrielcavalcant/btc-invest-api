import { TransactionType } from '../../domain/entities';
import type { Clock, TransactionRepository } from '../ports';

/** Start of the current day in the given IANA time zone, as an absolute instant. */
export function startOfDayInZone(now: Date, timeZone: string): Date {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  // Wall-clock time in the zone, read as if it were UTC -> difference = zone offset.
  const wallAsUtc = Date.UTC(
    get('year'),
    get('month') - 1,
    get('day'),
    get('hour'),
    get('minute'),
    get('second'),
  );
  const offsetMs = wallAsUtc - Math.floor(now.getTime() / 1000) * 1000;
  const midnightWallAsUtc = Date.UTC(get('year'), get('month') - 1, get('day'));
  return new Date(midnightWallAsUtc - offsetMs);
}

/**
 * Total BTC bought and sold on the platform in the current day.
 * Reinvestments are internal movements (the satoshis never left the platform), so they
 * are discounted from the liquidated volume.
 */
export class GetDailyVolume {
  constructor(
    private readonly deps: { transactions: TransactionRepository; clock: Clock; timeZone: string },
  ) {}

  async execute(): Promise<{ day: Date; boughtSats: bigint; soldSats: bigint }> {
    const now = this.deps.clock.now();
    const day = startOfDayInZone(now, this.deps.timeZone);
    const sums = await this.deps.transactions.sumBtcByTypeInRange(
      day,
      new Date(day.getTime() + 24 * 60 * 60 * 1000),
    );
    const boughtSats = sums[TransactionType.PURCHASE] ?? 0n;
    const soldSats =
      (sums[TransactionType.SELL] ?? 0n) - (sums[TransactionType.REINVESTMENT] ?? 0n);
    return { day, boughtSats, soldSats };
  }
}

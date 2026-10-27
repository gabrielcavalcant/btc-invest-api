import { ValidationError } from './errors';

/**
 * All monetary math is done with integers (bigint) to avoid floating point errors:
 *  - BRL amounts are stored in cents      (R$ 1,00   = 100n)
 *  - BTC amounts are stored in satoshis   (1 BTC     = 100_000_000n)
 *  - BTC prices are stored in cents/BTC   (R$ 350k   = 35_000_000n)
 */
export const CENTS_PER_REAL = 100n;
export const SATS_PER_BTC = 100_000_000n;

/** Biggest amount accepted in a single operation: R$ 1.000.000.000,00 */
export const MAX_OPERATION_CENTS = 1_000_000_000n * CENTS_PER_REAL;

const DECIMAL_RE = /^(\d+)(?:\.(\d+))?$/;
const USER_AMOUNT_RE = /^(\d{1,13})(?:\.(\d{1,2}))?$/;

function ceilDiv(a: bigint, b: bigint): bigint {
  return (a + b - 1n) / b;
}

/**
 * Parses a positive decimal string into an integer with `scale` decimal places,
 * rounding half up any extra digits. Used for third-party values (ticker).
 */
export function parseDecimal(value: string, scale: number): bigint {
  const match = DECIMAL_RE.exec(value.trim());
  if (!match) throw new ValidationError(`Invalid decimal value: "${value}"`);
  const [, intPart = '0', fracRaw = ''] = match;
  const frac = fracRaw.padEnd(scale + 1, '0');
  const kept = frac.slice(0, scale);
  const roundingDigit = Number(frac[scale] ?? '0');
  let result = BigInt(intPart) * 10n ** BigInt(scale) + BigInt(kept || '0');
  if (roundingDigit >= 5) result += 1n;
  return result;
}

/**
 * Parses an amount informed by the user (number or string, max 2 decimal places).
 * Rejects zero, negatives, more than 2 decimals and absurd values.
 */
export function parseUserAmountToCents(value: unknown): bigint {
  const asString = typeof value === 'number' ? String(value) : value;
  if (typeof asString !== 'string') throw new ValidationError('Amount must be a number');
  const match = USER_AMOUNT_RE.exec(asString.trim());
  if (!match) {
    throw new ValidationError('Amount must be a positive value with at most 2 decimal places');
  }
  const [, intPart = '0', frac = ''] = match;
  const cents = BigInt(intPart) * CENTS_PER_REAL + BigInt(frac.padEnd(2, '0'));
  if (cents <= 0n) throw new ValidationError('Amount must be greater than zero');
  if (cents > MAX_OPERATION_CENTS) throw new ValidationError('Amount exceeds the maximum allowed');
  return cents;
}

function formatScaled(value: bigint, scale: number): string {
  const negative = value < 0n;
  const abs = negative ? -value : value;
  const base = 10n ** BigInt(scale);
  const intPart = abs / base;
  const fracPart = (abs % base).toString().padStart(scale, '0');
  return `${negative ? '-' : ''}${intPart.toString()}.${fracPart}`;
}

/** 12345n -> "123.45" */
export const formatBrl = (cents: bigint): string => formatScaled(cents, 2);

/** 12345n -> "0.00012345" */
export const formatBtc = (sats: bigint): string => formatScaled(sats, 8);

/** How many satoshis R$ `cents` buys at `priceCents` per BTC (rounded down, never over-delivers). */
export function centsToSats(cents: bigint, priceCents: bigint): bigint {
  if (priceCents <= 0n) throw new ValidationError('BTC price must be positive');
  return (cents * SATS_PER_BTC) / priceCents;
}

/** Value in cents of `sats` at `priceCents` per BTC (rounded down). */
export function satsToCents(sats: bigint, priceCents: bigint): bigint {
  return (sats * priceCents) / SATS_PER_BTC;
}

/** Minimum satoshis that must be sold at `priceCents` to obtain at least R$ `cents`. */
export function satsNeededFor(cents: bigint, priceCents: bigint): bigint {
  if (priceCents <= 0n) throw new ValidationError('BTC price must be positive');
  return ceilDiv(cents * SATS_PER_BTC, priceCents);
}

/** Percentage variation from `from` to `to`, with 2 decimal places (half away from zero). */
export function percentVariation(from: bigint, to: bigint): number {
  if (from === 0n) return 0;
  const diff = to - from;
  const scaled = diff * 10_000n * 10n; // one extra digit for rounding
  let basisPoints = scaled / from;
  basisPoints = basisPoints >= 0n ? (basisPoints + 5n) / 10n : (basisPoints - 5n) / 10n;
  return Number(basisPoints) / 100;
}

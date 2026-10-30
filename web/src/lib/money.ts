/**
 * Money helpers. The API sends money as decimal strings ("1500.00", "0.00431234"); here they
 * are only formatted or converted with bigint, never with floating point, the same rule
 * the back-end follows.
 */

const SATS_PER_BTC = 100_000_000n;
const DECIMAL_RE = /^(-?)(\d+)(?:\.(\d+))?$/;

/** "1500.5" -> 150050n with scale 2. Throws on malformed input. */
export function toScaled(value: string, scale: number): bigint {
  const match = DECIMAL_RE.exec(value.trim());
  if (!match) throw new Error(`Invalid decimal: "${value}"`);
  const [, sign = '', int = '0', frac = ''] = match;
  const scaled =
    BigInt(int) * 10n ** BigInt(scale) + BigInt(frac.padEnd(scale, '0').slice(0, scale) || '0');
  return sign ? -scaled : scaled;
}

function groupThousands(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

function splitScaled(value: bigint, scale: number) {
  const negative = value < 0n;
  const abs = negative ? -value : value;
  const base = 10n ** BigInt(scale);
  return {
    sign: negative ? '-' : '',
    int: (abs / base).toString(),
    frac: (abs % base).toString().padStart(scale, '0'),
  };
}

/** 150050n, 2 -> "1500.50" (API format) */
export function toDecimal(value: bigint, scale: number): string {
  const { sign, int, frac } = splitScaled(value, scale);
  return `${sign}${int}.${frac}`;
}

/** 150050n, 2 -> "1.500,50" (pt-BR) */
function formatScaled(value: bigint, scale: number): string {
  const { sign, int, frac } = splitScaled(value, scale);
  return `${sign}${groupThousands(int)},${frac}`;
}

/** "10000.00" -> "R$ 10.000,00" */
export function formatBrl(value: string): string {
  const formatted = formatScaled(toScaled(value, 2), 2);
  return formatted.startsWith('-') ? `-R$ ${formatted.slice(1)}` : `R$ ${formatted}`;
}

/** "0.00697534" -> "0,00697534 BTC" */
export function formatBtc(value: string): string {
  return `${formatScaled(toScaled(value, 8), 8)} BTC`;
}

/** 12.5 -> "+12,50%", -3 -> "-3,00%" */
export function formatPercent(value: number): string {
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(2).replace('.', ',')}%`;
}

/** What the user can type in an amount field: "1500", "1500,50" or "1500.50". */
export const AMOUNT_INPUT_RE = /^\d{1,13}([.,]\d{1,2})?$/;

/** "1500,5" -> "1500.5" (the API format) */
export const normalizeAmount = (input: string) => input.trim().replace(',', '.');

/** BTC bought with R$ `amount` at `price` per BTC, rounded down like the API does. */
export function estimateBtcForPurchase(amount: string, price: string): string {
  const cents = toScaled(normalizeAmount(amount), 2);
  const priceCents = toScaled(price, 2);
  if (priceCents <= 0n) return '0.00000000';
  return toDecimal((cents * SATS_PER_BTC) / priceCents, 8);
}

/** BTC that must be sold at `price` to receive R$ `amount` (rounded up, like the API). */
export function estimateBtcForSale(amount: string, price: string): string {
  const cents = toScaled(normalizeAmount(amount), 2);
  const priceCents = toScaled(price, 2);
  if (priceCents <= 0n) return '0.00000000';
  return toDecimal((cents * SATS_PER_BTC + priceCents - 1n) / priceCents, 8);
}

/**
 * Variation (%) from `from` to `to`, with 2 decimal places rounded half away from zero:
 * the same rule the API uses for each investment. 0 when `from` is zero.
 */
export function percentChange(from: string, to: string): number {
  const a = toScaled(from, 2);
  if (a === 0n) return 0;
  const tenthsOfBasisPoint = ((toScaled(to, 2) - a) * 100_000n) / a; // one extra digit
  const basisPoints =
    tenthsOfBasisPoint >= 0n ? (tenthsOfBasisPoint + 5n) / 10n : (tenthsOfBasisPoint - 5n) / 10n;
  return Number(basisPoints) / 100;
}

/** a > b for decimal strings */
export const isGreater = (a: string, b: string) => toScaled(normalizeAmount(a), 8) > toScaled(b, 8);

import { z } from 'zod';
import { startOfDayInZone } from '../application/use-cases/get-daily-volume';
import { parseUserAmountToCents } from '../domain/money';

/** Input validation of every endpoint (zod). Errors become HTTP 400. */

export const registerBody = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().toLowerCase().email().max(254),
  // bcrypt only considers the first 72 bytes
  password: z.string().min(8).max(72),
});

export const loginBody = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(1).max(72),
});

/** { "amount": 150.5 } or { "amount": "150.50" } -> 15050n cents */
export const amountBody = z
  .object({ amount: z.union([z.number(), z.string()]) })
  .transform(({ amount }) => ({ amountCents: parseUserAmountToCents(amount) }));

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Accepts full ISO 8601 date-times or plain dates (YYYY-MM-DD). Plain dates are read in
 * the app time zone; for `to` the whole day is included.
 */
function dateParam(edge: 'start' | 'end', timeZone: string) {
  return z
    .string()
    .trim()
    .refine((v) => !Number.isNaN(Date.parse(v)), { message: 'Invalid date, use ISO 8601' })
    .transform((v) => {
      if (!DATE_ONLY.test(v)) return new Date(v);
      const noonUtc = new Date(`${v}T12:00:00Z`);
      const start = startOfDayInZone(noonUtc, timeZone);
      return edge === 'start' ? start : new Date(start.getTime() + DAY_MS - 1);
    });
}

export function statementQuery(timeZone: string) {
  return z.object({
    from: dateParam('start', timeZone).optional(),
    to: dateParam('end', timeZone).optional(),
  });
}

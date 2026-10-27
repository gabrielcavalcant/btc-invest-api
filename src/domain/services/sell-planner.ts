import type { Investment } from '../entities';
import { InsufficientFundsError } from '../errors';
import { satsNeededFor, satsToCents } from '../money';

export interface Liquidation {
  investment: Investment;
  /** The whole investment is liquidated (all of its satoshis). */
  sats: bigint;
  /** BRL obtained by selling all of its satoshis at the current bid. */
  cents: bigint;
}

export interface Reinvestment {
  origin: Investment;
  /** Residual BRL: what was liquidated beyond the requested amount. It is reinvested. */
  cents: bigint;
  /** Satoshis that were not needed for the withdrawal and go back to the portfolio. */
  sats: bigint;
  /** ORIGINAL BTC price of the liquidated investment (the reinvestment keeps it). */
  priceCents: bigint;
  /** Cost basis of the new investment, calculated with the original price. */
  investedCents: bigint;
  /** Keeps the original purchase date, so FIFO order and the variation are preserved. */
  purchasedAt: Date;
}

export interface SellPlan {
  liquidations: Liquidation[];
  reinvestment: Reinvestment | null;
  /**
   * Net BRL that goes back to the account. Equals the requested amount, except in a
   * rounding edge case where every satoshi was needed: the sub-cent dust goes to the customer.
   */
  creditedCents: bigint;
  /** Net BTC that left the portfolio (liquidated sats minus reinvested sats). */
  soldSats: bigint;
}

/**
 * Plans a withdrawal of `targetCents` from the investments, FIFO (oldest first),
 * at the current bid price.
 *
 * Spec rule: on a partial sale the investment is liquidated completely and the residual
 * value is reinvested using the original BTC quote; both movements go to the statement.
 *
 * Interpretation (see README): the residual value is exactly the market value of the
 * satoshis that were not needed, so the reinvestment buys back those same satoshis and
 * registers them with the original quote as cost basis. No BTC is created or destroyed,
 * the balance receives exactly the requested amount and the investment keeps its
 * original price variation.
 */
export function planSell(
  openInvestments: readonly Investment[],
  targetCents: bigint,
  bidCents: bigint,
): SellPlan {
  const ordered = [...openInvestments].sort(
    (a, b) => a.purchasedAt.getTime() - b.purchasedAt.getTime() || a.id.localeCompare(b.id),
  );

  const available = ordered.reduce((sum, inv) => sum + satsToCents(inv.btcSats, bidCents), 0n);
  if (targetCents > available) {
    throw new InsufficientFundsError(
      'Requested amount is greater than the current value of your investments',
    );
  }

  const liquidations: Liquidation[] = [];
  let reinvestment: Reinvestment | null = null;
  let remaining = targetCents;
  let creditedCents = targetCents;

  for (const investment of ordered) {
    if (remaining <= 0n) break;

    const value = satsToCents(investment.btcSats, bidCents);
    liquidations.push({ investment, sats: investment.btcSats, cents: value });

    if (value <= remaining) {
      remaining -= value;
      continue;
    }

    // Partial sale: the investment is fully liquidated and the residual is reinvested.
    const keptSats = investment.btcSats - satsNeededFor(remaining, bidCents);
    const residual = value - remaining;
    if (keptSats > 0n) {
      reinvestment = {
        origin: investment,
        cents: residual,
        sats: keptSats,
        priceCents: investment.priceCents,
        investedCents: satsToCents(keptSats, investment.priceCents),
        purchasedAt: investment.purchasedAt,
      };
    } else {
      creditedCents += residual;
    }
    remaining = 0n;
  }

  const liquidatedSats = liquidations.reduce((sum, l) => sum + l.sats, 0n);
  const soldSats = liquidatedSats - (reinvestment?.sats ?? 0n);

  return { liquidations, reinvestment, creditedCents, soldSats };
}

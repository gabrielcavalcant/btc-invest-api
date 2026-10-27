import type { Investment } from '../entities';
import { percentVariation, satsToCents } from '../money';

export interface InvestmentPosition {
  id: string;
  purchasedAt: Date;
  investedCents: bigint;
  btcSats: bigint;
  priceAtPurchaseCents: bigint;
  /** Variation (%) between the BTC price at purchase and the current bid. */
  priceVariationPercent: number;
  /** Gross value if sold now, at the current bid. */
  currentGrossCents: bigint;
}

export interface Position {
  investments: InvestmentPosition[];
  totals: {
    investedCents: bigint;
    btcSats: bigint;
    currentGrossCents: bigint;
  };
}

/**
 * The current value uses the BUY (bid) price: it is what the customer would receive
 * if the position were sold now.
 */
export function computePosition(investments: readonly Investment[], bidCents: bigint): Position {
  const items = [...investments]
    .sort((a, b) => a.purchasedAt.getTime() - b.purchasedAt.getTime())
    .map<InvestmentPosition>((inv) => ({
      id: inv.id,
      purchasedAt: inv.purchasedAt,
      investedCents: inv.investedCents,
      btcSats: inv.btcSats,
      priceAtPurchaseCents: inv.priceCents,
      priceVariationPercent: percentVariation(inv.priceCents, bidCents),
      currentGrossCents: satsToCents(inv.btcSats, bidCents),
    }));

  return {
    investments: items,
    totals: {
      investedCents: items.reduce((s, i) => s + i.investedCents, 0n),
      btcSats: items.reduce((s, i) => s + i.btcSats, 0n),
      currentGrossCents: items.reduce((s, i) => s + i.currentGrossCents, 0n),
    },
  };
}

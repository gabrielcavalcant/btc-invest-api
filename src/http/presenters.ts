import type { PriceSnapshot, Quote, Transaction } from '../domain/entities';
import { formatBrl, formatBtc } from '../domain/money';
import type { Position } from '../domain/services/position';

/**
 * Converts internal values (bigint cents/satoshis) to the JSON contract.
 * Money goes out as decimal strings ("1500.00", "0.00431234") so no precision is lost
 * in JavaScript clients; dates as ISO 8601.
 */

const optionalBtc = (v: bigint | null) => (v === null ? null : formatBtc(v));
const optionalBrl = (v: bigint | null) => (v === null ? null : formatBrl(v));

export const presentQuote = (q: Quote) => ({
  buy: formatBrl(q.buyCents),
  sell: formatBrl(q.sellCents),
  date: q.fetchedAt.toISOString(),
});

export const presentTransaction = (t: Transaction) => ({
  id: t.id,
  type: t.type,
  date: t.createdAt.toISOString(),
  amount: formatBrl(t.amountCents),
  btcAmount: optionalBtc(t.btcSats),
  btcPrice: optionalBrl(t.btcPriceCents),
  investmentId: t.investmentId,
});

export const presentPosition = (p: Position & { quote: Quote }) => ({
  quote: presentQuote(p.quote),
  investments: p.investments.map((i) => ({
    id: i.id,
    purchasedAt: i.purchasedAt.toISOString(),
    investedAmount: formatBrl(i.investedCents),
    btcAmount: formatBtc(i.btcSats),
    btcPriceAtPurchase: formatBrl(i.priceAtPurchaseCents),
    priceVariationPercent: i.priceVariationPercent,
    currentGrossAmount: formatBrl(i.currentGrossCents),
  })),
  totals: {
    investedAmount: formatBrl(p.totals.investedCents),
    btcAmount: formatBtc(p.totals.btcSats),
    currentGrossAmount: formatBrl(p.totals.currentGrossCents),
  },
});

export const presentSnapshot = (s: PriceSnapshot) => ({
  date: s.capturedAt.toISOString(),
  buy: formatBrl(s.buyCents),
  sell: formatBrl(s.sellCents),
});

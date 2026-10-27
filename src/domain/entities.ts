/**
 * Plain domain entities. Money is always bigint (cents / satoshis), see money.ts.
 * Persistence mapping lives in infra/database and never leaks here.
 */

export interface Account {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  balanceCents: bigint;
  createdAt: Date;
}

export interface Investment {
  id: string;
  accountId: string;
  /** Amount of BTC held by this investment. */
  btcSats: bigint;
  /** Amount in BRL this investment cost (cost basis). */
  investedCents: bigint;
  /** BTC price (cents/BTC) used when this investment was created. */
  priceCents: bigint;
  purchasedAt: Date;
  liquidatedAt: Date | null;
  /** Set when this investment is the residual reinvestment of a partial sale. */
  originInvestmentId: string | null;
}

export const TransactionType = {
  DEPOSIT: 'DEPOSIT',
  PURCHASE: 'PURCHASE',
  SELL: 'SELL',
  REINVESTMENT: 'REINVESTMENT',
} as const;
export type TransactionType = (typeof TransactionType)[keyof typeof TransactionType];

/** Statement (extrato) entry. Amounts are always positive; the type gives the direction. */
export interface Transaction {
  id: string;
  accountId: string;
  type: TransactionType;
  amountCents: bigint;
  btcSats: bigint | null;
  btcPriceCents: bigint | null;
  investmentId: string | null;
  createdAt: Date;
}

/** BTC quote. `buy` = price the market pays you (bid), `sell` = price you pay (ask). */
export interface Quote {
  buyCents: bigint;
  sellCents: bigint;
  fetchedAt: Date;
}

export interface PriceSnapshot {
  capturedAt: Date;
  buyCents: bigint;
  sellCents: bigint;
}

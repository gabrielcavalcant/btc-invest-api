/** JSON contract of the BTC Invest API. Money is always a decimal string. */

export interface Quote {
  buy: string;
  sell: string;
  date: string;
}

export interface Investment {
  id: string;
  purchasedAt: string;
  investedAmount: string;
  btcAmount: string;
  btcPriceAtPurchase: string;
  priceVariationPercent: number;
  currentGrossAmount: string;
}

export interface Position {
  quote: Quote;
  investments: Investment[];
  totals: { investedAmount: string; btcAmount: string; currentGrossAmount: string };
}

export type TransactionType = 'DEPOSIT' | 'PURCHASE' | 'SELL' | 'REINVESTMENT';

export interface Transaction {
  id: string;
  type: TransactionType;
  date: string;
  amount: string;
  btcAmount: string | null;
  btcPrice: string | null;
  investmentId: string | null;
}

export interface Statement {
  from: string;
  to: string;
  items: Transaction[];
}

export interface PriceSnapshot {
  date: string;
  buy: string;
  sell: string;
}

export interface DailyVolume {
  day: string;
  buy: string;
  sell: string;
}

export interface DepositResult {
  id: string;
  amount: string;
  balance: string;
  date: string;
}

export interface PurchaseResult {
  investmentId: string;
  amount: string;
  btcAmount: string;
  btcPrice: string;
  balance: string;
  date: string;
}

export interface SellResult {
  amount: string;
  btcAmount: string;
  btcPrice: string;
  balance: string;
  liquidatedInvestments: string[];
  reinvestment: {
    investmentId: string;
    amount: string;
    btcAmount: string;
    btcPrice: string;
  } | null;
  date: string;
}

export interface ApiErrorBody {
  error: { code: string; message: string; details?: { field: string; message: string }[] };
}

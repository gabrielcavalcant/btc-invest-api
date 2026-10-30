import { request } from './client';
import type {
  DailyVolume,
  DepositResult,
  Position,
  PriceSnapshot,
  PurchaseResult,
  Quote,
  SellResult,
  Statement,
} from './types';

/** One function per API endpoint. */
export const api = {
  register: (input: { name: string; email: string; password: string }) =>
    request<{ id: string; name: string; email: string }>('/account', {
      method: 'POST',
      body: input,
    }),
  login: (input: { email: string; password: string }) =>
    request<{ token: string }>('/login', { method: 'POST', body: input }),

  balance: () => request<{ balance: string }>('/account/balance'),
  deposit: (amount: string) =>
    request<DepositResult>('/account/deposit', { method: 'POST', body: { amount } }),

  quote: () => request<Quote>('/btc/price'),
  position: () => request<Position>('/btc'),
  purchase: (amount: string) =>
    request<PurchaseResult>('/btc/purchase', { method: 'POST', body: { amount } }),
  sell: (amount: string) => request<SellResult>('/btc/sell', { method: 'POST', body: { amount } }),

  statement: (range: { from?: string; to?: string }) =>
    request<Statement>('/extract', {
      query: Object.fromEntries(Object.entries(range).filter(([, v]) => v)) as Record<
        string,
        string
      >,
    }),
  volume: () => request<DailyVolume>('/volume'),
  history: () => request<PriceSnapshot[]>('/history'),
};

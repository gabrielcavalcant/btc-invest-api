import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../lib/query-client';
import { api } from './endpoints';
import type { DepositResult, PurchaseResult, SellResult } from './types';

/** Data hooks: cache, loading and refresh for every screen. */

export const useBalance = () => useQuery({ queryKey: queryKeys.balance, queryFn: api.balance });

/** The API caches the quote for 10 s, so refreshing faster brings nothing new. */
export const useQuote = () =>
  useQuery({ queryKey: queryKeys.quote, queryFn: api.quote, refetchInterval: 10_000 });

export const usePosition = () =>
  useQuery({ queryKey: queryKeys.position, queryFn: api.position, refetchInterval: 30_000 });

export const useStatement = (from?: string, to?: string) =>
  useQuery({ queryKey: queryKeys.statement(from, to), queryFn: () => api.statement({ from, to }) });

export const useVolume = () =>
  useQuery({ queryKey: queryKeys.volume, queryFn: api.volume, refetchInterval: 60_000 });

export const useHistory = () =>
  useQuery({ queryKey: queryKeys.history, queryFn: api.history, refetchInterval: 60_000 });

export type Operation = 'deposit' | 'purchase' | 'sell';
export type OperationResult = DepositResult | PurchaseResult | SellResult;

const OPERATIONS: Record<Operation, (amount: string) => Promise<OperationResult>> = {
  deposit: api.deposit,
  purchase: api.purchase,
  sell: api.sell,
};

/** Deposit, purchase or sale; afterwards refreshes everything the operation changed. */
export function useOperation(operation: Operation) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (amount: string) => OPERATIONS[operation](amount),
    onSuccess: (result) => {
      // Every operation answers with the new balance: no window with a stale value
      client.setQueryData(queryKeys.balance, { balance: result.balance });
      return Promise.all(
        [queryKeys.balance, queryKeys.position, ['statement'], queryKeys.volume].map((queryKey) =>
          client.invalidateQueries({ queryKey }),
        ),
      );
    },
  });
}

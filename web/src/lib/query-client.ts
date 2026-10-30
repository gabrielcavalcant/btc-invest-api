import { QueryClient } from '@tanstack/react-query';
import { ApiError } from '../api/client';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5_000,
      refetchOnWindowFocus: true,
      // client errors (401, 404...) will not change by trying again
      retry: (failureCount, error) =>
        failureCount < 2 &&
        !(error instanceof ApiError && error.status >= 400 && error.status < 500),
    },
  },
});

/** Query keys in one place, so mutations invalidate exactly what changed. */
export const queryKeys = {
  balance: ['balance'] as const,
  quote: ['quote'] as const,
  position: ['position'] as const,
  statement: (from?: string, to?: string) => ['statement', from ?? '', to ?? ''] as const,
  volume: ['volume'] as const,
  history: ['history'] as const,
};

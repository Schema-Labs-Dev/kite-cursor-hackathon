import { QueryClient } from '@tanstack/react-query';
import { ApiError } from './api';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      retry: (failureCount, error) => {
        if (error instanceof ApiError) {
          if (error.status === 401 || error.status === 403) return false;
          if (error.status >= 400 && error.status < 500) return false;
        }
        return failureCount < 2;
      },
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: false,
    },
  },
});

export const qk = {
  me: ['me'] as const,
  treasuryInfo: ['treasury', 'info'] as const,
  treasuryBalance: (address: string) => ['treasury', 'balance', address] as const,
  transactions: ['transactions'] as const,
  contacts: ['contacts'] as const,
  resolveUser: (q: string) => ['users', 'resolve', q] as const,
  basenameAvailability: (handle: string) =>
    ['basenames', 'check', handle] as const,
};

import { useInfiniteQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { TransactionsPage } from '@/lib/api-types';
import { qk } from '@/lib/query';

export function useTransactions(limit = 20) {
  return useInfiniteQuery({
    queryKey: [...qk.transactions, limit],
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) => {
      const params = new URLSearchParams({ limit: String(limit) });
      if (pageParam) params.set('cursor', pageParam);
      return api.get<TransactionsPage>(`/transactions?${params.toString()}`);
    },
    getNextPageParam: (last) => last.nextCursor,
  });
}

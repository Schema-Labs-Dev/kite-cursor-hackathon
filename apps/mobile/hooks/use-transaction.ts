import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '@/lib/api';
import type { ApiTransaction, TransactionsPage } from '@/lib/api-types';
import { qk } from '@/lib/query';

/**
 * Single-tx fetcher. Tries the TanStack cache (the list query) first; only
 * hits the network if it's not already there. Used by tx-detail when the
 * user opens a deep link or navigates from a freshly-arrived push.
 */
export function useTransaction(id: string | undefined) {
  const qc = useQueryClient();
  return useQuery<ApiTransaction | null>({
    queryKey: ['transaction', id],
    enabled: Boolean(id),
    queryFn: async () => {
      if (!id) return null;
      const fromCache = findInCache(qc, id);
      if (fromCache) return fromCache;
      try {
        return await api.get<ApiTransaction>(`/transactions/${encodeURIComponent(id)}`);
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) return null;
        throw err;
      }
    },
  });
}

function findInCache(qc: ReturnType<typeof useQueryClient>, id: string): ApiTransaction | null {
  const cache = qc.getQueriesData<{ pages: TransactionsPage[] }>({ queryKey: qk.transactions });
  for (const [, data] of cache) {
    if (!data) continue;
    for (const page of data.pages) {
      const hit = page.items.find((tx) => tx.id === id);
      if (hit) return hit;
    }
  }
  return null;
}

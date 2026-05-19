import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { ResolvedUser } from '@/lib/api-types';
import { qk } from '@/lib/query';

export function useResolveUser(query: string) {
  const debounced = useDebounced(query.trim(), 250);
  return useQuery<{ results: ResolvedUser[] }>({
    queryKey: qk.resolveUser(debounced),
    enabled: debounced.length >= 2,
    queryFn: () =>
      api.get<{ results: ResolvedUser[] }>(
        `/users/resolve?q=${encodeURIComponent(debounced)}`,
      ),
  });
}

function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return debounced;
}

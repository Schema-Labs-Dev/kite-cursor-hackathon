import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { qk } from '@/lib/query';

export type AvailabilityResult = {
  handle: string;
  fullName: string;
  available: boolean;
  onchain: boolean | null;
  reservedInKite: boolean;
};

export function useBasenameAvailability(handle: string) {
  const debounced = useDebounced(handle.trim().toLowerCase(), 300);
  return useQuery<AvailabilityResult>({
    queryKey: qk.basenameAvailability(debounced),
    enabled: debounced.length >= 2,
    queryFn: () =>
      api.get<AvailabilityResult>(
        `/basenames/check/${encodeURIComponent(debounced)}`,
        { auth: false },
      ),
    staleTime: 30_000,
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

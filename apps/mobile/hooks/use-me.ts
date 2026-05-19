import { useQuery } from '@tanstack/react-query';
import { api, ApiError } from '@/lib/api';
import { getToken } from '@/lib/auth-storage';
import type { Me } from '@/lib/api-types';
import { qk } from '@/lib/query';

export function useMe() {
  return useQuery<Me | null>({
    queryKey: qk.me,
    queryFn: async () => {
      const token = await getToken();
      if (!token) return null;
      try {
        return await api.get<Me>('/me');
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) return null;
        throw err;
      }
    },
  });
}

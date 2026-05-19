import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { qk } from '@/lib/query';

export type Contact = {
  userId: string;
  walletAddress: `0x${string}`;
  basename: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  lastTxAt: string;
};

export function useContacts() {
  return useQuery<{ items: Contact[] }>({
    queryKey: qk.contacts,
    queryFn: () => api.get<{ items: Contact[] }>('/contacts'),
    staleTime: 60_000,
  });
}

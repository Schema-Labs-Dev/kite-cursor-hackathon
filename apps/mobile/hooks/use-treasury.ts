import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { TreasuryBalance, TreasuryInfo } from '@/lib/api-types';
import { qk } from '@/lib/query';

export function useTreasuryInfo() {
  return useQuery<TreasuryInfo>({
    queryKey: qk.treasuryInfo,
    queryFn: () => api.get<TreasuryInfo>('/treasury/info', { auth: false }),
    staleTime: 5 * 60_000,
  });
}

export function useBalance(walletAddress: string | undefined) {
  return useQuery<TreasuryBalance>({
    queryKey: qk.treasuryBalance(walletAddress ?? '-'),
    enabled: Boolean(walletAddress),
    queryFn: () => api.get<TreasuryBalance>('/treasury/balance'),
    refetchInterval: 10_000,
  });
}
